package com.example.demo.service;

import com.example.demo.dto.request.DriverProfileUpdateRequest;
import com.example.demo.dto.response.DriverProfileResponse;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.User;
import com.example.demo.entity.Vehicle;
import com.example.demo.enums.DriverStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.DriverProfileRepository;
import com.example.demo.repository.TripRepository;
import com.example.demo.repository.VehicleRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverProfileService {

    UserService userService;
    DriverProfileRepository driverProfileRepository;
    VehicleRepository vehicleRepository;
    TripRepository tripRepository;

    @Transactional(readOnly = true)
    public DriverProfileResponse getMyProfile() {
        User user = userService.getCurrentUser();
        DriverProfile profile = getOrCreateDriverProfile(user);
        return toResponse(user, profile, profile.getVehicle());
    }

    @Transactional
    public DriverProfileResponse updateMyProfile(DriverProfileUpdateRequest request) {
        User user = userService.getCurrentUser();
        DriverProfile profile = getOrCreateDriverProfile(user);
        if (isProfileLocked(profile)) {
            throw new AppException(ErrorCode.DRIVER_PROFILE_LOCKED);
        }
        Vehicle vehicle = profile.getVehicle();

        if (request.getFullName() != null) {
            user.setFullName(normalize(request.getFullName()));
        }
        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(normalize(request.getPhoneNumber()));
        }
        if (request.getDateOfBirth() != null) {
            user.setDateOfBirth(request.getDateOfBirth());
        }
        if (request.getGender() != null) {
            user.setGender(request.getGender());
        }
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(normalize(request.getAvatarUrl()));
        }

        if (request.getCccd() != null) {
            profile.setCccd(normalize(request.getCccd()));
        }
        if (request.getCccdImageFront() != null) {
            profile.setCccdImageFront(normalize(request.getCccdImageFront()));
        }
        if (request.getCccdImageBack() != null) {
            profile.setCccdImageBack(normalize(request.getCccdImageBack()));
        }
        if (request.getGplx() != null) {
            profile.setGplx(normalize(request.getGplx()));
        }
        if (request.getGplxExpiryDate() != null) {
            profile.setGplxExpiryDate(request.getGplxExpiryDate());
        }
        if (request.getGplxImage() != null) {
            profile.setGplxImage(normalize(request.getGplxImage()));
        }

        boolean hasVehiclePayload = request.getPlateNumber() != null
                || request.getVehicleBrand() != null
                || request.getVehicleModel() != null
                || request.getVehicleYear() != null
                || request.getVehicleColor() != null
                || request.getSeatCapacity() != null
                || request.getVehicleType() != null
                || request.getVehicleImage() != null
                || request.getRegistrationImage() != null
                || request.getRegistrationExpiryDate() != null
                || request.getInsuranceImage() != null
                || request.getInsuranceExpiryDate() != null
                || request.getVehicleActive() != null;

        if (hasVehiclePayload && vehicle == null) {
            vehicle = Vehicle.builder()
                    .driver(profile)
                    .isVerified(false)
                    .isActive(Boolean.TRUE)
                    .build();
        }

        if (vehicle != null) {
            if (request.getPlateNumber() != null) {
                vehicle.setPlateNumber(normalize(request.getPlateNumber()));
            }
            if (request.getVehicleBrand() != null) {
                vehicle.setVehicleBrand(normalize(request.getVehicleBrand()));
            }
            if (request.getVehicleModel() != null) {
                vehicle.setVehicleModel(normalize(request.getVehicleModel()));
            }
            if (request.getVehicleYear() != null) {
                vehicle.setVehicleYear(request.getVehicleYear());
            }
            if (request.getVehicleColor() != null) {
                vehicle.setVehicleColor(normalize(request.getVehicleColor()));
            }
            if (request.getSeatCapacity() != null) {
                vehicle.setSeatCapacity(request.getSeatCapacity());
            }
            if (request.getVehicleType() != null) {
                vehicle.setVehicleType(request.getVehicleType());
            }
            if (request.getVehicleImage() != null) {
                vehicle.setVehicleImage(normalize(request.getVehicleImage()));
            }
            if (request.getRegistrationImage() != null) {
                vehicle.setRegistrationImage(normalize(request.getRegistrationImage()));
            }
            if (request.getRegistrationExpiryDate() != null) {
                vehicle.setRegistrationExpiryDate(request.getRegistrationExpiryDate());
            }
            if (request.getInsuranceImage() != null) {
                vehicle.setInsuranceImage(normalize(request.getInsuranceImage()));
            }
            if (request.getInsuranceExpiryDate() != null) {
                vehicle.setInsuranceExpiryDate(request.getInsuranceExpiryDate());
            }
            if (request.getVehicleActive() != null) {
                vehicle.setIsActive(request.getVehicleActive());
            }

            vehicle = vehicleRepository.save(vehicle);
            profile.setVehicle(vehicle);
        }

        DriverProfile savedProfile = driverProfileRepository.save(profile);
        return toResponse(user, savedProfile, savedProfile.getVehicle());
    }

    @Transactional
    public DriverProfileResponse submitMyProfile() {
        User user = userService.getCurrentUser();
        DriverProfile profile = getOrCreateDriverProfile(user);

        if (Boolean.TRUE.equals(profile.getSubmitted()) && profile.getStatus() == DriverStatus.PENDING) {
            throw new AppException(ErrorCode.DRIVER_PROFILE_LOCKED);
        }

        validateProfileForSubmit(profile);

        profile.setStatus(DriverStatus.PENDING);
        profile.setSubmitted(true);
        profile.setRejectedAt(null);
        profile.setRejectionReason(null);

        DriverProfile saved = driverProfileRepository.save(profile);
        return toResponse(user, saved, saved.getVehicle());
    }

    private DriverProfile getOrCreateDriverProfile(User user) {
        var profiles = driverProfileRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId());
        if (!profiles.isEmpty()) {
            return profiles.stream()
                .max(java.util.Comparator.comparingLong(p -> tripRepository.countByDriverId(p.getId())))
                .orElse(profiles.get(0));
        }

        return driverProfileRepository.save(
            DriverProfile.builder()
                .user(user)
                .status(DriverStatus.PENDING)
                .driverRating(0.0)
                .totalDriverRides(0)
                .submitted(false)
                .build()
        );
    }

    private DriverProfileResponse toResponse(User user, DriverProfile profile, Vehicle vehicle) {
        DriverProfileResponse.DriverProfileResponseBuilder builder = DriverProfileResponse.builder()
                .userId(user.getId())
                .driverProfileId(profile.getId())
                .fullName(user.getFullName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .dateOfBirth(user.getDateOfBirth())
                .gender(user.getGender())
                .avatarUrl(user.getAvatarUrl())
                .cccd(profile.getCccd())
                .cccdImageFront(profile.getCccdImageFront())
                .cccdImageBack(profile.getCccdImageBack())
                .gplx(profile.getGplx())
                .gplxExpiryDate(profile.getGplxExpiryDate())
                .gplxImage(profile.getGplxImage())
                .status(profile.getStatus())
                .driverRating(profile.getDriverRating())
                .totalDriverRides(profile.getTotalDriverRides())
                .profileLocked(isProfileLocked(profile))
                .submitted(Boolean.TRUE.equals(profile.getSubmitted()));

        if (vehicle != null) {
            builder
                    .plateNumber(vehicle.getPlateNumber())
                    .vehicleBrand(vehicle.getVehicleBrand())
                    .vehicleModel(vehicle.getVehicleModel())
                    .vehicleYear(vehicle.getVehicleYear())
                    .vehicleColor(vehicle.getVehicleColor())
                    .seatCapacity(vehicle.getSeatCapacity())
                    .vehicleType(vehicle.getVehicleType())
                    .vehicleImage(vehicle.getVehicleImage())
                    .registrationImage(vehicle.getRegistrationImage())
                    .registrationExpiryDate(vehicle.getRegistrationExpiryDate())
                    .insuranceImage(vehicle.getInsuranceImage())
                    .insuranceExpiryDate(vehicle.getInsuranceExpiryDate())
                    .vehicleVerified(vehicle.getIsVerified())
                    .vehicleActive(vehicle.getIsActive());
        }

        return builder.build();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isProfileLocked(DriverProfile profile) {
        return profile != null
                && Boolean.TRUE.equals(profile.getSubmitted())
                && profile.getStatus() == DriverStatus.PENDING;
    }

    private void validateProfileForSubmit(DriverProfile profile) {
        Vehicle vehicle = profile.getVehicle();
        boolean hasCoreDocs = org.springframework.util.StringUtils.hasText(profile.getCccd())
                && org.springframework.util.StringUtils.hasText(profile.getGplx());
        boolean hasCoreVehicle = vehicle != null
                && org.springframework.util.StringUtils.hasText(vehicle.getPlateNumber())
                && org.springframework.util.StringUtils.hasText(vehicle.getVehicleBrand())
                && org.springframework.util.StringUtils.hasText(vehicle.getVehicleModel());

        if (!hasCoreDocs || !hasCoreVehicle) {
            throw new AppException(ErrorCode.DRIVER_PROFILE_INCOMPLETE);
        }
    }
}
