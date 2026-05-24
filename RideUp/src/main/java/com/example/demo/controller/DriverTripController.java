package com.example.demo.controller;

import com.example.demo.dto.request.DriverTripRequest;
import com.example.demo.dto.request.TripCancellationRequest;
import com.example.demo.dto.response.DriverTripDetailResponse;
import com.example.demo.dto.response.DriverTripResponse;
import com.example.demo.service.DriverTripService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller xử lý các yêu cầu HTTP liên quan đến chuyến đi của tài xế.
 *
 * <p>Tất cả endpoint trong controller này đều yêu cầu xác thực JWT
 * ({@code @PreAuthorize("isAuthenticated()")}). Identity của tài xế được
 * lấy tự động từ SecurityContext trong tầng Service, không cần truyền
 * qua tham số để tránh rủi ro IDOR (Insecure Direct Object Reference).</p>
 *
 * <p>Base URL: {@code /driver}</p>
 *
 * <ul>
 *   <li>GET  /driver/trips                                        – Danh sách chuyến</li>
 *   <li>POST /driver/trips                                        – Tạo chuyến mới</li>
 *   <li>GET  /driver/trips/{tripId}                               – Chi tiết chuyến</li>
 *   <li>PUT  /driver/trips/{tripId}/cancel                        – Hủy chuyến</li>
 *   <li>PUT  /driver/trips/{tripId}/start                         – Bắt đầu chuyến</li>
 *   <li>PUT  /driver/trips/{tripId}/complete                      – Hoàn thành chuyến</li>
 *   <li>PUT  /driver/trips/{tripId}/bookings/{bookingId}/confirm-cash-payment – Xác nhận tiền mặt</li>
 *   <li>GET  /driver/stats                                        – Thống kê doanh thu</li>
 * </ul>
 *
 * @author Phạm Quang Huy (B22DCCN394)
 * @see DriverTripService
 */
