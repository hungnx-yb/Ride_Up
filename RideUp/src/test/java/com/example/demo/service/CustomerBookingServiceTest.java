package com.example.demo.service;

import com.example.demo.dto.request.CreateBookingRequest;
import com.example.demo.dto.request.CreateBookingReviewRequest;
import com.example.demo.dto.response.BookingReviewResponse;
import com.example.demo.dto.response.CustomerBookingResponse;
import com.example.demo.entity.*;
import com.example.demo.enums.BookingStatus;
import com.example.demo.enums.PaymentMethod;
import com.example.demo.enums.PaymentStatus;
import com.example.demo.enums.TripStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.BookingRepository;
import com.example.demo.repository.BookingReviewRepository;
import com.example.demo.repository.TripRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerBookingServiceTest {

    @Mock
    TripRepository tripRepository;

    @Mock
    BookingRepository bookingRepository;

    @Mock
    BookingReviewRepository bookingReviewRepository;

    @Mock
    ChatService chatService;

    @Mock
    UserService userService;

    @Mock
    VnPayService vnPayService;

    @Mock
    NotificationRealtimePublisher notificationRealtimePublisher;

    CustomerBookingService customerBookingService;

    User customerUser;

    @BeforeEach
    void setUp() {
        customerBookingService = new CustomerBookingService(
                tripRepository,
                bookingRepository,
                bookingReviewRepository,
                chatService,
                userService,
                vnPayService,
                notificationRealtimePublisher
        );

        customerUser = new User();
        customerUser.setId("cust-123");
        customerUser.setFullName("Customer User");
        customerUser.setPhoneNumber("0987654321");
    }

    @Test
    void createBooking_shouldThrowException_whenTripNotFound() {
        CreateBookingRequest request = CreateBookingRequest.builder()
                .tripId("non-existent-trip")
                .pickupPointId("pick-1")
                .dropoffPointId("drop-1")
                .build();

        when(tripRepository.findByIdForUpdate(request.getTripId())).thenReturn(Optional.empty());

        AppException exception = assertThrows(AppException.class, () -> {
            customerBookingService.createBooking(request, "127.0.0.1");
        });

        assertEquals(ErrorCode.TRIP_NOT_FOUND, exception.getErrorCode());
    }

    @Test
    void createBooking_shouldThrowException_whenNoAvailableSeats() {
        CreateBookingRequest request = CreateBookingRequest.builder()
                .tripId("trip-123")
                .pickupPointId("pick-1")
                .dropoffPointId("drop-1")
                .seatCount(3)
                .build();

        Trip trip = new Trip();
        trip.setId("trip-123");
        trip.setAvailableSeats(2); // Requesting 3, only 2 available
        trip.setStatus(TripStatus.OPEN);

        TripPickupPoint pickup = new TripPickupPoint();
        pickup.setId("pick-1");
        TripDropoffPoint drop = new TripDropoffPoint();
        drop.setId("drop-1");

        trip.setPickupPoints(java.util.List.of(pickup));
        trip.setDropoffPoints(java.util.List.of(drop));

        when(tripRepository.findByIdForUpdate(request.getTripId())).thenReturn(Optional.of(trip));

        AppException exception = assertThrows(AppException.class, () -> {
            customerBookingService.createBooking(request, "127.0.0.1");
        });

        assertEquals(ErrorCode.TRIP_NO_AVAILABLE_SEATS, exception.getErrorCode());
    }

    @Test
    void createBooking_shouldThrowException_whenPickupLocationOutOfRange() {
        // GPS coordinate distance exceeds 20km from the route ward center
        CreateBookingRequest request = CreateBookingRequest.builder()
                .tripId("trip-123")
                .pickupPointId("pick-1")
                .dropoffPointId("drop-1")
                .seatCount(1)
                // coordinates chosen to be very far from each other
                .pickupLat(21.0285)
                .pickupLng(105.8542)
                .dropoffLat(21.0285)
                .dropoffLng(105.8542)
                .build();

        Trip trip = new Trip();
        trip.setId("trip-123");
        trip.setAvailableSeats(4);
        trip.setStatus(TripStatus.OPEN);

        // Pickup point is located at Ha Noi (approx 21.0285, 105.8542)
        // Ward center located at Ho Chi Minh City (10.7626, 106.6601) -> distance > 1000km > 20km
        Ward pickupWard = new Ward();
        pickupWard.setLat(new BigDecimal("10.7626"));
        pickupWard.setLng(new BigDecimal("106.6601"));

        TripPickupPoint pickup = new TripPickupPoint();
        pickup.setId("pick-1");
        pickup.setWard(pickupWard);

        TripDropoffPoint drop = new TripDropoffPoint();
        drop.setId("drop-1");
        Ward dropoffWard = new Ward();
        dropoffWard.setLat(new BigDecimal("21.0285"));
        dropoffWard.setLng(new BigDecimal("105.8542"));
        drop.setWard(dropoffWard);

        trip.setPickupPoints(java.util.List.of(pickup));
        trip.setDropoffPoints(java.util.List.of(drop));

        when(tripRepository.findByIdForUpdate(request.getTripId())).thenReturn(Optional.of(trip));

        AppException exception = assertThrows(AppException.class, () -> {
            customerBookingService.createBooking(request, "127.0.0.1");
        });

        assertEquals(ErrorCode.BOOKING_LOCATION_OUT_OF_RANGE, exception.getErrorCode());
    }

    @Test
    void createBookingReview_shouldSucceed() {
        CreateBookingReviewRequest request = new CreateBookingReviewRequest(5, "Very good driver");
        Trip trip = new Trip();
        trip.setId("trip-123");
        DriverProfile driver = new DriverProfile();
        driver.setId("driver-123");
        driver.setUser(new User());
        trip.setDriver(driver);

        Booking booking = Booking.builder()
                .id("booking-123")
                .customer(customerUser)
                .status(BookingStatus.COMPLETED)
                .trip(trip)
                .build();

        when(bookingRepository.findById("booking-123")).thenReturn(Optional.of(booking));
        when(userService.getCurrentUser()).thenReturn(customerUser);
        when(bookingReviewRepository.existsByBookingId("booking-123")).thenReturn(false);
        when(bookingReviewRepository.save(any(BookingReview.class))).thenAnswer(invocation -> {
            BookingReview r = invocation.getArgument(0);
            r.setId("review-123");
            return r;
        });
        when(bookingReviewRepository.averageRatingByDriverId("driver-123")).thenReturn(4.8);

        BookingReviewResponse response = customerBookingService.createBookingReview("booking-123", request);

        assertNotNull(response);
        assertEquals(5, response.getRating());
        assertEquals("Very good driver", response.getComment());
        assertEquals(4.8, driver.getDriverRating());
    }
}
