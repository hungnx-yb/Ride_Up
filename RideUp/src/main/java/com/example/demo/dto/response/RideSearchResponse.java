package com.example.demo.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RideSearchResponse {
    String id;
    String from;
    String to;
    LocalDateTime departureTime;
    Integer availableSeats;
    Integer totalSeats;
    BigDecimal price;

    String tripStatus;
    BigDecimal estimatedDistanceKm;
    Integer estimatedDurationMinutes;
    String driverNote;

    String driverName;
    Double driverRating;
    String driverPhone;
    Integer driverTotalRides;
    String driverAvatarUrl;

    String vehiclePlateNumber;
    String vehicleBrand;
    String vehicleModel;
    String vehicleColor;
    String vehicleType;
    String vehicleImageUrl;

    List<PointOption> pickupPoints;
    List<PointOption> dropoffPoints;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PointOption {
        String id;
        String wardId;
        String wardName;
        String address;
        Double lat;
        Double lng;
    }
}
