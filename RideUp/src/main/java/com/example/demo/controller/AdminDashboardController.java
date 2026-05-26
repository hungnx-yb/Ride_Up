package com.example.demo.controller;

import com.example.demo.dto.response.ApiResponse;
import com.example.demo.dto.response.UserResponse;
import com.example.demo.service.AdminDashboardService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * REST Controller xử lý các endpoint tổng quan của Admin Dashboard.
 *
 * <p><b>Layer:</b> Controller (Presentation Layer)</p>
 * <p><b>Base URL:</b> {@code /admin}</p>
 * <p><b>Bảo mật:</b> Tất cả method yêu cầu {@code ROLE_ADMIN} qua
 * {@code @PreAuthorize} (method-level security).</p>
 *
 * @see AdminDashboardService
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminDashboardController {

    /** Service cung cấp dữ liệu thống kê và danh sách người dùng cho Admin. */
    AdminDashboardService adminDashboardService;

    /**
     * Trả về toàn bộ dữ liệu thống kê cho Admin Dashboard.
     *
     * <p>Dữ liệu được tổng hợp từ TripRepository, UserRepository,
     * DriverProfileRepository và bao gồm:</p>
     * <ul>
     *   <li>{@code today} – KPI trong ngày (tổng chuyến, hoàn thành, hủy, doanh thu)</li>
     *   <li>{@code thisMonth} – KPI tháng hiện tại (doanh thu, user/driver mới và tổng)</li>
     *   <li>{@code recentActivity} – danh sách 8 hoạt động gần đây nhất</li>
     * </ul>
     *
     * <p>Frontend cache kết quả 15 giây ({@code API_CACHE_TTL.ADMIN_STATS}).</p>
     *
     * @return {@code ApiResponse<Map<String, Object>>} với {@code result} chứa
     *         ba key: {@code today}, {@code thisMonth}, {@code recentActivity}
     * @throws org.springframework.security.access.AccessDeniedException nếu caller không có ROLE_ADMIN
     */
    @GetMapping("/stats")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<Map<String, Object>> getAdminStats() {
        return ApiResponse.<Map<String, Object>>builder()
                .result(adminDashboardService.getDashboardStats())
                .build();
    }

    /**
     * Trả về danh sách toàn bộ người dùng trong hệ thống, sắp xếp mới nhất trước.
     *
     * <p><b>Lưu ý hiệu năng:</b> Không có phân trang – toàn bộ bảng {@code user}
     * được tải vào bộ nhớ. Cần thêm {@code Pageable} khi số lượng user lớn.</p>
     *
     * <p>Frontend cache kết quả 20 giây ({@code API_CACHE_TTL.USERS}).</p>
     *
     * @return {@code ApiResponse<List<UserResponse>>} với {@code count} = tổng số user
     *         và {@code result} là danh sách {@link UserResponse} (không chứa password)
     * @throws org.springframework.security.access.AccessDeniedException nếu caller không có ROLE_ADMIN
     */
    @GetMapping("/users")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<List<UserResponse>> getAllUsers() {
        List<UserResponse> users = adminDashboardService.getAllUsers();
        return ApiResponse.<List<UserResponse>>builder()
                .result(users)
                .count(users.size())
                .build();
    }
}
