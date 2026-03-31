package com.example.demo.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CustomerBookingResponse {
    String id;
    String status;
    Integer seatCount;
    BigDecimal price;
    String from;
    String to;
    String pickupPoint;
    String dropPoint;
    LocalDateTime departureTime;
    String driverName;
    String driverAvatarUrl;
    Double driverRating;
    String paymentMethod;
    String paymentStatus;
    String paymentUrl;
    String paymentTransactionRef;
    Boolean hasRated;
    Integer myRating;
}