@RestController
@RequestMapping("/driver")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverTripController {

    DriverTripService driverTripService;

    /**
     * Lấy danh sách tất cả chuyến đi thực tế của tài xế đang đăng nhập.
     *
     * <p>Chỉ trả về các chuyến có {@code departureTime != null} (loại bỏ
     * route template). Kết quả được sắp xếp theo {@code departureTime} giảm dần
     * để chuyến gần nhất luôn hiển thị trên cùng.</p>
     *
     * @return danh sách chuyến đi, có thể rỗng nhưng không null
     */
    @GetMapping("/trips")
    @PreAuthorize("isAuthenticated()")
    public List<DriverTripResponse> getDriverTrips() {
        return driverTripService.getMyTrips();
    }

    /**
     * Tạo một chuyến đi mới từ request của tài xế.
     *
     * <p>Luồng xử lý:
     * <ol>
     *   <li>Validate request: bắt buộc có ngày giờ khởi hành, tỉnh đi/đến,
     *       clusters điểm đón/trả, và giá vé tối thiểu 1.000đ</li>
     *   <li>Kiểm tra hồ sơ tài xế phải ở trạng thái {@code APPROVED}</li>
     *   <li>Resolve hoặc tạo mới route template từ thông tin tỉnh/xã</li>
     *   <li>Build Trip entity và persist vào DB</li>
     *   <li>Publish WebSocket event {@code DRIVER_TRIP_CREATED} đến tài xế</li>
     * </ol>
     * </p>
     *
     * @param request dữ liệu tạo chuyến từ client
     * @return thông tin chuyến vừa được tạo
     * @throws AppException {@code DRIVER_PROFILE_NOT_APPROVED} nếu hồ sơ chưa được duyệt
     * @throws AppException {@code INVALID_KEY} nếu request thiếu thông tin bắt buộc
     */
    @PostMapping("/trips")
    @PreAuthorize("isAuthenticated()")
    public DriverTripResponse createTrip(@RequestBody DriverTripRequest request) {
        return driverTripService.createTrip(request);
    }

    /**
     * Lấy chi tiết chuyến đi của tài xế đang đăng nhập.
     *
     * <p>Trả về đầy đủ điểm đón, điểm trả và danh sách booking của chuyến
     * để client hiển thị thông tin theo từng chặng.</p>
     *
     * @param tripId ID chuyến cần xem chi tiết
     * @return thông tin chi tiết chuyến đi
     */
    @GetMapping("/trips/{tripId}")
    @PreAuthorize("isAuthenticated()")
    public DriverTripDetailResponse getTripDetail(@PathVariable String tripId) {
        return driverTripService.getTripDetail(tripId);
    }

    /**
     * Hủy một chuyến đi đang ở trạng thái OPEN hoặc FULL.
     *
     * <p>Khi hủy, hệ thống sẽ:
     * <ol>
     *   <li>Validate chuyến không ở trạng thái COMPLETED, CANCELLED hoặc IN_PROGRESS</li>
     *   <li>Hủy tất cả booking PENDING/CONFIRMED trong chuyến</li>
     *   <li>Tự động hoàn tiền VNPay cho các booking đã thanh toán online</li>
     *   <li>Đóng tất cả chat thread liên quan</li>
     *   <li>Gửi thông báo WebSocket đến tài xế và từng hành khách bị ảnh hưởng</li>
     * </ol>
     * </p>
     *
     * <p>IP address của client được extract và truyền vào để VNPay refund API
     * yêu cầu tham số {@code vnp_IpAddr} theo spec của cổng thanh toán.</p>
     *
     * @param tripId             ID chuyến cần hủy
     * @param request            lý do hủy (có thể null)
     * @param httpServletRequest HTTP request gốc để lấy client IP
     * @return thông tin chuyến sau khi hủy
     * @throws AppException {@code TRIP_NOT_FOUND} nếu không tìm thấy chuyến thuộc tài xế này
     * @throws AppException {@code TRIP_CANCEL_NOT_ALLOWED} nếu trạng thái không cho phép hủy
     */
    @PutMapping("/trips/{tripId}/cancel")
    @PreAuthorize("isAuthenticated()")
    public DriverTripResponse cancelTrip(
            @PathVariable String tripId,
            @RequestBody(required = false) TripCancellationRequest request,
            HttpServletRequest httpServletRequest
    ) {
        return driverTripService.cancelTrip(tripId, request, getClientIp(httpServletRequest));
    }

    /**
     * Bắt đầu chuyến đi, chuyển trạng thái từ OPEN/FULL sang IN_PROGRESS.
     *
     * <p>Điều kiện tiên quyết:
     * <ul>
     *   <li>Chuyến phải ở trạng thái {@code OPEN} hoặc {@code FULL}</li>
     *   <li>Thời điểm hiện tại phải >= {@code departureTime} đã lên lịch.
     *       Ràng buộc này ngăn tài xế bấm "Bắt đầu" sớm hơn giờ cam kết
     *       với hành khách, tránh trường hợp khách chưa kịp đến điểm đón.</li>
     * </ul>
     * </p>
     *
     * @param tripId ID chuyến cần bắt đầu
     * @return thông tin chuyến đã cập nhật trạng thái
     * @throws AppException {@code TRIP_NOT_FOUND} nếu không tìm thấy chuyến
     * @throws AppException {@code TRIP_START_NOT_ALLOWED} nếu trạng thái không phải OPEN/FULL
     * @throws AppException {@code TRIP_START_BEFORE_SCHEDULE} nếu giờ hiện tại < giờ lên lịch
     */
    @PutMapping("/trips/{tripId}/start")
    @PreAuthorize("isAuthenticated()")
    public DriverTripResponse startTrip(@PathVariable String tripId) {
        return driverTripService.startTrip(tripId);
    }

    /**
     * Hoàn thành chuyến đi, chuyển trạng thái từ IN_PROGRESS sang COMPLETED.
     *
     * <p>Guard condition quan trọng: không thể hoàn thành nếu còn booking
     * thanh toán tiền mặt chưa được xác nhận ({@code CASH + UNPAID}).
     * Ràng buộc này bảo vệ tài xế khỏi việc đóng chuyến mà chưa thu tiền
     * và bảo vệ hành khách khỏi việc bị đánh dấu hoàn thành khi chưa trả tiền.</p>
     *
     * <p>Sau khi hoàn thành: tất cả booking CONFIRMED/PENDING -> COMPLETED,
     * chat thread đóng lại, WebSocket event gửi đến cả tài xế và từng hành khách.</p>
     *
     * @param tripId ID chuyến cần hoàn thành
     * @return thông tin chuyến đã cập nhật
     * @throws AppException {@code TRIP_COMPLETE_NOT_ALLOWED} nếu chuyến không ở IN_PROGRESS
     * @throws AppException {@code UNCONFIRMED_CASH_PAYMENTS} nếu còn booking CASH chưa xác nhận
     */
    @PutMapping("/trips/{tripId}/complete")
    @PreAuthorize("isAuthenticated()")
    public DriverTripResponse completeTrip(@PathVariable String tripId) {
        return driverTripService.completeTrip(tripId);
    }

    /**
     * Xác nhận tài xế đã thu tiền mặt từ hành khách cho một booking cụ thể.
     *
     * <p>Chỉ áp dụng cho booking có {@code payment.method = CASH} và
     * {@code payment.status = UNPAID}. Sau khi xác nhận:
     * <ul>
     *   <li>{@code payment.status} -> {@code PAID}</li>
     *   <li>{@code payment.paidAt} = thời điểm hiện tại</li>
     *   <li>Hành khách nhận WebSocket event {@code CASH_PAYMENT_CONFIRMED}</li>
     * </ul>
     * </p>
     *
     * @param tripId    ID chuyến chứa booking
     * @param bookingId ID booking cần xác nhận thanh toán
     * @return thông tin booking đã cập nhật
     * @throws AppException {@code TRIP_NOT_FOUND} nếu chuyến không thuộc tài xế đang login
     * @throws AppException {@code BOOKING_NOT_FOUND} nếu booking không tồn tại trong chuyến
     * @throws AppException {@code PAYMENT_NOT_FOUND} nếu booking chưa có bản ghi payment
     * @throws AppException {@code PAYMENT_CONFIRM_NOT_ALLOWED} nếu method != CASH hoặc status != UNPAID
     */
    @PutMapping("/trips/{tripId}/bookings/{bookingId}/confirm-cash-payment")
    @PreAuthorize("isAuthenticated()")
    public DriverTripDetailResponse.BookingInfo confirmCashPayment(
            @PathVariable String tripId,
            @PathVariable String bookingId
    ) {
        return driverTripService.confirmCashPayment(tripId, bookingId);
    }

    /**
     * Trả về thống kê doanh thu và hiệu suất của tài xế trong tháng hiện tại.
     *
     * <p>Dữ liệu trả về bao gồm:
     * <ul>
     *   <li>{@code thisMonth.totalRides}    – tổng số chuyến trong tháng</li>
     *   <li>{@code thisMonth.completedRides} – số chuyến hoàn thành</li>
     *   <li>{@code thisMonth.cancelledRides} – số chuyến đã hủy</li>
     *   <li>{@code thisMonth.revenue}        – doanh thu (pricePerSeat x bookedSeats, không tính chuyến hủy)</li>
     *   <li>{@code rating}                   – điểm đánh giá trung bình từ hành khách</li>
     *   <li>{@code totalReviews}             – tổng số lượt đánh giá</li>
     * </ul>
     * </p>
     *
     * @return Map chứa dữ liệu thống kê
     */
    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> getDriverStats() {
        return driverTripService.getDriverStats();
    }

    /**
     * Trích xuất địa chỉ IP thực của client từ HTTP request.
     *
     * <p>Ưu tiên lấy từ header {@code X-Forwarded-For} (khi deploy sau
     * reverse proxy như Nginx/Load Balancer), sau đó {@code X-Real-IP},
     * cuối cùng mới lấy {@code remoteAddr} trực tiếp. Cơ chế này đảm bảo
     * lấy đúng IP gốc của client, tránh lấy IP của proxy server.
     * IP này được truyền sang VNPay Refund API theo yêu cầu bắt buộc của cổng.</p>
     *
     * @param request HTTP request, có thể null (khi test)
     * @return địa chỉ IP dạng String, fallback về "127.0.0.1" nếu không xác định được
     */
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
}
