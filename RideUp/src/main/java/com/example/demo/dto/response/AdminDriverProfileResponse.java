package com.example.demo.dto.response;

import com.example.demo.enums.DriverStatus;
import com.example.demo.enums.VehicleType;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AdminDriverProfileResponse {
    String driverProfileId;
    String userId;
    String fullName;
    String email;
    String phoneNumber;

    DriverStatus status;
    LocalDateTime createdAt;
    LocalDateTime approvedAt;
    String approvedBy;
    LocalDateTime rejectedAt;
    String rejectionReason;
    Boolean submitted;

    String cccd;
    String cccdImageFront;
    String cccdImageBack;
    String gplx;
    String gplxImage;
    Double driverRating;
    Integer totalDriverRides;

    String plateNumber;
    String vehicleBrand;
    String vehicleModel;
    VehicleType vehicleType;
    String vehicleImage;
    String registrationImage;
    String insuranceImage;
    Boolean vehicleVerified;
}
