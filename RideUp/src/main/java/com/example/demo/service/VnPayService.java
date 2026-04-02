package com.example.demo.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
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

    @Value("${vnpay.refund-url:https://sandbox.vnpayment.vn/merchant_webapi/api/transaction}")
    String refundUrl;

    @Value("${vnpay.return-url:}")
    String returnUrl;

    @Value("${vnpay.order-type:other}")
    String orderType;

    @Value("${vnpay.locale:vn}")
    String locale;

    @Value("${vnpay.expire-minutes:15}")
    int expireMinutes;

    HttpClient httpClient = HttpClient.newHttpClient();

    public record RefundResult(boolean success, String responseCode, String message) {
    }

    public record QueryResult(boolean success,
                              String responseCode,
                              String message,
                              String providerTransactionId,
                              String payDate) {
    }

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
        params.put("vnp_OrderInfo", StringUtils.hasText(orderInfo) ? orderInfo : "Thanh toán RideUp");
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

    public RefundResult refund(String txnRef,
                               String providerTransactionId,
                               BigDecimal amount,
                               LocalDateTime paidAt,
                               String ipAddress,
                               String orderInfo) {
        if (!isConfigured() || !StringUtils.hasText(refundUrl)) {
            return new RefundResult(false, "CONFIG", "VNPAY refund is not configured");
        }
        if (!StringUtils.hasText(txnRef)
                || !StringUtils.hasText(providerTransactionId)
                || amount == null
                || paidAt == null) {
            return new RefundResult(false, "INPUT", "Missing required refund parameters");
        }

        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        String requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String amountText = toVnpAmount(amount);
        String createDate = now.format(VNP_TIME_FORMAT);
        String transDate = paidAt.format(VNP_TIME_FORMAT);
        String createBy = "RideUpSystem";
        String safeIp = StringUtils.hasText(ipAddress) ? ipAddress : "127.0.0.1";
        String safeOrderInfo = StringUtils.hasText(orderInfo) ? orderInfo : "RideUp refund";

        String hashData = String.join("|",
                requestId,
                "2.1.0",
                "refund",
                tmnCode,
                "02",
                txnRef,
                amountText,
                providerTransactionId,
                transDate,
                createBy,
                createDate,
                safeIp,
                safeOrderInfo
        );
        String secureHash = hmacSha512(hashSecret, hashData);

        String body = "{" +
                "\"vnp_RequestId\":\"" + jsonEscape(requestId) + "\"," +
                "\"vnp_Version\":\"2.1.0\"," +
                "\"vnp_Command\":\"refund\"," +
                "\"vnp_TmnCode\":\"" + jsonEscape(tmnCode) + "\"," +
                "\"vnp_TransactionType\":\"02\"," +
                "\"vnp_TxnRef\":\"" + jsonEscape(txnRef) + "\"," +
                "\"vnp_Amount\":\"" + jsonEscape(amountText) + "\"," +
                "\"vnp_TransactionNo\":\"" + jsonEscape(providerTransactionId) + "\"," +
                "\"vnp_TransactionDate\":\"" + jsonEscape(transDate) + "\"," +
                "\"vnp_CreateBy\":\"" + jsonEscape(createBy) + "\"," +
                "\"vnp_CreateDate\":\"" + jsonEscape(createDate) + "\"," +
                "\"vnp_IpAddr\":\"" + jsonEscape(safeIp) + "\"," +
                "\"vnp_OrderInfo\":\"" + jsonEscape(safeOrderInfo) + "\"," +
                "\"vnp_SecureHash\":\"" + jsonEscape(secureHash) + "\"" +
                "}";

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(refundUrl))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String responseBody = response.body() == null ? "" : response.body();
                String responseCode = firstNonBlank(
                    extractJsonField(responseBody, "vnp_ResponseCode"),
                    extractJsonField(responseBody, "response_code"),
                    extractJsonField(responseBody, "ResponseCode")
                );
                String transactionStatus = firstNonBlank(
                    extractJsonField(responseBody, "vnp_TransactionStatus"),
                    extractJsonField(responseBody, "transaction_status"),
                    extractJsonField(responseBody, "TransactionStatus")
                );
            String message = extractJsonField(responseBody, "vnp_Message");

                boolean success = isAcceptedSuccessCode(responseCode) || isAcceptedSuccessCode(transactionStatus);
            return new RefundResult(success, responseCode, StringUtils.hasText(message) ? message : responseBody);
        } catch (Exception ex) {
            return new RefundResult(false, "EXCEPTION", ex.getMessage());
        }
    }

    public QueryResult queryTransaction(String txnRef,
                                        LocalDateTime transactionDate,
                                        String ipAddress,
                                        String orderInfo) {
        if (!isConfigured() || !StringUtils.hasText(refundUrl)) {
            return new QueryResult(false, "CONFIG", "VNPAY query is not configured", null, null);
        }
        if (!StringUtils.hasText(txnRef) || transactionDate == null) {
            return new QueryResult(false, "INPUT", "Missing required query parameters", null, null);
        }

        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        String requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String createDate = now.format(VNP_TIME_FORMAT);
        String transDate = transactionDate.format(VNP_TIME_FORMAT);
        String safeIp = StringUtils.hasText(ipAddress) ? ipAddress : "127.0.0.1";
        String safeOrderInfo = StringUtils.hasText(orderInfo) ? orderInfo : "RideUp query";

        String hashData = String.join("|",
                requestId,
                "2.1.0",
                "querydr",
                tmnCode,
                txnRef,
                transDate,
                createDate,
                safeIp,
                safeOrderInfo
        );
        String secureHash = hmacSha512(hashSecret, hashData);

        String body = "{" +
                "\"vnp_RequestId\":\"" + jsonEscape(requestId) + "\"," +
                "\"vnp_Version\":\"2.1.0\"," +
                "\"vnp_Command\":\"querydr\"," +
                "\"vnp_TmnCode\":\"" + jsonEscape(tmnCode) + "\"," +
                "\"vnp_TxnRef\":\"" + jsonEscape(txnRef) + "\"," +
                "\"vnp_OrderInfo\":\"" + jsonEscape(safeOrderInfo) + "\"," +
                "\"vnp_TransactionDate\":\"" + jsonEscape(transDate) + "\"," +
                "\"vnp_CreateDate\":\"" + jsonEscape(createDate) + "\"," +
                "\"vnp_IpAddr\":\"" + jsonEscape(safeIp) + "\"," +
                "\"vnp_SecureHash\":\"" + jsonEscape(secureHash) + "\"" +
                "}";

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(refundUrl))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String responseBody = response.body() == null ? "" : response.body();
                String responseCode = firstNonBlank(
                    extractJsonField(responseBody, "vnp_ResponseCode"),
                    extractJsonField(responseBody, "response_code"),
                    extractJsonField(responseBody, "ResponseCode")
                );
            String message = extractJsonField(responseBody, "vnp_Message");
            String providerTransactionId = extractJsonField(responseBody, "vnp_TransactionNo");
            String payDate = extractJsonField(responseBody, "vnp_PayDate");

                boolean success = isAcceptedSuccessCode(responseCode);
            return new QueryResult(
                    success,
                    responseCode,
                    StringUtils.hasText(message) ? message : responseBody,
                    StringUtils.hasText(providerTransactionId) ? providerTransactionId : null,
                    StringUtils.hasText(payDate) ? payDate : null
            );
        } catch (Exception ex) {
            return new QueryResult(false, "EXCEPTION", ex.getMessage(), null, null);
        }
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

    private String jsonEscape(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }

    private String extractJsonField(String json, String fieldName) {
        if (!StringUtils.hasText(json) || !StringUtils.hasText(fieldName)) {
            return "";
        }
        String marker = "\"" + fieldName + "\"";
        int markerPos = json.indexOf(marker);
        if (markerPos < 0) {
            return "";
        }
        int colonPos = json.indexOf(':', markerPos + marker.length());
        if (colonPos < 0) {
            return "";
        }
        int valueStart = colonPos + 1;
        while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart))) {
            valueStart++;
        }
        if (valueStart >= json.length()) {
            return "";
        }

        if (json.charAt(valueStart) == '"') {
            int valueEnd = json.indexOf('"', valueStart + 1);
            if (valueEnd > valueStart) {
                return json.substring(valueStart + 1, valueEnd);
            }
            return "";
        }

        int valueEnd = valueStart;
        while (valueEnd < json.length()
                && json.charAt(valueEnd) != ','
                && json.charAt(valueEnd) != '}') {
            valueEnd++;
        }
        return json.substring(valueStart, valueEnd).trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null || values.length == 0) {
            return "";
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private boolean isAcceptedSuccessCode(String code) {
        if (!StringUtils.hasText(code)) {
            return false;
        }
        String normalized = code.trim();
        if (normalized.startsWith("\"") && normalized.endsWith("\"") && normalized.length() >= 2) {
            normalized = normalized.substring(1, normalized.length() - 1).trim();
        }
        return "00".equals(normalized) || "99".equals(normalized);
    }
}
