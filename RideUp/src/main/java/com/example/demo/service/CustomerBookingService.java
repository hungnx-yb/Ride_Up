package com.example.demo.service;

import com.example.demo.dto.request.CreateBookingRequest;
import com.example.demo.dto.request.CreateBookingReviewRequest;
import com.example.demo.dto.request.ConfirmPaymentRequest;
import com.example.demo.dto.response.BookingReviewResponse;
import com.example.demo.dto.response.CustomerBookingResponse;
import com.example.demo.dto.response.RideSearchResponse;
import com.example.demo.entity.Booking;
import com.example.demo.entity.BookingReview;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.Payment;
import com.example.demo.entity.Trip;
import com.example.demo.entity.TripDropoffPoint;
import com.example.demo.entity.TripPickupPoint;
import com.example.demo.entity.User;
import com.example.demo.entity.Vehicle;
import com.example.demo.enums.BookingStatus;
import com.example.demo.enums.PaymentMethod;
import com.example.demo.enums.PaymentStatus;
import com.example.demo.enums.TripStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.BookingRepository;
import com.example.demo.repository.BookingReviewRepository;
import com.example.demo.repository.TripRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CustomerBookingService {

    TripRepository tripRepository;
    BookingRepository bookingRepository;
        BookingReviewRepository bookingReviewRepository;
        ChatService chatService;
    UserService userService;
        VnPayService vnPayService;

    @Transactional(readOnly = true)
    public List<RideSearchResponse> searchRides(String fromProvinceId,
                                                String toProvinceId,
                                                String fromWardId,
                                                String toWardId,
                                                String departureDate,
                                                String status,
                                                Integer page,
                                                Integer size) {
        LocalDate searchDate = parseDateOrNull(departureDate);
        TripStatus targetStatus = parseSearchRideStatus(status);
        int safePage = page == null ? 0 : Math.max(page, 0);
        int safeSize = size == null ? 20 : Math.min(Math.max(size, 1), 50);

        List<Trip> candidates = tripRepository.searchTrips(fromWardId, toWardId, searchDate, targetStatus, safePage, safeSize);

        return candidates.stream()
                .map(this::toRideSearchResponse)
                .toList();
    }

        private TripStatus parseSearchRideStatus(String status) {
                if (!StringUtils.hasText(status)) {
                        return TripStatus.OPEN;
                }
                try {
                        return TripStatus.valueOf(status.trim().toUpperCase());
                } catch (IllegalArgumentException ex) {
                        return TripStatus.OPEN;
                }
        }

    @Transactional(readOnly = true)
    public List<CustomerBookingResponse> getMyBookings() {
                return getMyBookings(0, 100);
        }

        @Transactional(readOnly = true)
        public List<CustomerBookingResponse> getMyBookings(Integer page, Integer size) {
        User currentUser = userService.getCurrentUser();

                int safePage = page == null ? 0 : Math.max(page, 0);
                int safeSize = size == null ? 100 : Math.min(Math.max(size, 1), 100);

                List<String> bookingIds = bookingRepository.findIdsByCustomerId(
                                                currentUser.getId(),
                                                PageRequest.of(safePage, safeSize)
                                )
                                .getContent();

                if (bookingIds.isEmpty()) {
                        return List.of();
                }

                return bookingRepository.findByIdInWithDetailsOrderByCreatedAtDesc(bookingIds)
                .stream()
                .map(this::toCustomerBookingResponse)
                .toList();
    }

        @Transactional
        public CustomerBookingResponse createBooking(CreateBookingRequest request, String ipAddress) {
        validateCreateRequest(request);

        User currentUser = userService.getCurrentUser();

        Trip trip = tripRepository.findByIdForUpdate(request.getTripId())
                                .orElseThrow(() -> {
                                        log.warn("Create booking failed: trip not found, tripId={}", request.getTripId());
                                        return new AppException(ErrorCode.TRIP_NOT_FOUND);
                                });

        TripPickupPoint pickupPoint = trip.getPickupPoints().stream()
                .filter(p -> Objects.equals(p.getId(), request.getPickupPointId()))
                .findFirst()
                                .orElseThrow(() -> {
                                        log.warn("Create booking failed: pickup point not in trip, tripId={}, pickupPointId={}", trip.getId(), request.getPickupPointId());
                                        return new AppException(ErrorCode.BOOKING_POINT_NOT_FOUND);
                                });

        TripDropoffPoint dropoffPoint = trip.getDropoffPoints().stream()
                .filter(p -> Objects.equals(p.getId(), request.getDropoffPointId()))
                .findFirst()
                                .orElseThrow(() -> {
                                        log.warn("Create booking failed: dropoff point not in trip, tripId={}, dropoffPointId={}", trip.getId(), request.getDropoffPointId());
                                        return new AppException(ErrorCode.BOOKING_POINT_NOT_FOUND);
                                });

        Double pickupLat = request.getPickupLat();
        Double pickupLng = request.getPickupLng();
        Double dropoffLat = request.getDropoffLat();
        Double dropoffLng = request.getDropoffLng();

        validateCoordinatePair(pickupLat, pickupLng);
        validateCoordinatePair(dropoffLat, dropoffLng);

        Double pickupWardLat = pickupPoint.getWard() != null && pickupPoint.getWard().getLat() != null ? pickupPoint.getWard().getLat().doubleValue() : null;
        Double pickupWardLng = pickupPoint.getWard() != null && pickupPoint.getWard().getLng() != null ? pickupPoint.getWard().getLng().doubleValue() : null;
        Double dropoffWardLat = dropoffPoint.getWard() != null && dropoffPoint.getWard().getLat() != null ? dropoffPoint.getWard().getLat().doubleValue() : null;
        Double dropoffWardLng = dropoffPoint.getWard() != null && dropoffPoint.getWard().getLng() != null ? dropoffPoint.getWard().getLng().doubleValue() : null;

        validateWithinRadius(pickupWardLat, pickupWardLng, pickupLat, pickupLng, 20.0);
        validateWithinRadius(dropoffWardLat, dropoffWardLng, dropoffLat, dropoffLng, 20.0);

        int seatCount = request.getSeatCount() == null ? 1 : request.getSeatCount();
        if (seatCount < 1) {
                        throw new AppException(ErrorCode.BOOKING_REQUEST_INVALID);
        }

        int availableSeats = trip.getAvailableSeats() == null ? 0 : trip.getAvailableSeats();
        if (availableSeats < seatCount || trip.getStatus() == TripStatus.CANCELLED || trip.getStatus() == TripStatus.COMPLETED) {
                        log.warn("Create booking failed: seats/status invalid, tripId={}, availableSeats={}, requestedSeats={}, status={}",
                                        trip.getId(), availableSeats, seatCount, trip.getStatus());
                        throw new AppException(ErrorCode.TRIP_NO_AVAILABLE_SEATS);
        }

        BigDecimal fare = trip.getPricePerSeat() == null ? BigDecimal.ZERO : trip.getPricePerSeat();
        BigDecimal totalPrice = fare.multiply(BigDecimal.valueOf(seatCount));

        PaymentMethod paymentMethod = parsePaymentMethod(request.getPaymentMethod());
        BookingStatus initialStatus = paymentMethod == PaymentMethod.VNPAY
                ? BookingStatus.PENDING
                : BookingStatus.CONFIRMED;

        Booking booking = Booking.builder()
                .trip(trip)
                .customer(currentUser)
                .pickupPoint(pickupPoint)
                .dropoffPoint(dropoffPoint)
                .seatCount(seatCount)
                .totalPrice(totalPrice)
                .status(initialStatus)
                .confirmedAt(initialStatus == BookingStatus.CONFIRMED ? java.time.LocalDateTime.now() : null)
                .customerNote(StringUtils.hasText(request.getCustomerNote()) ? request.getCustomerNote().trim() : null)
                .passengerName(StringUtils.hasText(request.getPassengerName()) ? request.getPassengerName().trim() : currentUser.getFullName())
                .contactPhone(StringUtils.hasText(request.getContactPhone()) ? request.getContactPhone().trim() : currentUser.getPhoneNumber())
                .pickupAddress(StringUtils.hasText(request.getPickupAddress()) ? request.getPickupAddress().trim() : pickupPoint.getAddress())
                .pickupLat(pickupLat)
                .pickupLng(pickupLng)
                .dropoffAddress(StringUtils.hasText(request.getDropoffAddress()) ? request.getDropoffAddress().trim() : dropoffPoint.getAddress())
                .dropoffLat(dropoffLat)
                .dropoffLng(dropoffLng)
                .build();

        Payment payment = Payment.builder()
                .booking(booking)
                .amount(totalPrice)
                .method(paymentMethod)
                .status(PaymentStatus.UNPAID)
                .paidAt(null)
                .build();
        booking.setPayment(payment);

        int newAvailable = availableSeats - seatCount;
        trip.setAvailableSeats(newAvailable);
        trip.setStatus(newAvailable == 0 ? TripStatus.FULL : TripStatus.OPEN);

        Booking saved = bookingRepository.save(booking);
        chatService.ensureThreadForConfirmedBooking(saved.getId());

        String paymentUrl = null;
        if (paymentMethod == PaymentMethod.VNPAY) {
                paymentUrl = createVnPayPaymentUrlForBooking(saved, currentUser.getId(), ipAddress);
        }
        return toCustomerBookingResponse(saved, paymentUrl);
    }

        @Transactional
        public Map<String, String> createVnpayPaymentUrl(String bookingId, String ipAddress) {
                if (!StringUtils.hasText(bookingId)) {
                        throw new AppException(ErrorCode.INVALID_KEY);
                }

                User currentUser = userService.getCurrentUser();
                Booking booking = bookingRepository.findByIdWithPayment(bookingId)
                                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

                if (booking.getCustomer() == null || !Objects.equals(booking.getCustomer().getId(), currentUser.getId())) {
                        throw new AppException(ErrorCode.UNAUTHORIZED);
                }

                String paymentUrl = createVnPayPaymentUrlForBooking(booking, currentUser.getId(), ipAddress);
                Map<String, String> result = new LinkedHashMap<>();
                result.put("bookingId", booking.getId());
                result.put("paymentUrl", paymentUrl);
                result.put("transactionRef", booking.getPayment() != null ? booking.getPayment().getTransactionId() : null);
                return result;
        }

        @Transactional
        public Map<String, String> handleVnpayGatewayCallback(Map<String, String> params, boolean ipnRequest) {
                if (params == null || params.isEmpty()) {
                        if (ipnRequest) {
                                return Map.of("RspCode", "99", "Message", "Invalid request");
                        }
                        return Map.of("status", "FAILED", "message", "Invalid callback payload");
                }

                String txnRef = params.get("vnp_TxnRef");
                String responseCode = params.get("vnp_ResponseCode");
                String transactionStatus = params.get("vnp_TransactionStatus");

                if (!StringUtils.hasText(txnRef)) {
                        if (ipnRequest) {
                                return Map.of("RspCode", "01", "Message", "Transaction reference not found");
                        }
                        return Map.of("status", "FAILED", "message", "Missing transaction reference");
                }

                Booking booking = bookingRepository.findByPaymentTransactionId(txnRef).orElse(null);
                if (booking == null) {
                        if (ipnRequest) {
                                return Map.of("RspCode", "01", "Message", "Order not found");
                        }
                        return Map.of("status", "FAILED", "message", "Order not found");
                }

                boolean validSignature = vnPayService.verifyReturn(params);
                if (!validSignature) {
                        if (ipnRequest) {
                                return Map.of("RspCode", "97", "Message", "Invalid signature");
                        }
                        return Map.of("status", "FAILED", "message", "Invalid signature");
                }

                boolean success = "00".equals(responseCode)
                                && (!StringUtils.hasText(transactionStatus) || "00".equals(transactionStatus));

                Payment payment = booking.getPayment();
                boolean alreadyPaid = payment != null && payment.getStatus() == PaymentStatus.PAID;

                if (ipnRequest && alreadyPaid) {
                        return Map.of("RspCode", "02", "Message", "Order already confirmed");
                }

                completeVnpayPayment(booking, success, params.get("vnp_TransactionNo"));

                if (ipnRequest) {
                        return Map.of("RspCode", "00", "Message", "Confirm Success");
                }

                return Map.of(
                                "status", (success || alreadyPaid) ? "PAID" : "FAILED",
                                "bookingId", booking.getId(),
                                "transactionRef", txnRef,
                                "message", (success || alreadyPaid) ? "Payment success" : "Payment failed"
                );
        }

        @Transactional
        public CustomerBookingResponse confirmBookingPayment(String bookingId, ConfirmPaymentRequest request) {
                if (!StringUtils.hasText(bookingId)) {
                        throw new AppException(ErrorCode.INVALID_KEY);
                }

                User currentUser = userService.getCurrentUser();

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

                if (booking.getCustomer() == null || !Objects.equals(booking.getCustomer().getId(), currentUser.getId())) {
                        throw new AppException(ErrorCode.UNAUTHORIZED);
                }

                Payment payment = booking.getPayment();
                if (payment == null) {
                        throw new AppException(ErrorCode.PAYMENT_NOT_FOUND);
                }

                if (payment.getMethod() != PaymentMethod.BANK_TRANSFER
                                || payment.getStatus() == PaymentStatus.PAID
                                || booking.getStatus() == BookingStatus.CANCELLED_BY_CUSTOMER
                                || booking.getStatus() == BookingStatus.CANCELLED_BY_DRIVER
                                || booking.getStatus() == BookingStatus.COMPLETED
                                || booking.getStatus() == BookingStatus.NO_SHOW) {
                        throw new AppException(ErrorCode.PAYMENT_CONFIRM_NOT_ALLOWED);
                }

                payment.setStatus(PaymentStatus.PAID);
                payment.setPaidAt(java.time.LocalDateTime.now());
                if (request != null && StringUtils.hasText(request.getTransactionId())) {
                        payment.setTransactionId(request.getTransactionId().trim());
                }

                booking.setStatus(BookingStatus.CONFIRMED);
                if (booking.getConfirmedAt() == null) {
                        booking.setConfirmedAt(java.time.LocalDateTime.now());
                }

                Booking saved = bookingRepository.save(booking);
                chatService.ensureThreadForConfirmedBooking(saved.getId());
                return toCustomerBookingResponse(saved);
        }

        @Transactional
        public BookingReviewResponse createBookingReview(String bookingId, CreateBookingReviewRequest request) {
                if (!StringUtils.hasText(bookingId) || request == null || request.getRating() == null) {
                        throw new AppException(ErrorCode.INVALID_KEY);
                }

                int rating = request.getRating();
                if (rating < 1 || rating > 5) {
                        throw new AppException(ErrorCode.REVIEW_INVALID_RATING);
                }

                User currentUser = userService.getCurrentUser();

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

                if (booking.getCustomer() == null || !Objects.equals(booking.getCustomer().getId(), currentUser.getId())) {
                        throw new AppException(ErrorCode.UNAUTHORIZED);
                }

                if (booking.getStatus() != BookingStatus.COMPLETED) {
                        throw new AppException(ErrorCode.REVIEW_NOT_ALLOWED);
                }

                if (bookingReviewRepository.existsByBookingId(bookingId)) {
                        throw new AppException(ErrorCode.REVIEW_ALREADY_EXISTS);
                }

                Trip trip = booking.getTrip();
                DriverProfile driver = trip != null ? trip.getDriver() : null;
                if (trip == null || driver == null) {
                        throw new AppException(ErrorCode.INVALID_KEY);
                }

                BookingReview review = BookingReview.builder()
                                .booking(booking)
                                .trip(trip)
                                .customer(currentUser)
                                .driver(driver)
                                .rating(rating)
                                .comment(StringUtils.hasText(request.getComment()) ? request.getComment().trim() : null)
                                .build();

                BookingReview saved = bookingReviewRepository.save(review);

                Double avg = bookingReviewRepository.averageRatingByDriverId(driver.getId());
                driver.setDriverRating(avg == null ? 0.0 : Math.round(avg * 10.0) / 10.0);

                return BookingReviewResponse.builder()
                                .id(saved.getId())
                                .bookingId(bookingId)
                                .rating(saved.getRating())
                                .comment(saved.getComment())
                                .createdAt(saved.getCreatedAt())
                                .build();
        }

    private void validateCreateRequest(CreateBookingRequest request) {
        if (request == null
                || !StringUtils.hasText(request.getTripId())
                || !StringUtils.hasText(request.getPickupPointId())
                || !StringUtils.hasText(request.getDropoffPointId())) {
                        throw new AppException(ErrorCode.BOOKING_REQUEST_INVALID);
        }
    }

    private RideSearchResponse toRideSearchResponse(Trip trip) {
                User driverUser = trip.getDriver() != null ? trip.getDriver().getUser() : null;
                Vehicle vehicle = trip.getDriver() != null ? trip.getDriver().getVehicle() : null;

        String fromProvince = trip.getPickupPoints().stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

        String toProvince = trip.getDropoffPoints().stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

        List<RideSearchResponse.PointOption> pickupOptions = trip.getPickupPoints().stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> RideSearchResponse.PointOption.builder()
                        .id(p.getId())
                        .wardId(p.getWard() != null ? p.getWard().getId() : null)
                        .wardName(p.getWard() != null ? p.getWard().getName() : null)
                        .address(StringUtils.hasText(p.getAddress()) ? p.getAddress() : (p.getWard() != null ? p.getWard().getName() : ""))
                        .lat(p.getWard() != null && p.getWard().getLat() != null ? p.getWard().getLat().doubleValue() : null)
                        .lng(p.getWard() != null && p.getWard().getLng() != null ? p.getWard().getLng().doubleValue() : null)
                        .build())
                .toList();

        List<RideSearchResponse.PointOption> dropoffOptions = trip.getDropoffPoints().stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> RideSearchResponse.PointOption.builder()
                        .id(p.getId())
                        .wardId(p.getWard() != null ? p.getWard().getId() : null)
                        .wardName(p.getWard() != null ? p.getWard().getName() : null)
                        .address(StringUtils.hasText(p.getAddress()) ? p.getAddress() : (p.getWard() != null ? p.getWard().getName() : ""))
                        .lat(p.getWard() != null && p.getWard().getLat() != null ? p.getWard().getLat().doubleValue() : null)
                        .lng(p.getWard() != null && p.getWard().getLng() != null ? p.getWard().getLng().doubleValue() : null)
                        .build())
                .toList();

        return RideSearchResponse.builder()
                .id(trip.getId())
                .from(fromProvince)
                .to(toProvince)
                .departureTime(trip.getDepartureTime())
                .availableSeats(trip.getAvailableSeats())
                .totalSeats(trip.getTotalSeats())
                .price(trip.getPricePerSeat())
                .tripStatus(trip.getStatus() != null ? trip.getStatus().name() : null)
                .estimatedDistanceKm(trip.getEstimatedDistanceKm())
                .estimatedDurationMinutes(trip.getEstimatedDurationMinutes())
                .driverNote(trip.getDriverNote())
                .driverName(driverUser != null ? driverUser.getFullName() : "")
                .driverRating(trip.getDriver() != null ? trip.getDriver().getDriverRating() : 0.0)
                .driverPhone(driverUser != null ? driverUser.getPhoneNumber() : null)
                .driverTotalRides(trip.getDriver() != null ? trip.getDriver().getTotalDriverRides() : null)
                .driverAvatarUrl(driverUser != null ? driverUser.getAvatarUrl() : null)
                .vehiclePlateNumber(vehicle != null ? vehicle.getPlateNumber() : null)
                .vehicleBrand(vehicle != null ? vehicle.getVehicleBrand() : null)
                .vehicleModel(vehicle != null ? vehicle.getVehicleModel() : null)
                .vehicleColor(vehicle != null ? vehicle.getVehicleColor() : null)
                .vehicleType(vehicle != null && vehicle.getVehicleType() != null ? vehicle.getVehicleType().name() : null)
                .vehicleImageUrl(vehicle != null ? vehicle.getVehicleImage() : null)
                .pickupPoints(pickupOptions)
                .dropoffPoints(dropoffOptions)
                .build();
    }

        private CustomerBookingResponse toCustomerBookingResponse(Booking booking) {
                return toCustomerBookingResponse(booking, null);
        }

        private CustomerBookingResponse toCustomerBookingResponse(Booking booking, String paymentUrl) {
        Trip trip = booking.getTrip();

        String fromProvince = booking.getPickupPoint() != null
                && booking.getPickupPoint().getWard() != null
                && booking.getPickupPoint().getWard().getProvince() != null
                ? booking.getPickupPoint().getWard().getProvince().getName()
                : "";

        String toProvince = booking.getDropoffPoint() != null
                && booking.getDropoffPoint().getWard() != null
                && booking.getDropoffPoint().getWard().getProvince() != null
                ? booking.getDropoffPoint().getWard().getProvince().getName()
                : "";

        return CustomerBookingResponse.builder()
                .id(booking.getId())
                .status(toUiBookingStatus(booking.getStatus()))
                .seatCount(booking.getSeatCount())
                .price(booking.getTotalPrice())
                .from(fromProvince)
                .to(toProvince)
                .pickupPoint(booking.getPickupPoint() != null && booking.getPickupPoint().getWard() != null ? booking.getPickupPoint().getWard().getName() : "")
                .dropPoint(booking.getDropoffPoint() != null && booking.getDropoffPoint().getWard() != null ? booking.getDropoffPoint().getWard().getName() : "")
                .departureTime(trip.getDepartureTime())
                .driverName(trip.getDriver() != null && trip.getDriver().getUser() != null ? trip.getDriver().getUser().getFullName() : "")
                .driverAvatarUrl(trip.getDriver() != null && trip.getDriver().getUser() != null ? trip.getDriver().getUser().getAvatarUrl() : null)
                .driverRating(trip.getDriver() != null ? trip.getDriver().getDriverRating() : 0.0)
                .paymentMethod(booking.getPayment() != null && booking.getPayment().getMethod() != null ? booking.getPayment().getMethod().name() : null)
                .paymentStatus(booking.getPayment() != null && booking.getPayment().getStatus() != null ? booking.getPayment().getStatus().name() : null)
                                .paymentUrl(paymentUrl)
                                .paymentTransactionRef(booking.getPayment() != null ? booking.getPayment().getTransactionId() : null)
                .hasRated(booking.getReview() != null)
                .myRating(booking.getReview() != null ? booking.getReview().getRating() : null)
                .build();
    }

        private String createVnPayPaymentUrlForBooking(Booking booking, String customerId, String ipAddress) {
                if (booking == null || !StringUtils.hasText(booking.getId())) {
                        throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
                }

                Payment payment = booking.getPayment();
                if (payment == null) {
                        throw new AppException(ErrorCode.PAYMENT_NOT_FOUND);
                }

                if (booking.getCustomer() == null || !Objects.equals(booking.getCustomer().getId(), customerId)) {
                        throw new AppException(ErrorCode.UNAUTHORIZED);
                }

                if (payment.getMethod() != PaymentMethod.VNPAY) {
                        throw new AppException(ErrorCode.PAYMENT_CONFIRM_NOT_ALLOWED);
                }

                if (payment.getStatus() == PaymentStatus.PAID || booking.getStatus() == BookingStatus.CONFIRMED) {
                        throw new AppException(ErrorCode.PAYMENT_CONFIRM_NOT_ALLOWED);
                }

                if (!vnPayService.isConfigured()) {
                        throw new AppException(ErrorCode.VNPAY_NOT_CONFIGURED);
                }

                String txnRef = vnPayService.generateTxnRef(booking.getId());
                payment.setTransactionId(txnRef);
                bookingRepository.save(booking);

                String route = "";
                if (booking.getTrip() != null) {
                        route = booking.getTrip().getId();
                }
                String orderInfo = "Thanh toan RideUp " + route + " " + booking.getId();
                return vnPayService.buildPaymentUrl(txnRef, payment.getAmount(), ipAddress, orderInfo);
        }

        private void completeVnpayPayment(Booking booking, boolean success, String gatewayTransactionId) {
                if (booking == null || booking.getPayment() == null) {
                        return;
                }

                Payment payment = booking.getPayment();
                if (payment.getMethod() != PaymentMethod.VNPAY) {
                        return;
                }

                if (payment.getStatus() == PaymentStatus.PAID) {
                        return;
                }

                if (success) {
                        payment.setStatus(PaymentStatus.PAID);
                        payment.setPaidAt(LocalDateTime.now());
                        if (StringUtils.hasText(gatewayTransactionId)) {
                                payment.setTransactionId(gatewayTransactionId.trim());
                        }
                        booking.setStatus(BookingStatus.CONFIRMED);
                        if (booking.getConfirmedAt() == null) {
                                booking.setConfirmedAt(LocalDateTime.now());
                        }
                        chatService.ensureThreadForConfirmedBooking(booking.getId());
                } else {
                        payment.setStatus(PaymentStatus.FAILED);
                }

                bookingRepository.save(booking);
        }

    private String toUiBookingStatus(BookingStatus status) {
                if (status == null) return "confirmed";
        return switch (status) {
            case CONFIRMED -> "confirmed";
                        case PENDING -> "pending";
            case COMPLETED -> "completed";
            case CANCELLED_BY_CUSTOMER, CANCELLED_BY_DRIVER, NO_SHOW -> "cancelled";
        };
    }

    private LocalDate parseDateOrNull(String text) {
        if (!StringUtils.hasText(text)) return null;
        try {
            return LocalDate.parse(text.trim());
        } catch (DateTimeParseException ex) {
            throw new AppException(ErrorCode.INVALID_KEY);
        }
    }

        private PaymentMethod parsePaymentMethod(String method) {
                if (!StringUtils.hasText(method)) return PaymentMethod.CASH;
                try {
                        PaymentMethod parsed = PaymentMethod.valueOf(method.trim().toUpperCase());
                        // Keep compatibility with older clients that still send BANK_TRANSFER.
                        return parsed == PaymentMethod.BANK_TRANSFER ? PaymentMethod.VNPAY : parsed;
                } catch (IllegalArgumentException ex) {
                        throw new AppException(ErrorCode.INVALID_KEY);
                }
        }

        private void validateCoordinatePair(Double lat, Double lng) {
                if (lat == null && lng == null) {
                        return;
                }
                if (lat == null || lng == null) {
                        throw new AppException(ErrorCode.INVALID_KEY);
                }
                if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                        throw new AppException(ErrorCode.INVALID_KEY);
                }
        }

        private void validateWithinRadius(Double centerLat, Double centerLng, Double pickedLat, Double pickedLng, double radiusKm) {
                if (pickedLat == null || pickedLng == null) {
                        return;
                }
                if (centerLat == null || centerLng == null) {
                        return;
                }

                double distanceKm = haversineKm(centerLat, centerLng, pickedLat, pickedLng);
                if (distanceKm > radiusKm) {
                        throw new AppException(ErrorCode.BOOKING_LOCATION_OUT_OF_RANGE);
                }
        }

        private double haversineKm(double lat1, double lng1, double lat2, double lng2) {
                final double earthRadiusKm = 6371.0;
                double dLat = Math.toRadians(lat2 - lat1);
                double dLng = Math.toRadians(lng2 - lng1);

                double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
                double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return earthRadiusKm * c;
        }
}
