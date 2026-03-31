package com.example.demo.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class VnPayService {

    static final DateTimeFormatter VNP_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Value("${vnpay.tmn-code:}")
    String tmnCode;

    @Value("${vnpay.hash-secret:}")
    String hashSecret;

    @Value("${vnpay.pay-url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}")
    String payUrl;

    @Value("${vnpay.return-url:}")
    String returnUrl;

    @Value("${vnpay.order-type:other}")
    String orderType;

    @Value("${vnpay.locale:vn}")
    String locale;

    @Value("${vnpay.expire-minutes:15}")
    int expireMinutes;

    public boolean isConfigured() {
        return StringUtils.hasText(tmnCode)
                && StringUtils.hasText(hashSecret)
                && StringUtils.hasText(payUrl)
                && StringUtils.hasText(returnUrl);
    }

    public String generateTxnRef(String bookingId) {
        String compactBookingId = StringUtils.hasText(bookingId)
                ? bookingId.replace("-", "")
                : UUID.randomUUID().toString().replace("-", "");
        String randomSuffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String candidate = "BK" + compactBookingId + randomSuffix;
        return candidate.length() > 96 ? candidate.substring(0, 96) : candidate;
    }

    public String buildPaymentUrl(String txnRef,
                                  BigDecimal amount,
                                  String ipAddress,
                                  String orderInfo) {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDateTime expireAt = now.plusMinutes(Math.max(5, expireMinutes));

        Map<String, String> params = new LinkedHashMap<>();
        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", tmnCode);
        params.put("vnp_Amount", toVnpAmount(amount));
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", txnRef);
        params.put("vnp_OrderInfo", StringUtils.hasText(orderInfo) ? orderInfo : "Thanh toan RideUp");
        params.put("vnp_OrderType", StringUtils.hasText(orderType) ? orderType : "other");
        params.put("vnp_Locale", StringUtils.hasText(locale) ? locale : "vn");
        params.put("vnp_ReturnUrl", returnUrl);
        params.put("vnp_IpAddr", StringUtils.hasText(ipAddress) ? ipAddress : "127.0.0.1");
        params.put("vnp_CreateDate", now.format(VNP_TIME_FORMAT));
        params.put("vnp_ExpireDate", expireAt.format(VNP_TIME_FORMAT));

        String hashData = buildQuery(params);
        String secureHash = hmacSha512(hashSecret, hashData);

        String queryString = buildQuery(params);
        return payUrl + "?" + queryString + "&vnp_SecureHash=" + secureHash;
    }

    public boolean verifyReturn(Map<String, String> requestParams) {
        if (requestParams == null || requestParams.isEmpty() || !StringUtils.hasText(hashSecret)) {
            return false;
        }
        String providedHash = requestParams.get("vnp_SecureHash");
        if (!StringUtils.hasText(providedHash)) {
            return false;
        }

        Map<String, String> filtered = new LinkedHashMap<>();
        requestParams.forEach((k, v) -> {
            if (!"vnp_SecureHash".equals(k) && !"vnp_SecureHashType".equals(k) && StringUtils.hasText(v)) {
                filtered.put(k, v);
            }
        });

        String hashData = buildQuery(filtered);
        String expectedHash = hmacSha512(hashSecret, hashData);
        return expectedHash.equalsIgnoreCase(providedHash);
    }

    private String toVnpAmount(BigDecimal amount) {
        BigDecimal normalized = amount == null ? BigDecimal.ZERO : amount;
        return normalized
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .toPlainString();
    }

    private String buildQuery(Map<String, String> data) {
        List<Map.Entry<String, String>> entries = new ArrayList<>(data.entrySet());
        entries.sort(Comparator.comparing(Map.Entry::getKey));

        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, String> entry : entries) {
            String key = entry.getKey();
            String value = Objects.toString(entry.getValue(), "");
            if (!StringUtils.hasText(key) || !StringUtils.hasText(value)) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append('&');
            }
            builder.append(urlEncode(key)).append('=').append(urlEncode(value));
        }
        return builder.toString();
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.US_ASCII);
    }

    private String hmacSha512(String key, String data) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA512");
            SecretKeySpec secretKeySpec = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
            hmac.init(secretKeySpec);
            byte[] bytes = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hash = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hash.append(String.format("%02x", b));
            }
            return hash.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot sign VNPAY payload", ex);
        }
    }
}
