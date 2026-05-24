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

/**
 * Service xử lý nghiệp vụ quản lý hồ sơ tài xế (DriverProfile và Vehicle).
 *
 * <p>Quản lý toàn bộ vòng đời hồ sơ:
 * PENDING (mới tạo) → PENDING+submitted (đã nộp) → APPROVED/REJECTED (Admin duyệt)
 * → PENDING+submitted lại (nếu tài xế chỉnh sửa sau khi được duyệt)</p>
 *
 * <p><b>Cơ chế khóa hồ sơ:</b> Khi {@code submitted = true} và {@code status = PENDING},
 * hồ sơ bị khóa không cho chỉnh sửa để đảm bảo Admin duyệt đúng phiên bản
 * tài xế đã xác nhận nộp.</p>
 *
 * @author Phạm Quang Huy (B22DCCN394)
 * @see DriverProfile
 * @see Vehicle
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverProfileService {

    UserService userService;
    DriverProfileRepository driverProfileRepository;
    VehicleRepository vehicleRepository;
    TripRepository tripRepository;

    /**
     * Lấy hồ sơ tài xế của user đang đăng nhập.
     *
     * @return DriverProfileResponse hiển thị thông tin hồ sơ và trạng thái duyệt
     */
    @Transactional(readOnly = true)
    public DriverProfileResponse getMyProfile() {
        User user = userService.getCurrentUser();
        DriverProfile profile = getOrCreateDriverProfile(user);
        return toResponse(user, profile, profile.getVehicle());
    }

    /**
     * Cập nhật thông tin hồ sơ tài xế (cả User, DriverProfile và Vehicle).
     *
     * <p><b>Chiến lược update partial:</b> Chỉ cập nhật các trường có giá trị
     * khác null trong request. Điều này cho phép client gửi patch nhỏ mà không
     * cần gửi lại toàn bộ hồ sơ, giảm bandwidth và tránh ghi đè nhầm.</p>
     *
     * <p><b>Auto re-review khi chỉnh sửa sau APPROVED:</b> Nếu tài xế chỉnh sửa
     * hồ sơ sau khi đã được duyệt, trạng thái tự động về PENDING để Admin
     * xem xét lại. Điều này ngăn tài xế thay đổi thông tin xe/GPLX sau khi
     * được duyệt mà không qua kiểm soát.</p>
     *
     * <p><b>Vehicle creation on-demand:</b> Nếu request có thông tin xe nhưng
     * Vehicle entity chưa tồn tại (hồ sơ mới), Vehicle được tạo mới tự động.</p>
     *
     * @param request dữ liệu cập nhật (partial update - chỉ field != null mới được ghi)
     * @return DriverProfileResponse phản ánh trạng thái mới nhất
     * @throws AppException {@code DRIVER_PROFILE_LOCKED} nếu hồ sơ đang chờ duyệt (PENDING+submitted)
     */
    @Transactional
    public DriverProfileResponse updateMyProfile(DriverProfileUpdateRequest request) {
        User user = userService.getCurrentUser();
        DriverProfile profile = getOrCreateDriverProfile(user);
        DriverStatus originalStatus = profile.getStatus();
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

        // Nếu hồ sơ đã được duyệt mà có chỉnh sửa, bắt buộc quay về PENDING để Admin duyệt lại.
        if (originalStatus == DriverStatus.APPROVED) {
            profile.setStatus(DriverStatus.PENDING);
            profile.setSubmitted(true);
            profile.setApprovedAt(null);
            profile.setApprovedBy(null);
            profile.setRejectedAt(null);
            profile.setRejectionReason(null);
        }

        DriverProfile savedProfile = driverProfileRepository.save(profile);
        return toResponse(user, savedProfile, savedProfile.getVehicle());
    }

    /**
     * Nộp hồ sơ tài xế để Admin xem xét.
     *
     * <p>Trước khi nộp, validate bắt buộc:
     * <ul>
     *   <li>Tài liệu pháp lý: phải có số CCCD và số GPLX</li>
     *   <li>Thông tin xe: phải có biển số, hãng xe và dòng xe</li>
     * </ul>
     * Các trường khác (ảnh, ngày hết hạn...) không bắt buộc ở bước này
     * nhưng Admin có thể từ chối nếu thiếu.</p>
     *
     * <p><b>Idempotent:</b> Nếu hồ sơ đã ở trạng thái PENDING+submitted,
     * method trả về ngay kết quả hiện tại mà không thực hiện thêm gì,
     * tránh tạo duplicate request khi client gọi nhiều lần.</p>
     *
     * @return DriverProfileResponse với profileLocked = true, status = PENDING
     * @throws AppException {@code DRIVER_PROFILE_INCOMPLETE} nếu thiếu CCCD/GPLX/biển số/hãng xe/dòng xe
     */
    @Transactional
    public DriverProfileResponse submitMyProfile() {
        User user = userService.getCurrentUser();
        DriverProfile profile = getOrCreateDriverProfile(user);

        if (Boolean.TRUE.equals(profile.getSubmitted()) && profile.getStatus() == DriverStatus.PENDING) {
            return toResponse(user, profile, profile.getVehicle());
        }

        validateProfileForSubmit(profile);

        profile.setStatus(DriverStatus.PENDING);
        profile.setSubmitted(true);
        profile.setRejectedAt(null);
        profile.setRejectionReason(null);

        DriverProfile saved = driverProfileRepository.save(profile);
        return toResponse(user, saved, saved.getVehicle());
    }

    /**
     * Lấy DriverProfile của user, hoặc tạo mới nếu chưa tồn tại.
     *
     * <p>Nếu có nhiều profile (legacy), chọn profile có nhiều trip nhất
     * để tránh phân mảnh dữ liệu.</p>
     *
     * @param user user hiện tại
     * @return DriverProfile không bao giờ null
     */
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

    /**
     * Kiểm tra hồ sơ có đang bị khóa chỉnh sửa hay không.
     *
     * <p>Hồ sơ bị khóa khi {@code submitted = true} VÀ {@code status = PENDING}.
     * Tức là tài xế đã nộp và đang chờ Admin xem xét. Khóa này được tháo khi:
     * <ul>
     *   <li>Admin duyệt (status -> APPROVED)</li>
     *   <li>Admin từ chối (status -> REJECTED, submitted -> false)</li>
     * </ul>
     * </p>
     *
     * @param profile hồ sơ cần kiểm tra
     * @return true nếu đang chờ duyệt và không được chỉnh sửa
     */
    private boolean isProfileLocked(DriverProfile profile) {
        return profile != null
                && Boolean.TRUE.equals(profile.getSubmitted())
                && profile.getStatus() == DriverStatus.PENDING;
    }

    /**
     * Validate các trường bắt buộc tối thiểu trước khi nộp hồ sơ.
     *
     * <p>Chia thành 2 nhóm kiểm tra:
     * <ul>
     *   <li>{@code hasCoreDocs}: số CCCD và số GPLX (không cần ảnh ở bước này)</li>
     *   <li>{@code hasCoreVehicle}: biển số xe, hãng xe, dòng xe
     *       (thông tin định danh tối thiểu của phương tiện)</li>
     * </ul>
     * </p>
     *
     * @param profile hồ sơ cần validate
     * @throws AppException {@code DRIVER_PROFILE_INCOMPLETE} nếu thiếu bất kỳ trường nào
     */
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
