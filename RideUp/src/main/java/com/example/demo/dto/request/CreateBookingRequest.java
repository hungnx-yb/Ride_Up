package com.example.demo.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CreateBookingRequest {
    String tripId;
    String pickupPointId;
    String dropoffPointId;
    Integer seatCount;
    String paymentMethod;
    String passengerName;
    String contactPhone;
    String customerNote;
}
