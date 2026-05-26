package com.example.demo.controller;

import com.example.demo.dto.request.DriverProfileRejectRequest;
import com.example.demo.dto.response.AdminDriverProfileResponse;
import com.example.demo.dto.response.ApiResponse;
import com.example.demo.service.AdminDriverProfileService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller quản lý vòng đời duyệt hồ sơ tài xế (Driver Profile Approval Workflow).
 *
 * <p><b>Layer:</b> Controller (Presentation Layer)</p>
 * <p><b>Base URL:</b> {@code /admin/driver-profiles}</p>
 *
 * <p><b>Quy trình nghiệp vụ:</b></p>
 * <ol>
 *   <li>Tài xế tạo và nộp hồ sơ → trạng thái {@code PENDING}</li>
 *   <li>Admin xem danh sách qua {@link #getAllDriverProfiles()}</li>
 *   <li>Admin duyệt → {@link #approveProfile(String)} → trạng thái {@code APPROVED}</li>
 *   <li>Admin từ chối → {@link #rejectProfile(String, DriverProfileRejectRequest)} → {@code REJECTED}</li>
 * </ol>
 *
 * @see AdminDriverProfileService
 */
@RestController
@RequestMapping("/admin/driver-profiles")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminDriverProfileController {

    /** Service xử lý toàn bộ logic approve/reject và resolve URL ảnh Supabase. */
    AdminDriverProfileService adminDriverProfileService;

    /**
     * Lấy danh sách tất cả hồ sơ tài xế, bao gồm mọi trạng thái
     * (PENDING, APPROVED, REJECTED).
     *
     * <p>URL ảnh tài liệu trong response đã được resolve thành Supabase public URL
     * bởi {@link AdminDriverProfileService#toResponse(com.example.demo.entity.DriverProfile)}.</p>
     *
     * @return {@code ApiResponse<List<AdminDriverProfileResponse>>} với {@code count}
     *         = tổng số hồ sơ
     * @throws org.springframework.security.access.AccessDeniedException nếu caller không có ROLE_ADMIN
     */
    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<List<AdminDriverProfileResponse>> getAllDriverProfiles() {
        List<AdminDriverProfileResponse> data = adminDriverProfileService.getAllProfiles();
        return ApiResponse.<List<AdminDriverProfileResponse>>builder()
                .result(data)
                .count(data.size())
                .build();
    }

    /**
     * Duyệt hồ sơ tài xế, chuyển trạng thái sang {@code APPROVED}.
     *
     * <p>Service sẽ ghi {@code approvedAt = now()}, {@code approvedBy = adminId},
     * xóa {@code rejectedAt} và {@code rejectionReason} cũ (nếu có).</p>
     *
     * @param profileId ID của {@code DriverProfile} cần duyệt (UUID String)
     * @return {@code ApiResponse<AdminDriverProfileResponse>} với {@code message = "Approved"}
     * @throws com.example.demo.exception.AppException với
     *         {@code ErrorCode.DRIVER_PROFILE_NOT_FOUND} nếu profileId không tồn tại
     */
    @PutMapping("/{profileId}/approve")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<AdminDriverProfileResponse> approveProfile(@PathVariable String profileId) {
        return ApiResponse.<AdminDriverProfileResponse>builder()
                .result(adminDriverProfileService.approveProfile(profileId))
                .message("Approved")
                .build();
    }

    /**
     * Từ chối hồ sơ tài xế, chuyển trạng thái sang {@code REJECTED}.
     *
     * <p>Request body là tùy chọn ({@code required = false}). Nếu không cung cấp
     * lý do hoặc lý do rỗng, service dùng giá trị mặc định:
     * {@code "Hồ sơ chưa đủ điều kiện duyệt"}.</p>
     *
     * @param profileId ID của {@code DriverProfile} cần từ chối
     * @param request   DTO chứa {@code rejectionReason}; có thể {@code null}
     * @return {@code ApiResponse<AdminDriverProfileResponse>} với {@code message = "Rejected"}
     * @throws com.example.demo.exception.AppException với
     *         {@code ErrorCode.DRIVER_PROFILE_NOT_FOUND} nếu profileId không tồn tại
     */
    @PutMapping("/{profileId}/reject")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<AdminDriverProfileResponse> rejectProfile(
            @PathVariable String profileId,
            @RequestBody(required = false) DriverProfileRejectRequest request) {

        return ApiResponse.<AdminDriverProfileResponse>builder()
                .result(adminDriverProfileService.rejectProfile(profileId, request != null ? request.getRejectionReason() : null))
                .message("Rejected")
                .build();
    }
}
