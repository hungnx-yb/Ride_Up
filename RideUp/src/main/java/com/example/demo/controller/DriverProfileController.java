package com.example.demo.controller;

import com.example.demo.dto.request.DriverProfileUpdateRequest;
import com.example.demo.dto.response.DriverProfileResponse;
import com.example.demo.service.DriverProfileService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST Controller xử lý các yêu cầu HTTP quản lý hồ sơ tài xế.
 *
 * <p>Hồ sơ tài xế là điều kiện tiên quyết để tạo chuyến đi. Tài xế phải
 * hoàn thiện hồ sơ (CCCD, GPLX, thông tin xe) và nộp để Admin duyệt.
 * Chỉ khi trạng thái là {@code APPROVED} thì tài xế mới được phép tạo chuyến.</p>
 *
 * <p>Base URL: {@code /driver/profile}</p>
 *
 * <ul>
 *   <li>GET  /driver/profile        – Xem hồ sơ hiện tại</li>
 *   <li>PUT  /driver/profile        – Cập nhật hồ sơ</li>
 *   <li>POST /driver/profile/submit – Nộp hồ sơ để Admin duyệt</li>
 * </ul>
 *
 * @author Phạm Quang Huy (B22DCCN394)
 * @see DriverProfileService
 */
@RestController
@RequestMapping("/driver/profile")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverProfileController {

    DriverProfileService driverProfileService;

    /**
     * Lấy hồ sơ tài xế hiện tại của user đang đăng nhập.
     *
     * @return DriverProfileResponse phản ánh toàn bộ thông tin hồ sơ
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public DriverProfileResponse getMyProfile() {
        return driverProfileService.getMyProfile();
    }

    /**
     * Cập nhật hồ sơ tài xế từ request của client.
     *
     * <p>Chỉ cập nhật các trường có giá trị khác null để tránh ghi đè thông tin không mong muốn.</p>
     *
     * @param request dữ liệu cập nhật hồ sơ
     * @return DriverProfileResponse sau khi cập nhật
     */
    @PutMapping
    @PreAuthorize("isAuthenticated()")
    public DriverProfileResponse updateMyProfile(@RequestBody DriverProfileUpdateRequest request) {
        return driverProfileService.updateMyProfile(request);
    }

    /**
     * Nộp hồ sơ tài xế để Admin xem xét và phê duyệt.
     *
     * <p>Endpoint này chấp nhận body tùy chọn: nếu client gửi kèm dữ liệu cập nhật
     * ({@link DriverProfileUpdateRequest}), hệ thống sẽ lưu cập nhật đó trước,
     * sau đó mới nộp. Đây là convenience endpoint cho phép tài xế cập nhật
     * lần cuối và nộp trong 1 request duy nhất thay vì phải gọi 2 API riêng.</p>
     *
     * @param request dữ liệu cập nhật cuối (có thể null)
     * @return DriverProfileResponse với submitted = true, status = PENDING
     */
    @PostMapping("/submit")
    @PreAuthorize("isAuthenticated()")
    public DriverProfileResponse submitMyProfile(@RequestBody(required = false) DriverProfileUpdateRequest request) {
        if (request != null) {
            driverProfileService.updateMyProfile(request);
        }
        return driverProfileService.submitMyProfile();
    }
}
