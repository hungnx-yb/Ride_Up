package com.example.demo.controller;

import com.example.demo.dto.request.CreateBookingRequest;
import com.example.demo.dto.request.CreateBookingReviewRequest;
import com.example.demo.dto.request.ConfirmPaymentRequest;
import com.example.demo.dto.request.RideSearchFromTextRequest;
import com.example.demo.dto.response.BookingReviewResponse;
import com.example.demo.dto.response.CustomerBookingResponse;
import com.example.demo.dto.response.RideSearchFromTextResponse;
import com.example.demo.dto.response.RideSearchResponse;
import com.example.demo.service.CustomerBookingService;
import com.example.demo.service.RideSearchTextService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CustomerBookingController {

    CustomerBookingService customerBookingService;
    RideSearchTextService rideSearchTextService;

    @GetMapping("/rides/search")
    @PreAuthorize("isAuthenticated()")
    public List<RideSearchResponse> searchRides(@RequestParam(required = false) String fromProvinceId,
                                                @RequestParam(required = false) String toProvinceId,
                                                @RequestParam(required = false) String fromWardId,
                                                @RequestParam(required = false) String toWardId,
                                                @RequestParam(required = false) String departureDate,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(required = false) Integer page,
                                                @RequestParam(required = false) Integer size
                                                ) {
        return customerBookingService.searchRides(fromProvinceId, toProvinceId, fromWardId, toWardId, departureDate, status, page, size);
    }

    @PostMapping("/rides/search-from-text")
    @PreAuthorize("isAuthenticated()")
    public RideSearchFromTextResponse searchRidesFromText(
            @RequestBody(required = false) RideSearchFromTextRequest request) {
        return rideSearchTextService.searchFromText(request == null ? null : request.getQueryText());
    }

    @GetMapping("/customer/bookings")
    @PreAuthorize("isAuthenticated()")
    public List<CustomerBookingResponse> getMyBookings(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        return customerBookingService.getMyBookings(page, size);
    }

    @PostMapping("/customer/bookings")
    @PreAuthorize("isAuthenticated()")
    public CustomerBookingResponse createBooking(@RequestBody CreateBookingRequest request,
                                                 HttpServletRequest httpServletRequest) {
        return customerBookingService.createBooking(request, getClientIp(httpServletRequest));
    }

    @PostMapping("/customer/bookings/{bookingId}/payment/vnpay-url")
    @PreAuthorize("isAuthenticated()")
    public Map<String, String> createVnpayPaymentUrl(@PathVariable String bookingId,
                                                      HttpServletRequest httpServletRequest) {
        return customerBookingService.createVnpayPaymentUrl(bookingId, getClientIp(httpServletRequest));
    }

    @PostMapping("/customer/bookings/{bookingId}/payment/confirm")
    @PreAuthorize("isAuthenticated()")
    public CustomerBookingResponse confirmBookingPayment(@PathVariable String bookingId,
                                                         @RequestBody(required = false) ConfirmPaymentRequest request) {
        return customerBookingService.confirmBookingPayment(bookingId, request);
    }

    @PostMapping("/customer/bookings/{bookingId}/rate")
    @PreAuthorize("isAuthenticated()")
    public BookingReviewResponse createBookingReview(@PathVariable String bookingId,
                                                     @RequestBody CreateBookingReviewRequest request) {
        return customerBookingService.createBookingReview(bookingId, request);
    }

        @GetMapping("/payments/vnpay/return")
        public ResponseEntity<String> vnpayReturnCallback(@RequestParam Map<String, String> params) {
                Map<String, String> result = customerBookingService.handleVnpayGatewayCallback(params, false);

                boolean success = "PAID".equalsIgnoreCase(result.get("status"));
                String bookingIdRaw = result.get("bookingId");
                String bookingId = safeText(bookingIdRaw);
                String transactionRef = safeText(result.get("transactionRef"));
                String detail = safeText(result.get("message"));
                String title = success ? "Thanh toan thanh cong" : "Thanh toan that bai";
                String subtitle = success
                                ? "Giao dich da duoc xac nhan boi RideUp."
                                : "Khong the xac nhan thanh toan. Vui long thu lai.";
                String targetTripsUrl = safeText(buildCustomerTripsUrl(bookingIdRaw, success));

                String html = """
                                <!doctype html>
                                <html lang=\"vi\">
                                <head>
                                    <meta charset=\"utf-8\" />
                                    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
                                    <title>%s</title>
                                    <style>
                                        :root {
                                            --bg: #edf3ff;
                                            --card: #fff;
                                            --ok: #16a34a;
                                            --fail: #dc2626;
                                            --ink: #0f172a;
                                            --muted: #64748b;
                                        }
                                        * { box-sizing: border-box; }
                                        body {
                                            margin: 0;
                                            min-height: 100vh;
                                            display: grid;
                                            place-items: center;
                                            padding: 24px;
                                            font-family: Segoe UI, Tahoma, Arial, sans-serif;
                                            background: radial-gradient(circle at 10%% 20%%, #dbeafe, transparent 45%%),
                                                                    radial-gradient(circle at 90%% 80%%, #dcfce7, transparent 40%%),
                                                                    var(--bg);
                                            color: var(--ink);
                                        }
                                        .wrap {
                                            width: min(680px, 100%%);
                                            background: var(--card);
                                            border-radius: 20px;
                                            overflow: hidden;
                                            box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
                                            border: 1px solid #e2e8f0;
                                        }
                                        .head {
                                            text-align: center;
                                            padding: 26px 20px;
                                            color: #fff;
                                            background: %s;
                                        }
                                        .icon {
                                            width: 62px;
                                            height: 62px;
                                            border-radius: 999px;
                                            margin: 0 auto 10px;
                                            display: grid;
                                            place-items: center;
                                            background: rgba(255,255,255,0.24);
                                            font-size: 30px;
                                            font-weight: 700;
                                        }
                                        h1 { margin: 0; font-size: 30px; font-weight: 800; }
                                        .sub { margin-top: 8px; opacity: .95; }
                                        .body { padding: 20px 22px 24px; }
                                        .row {
                                            display: flex;
                                            justify-content: space-between;
                                            align-items: flex-start;
                                            gap: 14px;
                                            padding: 11px 0;
                                            border-bottom: 1px dashed #e2e8f0;
                                        }
                                        .k { color: var(--muted); }
                                        .v { font-weight: 600; text-align: right; word-break: break-word; }
                                        .actions { margin-top: 18px; display: flex; gap: 10px; flex-wrap: wrap; }
                                        .btn {
                                            border: 0;
                                            border-radius: 11px;
                                            padding: 11px 16px;
                                            font-weight: 700;
                                            cursor: pointer;
                                        }
                                        .btn.home { background: #e2e8f0; color: #0f172a; }
                                    </style>
                                </head>
                                <body>
                                    <div class=\"wrap\">
                                        <div class=\"head\">
                                            <div class=\"icon\">%s</div>
                                            <h1>%s</h1>
                                            <div class=\"sub\">%s</div>
                                        </div>
                                        <div class=\"body\">
                                            <div class=\"row\"><span class=\"k\">Ma don dat</span><span class=\"v\">%s</span></div>
                                            <div class=\"row\"><span class=\"k\">Ma giao dich</span><span class=\"v\">%s</span></div>
                                            <div class=\"row\"><span class=\"k\">Chi tiet</span><span class=\"v\">%s</span></div>
                                            <div class=\"actions\">
                                                <button class=\"btn home\" onclick=\"window.location.href='%s'\">Chuyen cua toi</button>
                                            </div>
                                        </div>
                                    </div>
                                </body>
                                </html>
                                """.formatted(
                                title,
                                success ? "linear-gradient(135deg,#16a34a,#0ea5e9)" : "linear-gradient(135deg,#dc2626,#f59e0b)",
                                success ? "✓" : "!",
                                title,
                                subtitle,
                                bookingId,
                                transactionRef,
                                detail,
                                targetTripsUrl
                );

                return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_HTML_VALUE + ";charset=UTF-8")
                                .body(html);
    }

    @GetMapping("/payments/vnpay/ipn")
    public Map<String, String> vnpayIpnCallback(@RequestParam Map<String, String> params) {
        return customerBookingService.handleVnpayGatewayCallback(params, true);
    }

        @GetMapping("/payments/vnpay/home")
        public ResponseEntity<String> vnpayHomePage() {
                String html = """
                                <!doctype html>
                                <html lang="vi">
                                <head>
                                    <meta charset="utf-8" />
                                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                                    <title>RideUp</title>
                                    <style>
                                        body {
                                            margin: 0;
                                            min-height: 100vh;
                                            display: grid;
                                            place-items: center;
                                            background: #f1f5f9;
                                            font-family: Segoe UI, Tahoma, Arial, sans-serif;
                                        }
                                        .card {
                                            background: #fff;
                                            border: 1px solid #e2e8f0;
                                            border-radius: 16px;
                                            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
                                            width: min(560px, 92vw);
                                            padding: 24px;
                                        }
                                        h1 { margin: 0 0 10px; color: #0f172a; }
                                        p { margin: 0 0 16px; color: #475569; }
                                        .btn {
                                            border: 0;
                                            border-radius: 10px;
                                            background: #0f172a;
                                            color: #fff;
                                            font-weight: 700;
                                            padding: 10px 14px;
                                            cursor: pointer;
                                        }
                                    </style>
                                </head>
                                <body>
                                    <div class="card">
                                        <h1>Da ve trang RideUp</h1>
                                        <p>Ban co the dong cua so nay va quay lai ung dung RideUp de tiep tuc.</p>
                                        <button class="btn" onclick="if (window.history.length > 1) { window.history.back(); }">Quay lai trang truoc</button>
                                    </div>
                                </body>
                                </html>
                                """;
                return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_HTML_VALUE + ";charset=UTF-8")
                                .body(html);
        }

    private String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int commaIdx = forwarded.indexOf(',');
            return (commaIdx > 0 ? forwarded.substring(0, commaIdx) : forwarded).trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr == null || remoteAddr.isBlank()) ? "127.0.0.1" : remoteAddr.trim();
    }

    private String safeText(String value) {
        if (value == null || value.isBlank()) {
            return "--";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String buildCustomerTripsUrl(String bookingId, boolean success) {
        String id = bookingId == null ? "" : bookingId.trim();
        return "http://localhost:8081/?tab=myTrips&bookingId=" + id + "&paymentStatus=" + (success ? "PAID" : "FAILED");
    }
}
