package com.example.demo.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DriverTripResponse {
    String id;
    String routeId;
    String pickupProvince;
    String dropoffProvince;
    String departureDate;
    String departureTime;
    Integer totalSeats;
    Integer availableSeats;
    Long fixedFare;
    String status;
}
