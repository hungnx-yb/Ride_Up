package com.example.demo.dto.request;

import com.example.demo.enums.Gender;
import com.example.demo.enums.VehicleType;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DriverProfileUpdateRequest {
    String fullName;
    String phoneNumber;
    LocalDate dateOfBirth;
    Gender gender;
    String avatarUrl;

    String cccd;
    String cccdImageFront;
    String cccdImageBack;
    String gplx;
    LocalDate gplxExpiryDate;
    String gplxImage;

    String plateNumber;
    String vehicleBrand;
    String vehicleModel;
    Integer vehicleYear;
    String vehicleColor;
    Integer seatCapacity;
    VehicleType vehicleType;
    String vehicleImage;
    String registrationImage;
    LocalDate registrationExpiryDate;
    String insuranceImage;
    LocalDate insuranceExpiryDate;
    Boolean vehicleActive;
}
