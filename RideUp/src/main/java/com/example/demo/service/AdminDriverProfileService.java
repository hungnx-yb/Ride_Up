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

/**
 * Service xử lý toàn bộ nghiệp vụ duyệt và từ chối hồ sơ tài xế.
 *
 * <p><b>Layer:</b> Service (Business Logic Layer)</p>
 * <p><b>Trách nhiệm:</b> Approve/reject hồ sơ với audit trail, map entity → DTO,
 * resolve đường dẫn file Supabase thành public URL.</p>
 *
 * @see AdminDriverProfileController
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminDriverProfileService {

    /** Repository truy xuất và lưu hồ sơ tài xế. */
    DriverProfileRepository driverProfileRepository;

    /** Lấy thông tin admin hiện tại (ID) khi ghi audit trail approvedBy. */
    UserService userService;

    /** Chuyển đổi storage path → Supabase public URL. */
    FileService fileService;

    /**
     * Lấy danh sách tất cả hồ sơ tài xế (mọi trạng thái).
     *
     * <p>URL ảnh trong response đã được resolve thành Supabase public URL.</p>
     *
     * @return Danh sách {@link AdminDriverProfileResponse} sắp xếp mới nhất trước.
     *         Không bao giờ trả về {@code null}.
     */
    @Transactional(readOnly = true)
    public List<AdminDriverProfileResponse> getAllProfiles() {
        return driverProfileRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Duyệt hồ sơ tài xế: chuyển trạng thái sang {@code APPROVED} và ghi audit trail.
     *
     * <p>Cập nhật trong một transaction:
     * {@code status=APPROVED}, {@code submitted=true}, {@code approvedAt=now()},
     * {@code approvedBy=adminId}, xóa {@code rejectedAt} và {@code rejectionReason}.</p>
     *
     * @param profileId ID của {@code DriverProfile} cần duyệt
     * @return {@link AdminDriverProfileResponse} đã cập nhật
     * @throws AppException với {@link ErrorCode#DRIVER_PROFILE_NOT_FOUND}
     *         nếu không tìm thấy profile
     */
    @Transactional
    public AdminDriverProfileResponse approveProfile(String profileId) {
        DriverProfile profile = driverProfileRepository.findById(profileId)
                .orElseThrow(() -> new AppException(ErrorCode.DRIVER_PROFILE_NOT_FOUND));

        // Lấy thông tin admin đang đăng nhập để ghi audit trail (approvedBy)
        User admin = userService.getCurrentUser();

        profile.setStatus(DriverStatus.APPROVED);
        profile.setSubmitted(true);
        profile.setApprovedAt(LocalDateTime.now());
        profile.setApprovedBy(admin.getId());
        // Xóa thông tin từ chối cũ nếu hồ sơ đã bị reject rồi nộp lại
        profile.setRejectedAt(null);
        profile.setRejectionReason(null);

        return toResponse(driverProfileRepository.save(profile));
    }

    /**
     * Từ chối hồ sơ tài xế: chuyển trạng thái sang {@code REJECTED}.
     *
     * <p>Nếu {@code reason} rỗng hoặc {@code null}, dùng giá trị mặc định:
     * {@code "Hồ sơ chưa đủ điều kiện duyệt"}.</p>
     *
     * @param profileId ID của {@code DriverProfile} cần từ chối
     * @param reason    Lý do từ chối; {@code null}/rỗng → dùng giá trị mặc định
     * @return {@link AdminDriverProfileResponse} đã cập nhật
     * @throws AppException với {@link ErrorCode#DRIVER_PROFILE_NOT_FOUND}
     *         nếu không tìm thấy profile
     */
    @Transactional
    public AdminDriverProfileResponse rejectProfile(String profileId, String reason) {
        DriverProfile profile = driverProfileRepository.findById(profileId)
                .orElseThrow(() -> new AppException(ErrorCode.DRIVER_PROFILE_NOT_FOUND));

        profile.setStatus(DriverStatus.REJECTED);
        profile.setSubmitted(false); // Tài xế cần chỉnh sửa và nộp lại
        profile.setRejectedAt(LocalDateTime.now());
        // Dùng lý do cụ thể nếu có, ngược lại dùng thông báo mặc định
        profile.setRejectionReason(StringUtils.hasText(reason) ? reason.trim() : "Hồ sơ chưa đủ điều kiện duyệt");

        return toResponse(driverProfileRepository.save(profile));
    }

    /**
     * Chuyển đổi {@link DriverProfile} entity sang {@link AdminDriverProfileResponse} DTO.
     *
     * <p>Xử lý null-safe cho {@link User} và {@link Vehicle} (có thể chưa liên kết).
     * Tất cả 6 trường ảnh được resolve qua {@link #resolvePublicFileUrl(String)}.</p>
     *
     * @param profile Entity cần chuyển đổi; không được {@code null}
     * @return DTO với đầy đủ thông tin và URL ảnh đã resolve
     */
    private AdminDriverProfileResponse toResponse(DriverProfile profile) {
        User user = profile.getUser();
        Vehicle vehicle = profile.getVehicle();

        return AdminDriverProfileResponse.builder()
                .driverProfileId(profile.getId())
                // Thông tin từ User – null-safe nếu relationship chưa load
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
                // Resolve storage path → Supabase public HTTPS URL cho từng ảnh tài liệu
                .cccdImageFront(resolvePublicFileUrl(profile.getCccdImageFront()))
                .cccdImageBack(resolvePublicFileUrl(profile.getCccdImageBack()))
                .gplx(profile.getGplx())
                .gplxImage(resolvePublicFileUrl(profile.getGplxImage()))
                .driverRating(profile.getDriverRating())
                .totalDriverRides(profile.getTotalDriverRides())
                // Thông tin từ Vehicle – null-safe, tài xế có thể chưa có xe
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

    /**
     * Chuyển đổi đường dẫn file Supabase Storage thành public HTTPS URL.
     *
     * <p><b>Logic:</b></p>
     * <ol>
     *   <li>Trả về {@code null} nếu path rỗng/null</li>
     *   <li>Trả về nguyên vẹn nếu đã là URL đầy đủ (tránh double-resolve)</li>
     *   <li>Gọi {@link FileService#getFileUrl(String)} để tạo Supabase public URL</li>
     * </ol>
     *
     * @param rawPath Đường dẫn file (VD: {@code "cccd/userId/front.jpg"}) hoặc URL đầy đủ
     * @return Public HTTPS URL hoặc {@code null} nếu path không hợp lệ
     */
    private String resolvePublicFileUrl(String rawPath) {
        String trimmed = rawPath == null ? "" : rawPath.trim();
        if (!StringUtils.hasText(trimmed)) {
            return null;
        }
        String lower = trimmed.toLowerCase();
        // Nếu đã là URL đầy đủ, trả về nguyên vẹn để tránh double-resolve
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            return trimmed;
        }
        return fileService.getFileUrl(trimmed);
    }
}
