package com.example.demo.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DriverTripDetailResponse {
    String id;
    String routeId;
    String status;

    String pickupProvince;
    String dropoffProvince;

    String departureDate;
    String departureTime;
    String createdAt;
    String updatedAt;
    String actualDepartureTime;
    String actualArrivalTime;
    String completedAt;

    Integer totalSeats;
    Integer availableSeats;
    Integer bookedSeats;
    Long fixedFare;
    Long estimatedRevenue;
    String driverNote;

    List<PointInfo> pickupPoints;
    List<PointInfo> dropoffPoints;
    List<BookingInfo> bookings;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PointInfo {
        String id;
        String wardName;
        String provinceName;
        String address;
        Integer sortOrder;
        String time;
        String note;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class BookingInfo {
        String id;
        String status;
        Integer seatCount;
        BigDecimal totalPrice;
        BigDecimal distanceKm;

        String pickupAddress;
        Double pickupLat;
        Double pickupLng;
        String dropoffAddress;
        Double dropoffLat;
        Double dropoffLng;

        String passengerName;
        String contactPhone;
        String customerNote;

        String createdAt;
        String confirmedAt;
        String cancelledAt;
        String cancellationReason;
        String completedAt;

        String customerId;
        String customerName;
        String customerPhone;
        String customerEmail;
        String customerAvatarUrl;

        String paymentMethod;
        String paymentStatus;
        BigDecimal paymentAmount;
        String transactionId;
        String paidAt;
    }
}
