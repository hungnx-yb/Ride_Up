package com.example.demo.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class VnPayServiceTest {

    VnPayService vnPayService;

    @BeforeEach
    void setUp() {
        vnPayService = new VnPayService();
        ReflectionTestUtils.setField(vnPayService, "tmnCode", "TMN12345");
        ReflectionTestUtils.setField(vnPayService, "hashSecret", "SECRET12345");
        ReflectionTestUtils.setField(vnPayService, "payUrl", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        ReflectionTestUtils.setField(vnPayService, "returnUrl", "https://mywebsite.com/callback");
        ReflectionTestUtils.setField(vnPayService, "orderType", "other");
        ReflectionTestUtils.setField(vnPayService, "locale", "vn");
        ReflectionTestUtils.setField(vnPayService, "expireMinutes", 15);
    }

    @Test
    void isConfigured_shouldReturnTrue_whenConfigIsPresent() {
        assertTrue(vnPayService.isConfigured());
    }

    @Test
    void generateTxnRef_shouldCreateValidTxnRef() {
        String txnRef = vnPayService.generateTxnRef("booking-123");
        assertNotNull(txnRef);
        assertTrue(txnRef.startsWith("BK"));
    }

    @Test
    void buildPaymentUrl_shouldGenerateValidPaymentUrl() {
        String txnRef = "BK12345";
        BigDecimal amount = new BigDecimal("150000");
        String ipAddress = "127.0.0.1";
        String orderInfo = "Thanh toan ve xe";

        String url = vnPayService.buildPaymentUrl(txnRef, amount, ipAddress, orderInfo);

        assertNotNull(url);
        assertTrue(url.startsWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"));
        assertTrue(url.contains("vnp_SecureHash="));
        assertTrue(url.contains("vnp_Amount=15000000")); // Amount is multiplied by 100
        assertTrue(url.contains("vnp_TxnRef=BK12345"));
    }

    @Test
    void verifyReturn_shouldReturnTrue_whenSignatureMatches() {
        String paymentUrl = vnPayService.buildPaymentUrl("BK12345", new BigDecimal("150000"), "127.0.0.1", "Thanh toan ve xe");

        // Parse the URL to get all query parameters
        Map<String, String> params = new HashMap<>();
        String query = paymentUrl.substring(paymentUrl.indexOf("?") + 1);
        String[] pairs = query.split("&");
        for (String pair : pairs) {
            int idx = pair.indexOf("=");
            if (idx > 0) {
                params.put(pair.substring(0, idx), java.net.URLDecoder.decode(pair.substring(idx + 1), java.nio.charset.StandardCharsets.US_ASCII));
            }
        }

        boolean result = vnPayService.verifyReturn(params);

        assertTrue(result);
    }

    @Test
    void verifyReturn_shouldReturnFalse_whenSignatureMismatches() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_SecureHash", "INVALIDSIGNATURE123");

        boolean result = vnPayService.verifyReturn(params);

        assertFalse(result);
    }

    private String extractSecureHash(String url) {
        int pos = url.indexOf("vnp_SecureHash=");
        if (pos >= 0) {
            return url.substring(pos + "vnp_SecureHash=".length());
        }
        return "";
    }
}
