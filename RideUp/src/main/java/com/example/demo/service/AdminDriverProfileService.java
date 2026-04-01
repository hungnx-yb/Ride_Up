package com.example.demo.service;

import com.example.demo.dto.response.AdminDriverProfileResponse;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.User;
import com.example.demo.entity.Vehicle;
import com.example.demo.enums.DriverStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.DriverProfileRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminDriverProfileService {

    DriverProfileRepository driverProfileRepository;
    UserService userService;
    FileService fileService;

    @Transactional(readOnly = true)
    public List<AdminDriverProfileResponse> getAllProfiles() {
        return driverProfileRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AdminDriverProfileResponse approveProfile(String profileId) {
        DriverProfile profile = driverProfileRepository.findById(profileId)
                .orElseThrow(() -> new AppException(ErrorCode.DRIVER_PROFILE_NOT_FOUND));

        User admin = userService.getCurrentUser();

        profile.setStatus(DriverStatus.APPROVED);
        profile.setSubmitted(true);
        profile.setApprovedAt(LocalDateTime.now());
        profile.setApprovedBy(admin.getId());
        profile.setRejectedAt(null);
        profile.setRejectionReason(null);

        return toResponse(driverProfileRepository.save(profile));
    }

    @Transactional
    public AdminDriverProfileResponse rejectProfile(String profileId, String reason) {
        DriverProfile profile = driverProfileRepository.findById(profileId)
                .orElseThrow(() -> new AppException(ErrorCode.DRIVER_PROFILE_NOT_FOUND));

        profile.setStatus(DriverStatus.REJECTED);
        profile.setSubmitted(false);
        profile.setRejectedAt(LocalDateTime.now());
        profile.setRejectionReason(StringUtils.hasText(reason) ? reason.trim() : "Hồ sơ chưa đủ điều kiện duyệt");

        return toResponse(driverProfileRepository.save(profile));
    }

    private AdminDriverProfileResponse toResponse(DriverProfile profile) {
        User user = profile.getUser();
        Vehicle vehicle = profile.getVehicle();

        return AdminDriverProfileResponse.builder()
                .driverProfileId(profile.getId())
                .userId(user != null ? user.getId() : null)
                .fullName(user != null ? user.getFullName() : null)
                .email(user != null ? user.getEmail() : null)
                .phoneNumber(user != null ? user.getPhoneNumber() : null)
                .status(profile.getStatus())
                .createdAt(profile.getCreatedAt())
                .approvedAt(profile.getApprovedAt())
                .approvedBy(profile.getApprovedBy())
                .rejectedAt(profile.getRejectedAt())
                .rejectionReason(profile.getRejectionReason())
                .submitted(Boolean.TRUE.equals(profile.getSubmitted()))
                .cccd(profile.getCccd())
                .cccdImageFront(resolvePublicFileUrl(profile.getCccdImageFront()))
                .cccdImageBack(resolvePublicFileUrl(profile.getCccdImageBack()))
                .gplx(profile.getGplx())
                .gplxImage(resolvePublicFileUrl(profile.getGplxImage()))
                .driverRating(profile.getDriverRating())
                .totalDriverRides(profile.getTotalDriverRides())
                .plateNumber(vehicle != null ? vehicle.getPlateNumber() : null)
                .vehicleBrand(vehicle != null ? vehicle.getVehicleBrand() : null)
                .vehicleModel(vehicle != null ? vehicle.getVehicleModel() : null)
                .vehicleType(vehicle != null ? vehicle.getVehicleType() : null)
                .vehicleImage(resolvePublicFileUrl(vehicle != null ? vehicle.getVehicleImage() : null))
                .registrationImage(resolvePublicFileUrl(vehicle != null ? vehicle.getRegistrationImage() : null))
                .insuranceImage(resolvePublicFileUrl(vehicle != null ? vehicle.getInsuranceImage() : null))
                .vehicleVerified(vehicle != null ? vehicle.getIsVerified() : null)
                .build();
    }

    private String resolvePublicFileUrl(String rawPath) {
        String trimmed = rawPath == null ? "" : rawPath.trim();
        if (!StringUtils.hasText(trimmed)) {
            return null;
        }
        String lower = trimmed.toLowerCase();
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            return trimmed;
        }
        return fileService.getFileUrl(trimmed);
    }
}
