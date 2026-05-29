package com.example.demo.service;

import com.example.demo.dto.request.DriverTripRequest;
import com.example.demo.dto.request.TripCancellationRequest;
import com.example.demo.dto.response.DriverTripDetailResponse;
import com.example.demo.dto.response.DriverTripResponse;
import com.example.demo.entity.Booking;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.Payment;
import com.example.demo.entity.Province;
import com.example.demo.entity.Trip;
import com.example.demo.entity.TripDropoffPoint;
import com.example.demo.entity.TripPickupPoint;
import com.example.demo.entity.User;
import com.example.demo.entity.Ward;
import com.example.demo.enums.BookingStatus;
import com.example.demo.enums.DriverStatus;
import com.example.demo.enums.PaymentMethod;
import com.example.demo.enums.PaymentStatus;
import com.example.demo.enums.TripStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.DriverProfileRepository;
import com.example.demo.repository.ProvinceRepository;
import com.example.demo.repository.TripRepository;
import com.example.demo.repository.WardRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service xử lý toàn bộ nghiệp vụ quản lý chuyến đi của tài xế (Driver).
 *
 * <p>Đây là lớp trung tâm của module Tài xế, chịu trách nhiệm:
 * <ul>
 *   <li>Tạo và quản lý vòng đời chuyến đi: OPEN → IN_PROGRESS → COMPLETED/CANCELLED</li>
 *   <li>Quản lý điểm đón/trả (TripPickupPoint, TripDropoffPoint)</li>
 *   <li>Phối hợp với {@link CustomerBookingService} để hoàn tiền VNPay khi hủy chuyến</li>
 *   <li>Publish thông báo realtime qua WebSocket STOMP sau mỗi thay đổi trạng thái</li>
 *   <li>Tính toán thống kê doanh thu theo tháng</li>
 * </ul>
 * </p>
 *
 * <p><b>Nguyên tắc bảo mật:</b> Mọi truy vấn trip đều kèm điều kiện
 * {@code driver_id = currentDriverProfile.id} để đảm bảo tài xế chỉ
 * thao tác được trên chuyến của mình (tránh IDOR).</p>
 *
 * @author Phạm Quang Huy (B22DCCN394)
 * @see DriverTripController
 * @see Trip
 * @see TripRepository
 */
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverTripService {

    UserService userService;
    DriverProfileRepository driverProfileRepository;
    TripRepository tripRepository;
    ProvinceRepository provinceRepository;
    WardRepository wardRepository;
    CustomerBookingService customerBookingService;
    ChatService chatService;
    NotificationRealtimePublisher notificationRealtimePublisher;

    DateTimeFormatter isoDate = DateTimeFormatter.ISO_LOCAL_DATE;
    DateTimeFormatter viDate = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    DateTimeFormatter uiTime = DateTimeFormatter.ofPattern("HH:mm");

    /**
     * Lấy toàn bộ danh sách chuyến đi thực tế của tài xế đang đăng nhập.
     *
     * <p>Sử dụng điều kiện {@code departureTime IS NOT NULL} để phân biệt
     * chuyến đi thực tế với route template (template có departureTime = null).
     * Kết quả sắp xếp giảm dần theo thời gian khởi hành.</p>
     *
     * @return danh sách {@link DriverTripResponse} đã được map từ entity,
     *         trả về list rỗng nếu tài xế chưa tạo chuyến nào
     */
    @Transactional(readOnly = true)
    public List<DriverTripResponse> getMyTrips() {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        List<Trip> actualTrips = tripRepository.findByDriverIdAndDepartureTimeIsNotNullOrderByDepartureTimeDesc(driverProfile.getId());

        return actualTrips.stream()
                .map(this::toTripListResponse)
                .collect(Collectors.toList());
    }

            /**
             * Lấy thông tin chi tiết đầy đủ của một chuyến đi, bao gồm danh sách
             * điểm đón, điểm trả và toàn bộ booking của chuyến.
             *
             * <p>Tính toán thêm các trường dẫn xuất:
             * <ul>
             *   <li>{@code bookedSeats} = totalSeats - availableSeats</li>
             *   <li>{@code estimatedRevenue} = fixedFare × bookedSeats</li>
             *   <li>{@code pickupProvince} / {@code dropoffProvince} – lấy từ điểm đón/trả
             *       đầu tiên theo sortOrder</li>
             * </ul>
             * </p>
             *
             * @param tripId ID của chuyến cần xem chi tiết
             * @return {@link DriverTripDetailResponse} bao gồm cả pickupPoints, dropoffPoints và bookings
             * @throws AppException {@code TRIP_NOT_FOUND} nếu chuyến không tồn tại hoặc không thuộc tài xế này
             */
            @Transactional(readOnly = true)
            public DriverTripDetailResponse getTripDetail(String tripId) {
            DriverProfile driverProfile = getOrCreateDriverProfile();
            Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNotNull(tripId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.TRIP_NOT_FOUND));

            List<DriverTripDetailResponse.PointInfo> pickupPoints = mapPickupPoints(trip.getPickupPoints());
            List<DriverTripDetailResponse.PointInfo> dropoffPoints = mapDropoffPoints(trip.getDropoffPoints());
            List<DriverTripDetailResponse.BookingInfo> bookings = mapBookings(trip.getBookings());

            // Tính toán các trường dẫn xuất để UI không phải tính lại từ client.
            int totalSeats = trip.getTotalSeats() == null ? 0 : trip.getTotalSeats();
            int availableSeats = trip.getAvailableSeats() == null ? 0 : trip.getAvailableSeats();
            int bookedSeats = Math.max(0, totalSeats - availableSeats);
            long fixedFare = trip.getPricePerSeat() == null ? 0L : trip.getPricePerSeat().longValue();

            String pickupProvince = pickupPoints.stream()
                .map(DriverTripDetailResponse.PointInfo::getProvinceName)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

            String dropoffProvince = dropoffPoints.stream()
                .map(DriverTripDetailResponse.PointInfo::getProvinceName)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

            LocalDateTime departure = trip.getDepartureTime();
            return DriverTripDetailResponse.builder()
                .id(trip.getId())
                .routeId(trip.getId())
                .status(toUiStatus(trip.getStatus()))
                .pickupProvince(pickupProvince)
                .dropoffProvince(dropoffProvince)
                .departureDate(departure == null ? null : departure.toLocalDate().format(isoDate))
                .departureTime(departure == null ? null : departure.toLocalTime().format(uiTime))
                .createdAt(formatDateTime(trip.getCreatedAt()))
                .updatedAt(formatDateTime(trip.getUpdatedAt()))
                .actualDepartureTime(formatDateTime(trip.getActualDepartureTime()))
                .actualArrivalTime(formatDateTime(trip.getActualArrivalTime()))
                .completedAt(formatDateTime(trip.getCompletedAt()))
                .totalSeats(totalSeats)
                .availableSeats(availableSeats)
                .bookedSeats(bookedSeats)
                .fixedFare(fixedFare)
                .estimatedRevenue(fixedFare * bookedSeats)
                .driverNote(trip.getDriverNote())
                .pickupPoints(pickupPoints)
                .dropoffPoints(dropoffPoints)
                .bookings(bookings)
                .build();
            }

    /**
     * Tạo một chuyến đi mới từ dữ liệu do tài xế nhập vào.
     *
     * <p><b>Luồng xử lý chi tiết:</b>
     * <ol>
     *   <li>{@link #validateCreateRequest(DriverTripRequest)} – kiểm tra tính hợp lệ của request</li>
     *   <li>{@link #getOrCreateDriverProfile()} – lấy hồ sơ tài xế, kiểm tra status = APPROVED</li>
     *   <li>{@link #resolveOrCreateTemplate(DriverProfile, DriverTripRequest)} –
     *       resolve hoặc tạo route template từ thông tin tỉnh/xã</li>
     *   <li>Build {@link Trip} entity mới với pickup/dropoff points copy từ template</li>
     *   <li>Persist trip vào PostgreSQL qua {@link TripRepository#save(Object)}</li>
     *   <li>Publish WebSocket event {@code DRIVER_TRIP_CREATED} đến tài xế</li>
     * </ol>
     * </p>
     *
     * <p><b>Về availableSeats:</b> Mặc định bằng totalSeats khi tạo mới.
     * Giá trị này giảm mỗi khi có booking được xác nhận và tăng lại khi booking bị hủy,
     * do CustomerBookingService quản lý.</p>
     *
     * @param request dữ liệu tạo chuyến từ client (xem {@link DriverTripRequest})
     * @return {@link DriverTripResponse} thông tin chuyến vừa tạo
     * @throws AppException {@code DRIVER_PROFILE_NOT_APPROVED} nếu hồ sơ chưa được Admin duyệt
     * @throws AppException {@code INVALID_KEY} nếu thiếu tỉnh, clusters, giá vé, hoặc ngày giờ
     */
    @Transactional
    public DriverTripResponse createTrip(DriverTripRequest request) {
        // ── 1. Xác thực request ──────────────────────────────────────────────────────
        validateCreateRequest(request);
        // ── 2. Lấy hồ sơ tài xế & route template ────────────────────────────────────
        DriverProfile driverProfile = getOrCreateDriverProfile();
        if (driverProfile.getStatus() != DriverStatus.APPROVED) {
            throw new AppException(ErrorCode.DRIVER_PROFILE_NOT_APPROVED);
        }

        Trip template = resolveOrCreateTemplate(driverProfile, request);

        // ── 3. Dựng Trip entity ─────────────────────────────────────────────────────
        int totalSeats = request.getTotalSeats() == null || request.getTotalSeats() < 1 ? 4 : request.getTotalSeats();
        int availableSeats = request.getAvailableSeats() == null
                ? totalSeats
                : Math.max(0, Math.min(request.getAvailableSeats(), totalSeats));

        BigDecimal fare = request.getFixedFare() != null
                ? BigDecimal.valueOf(request.getFixedFare())
                : (template.getPricePerSeat() == null ? BigDecimal.ZERO : template.getPricePerSeat());

        Trip newTrip = Trip.builder()
                .driver(driverProfile)
                .departureTime(parseDepartureDateTime(request.getDepartureDate(), request.getDepartureTime()))
                .totalSeats(totalSeats)
                .availableSeats(availableSeats)
                .pricePerSeat(fare)
                .status(toTripStatus(request.getStatus()))
                .driverNote(StringUtils.hasText(request.getNotes()) ? request.getNotes().trim() : null)
                .pickupPoints(new ArrayList<>())
                .dropoffPoints(new ArrayList<>())
                .build();

        // ── 4. Sao chép điểm đón/trả từ template ────────────────────────────────────
        List<TripPickupPoint> pickupPoints = template.getPickupPoints().stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> TripPickupPoint.builder()
                        .trip(newTrip)
                        .ward(p.getWard())
                        .address(p.getAddress())
                        .pickupTime(p.getPickupTime())
                        .sortOrder(p.getSortOrder())
                        .note(p.getNote())
                        .build())
                .collect(Collectors.toList());

        List<TripDropoffPoint> dropoffPoints = template.getDropoffPoints().stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> TripDropoffPoint.builder()
                        .trip(newTrip)
                        .ward(p.getWard())
                        .address(p.getAddress())
                        .dropoffTime(p.getDropoffTime())
                        .sortOrder(p.getSortOrder())
                        .note(p.getNote())
                        .build())
                .collect(Collectors.toList());

        newTrip.setPickupPoints(pickupPoints);
        newTrip.setDropoffPoints(dropoffPoints);

        // ── 5. Lưu & phát thông báo ─────────────────────────────────────────────────
        Trip saved = tripRepository.save(newTrip);
        String driverUserId = driverProfile.getUser() != null ? driverProfile.getUser().getId() : null;
        // Thông báo realtime cho tài xế về việc tạo chuyến.
        notificationRealtimePublisher.notifyUser(
            driverUserId,
            "DRIVER_TRIP_CREATED",
            "Tạo chuyến thành công",
            "Bạn đã tạo thành công chuyến " + buildTripRouteLabel(saved) + ".",
            saved.getId()
        );
        DriverTripResponse response = toTripResponse(saved, List.of(template));
        response.setRouteId(StringUtils.hasText(template.getId()) ? template.getId() : saved.getId());
        return response;
    }

    /**
     * Hủy chuyến đi và thực hiện toàn bộ side effects liên quan.
     *
     * <p><b>Điều kiện tiên quyết:</b> Chỉ hủy được khi status là OPEN hoặc FULL.
     * Không thể hủy chuyến đang chạy (IN_PROGRESS) hoặc đã kết thúc.</p>
     *
     * <p><b>Side effects theo thứ tự:</b>
     * <ol>
     *   <li>Cập nhật {@code trip.status = CANCELLED}</li>
     *   <li>Duyệt qua tất cả booking PENDING/CONFIRMED:
     *       <ul>
     *         <li>Đặt {@code booking.status = CANCELLED_BY_DRIVER}</li>
     *         <li>Gọi {@link CustomerBookingService#tryAutoRefundVnPay} cho booking VNPay đã thanh toán.
     *             Lỗi refund được bắt và log warning – không làm dừng luồng hủy chuyến,
     *             vì nghiệp vụ hủy phải thành công bất kể refund có lỗi hay không.</li>
     *       </ul>
     *   </li>
     *   <li>Đóng tất cả chat thread của chuyến</li>
     *   <li>Gửi WebSocket {@code DRIVER_TRIP_CANCELLED} đến tài xế</li>
     *   <li>Gửi WebSocket {@code TRIP_CANCELLED_BY_DRIVER} đến từng hành khách bị ảnh hưởng</li>
     * </ol>
     * </p>
     *
     * @param tripId    ID chuyến cần hủy
     * @param request   thông tin hủy, có thể null (lý do hủy là tùy chọn)
     * @param ipAddress IP của client, dùng cho VNPay Refund API
     * @return {@link DriverTripResponse} phản ánh trạng thái CANCELLED
     * @throws AppException {@code TRIP_NOT_FOUND} nếu chuyến không tồn tại hoặc không thuộc tài xế
     * @throws AppException {@code TRIP_CANCEL_NOT_ALLOWED} nếu trạng thái không hợp lệ
     */
    @Transactional
    public DriverTripResponse cancelTrip(String tripId, TripCancellationRequest request, String ipAddress) {
        // ── 1. Kiểm tra quyền sở hữu & trạng thái chuyến ────────────────────────────
        DriverProfile driverProfile = getOrCreateDriverProfile();
        Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNotNullWithBookings(tripId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.TRIP_NOT_FOUND));

        TripStatus status = trip.getStatus();
        if (status == TripStatus.COMPLETED || status == TripStatus.CANCELLED || status == TripStatus.IN_PROGRESS) {
            // Không cho phép hủy khi chuyến đã kết thúc hoặc đang chạy để tránh sai lệch trạng thái.
            throw new AppException(ErrorCode.TRIP_CANCEL_NOT_ALLOWED);
        }

        // ── 2. Cập nhật trạng thái & ghi chú chuyến ─────────────────────────────────
        trip.setStatus(TripStatus.CANCELLED);
        trip.setCompletedAt(null);

        String reason = request == null ? null : request.getCancellationReason();
        if (StringUtils.hasText(reason)) {
            trip.setDriverNote(reason.trim());
        }

        // ── 3. Hủy booking & hoàn tiền tự động nếu cần ──────────────────────────────
        markBookingsCancelledByDriver(trip, reason, ipAddress);

        // ── 4. Lưu, đóng chat và thông báo người dùng ───────────────────────────────
        Trip saved = tripRepository.save(trip);
        // Đóng thread chat khi tài xế hủy chuyến.
        chatService.closeThreadsByTripId(saved.getId(), "Trip was cancelled by driver");

        String driverUserId = driverProfile.getUser() != null ? driverProfile.getUser().getId() : null;
        // Thông báo realtime cho tài xế về việc hủy chuyến.
        notificationRealtimePublisher.notifyUser(
            driverUserId,
            "DRIVER_TRIP_CANCELLED",
            "Hủy chuyến thành công",
            "Bạn đã hủy chuyến " + buildTripRouteLabel(saved) + ".",
            saved.getId()
        );
        for (String customerUserId : collectAffectedCustomerUserIds(saved)) {
            // Thông báo realtime cho khách khi tài xế hủy chuyến.
            notificationRealtimePublisher.notifyUser(
                customerUserId,
                "TRIP_CANCELLED_BY_DRIVER",
                "Chuyến xe đã bị hủy",
                "Tài xế đã hủy chuyến " + buildTripRouteLabel(saved) + ".",
                saved.getId()
            );
        }

        List<Trip> routeTemplates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());
        return toTripResponse(saved, routeTemplates);
    }

    /**
     * Bắt đầu chuyến đi – chuyển trạng thái OPEN/FULL sang IN_PROGRESS.
     *
     * <p><b>Guard condition về giờ khởi hành:</b>
     * Hệ thống kiểm tra {@code now >= departureTime} trước khi cho phép bắt đầu.
     * Điều này đảm bảo tài xế không thể xuất phát sớm hơn giờ đã cam kết với
     * hành khách trên app, tránh trường hợp khách đến điểm đón đúng giờ nhưng
     * xe đã đi rồi.</p>
     *
     * <p>Ghi lại {@code actualDepartureTime = now()} để phục vụ thống kê
     * và tính toán thời gian thực tế của chuyến.</p>
     *
     * @param tripId ID chuyến cần bắt đầu
     * @return {@link DriverTripResponse} với status "ongoing"
     * @throws AppException {@code TRIP_NOT_FOUND}
     * @throws AppException {@code TRIP_START_NOT_ALLOWED} nếu status không phải OPEN/FULL
     * @throws AppException {@code TRIP_START_BEFORE_SCHEDULE} nếu now < departureTime
     */
    @Transactional
    public DriverTripResponse startTrip(String tripId) {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNotNull(tripId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.TRIP_NOT_FOUND));

        if (trip.getStatus() != TripStatus.OPEN && trip.getStatus() != TripStatus.FULL) {
            throw new AppException(ErrorCode.TRIP_START_NOT_ALLOWED);
        }

        LocalDateTime now = LocalDateTime.now();
        if (trip.getDepartureTime() != null && now.isBefore(trip.getDepartureTime())) {
            // Chặn tài xế bắt đầu sớm để đảm bảo đúng giờ hẹn với hành khách.
            throw new AppException(ErrorCode.TRIP_START_BEFORE_SCHEDULE);
        }

        trip.setStatus(TripStatus.IN_PROGRESS);
        trip.setActualDepartureTime(now);
        trip.setActualArrivalTime(null);
        trip.setCompletedAt(null);

        markBookingsInProgress(trip, now);

        Trip saved = tripRepository.save(trip);
        List<Trip> routeTemplates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());
        return toTripResponse(saved, routeTemplates);
    }

    /**
     * Hoàn thành chuyến đi – chuyển trạng thái IN_PROGRESS sang COMPLETED.
     *
     * <p><b>Guard quan trọng về tiền mặt chưa thu:</b>
     * Trước khi hoàn thành, hệ thống kiểm tra còn booking nào có
     * {@code payment.method = CASH} và {@code payment.status = UNPAID} không.
     * Nếu có, ném exception {@code UNCONFIRMED_CASH_PAYMENTS} và yêu cầu
     * tài xế xác nhận thu tiền thủ công trước. Ràng buộc này bảo vệ tài xế
     * không bị mất doanh thu và bảo vệ tính nhất quán dữ liệu tài chính.</p>
     *
     * <p><b>Side effects:</b>
     * <ul>
     *   <li>Tất cả booking CONFIRMED/PENDING → COMPLETED</li>
     *   <li>Chat thread của chuyến bị đóng lại</li>
     *   <li>WebSocket {@code DRIVER_TRIP_COMPLETED} gửi đến tài xế</li>
     *   <li>WebSocket {@code TRIP_COMPLETED} gửi đến từng hành khách</li>
     * </ul>
     * </p>
     *
     * @param tripId ID chuyến cần hoàn thành
     * @return {@link DriverTripResponse} với status "completed"
     * @throws AppException {@code TRIP_COMPLETE_NOT_ALLOWED} nếu status != IN_PROGRESS
     * @throws AppException {@code UNCONFIRMED_CASH_PAYMENTS} nếu còn booking CASH chưa thu tiền
     */
    @Transactional
    public DriverTripResponse completeTrip(String tripId) {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNotNull(tripId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.TRIP_NOT_FOUND));

        if (trip.getStatus() != TripStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.TRIP_COMPLETE_NOT_ALLOWED);
        }

        if (trip.getBookings() != null) {
            // Không cho phép hoàn thành nếu vẫn còn booking tiền mặt chưa xác nhận.
            boolean hasUnconfirmedCashPayment = trip.getBookings().stream()
                    .filter(b -> b != null && (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING))
                    .map(com.example.demo.entity.Booking::getPayment)
                    .anyMatch(p -> p != null && p.getMethod() == PaymentMethod.CASH && p.getStatus() == PaymentStatus.UNPAID);

            if (hasUnconfirmedCashPayment) {
                throw new AppException(ErrorCode.UNCONFIRMED_CASH_PAYMENTS);
            }
        }

        LocalDateTime now = LocalDateTime.now();
        trip.setStatus(TripStatus.COMPLETED);
        if (trip.getActualDepartureTime() == null) {
            trip.setActualDepartureTime(now);
        }
        trip.setActualArrivalTime(now);
        trip.setCompletedAt(now);

        markBookingsCompleted(trip, now);

        Trip saved = tripRepository.save(trip);
        // Đóng thread chat khi chuyến kết thúc.
        chatService.closeThreadsByTripId(saved.getId(), "Trip has been completed");

        String driverUserId = driverProfile.getUser() != null ? driverProfile.getUser().getId() : null;
        // Thông báo realtime cho tài xế khi hoàn thành chuyến.
        notificationRealtimePublisher.notifyUser(
            driverUserId,
            "DRIVER_TRIP_COMPLETED",
            "Chuyến xe đã hoàn thành",
            "Bạn đã hoàn thành chuyến " + buildTripRouteLabel(saved) + ".",
            saved.getId()
        );
        for (String customerUserId : collectAffectedCustomerUserIds(saved)) {
            // Thông báo realtime cho khách khi chuyến kết thúc.
            notificationRealtimePublisher.notifyUser(
                customerUserId,
                "TRIP_COMPLETED",
                "Chuyến xe đã hoàn thành",
                "Chuyến " + buildTripRouteLabel(saved) + " đã kết thúc.",
                saved.getId()
            );
        }
        List<Trip> routeTemplates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());
        return toTripResponse(saved, routeTemplates);
    }

    /**
     * Xác nhận tài xế đã thu tiền mặt từ hành khách cho một booking.
     *
     * <p>Validate đa tầng trước khi cập nhật:
     * <ol>
     *   <li>Trip phải tồn tại và thuộc tài xế đang login</li>
     *   <li>Booking phải nằm trong trip đó</li>
     *   <li>Payment phải tồn tại trên booking</li>
     *   <li>{@code payment.method} phải là {@code CASH} (không cho phép xác nhận thủ công VNPay)</li>
     *   <li>{@code payment.status} phải là {@code UNPAID} (tránh xác nhận trùng lặp)</li>
     * </ol>
     * </p>
     *
     * <p>Sau khi xác nhận thành công, hệ thống gửi WebSocket event
     * {@code CASH_PAYMENT_CONFIRMED} đến hành khách để app phía khách
     * cập nhật realtime trạng thái thanh toán mà không cần refresh.</p>
     *
     * @param tripId    ID chuyến
     * @param bookingId ID booking cần xác nhận
     * @return {@link DriverTripDetailResponse.BookingInfo} đã cập nhật paymentStatus = "PAID"
     * @throws AppException {@code TRIP_NOT_FOUND}
     * @throws AppException {@code BOOKING_NOT_FOUND}
     * @throws AppException {@code PAYMENT_NOT_FOUND}
     * @throws AppException {@code PAYMENT_CONFIRM_NOT_ALLOWED}
     */
    @Transactional
    public DriverTripDetailResponse.BookingInfo confirmCashPayment(String tripId, String bookingId) {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNotNullWithBookings(tripId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.TRIP_NOT_FOUND));

        Booking booking = trip.getBookings().stream()
                .filter(b -> b != null && bookingId.equals(b.getId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        Payment payment = booking.getPayment();
        if (payment == null) {
            throw new AppException(ErrorCode.PAYMENT_NOT_FOUND);
        }

        if (payment.getMethod() != PaymentMethod.CASH) {
            // Chỉ cho phép xác nhận thủ công với tiền mặt, không được can thiệp VNPay.
            throw new AppException(ErrorCode.PAYMENT_CONFIRM_NOT_ALLOWED);
        }

        if (payment.getStatus() != PaymentStatus.UNPAID) {
            // Ngăn việc xác nhận trùng lặp khi payment đã ở trạng thái PAID.
            throw new AppException(ErrorCode.PAYMENT_CONFIRM_NOT_ALLOWED);
        }

        payment.setStatus(PaymentStatus.PAID);
        payment.setPaidAt(LocalDateTime.now());

        tripRepository.save(trip);

    // Thong bao realtime cho khach ve viec xac nhan thanh toan tien mat.
        User customer = booking.getCustomer();
        if (customer != null && StringUtils.hasText(customer.getId())) {
            notificationRealtimePublisher.notifyUser(
                customer.getId(),
                "CASH_PAYMENT_CONFIRMED",
                "Thanh toán đã được xác nhận",
                "Tài xế đã xác nhận nhận tiền mặt cho chuyến " + buildTripRouteLabel(trip) + ".",
                trip.getId()
            );
        }

        return toBookingInfo(booking);
    }

    /**
     * Đánh dấu tất cả booking PENDING/CONFIRMED trong chuyến là bị hủy bởi tài xế,
     * và thực hiện hoàn tiền VNPay tự động nếu booking đã thanh toán online.
     *
     * <p><b>Xử lý lỗi refund:</b> Exception từ {@code tryAutoRefundVnPay} được
     * catch và log ở mức WARNING thay vì propagate lên. Quyết định thiết kế này
     * đảm bảo việc hủy chuyến luôn hoàn thành dù VNPay có timeout hay lỗi kết nối.
     * Các refund thất bại có thể được xử lý thủ công bởi admin sau đó.</p>
     *
     * @param trip      chuyến bị hủy (đã có bookings được fetch eager)
     * @param reason    lý do hủy để ghi vào booking.cancellationReason
     * @param ipAddress IP client để truyền vào VNPay Refund API
     */
    private void markBookingsCancelledByDriver(Trip trip, String reason, String ipAddress) {
        if (trip.getBookings() == null || trip.getBookings().isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        String normalizedReason = StringUtils.hasText(reason) ? reason.trim() : "Driver cancelled trip";

        for (Booking booking : trip.getBookings()) {
            if (booking == null || booking.getStatus() == null) {
                continue;
            }

            if (booking.getStatus() == BookingStatus.PENDING || booking.getStatus() == BookingStatus.CONFIRMED) {
                booking.setStatus(BookingStatus.CANCELLED_BY_DRIVER);
                booking.setCancelledAt(now);
                booking.setCancellationReason(normalizedReason);
                booking.setConfirmedAt(null);
                booking.setCompletedAt(null);
                try {
                    customerBookingService.tryAutoRefundVnPay(booking, ipAddress, "Driver cancellation refund " + booking.getId());
                } catch (Exception ex) {
                    // Hủy chuyến vẫn phải thành công kể cả refund bị lỗi.
                    log.warn("Auto refund failed while driver cancels trip. tripId={}, bookingId={}, message={}",
                            trip != null ? trip.getId() : null,
                            booking.getId(),
                            ex.getMessage());
                }
            }
        }
    }

    /**
     * Trích xuất tập hợp userId của tất cả hành khách có booking trong chuyến.
     *
     * <p>Dùng Set để tự động loại bỏ trùng lặp trong trường hợp một hành khách
     * có nhiều booking trên cùng chuyến (mua nhiều ghế). Mỗi userId chỉ nhận
     * một thông báo WebSocket dù có bao nhiêu booking.</p>
     *
     * @param trip chuyến cần lấy danh sách khách bị ảnh hưởng
     * @return Set userId không trùng lặp, không bao giờ null
     */
    private Set<String> collectAffectedCustomerUserIds(Trip trip) {
        if (trip == null || trip.getBookings() == null || trip.getBookings().isEmpty()) {
            return Set.of();
        }

        Set<String> userIds = new HashSet<>();
        for (Booking booking : trip.getBookings()) {
            if (booking == null || booking.getCustomer() == null || !StringUtils.hasText(booking.getCustomer().getId())) {
                continue;
            }
            userIds.add(booking.getCustomer().getId());
        }
        return userIds;
    }

    private String buildTripRouteLabel(Trip trip) {
        if (trip == null) {
            return "--";
        }

        String from = extractProvinceNameFromPickupPoints(trip.getPickupPoints());
        String to = extractProvinceNameFromDropoffPoints(trip.getDropoffPoints());
        if (!StringUtils.hasText(from) && !StringUtils.hasText(to)) {
            return trip.getId();
        }
        if (!StringUtils.hasText(from)) {
            return "-- - " + to;
        }
        if (!StringUtils.hasText(to)) {
            return from + " - --";
        }
        return from + " - " + to;
    }

    private String extractProvinceNameFromPickupPoints(List<TripPickupPoint> points) {
        if (points == null || points.isEmpty()) {
            return null;
        }
        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(null);
    }

    private String extractProvinceNameFromDropoffPoints(List<TripDropoffPoint> points) {
        if (points == null || points.isEmpty()) {
            return null;
        }
        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(null);
    }

    private void markBookingsInProgress(Trip trip, LocalDateTime startedAt) {
        if (trip.getBookings() == null || trip.getBookings().isEmpty()) {
            return;
        }

        for (Booking booking : trip.getBookings()) {
            if (booking == null || booking.getStatus() == null) {
                continue;
            }

            if (booking.getStatus() == BookingStatus.CONFIRMED) {
                booking.setStatus(BookingStatus.CONFIRMED);
                if (booking.getConfirmedAt() == null) {
                    booking.setConfirmedAt(startedAt);
                }
                booking.setCancelledAt(null);
                booking.setCancellationReason(null);
                booking.setCompletedAt(null);
            }
        }
    }

    private void markBookingsCompleted(Trip trip, LocalDateTime completedAt) {
        if (trip.getBookings() == null || trip.getBookings().isEmpty()) {
            return;
        }

        for (Booking booking : trip.getBookings()) {
            if (booking == null || booking.getStatus() == null) {
                continue;
            }

            if (booking.getStatus() == BookingStatus.CONFIRMED || booking.getStatus() == BookingStatus.PENDING) {
                booking.setStatus(BookingStatus.COMPLETED);
                if (booking.getConfirmedAt() == null) {
                    booking.setConfirmedAt(completedAt);
                }
                booking.setCompletedAt(completedAt);
                booking.setCancelledAt(null);
                booking.setCancellationReason(null);
            }
        }
    }

    /**
     * Tính toán và trả về thống kê hiệu suất của tài xế trong tháng hiện tại.
     *
     * <p>Doanh thu được tính theo công thức:
     * {@code revenue = Σ (pricePerSeat × (totalSeats - availableSeats))}
     * cho các chuyến không bị hủy trong tháng. Chuyến hủy bị loại trừ
     * vì tiền đã được hoàn lại cho hành khách.</p>
     *
     * @return Map với 3 key: {@code thisMonth} (Map con), {@code rating} (Double),
     *         {@code totalReviews} (Integer)
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getDriverStats() {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        List<Trip> actualTrips = tripRepository.findByDriverIdAndDepartureTimeIsNotNullOrderByDepartureTimeDesc(driverProfile.getId());

        YearMonth now = YearMonth.now();
        List<Trip> thisMonthTrips = actualTrips.stream()
                .filter(t -> t.getDepartureTime() != null && YearMonth.from(t.getDepartureTime()).equals(now))
                .collect(Collectors.toList());

        int totalRides = thisMonthTrips.size();
        int completedRides = (int) thisMonthTrips.stream().filter(t -> t.getStatus() == TripStatus.COMPLETED).count();
        int cancelledRides = (int) thisMonthTrips.stream().filter(t -> t.getStatus() == TripStatus.CANCELLED).count();

        // Loại bỏ chuyến hủy khỏi doanh thu vì đã hoàn tiền cho hành khách.
        long revenue = thisMonthTrips.stream()
                .filter(t -> t.getStatus() != TripStatus.CANCELLED)
                .mapToLong(this::calculateTripRevenue)
                .sum();

        Map<String, Object> thisMonth = new HashMap<>();
        thisMonth.put("totalRides", totalRides);
        thisMonth.put("completedRides", completedRides);
        thisMonth.put("cancelledRides", cancelledRides);
        thisMonth.put("revenue", revenue);

        Map<String, Object> data = new HashMap<>();
        data.put("thisMonth", thisMonth);
        data.put("rating", driverProfile.getDriverRating() == null ? 0.0 : driverProfile.getDriverRating());
        data.put("totalReviews", driverProfile.getTotalDriverRides() == null ? 0 : driverProfile.getTotalDriverRides());
        return data;
    }

    private long calculateTripRevenue(Trip t) {
        long fare = t.getPricePerSeat() == null ? 0L : t.getPricePerSeat().longValue();
        int total = t.getTotalSeats() == null ? 0 : t.getTotalSeats();
        int available = t.getAvailableSeats() == null ? 0 : t.getAvailableSeats();
        int booked = Math.max(0, total - available);
        return fare * booked;
    }

    /**
     * Validate tính hợp lệ của request tạo chuyến trước khi xử lý nghiệp vụ.
     *
     * <p>Các ràng buộc:
     * <ul>
     *   <li>Phải có {@code departureDate} và {@code departureTime}</li>
     *   <li>Nếu không có {@code routeId} (tạo từ đầu): phải có tỉnh đi, tỉnh đến,
     *       ít nhất 1 pickup cluster, ít nhất 1 dropoff cluster, giá vé >= 1.000đ</li>
     *   <li>Nếu có {@code routeId} (tái sử dụng template): chỉ cần ngày giờ</li>
     * </ul>
     * </p>
     *
     * @param request request cần validate
     * @throws AppException {@code INVALID_KEY} nếu vi phạm bất kỳ ràng buộc nào
     */
    private void validateCreateRequest(DriverTripRequest request) {
        if (request == null
                || !StringUtils.hasText(request.getDepartureDate())
                || !StringUtils.hasText(request.getDepartureTime())) {
            throw new AppException(ErrorCode.INVALID_KEY);
        }

        if (!StringUtils.hasText(request.getRouteId())) {
            if (!StringUtils.hasText(request.getPickupProvince())
                    && !StringUtils.hasText(request.getPickupProvinceId())) {
                throw new AppException(ErrorCode.INVALID_KEY);
            }
            if (!StringUtils.hasText(request.getDropoffProvince())
                    && !StringUtils.hasText(request.getDropoffProvinceId())) {
                throw new AppException(ErrorCode.INVALID_KEY);
            }
            if (request.getPickupClusters() == null || request.getPickupClusters().isEmpty()
                    || request.getDropoffClusters() == null || request.getDropoffClusters().isEmpty()) {
                throw new AppException(ErrorCode.INVALID_KEY);
            }
            if (request.getFixedFare() == null || request.getFixedFare() < 1000) {
                throw new AppException(ErrorCode.INVALID_KEY);
            }
        }
    }

    /**
     * Resolve hoặc tạo route template từ thông tin tỉnh và clusters do tài xế nhập.
     *
     * <p><b>Cơ chế tái sử dụng template:</b>
     * Nếu tài xế tạo chuyến với cùng tuyến đường (cùng ward IDs pickup và dropoff)
     * và cùng giá vé, hệ thống sẽ tái sử dụng template đã có thay vì tạo mới.
     * Điều này tránh duplicate data và giúp tài xế dễ tạo chuyến định kỳ trên
     * cùng tuyến.</p>
     *
     * <p><b>Lưu ý:</b> Template mới (chưa từng tồn tại trong DB) được build
     * in-memory nhưng KHÔNG được persist ở đây. Việc lưu xảy ra khi Trip
     * thực tế được lưu với cascade, tránh tạo row rỗng trong bảng trip.</p>
     *
     * @param driverProfile hồ sơ tài xế đang tạo chuyến
     * @param request       dữ liệu tạo chuyến từ client
     * @return Trip entity đóng vai trò route template (có thể chưa có ID nếu tạo mới)
     * @throws AppException {@code INVALID_KEY} nếu tỉnh hoặc ward không tìm thấy trong DB
     */
    private Trip resolveOrCreateTemplate(DriverProfile driverProfile, DriverTripRequest request) {
        if (StringUtils.hasText(request.getRouteId())) {
            return tripRepository.findByIdAndDriverIdAndDepartureTimeIsNull(request.getRouteId(), driverProfile.getId())
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));
        }

        Province pickupProvince = resolveProvince(request.getPickupProvinceId(), request.getPickupProvince());
        Province dropoffProvince = resolveProvince(request.getDropoffProvinceId(), request.getDropoffProvince());

        List<String> pickupClusterNames = cleanClusters(request.getPickupClusters());
        List<String> dropoffClusterNames = cleanClusters(request.getDropoffClusters());

        List<Ward> pickupWards = resolveWards(pickupProvince.getId(), pickupClusterNames);
        List<Ward> dropoffWards = resolveWards(dropoffProvince.getId(), dropoffClusterNames);

        BigDecimal fare = BigDecimal.valueOf(request.getFixedFare());

        List<Trip> templates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());
        Optional<Trip> matchedTemplate = templates.stream()
            .filter(t -> isSameRouteTemplate(t, pickupWards, dropoffWards, fare))
                .findFirst();

        if (matchedTemplate.isPresent()) {
            return matchedTemplate.get();
        }

        Trip template = Trip.builder()
                .driver(driverProfile)
                .pricePerSeat(fare)
                .status(TripStatus.OPEN)
                .pickupPoints(new ArrayList<>())
                .dropoffPoints(new ArrayList<>())
                .build();

        List<TripPickupPoint> pickupPoints = new ArrayList<>();
        for (int i = 0; i < pickupWards.size(); i++) {
            Ward ward = pickupWards.get(i);
            pickupPoints.add(TripPickupPoint.builder()
                    .trip(template)
                    .ward(ward)
                    .address(ward.getName())
                    .sortOrder(i)
                    .build());
        }

        List<TripDropoffPoint> dropoffPoints = new ArrayList<>();
        for (int i = 0; i < dropoffWards.size(); i++) {
            Ward ward = dropoffWards.get(i);
            dropoffPoints.add(TripDropoffPoint.builder()
                    .trip(template)
                    .ward(ward)
                    .address(ward.getName())
                    .sortOrder(i)
                    .build());
        }

        template.setPickupPoints(pickupPoints);
        template.setDropoffPoints(dropoffPoints);

        // Không persist template mới ở đây để tránh tạo row rỗng trong bảng trip.
        return template;
    }

    private Province resolveProvince(String provinceId, String provinceName) {
        if (StringUtils.hasText(provinceId)) {
            return provinceRepository.findById(provinceId.trim())
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));
        }
        if (StringUtils.hasText(provinceName)) {
            return provinceRepository.findByName(provinceName.trim())
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));
        }
        throw new AppException(ErrorCode.INVALID_KEY);
    }

    private List<String> cleanClusters(List<String> clusters) {
        if (clusters == null) {
            return List.of();
        }
        return clusters.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<Ward> resolveWards(String provinceId, List<String> wardNames) {
        List<Ward> wards = new ArrayList<>();
        for (String wardName : wardNames) {
            Ward ward = wardRepository.findByProvinceIdAndWardName(provinceId, wardName)
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));
            wards.add(ward);
        }
        return wards;
    }

    private boolean isSameRouteTemplate(Trip template, List<Ward> pickupWards, List<Ward> dropoffWards, BigDecimal fare) {
        List<String> templatePickup = extractPickupWardIds(template.getPickupPoints());
        List<String> templateDropoff = extractDropoffWardIds(template.getDropoffPoints());
        List<String> requestPickup = pickupWards.stream().map(Ward::getId).collect(Collectors.toList());
        List<String> requestDropoff = dropoffWards.stream().map(Ward::getId).collect(Collectors.toList());
        long templateFare = template.getPricePerSeat() == null ? 0L : template.getPricePerSeat().longValue();

        return templatePickup.equals(requestPickup)
                && templateDropoff.equals(requestDropoff)
                && templateFare == fare.longValue();
    }

    /**
     * Lấy DriverProfile của tài xế đang đăng nhập, hoặc tạo mới nếu chưa có.
     *
     * <p>Logic ưu tiên:
     * <ol>
     *   <li>Tìm profile theo userId trong DB</li>
     *   <li>Nếu có nhiều profile (legacy data từ phiên bản cũ) → chọn profile
     *       có nhiều trip nhất để đảm bảo dữ liệu không bị phân tán</li>
     *   <li>Nếu chưa có profile nào → tạo mới với {@code status = PENDING},
     *       {@code submitted = false}, rating = 0.0</li>
     * </ol>
     * </p>
     *
     * @return DriverProfile của tài xế hiện tại, không bao giờ null
     */
    private DriverProfile getOrCreateDriverProfile() {
        User currentUser = userService.getCurrentUser();
        Optional<DriverProfile> existingProfile = driverProfileRepository.findByUserId(currentUser.getId());
        if (existingProfile.isPresent()) {
            return existingProfile.get();
        }

        // Fallback cho dữ liệu legacy có thể bị duplicate profile.
        List<DriverProfile> profiles = driverProfileRepository.findAllByUserIdOrderByCreatedAtDesc(currentUser.getId());
        if (!profiles.isEmpty()) {
            return profiles.stream()
                .max(Comparator.comparingLong(p -> tripRepository.countByDriverId(p.getId())))
                .orElse(profiles.get(0));
        }

        return driverProfileRepository.save(
            DriverProfile.builder()
                .user(currentUser)
                .status(DriverStatus.PENDING)
                .driverRating(0.0)
                .totalDriverRides(0)
                .submitted(false)
                .build()
        );
    }

    /**
     * Phân tích ngày giờ khởi hành từ 2 chuỗi riêng biệt thành {@link LocalDateTime}.
     *
     * <p>Hỗ trợ 2 định dạng ngày để tương thích với cả web form và mobile app:
     * <ul>
     *   <li>ISO: {@code yyyy-MM-dd} (mặc định của DatePicker trên một số platform)</li>
     *   <li>Việt Nam: {@code dd/MM/yyyy} (quen thuộc với người dùng VN)</li>
     * </ul>
     * </p>
     *
     * @param departureDate chuỗi ngày (yyyy-MM-dd hoặc dd/MM/yyyy)
     * @param departureTime chuỗi giờ (HH:mm)
     * @return LocalDateTime kết hợp ngày và giờ
     * @throws AppException {@code INVALID_KEY} nếu không parse được định dạng nào
     */
    private LocalDateTime parseDepartureDateTime(String departureDate, String departureTime) {
        LocalDate date = parseDateFlexible(departureDate);
        LocalTime time = parseTimeFlexible(departureTime);
        return LocalDateTime.of(date, time);
    }

    private LocalDate parseDateFlexible(String text) {
        String raw = text.trim();
        try {
            return LocalDate.parse(raw, isoDate);
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDate.parse(raw, viDate);
        } catch (DateTimeParseException ignored) {
        }
        throw new AppException(ErrorCode.INVALID_KEY);
    }

    private LocalTime parseTimeFlexible(String text) {
        String raw = text.trim();
        try {
            return LocalTime.parse(raw, uiTime);
        } catch (DateTimeParseException ignored) {
        }
        throw new AppException(ErrorCode.INVALID_KEY);
    }

    private DriverTripResponse toTripResponse(Trip trip, List<Trip> routeTemplates) {
        String routeId = matchTemplateId(trip, routeTemplates).orElse(trip.getId());

        String pickupProvince = trip.getPickupPoints().stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

        String dropoffProvince = trip.getDropoffPoints().stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

        LocalDateTime departure = trip.getDepartureTime();

        return DriverTripResponse.builder()
                .id(trip.getId())
                .routeId(routeId)
                .pickupProvince(pickupProvince)
                .dropoffProvince(dropoffProvince)
                .departureDate(departure == null ? null : departure.toLocalDate().format(isoDate))
                .departureTime(departure == null ? null : departure.toLocalTime().format(uiTime))
                .totalSeats(trip.getTotalSeats() == null ? 0 : trip.getTotalSeats())
                .availableSeats(trip.getAvailableSeats() == null ? 0 : trip.getAvailableSeats())
                .fixedFare(trip.getPricePerSeat() == null ? 0L : trip.getPricePerSeat().longValue())
                .status(toUiStatus(trip.getStatus()))
                .build();
    }

            private DriverTripResponse toTripListResponse(Trip trip) {
            String pickupProvince = trip.getPickupPoints().stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

            String dropoffProvince = trip.getDropoffPoints().stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

            LocalDateTime departure = trip.getDepartureTime();

            return DriverTripResponse.builder()
                .id(trip.getId())
                .routeId(trip.getId())
                .pickupProvince(pickupProvince)
                .dropoffProvince(dropoffProvince)
                .departureDate(departure == null ? null : departure.toLocalDate().format(isoDate))
                .departureTime(departure == null ? null : departure.toLocalTime().format(uiTime))
                .totalSeats(trip.getTotalSeats() == null ? 0 : trip.getTotalSeats())
                .availableSeats(trip.getAvailableSeats() == null ? 0 : trip.getAvailableSeats())
                .fixedFare(trip.getPricePerSeat() == null ? 0L : trip.getPricePerSeat().longValue())
                .status(toUiStatus(trip.getStatus()))
                .build();
            }

    private List<DriverTripDetailResponse.PointInfo> mapPickupPoints(List<TripPickupPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }

        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> DriverTripDetailResponse.PointInfo.builder()
                        .id(p.getId())
                        .wardName(p.getWard() == null ? null : p.getWard().getName())
                        .provinceName(p.getWard() == null || p.getWard().getProvince() == null ? null : p.getWard().getProvince().getName())
                        .address(p.getAddress())
                        .sortOrder(p.getSortOrder())
                        .time(p.getPickupTime() == null ? null : p.getPickupTime().toString())
                        .note(p.getNote())
                        .build())
                .collect(Collectors.toList());
    }

    private List<DriverTripDetailResponse.PointInfo> mapDropoffPoints(List<TripDropoffPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }

        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> DriverTripDetailResponse.PointInfo.builder()
                        .id(p.getId())
                        .wardName(p.getWard() == null ? null : p.getWard().getName())
                        .provinceName(p.getWard() == null || p.getWard().getProvince() == null ? null : p.getWard().getProvince().getName())
                        .address(p.getAddress())
                        .sortOrder(p.getSortOrder())
                        .time(p.getDropoffTime() == null ? null : p.getDropoffTime().toString())
                        .note(p.getNote())
                        .build())
                .collect(Collectors.toList());
    }

    private List<DriverTripDetailResponse.BookingInfo> mapBookings(List<Booking> bookings) {
        if (bookings == null || bookings.isEmpty()) {
            return List.of();
        }

        return bookings.stream()
                .sorted(Comparator.comparing(Booking::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toBookingInfo)
                .collect(Collectors.toList());
    }

    private DriverTripDetailResponse.BookingInfo toBookingInfo(Booking booking) {
        Payment payment = booking.getPayment();
        User customer = booking.getCustomer();

        return DriverTripDetailResponse.BookingInfo.builder()
                .id(booking.getId())
                .status(booking.getStatus() == null ? null : booking.getStatus().name())
                .seatCount(booking.getSeatCount())
                .totalPrice(booking.getTotalPrice())
                .distanceKm(booking.getDistanceKm())
                .pickupAddress(booking.getPickupAddress())
                .pickupLat(booking.getPickupLat())
                .pickupLng(booking.getPickupLng())
                .dropoffAddress(booking.getDropoffAddress())
                .dropoffLat(booking.getDropoffLat())
                .dropoffLng(booking.getDropoffLng())
                .passengerName(booking.getPassengerName())
                .contactPhone(booking.getContactPhone())
                .customerNote(booking.getCustomerNote())
                .createdAt(formatDateTime(booking.getCreatedAt()))
                .confirmedAt(formatDateTime(booking.getConfirmedAt()))
                .cancelledAt(formatDateTime(booking.getCancelledAt()))
                .cancellationReason(booking.getCancellationReason())
                .completedAt(formatDateTime(booking.getCompletedAt()))
                .customerId(customer == null ? null : customer.getId())
                .customerName(customer == null ? null : customer.getFullName())
                .customerPhone(customer == null ? null : customer.getPhoneNumber())
                .customerEmail(customer == null ? null : customer.getEmail())
                .customerAvatarUrl(customer == null ? null : customer.getAvatarUrl())
                .paymentMethod(payment == null || payment.getMethod() == null ? null : payment.getMethod().name())
                .paymentStatus(payment == null || payment.getStatus() == null ? null : payment.getStatus().name())
                .paymentAmount(payment == null ? null : payment.getAmount())
                .transactionId(payment == null ? null : payment.getTransactionId())
                .paidAt(payment == null ? null : formatDateTime(payment.getPaidAt()))
                .build();
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? null : value.toString();
    }

    private Optional<String> matchTemplateId(Trip trip, List<Trip> templates) {
        if (templates == null || templates.isEmpty()) {
            return Optional.empty();
        }

        List<String> pickup = extractPickupWardIds(trip.getPickupPoints());
        List<String> dropoff = extractDropoffWardIds(trip.getDropoffPoints());

        return templates.stream()
            .filter(t -> pickup.equals(extractPickupWardIds(t.getPickupPoints()))
                && dropoff.equals(extractDropoffWardIds(t.getDropoffPoints())))
                .map(Trip::getId)
                .filter(StringUtils::hasText)
                .findFirst();
    }

        private List<String> extractPickupWardIds(List<TripPickupPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        return points.stream()
            .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
            .map(p -> p.getWard() != null ? p.getWard().getId() : "")
            .collect(Collectors.toList());
        }

        private List<String> extractDropoffWardIds(List<TripDropoffPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        return points.stream()
            .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
            .map(p -> p.getWard() != null ? p.getWard().getId() : "")
            .collect(Collectors.toList());
        }

    private List<String> extractPickupWardNames(List<TripPickupPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> p.getWard() != null ? p.getWard().getName() : "")
                .collect(Collectors.toList());
    }

    private List<String> extractDropoffWardNames(List<TripDropoffPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> p.getWard() != null ? p.getWard().getName() : "")
                .collect(Collectors.toList());
    }

    /**
     * Chuyển đổi chuỗi trạng thái từ client về {@link TripStatus} enum nội bộ.
     * Chấp nhận cả tiếng Anh kỹ thuật ("in_progress") và UI string ("ongoing").
     */
    private TripStatus toTripStatus(String uiStatus) {
        if (!StringUtils.hasText(uiStatus)) {
            return TripStatus.OPEN;
        }

        switch (uiStatus.trim().toLowerCase(Locale.ROOT)) {
            case "scheduled":
            case "pending":
                return TripStatus.OPEN;
            case "ongoing":
            case "in_progress":
                return TripStatus.IN_PROGRESS;
            case "completed":
                return TripStatus.COMPLETED;
            case "cancelled":
                return TripStatus.CANCELLED;
            default:
                return TripStatus.OPEN;
        }
    }

    /**
     * Chuyển đổi {@link TripStatus} enum nội bộ sang chuỗi UI-friendly để trả về client.
     *
     * <p>Mapping: OPEN/FULL → "scheduled", IN_PROGRESS → "ongoing",
     * COMPLETED → "completed", CANCELLED → "cancelled".
     * Cách này tách biệt model nội bộ khỏi API contract, cho phép thay đổi
     * giá trị enum mà không break client.</p>
     */
    private String toUiStatus(TripStatus status) {
        if (status == null) {
            return "scheduled";
        }
        switch (status) {
            case IN_PROGRESS:
                return "ongoing";
            case COMPLETED:
                return "completed";
            case CANCELLED:
                return "cancelled";
            case OPEN:
            case FULL:
            default:
                return "scheduled";
        }
    }
}
