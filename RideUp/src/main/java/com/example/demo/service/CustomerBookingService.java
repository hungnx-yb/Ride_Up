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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CustomerBookingService {

    TripRepository tripRepository;
    BookingRepository bookingRepository;
        BookingReviewRepository bookingReviewRepository;
    UserService userService;

    @Transactional(readOnly = true)
    public List<RideSearchResponse> searchRides(String fromProvinceId,
                                                String toProvinceId,
                                                String fromWardId,
                                                String toWardId,
                                                String departureDate) {
        LocalDate searchDate = parseDateOrNull(departureDate);

        List<Trip> candidates = tripRepository.searchTrips(fromWardId, toWardId, searchDate);

        return candidates.stream()
                .filter(t -> t.getAvailableSeats() != null && t.getAvailableSeats() > 0)
            .filter(t -> t.getStatus() == TripStatus.OPEN || t.getStatus() == TripStatus.FULL)
                .map(this::toRideSearchResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CustomerBookingResponse> getMyBookings() {
        User currentUser = userService.getCurrentUser();
        return bookingRepository.findByCustomerIdWithDetails(currentUser.getId())
                .stream()
                .map(this::toCustomerBookingResponse)
                .toList();
    }

    @Transactional
    public CustomerBookingResponse createBooking(CreateBookingRequest request) {
        validateCreateRequest(request);

        User currentUser = userService.getCurrentUser();

        Trip trip = tripRepository.findByIdForUpdate(request.getTripId())
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));

        TripPickupPoint pickupPoint = trip.getPickupPoints().stream()
                .filter(p -> Objects.equals(p.getId(), request.getPickupPointId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));

        TripDropoffPoint dropoffPoint = trip.getDropoffPoints().stream()
                .filter(p -> Objects.equals(p.getId(), request.getDropoffPointId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));

        int seatCount = request.getSeatCount() == null ? 1 : request.getSeatCount();
        if (seatCount < 1) {
            throw new AppException(ErrorCode.INVALID_KEY);
        }

        int availableSeats = trip.getAvailableSeats() == null ? 0 : trip.getAvailableSeats();
        if (availableSeats < seatCount || trip.getStatus() == TripStatus.CANCELLED || trip.getStatus() == TripStatus.COMPLETED) {
            throw new AppException(ErrorCode.INVALID_KEY);
        }

        BigDecimal fare = trip.getPricePerSeat() == null ? BigDecimal.ZERO : trip.getPricePerSeat();
        BigDecimal totalPrice = fare.multiply(BigDecimal.valueOf(seatCount));

        PaymentMethod paymentMethod = parsePaymentMethod(request.getPaymentMethod());
        BookingStatus initialStatus = paymentMethod == PaymentMethod.BANK_TRANSFER
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
                .pickupAddress(pickupPoint.getAddress())
                .dropoffAddress(dropoffPoint.getAddress())
                .build();

        Payment payment = Payment.builder()
                .booking(booking)
                .amount(totalPrice)
                .method(paymentMethod)
                .status(paymentMethod == PaymentMethod.BANK_TRANSFER ? PaymentStatus.UNPAID : PaymentStatus.UNPAID)
                .paidAt(null)
                .build();
        booking.setPayment(payment);

        int newAvailable = availableSeats - seatCount;
        trip.setAvailableSeats(newAvailable);
        trip.setStatus(newAvailable == 0 ? TripStatus.FULL : TripStatus.OPEN);

        Booking saved = bookingRepository.save(booking);
        return toCustomerBookingResponse(saved);
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
            throw new AppException(ErrorCode.INVALID_KEY);
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
                        .build())
                .toList();

        List<RideSearchResponse.PointOption> dropoffOptions = trip.getDropoffPoints().stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> RideSearchResponse.PointOption.builder()
                        .id(p.getId())
                        .wardId(p.getWard() != null ? p.getWard().getId() : null)
                        .wardName(p.getWard() != null ? p.getWard().getName() : null)
                        .address(StringUtils.hasText(p.getAddress()) ? p.getAddress() : (p.getWard() != null ? p.getWard().getName() : ""))
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
        Trip trip = booking.getTrip();

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
                .driverRating(trip.getDriver() != null ? trip.getDriver().getDriverRating() : 0.0)
                .paymentMethod(booking.getPayment() != null && booking.getPayment().getMethod() != null ? booking.getPayment().getMethod().name() : null)
                .paymentStatus(booking.getPayment() != null && booking.getPayment().getStatus() != null ? booking.getPayment().getStatus().name() : null)
                .hasRated(booking.getReview() != null)
                .myRating(booking.getReview() != null ? booking.getReview().getRating() : null)
                .build();
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
                        return PaymentMethod.valueOf(method.trim().toUpperCase());
                } catch (IllegalArgumentException ex) {
                        throw new AppException(ErrorCode.INVALID_KEY);
                }
        }
}
