package com.example.demo.service;

import com.example.demo.dto.response.UserResponse;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.Trip;
import com.example.demo.entity.User;
import com.example.demo.enums.TripStatus;
import com.example.demo.repository.DriverProfileRepository;
import com.example.demo.repository.TripRepository;
import com.example.demo.repository.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service cung cấp dữ liệu tổng hợp cho Admin Dashboard.
 *
 * <p><b>Layer:</b> Service (Business Logic Layer)</p>
 * <p><b>Trách nhiệm:</b> Tổng hợp KPI hôm nay/tháng từ ba repository,
 * xây dựng feed hoạt động gần đây, trả danh sách người dùng cho Admin.</p>
 *
 * @see AdminDashboardController
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminDashboardService {

    UserRepository userRepository;
    DriverProfileRepository driverProfileRepository;
    TripRepository tripRepository;
    /** Dùng để map {@link User} entity → {@link UserResponse} DTO. */
    ModelMapper modelMapper;

    /**
     * Tổng hợp tất cả KPI hiển thị trên Admin Dashboard.
     *
     * <p><b>Khoảng thời gian query:</b></p>
     * <ul>
     *   <li>Hôm nay: {@code [todayStart, tomorrowStart)}</li>
     *   <li>Tháng này: {@code [monthStart, nextMonthStart)}</li>
     * </ul>
     *
     * <p><b>recentActivity:</b> Hợp nhất top-8 driver profiles mới + top-8 trips mới,
     * sắp xếp giảm dần theo createdAt, lấy 8 phần tử đầu.</p>
     *
     * @return {@code Map} với ba key: {@code today}, {@code thisMonth}, {@code recentActivity}
     */
        @Transactional(readOnly = true)
    public Map<String, Object> getDashboardStats() {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        // Xác định khoảng thời gian hôm nay: [00:00:00 hôm nay, 00:00:00 ngày mai)
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime tomorrowStart = todayStart.plusDays(1);

        // Xác định khoảng thời gian tháng này: [ngày 1 tháng này, ngày 1 tháng sau)
        LocalDateTime monthStart = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime nextMonthStart = monthStart.plusMonths(1);

        // ── KPI hôm nay ──────────────────────────────────────────────────────
        int todayTotalRides = (int) tripRepository.countByCreatedAtBetween(todayStart, tomorrowStart);
        int todayCompletedRides = (int) tripRepository.countByCreatedAtBetweenAndStatus(todayStart, tomorrowStart, TripStatus.COMPLETED);
        int todayCancelledRides = (int) tripRepository.countByCreatedAtBetweenAndStatus(todayStart, tomorrowStart, TripStatus.CANCELLED);
        // safeLong() xử lý SUM() trả về null khi không có row nào thỏa điều kiện
        long todayRevenue = safeLong(tripRepository.sumRevenueForPeriod(todayStart, tomorrowStart, TripStatus.COMPLETED));

        // ── KPI tháng này ────────────────────────────────────────────────────
        int monthTotalRides = (int) tripRepository.countByCreatedAtBetween(monthStart, nextMonthStart);
        long monthRevenue = safeLong(tripRepository.sumRevenueForPeriod(monthStart, nextMonthStart, TripStatus.COMPLETED));

        int totalUsers = (int) userRepository.count();
        int newUsers = (int) userRepository.countByCreatedAtBetween(monthStart, nextMonthStart);

        int totalDrivers = (int) driverProfileRepository.count();
        int newDrivers = (int) driverProfileRepository.countByCreatedAtBetween(monthStart, nextMonthStart);

        Map<String, Object> todayData = new HashMap<>();
        todayData.put("totalRides", todayTotalRides);
        todayData.put("completedRides", todayCompletedRides);
        todayData.put("cancelledRides", todayCancelledRides);
        todayData.put("revenue", todayRevenue);

        Map<String, Object> thisMonthData = new HashMap<>();
        thisMonthData.put("totalRides", monthTotalRides);
        thisMonthData.put("revenue", monthRevenue);
        thisMonthData.put("newUsers", newUsers);
        thisMonthData.put("totalUsers", totalUsers);
        thisMonthData.put("newDrivers", newDrivers);
        thisMonthData.put("totalDrivers", totalDrivers);

        // Hợp nhất top-8 driver profiles + top-8 trips, sắp xếp và giới hạn 8 kết quả
        List<Map<String, Object>> recentActivity = buildRecentActivity(
            driverProfileRepository.findTop8ByOrderByCreatedAtDesc(),
            tripRepository.findTop8ByOrderByCreatedAtDesc(),
            now
        );

        Map<String, Object> result = new HashMap<>();
        result.put("today", todayData);
        result.put("thisMonth", thisMonthData);
        result.put("recentActivity", recentActivity);
        return result;
    }

    /**
     * Lấy danh sách tất cả người dùng, sắp xếp theo thời gian tạo giảm dần.
     *
     * <p><b>Lưu ý:</b> Không có phân trang – cần thêm {@code Pageable} khi user lớn.</p>
     *
     * @return Danh sách {@link UserResponse} (không chứa password)
     */
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(user -> modelMapper.map(user, UserResponse.class))
                .collect(Collectors.toList());
    }

    /**
     * Xây dựng feed hoạt động gần đây từ driver profiles và trips.
     *
     * <p>Thuật toán: chuyển đổi từng entity thành {@link ActivityData},
     * sort giảm dần theo timestamp, lấy 8 phần tử đầu, format thành Map.</p>
     *
     * @param driverProfiles Tối đa 8 DriverProfile mới nhất
     * @param trips          Tối đa 8 Trip mới nhất
     * @param now            Thời điểm hiện tại để tính khoảng cách tương đối
     * @return Danh sách tối đa 8 hoạt động với key: {@code id}, {@code type},
     *         {@code message}, {@code time}
     */
    private List<Map<String, Object>> buildRecentActivity(List<DriverProfile> driverProfiles, List<Trip> trips, LocalDateTime now) {
        List<ActivityData> data = new ArrayList<>();

        for (DriverProfile profile : driverProfiles) {
            if (profile.getCreatedAt() == null) {
                continue;
            }
            // Fallback về "Tài xế" nếu user hoặc tên bị null
            String fullName = profile.getUser() != null && profile.getUser().getFullName() != null
                    ? profile.getUser().getFullName()
                    : "Tài xế";
            data.add(new ActivityData(
                    profile.getId(),
                    "new_driver",
                    "Tài xế mới đăng ký: " + fullName,
                    profile.getCreatedAt()
            ));
        }

        for (Trip trip : trips) {
            if (trip.getCreatedAt() == null) {
                continue;
            }
            // Map trạng thái trip → type và message hiển thị tiếng Việt
            String type;
            String message;
            if (trip.getStatus() == TripStatus.COMPLETED) {
                type = "ride_completed";
                message = "Một chuyến xe đã hoàn thành";
            } else if (trip.getStatus() == TripStatus.CANCELLED) {
                type = "cancelled";
                message = "Một chuyến xe đã bị hủy";
            } else {
                // OPEN, FULL, IN_PROGRESS → hiển thị là chuyến mới
                type = "new_booking";
                message = "Có chuyến xe mới được tạo";
            }
            data.add(new ActivityData(trip.getId(), type, message, trip.getCreatedAt()));
        }

        return data.stream()
                .sorted(Comparator.comparing(ActivityData::timestamp).reversed()) // Mới nhất trước
                .limit(8)
                .map(item -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", item.id());
                    row.put("type", item.type());
                    row.put("message", item.message());
                    row.put("time", toTimeAgo(item.timestamp(), now));
                    return row;
                })
                .collect(Collectors.toList());
    }

    /**
     * Trả về {@code 0} nếu {@code value} là {@code null}.
     * Dùng để xử lý kết quả {@code SUM()} từ JPQL có thể trả {@code null}
     * khi không có row nào thỏa điều kiện.
     *
     * @param value Giá trị Long có thể null
     * @return {@code 0L} nếu null, ngược lại trả về {@code value}
     */
    private long safeLong(Long value) {
        return value != null ? value : 0L;
    }

    /**
     * Chuyển timestamp thành chuỗi thời gian tương đối tiếng Việt.
     * VD: "Vừa xong", "5 phút trước", "2 giờ trước", "1 ngày trước".
     *
     * @param timestamp Thời điểm sự kiện; trả về "Không có" nếu {@code null}
     * @param now       Thời điểm hiện tại (đồng nhất trong cùng request)
     * @return Chuỗi thời gian tương đối
     */
    private String toTimeAgo(LocalDateTime timestamp, LocalDateTime now) {
        if (timestamp == null) {
            return "Không có";
        }
        Duration diff = Duration.between(timestamp, now);
        // Math.max tránh kết quả âm do clock skew giữa các node
        long minutes = Math.max(diff.toMinutes(), 0);
        if (minutes < 1) {
            return "Vừa xong";
        }
        if (minutes < 60) {
            return minutes + " phút trước";
        }
        long hours = minutes / 60;
        if (hours < 24) {
            return hours + " giờ trước";
        }
        long days = hours / 24;
        return days + " ngày trước";
    }

    /**
     * Value object nội bộ đại diện cho một sự kiện trong feed Recent Activity.
     *
     * @param id        ID định danh (UUID của DriverProfile hoặc Trip)
     * @param type      Loại sự kiện: "new_driver" | "ride_completed" | "cancelled" | "new_booking"
     * @param message   Nội dung hiển thị tiếng Việt
     * @param timestamp Thời điểm xảy ra; dùng để sắp xếp
     */
    private record ActivityData(String id, String type, String message, LocalDateTime timestamp) {
    }
}

        @Transactional(readOnly = true)
    public Map<String, Object> getDashboardStats() {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime tomorrowStart = todayStart.plusDays(1);
        LocalDateTime monthStart = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime nextMonthStart = monthStart.plusMonths(1);

        int todayTotalRides = (int) tripRepository.countByCreatedAtBetween(todayStart, tomorrowStart);
        int todayCompletedRides = (int) tripRepository.countByCreatedAtBetweenAndStatus(todayStart, tomorrowStart, TripStatus.COMPLETED);
        int todayCancelledRides = (int) tripRepository.countByCreatedAtBetweenAndStatus(todayStart, tomorrowStart, TripStatus.CANCELLED);
        long todayRevenue = safeLong(tripRepository.sumRevenueForPeriod(todayStart, tomorrowStart, TripStatus.COMPLETED));

        int monthTotalRides = (int) tripRepository.countByCreatedAtBetween(monthStart, nextMonthStart);
        long monthRevenue = safeLong(tripRepository.sumRevenueForPeriod(monthStart, nextMonthStart, TripStatus.COMPLETED));

        int totalUsers = (int) userRepository.count();
        int newUsers = (int) userRepository.countByCreatedAtBetween(monthStart, nextMonthStart);

        int totalDrivers = (int) driverProfileRepository.count();
        int newDrivers = (int) driverProfileRepository.countByCreatedAtBetween(monthStart, nextMonthStart);

        Map<String, Object> todayData = new HashMap<>();
        todayData.put("totalRides", todayTotalRides);
        todayData.put("completedRides", todayCompletedRides);
        todayData.put("cancelledRides", todayCancelledRides);
        todayData.put("revenue", todayRevenue);

        Map<String, Object> thisMonthData = new HashMap<>();
        thisMonthData.put("totalRides", monthTotalRides);
        thisMonthData.put("revenue", monthRevenue);
        thisMonthData.put("newUsers", newUsers);
        thisMonthData.put("totalUsers", totalUsers);
        thisMonthData.put("newDrivers", newDrivers);
        thisMonthData.put("totalDrivers", totalDrivers);

        List<Map<String, Object>> recentActivity = buildRecentActivity(
            driverProfileRepository.findTop8ByOrderByCreatedAtDesc(),
            tripRepository.findTop8ByOrderByCreatedAtDesc(),
            now
        );

        Map<String, Object> result = new HashMap<>();
        result.put("today", todayData);
        result.put("thisMonth", thisMonthData);
        result.put("recentActivity", recentActivity);
        return result;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(user -> modelMapper.map(user, UserResponse.class))
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildRecentActivity(List<DriverProfile> driverProfiles, List<Trip> trips, LocalDateTime now) {
        List<ActivityData> data = new ArrayList<>();

        for (DriverProfile profile : driverProfiles) {
            if (profile.getCreatedAt() == null) {
                continue;
            }
            String fullName = profile.getUser() != null && profile.getUser().getFullName() != null
                    ? profile.getUser().getFullName()
                    : "Tài xế";
            data.add(new ActivityData(
                    profile.getId(),
                    "new_driver",
                    "Tài xế mới đăng ký: " + fullName,
                    profile.getCreatedAt()
            ));
        }

        for (Trip trip : trips) {
            if (trip.getCreatedAt() == null) {
                continue;
            }
            String type;
            String message;
            if (trip.getStatus() == TripStatus.COMPLETED) {
                type = "ride_completed";
                message = "Một chuyến xe đã hoàn thành";
            } else if (trip.getStatus() == TripStatus.CANCELLED) {
                type = "cancelled";
                message = "Một chuyến xe đã bị hủy";
            } else {
                type = "new_booking";
                message = "Có chuyến xe mới được tạo";
            }
            data.add(new ActivityData(trip.getId(), type, message, trip.getCreatedAt()));
        }

        return data.stream()
                .sorted(Comparator.comparing(ActivityData::timestamp).reversed())
                .limit(8)
                .map(item -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", item.id());
                    row.put("type", item.type());
                    row.put("message", item.message());
                    row.put("time", toTimeAgo(item.timestamp(), now));
                    return row;
                })
                .collect(Collectors.toList());
    }

    private long safeLong(Long value) {
        return value != null ? value : 0L;
    }

    private String toTimeAgo(LocalDateTime timestamp, LocalDateTime now) {
        if (timestamp == null) {
            return "Không có";
        }
        Duration diff = Duration.between(timestamp, now);
        long minutes = Math.max(diff.toMinutes(), 0);
        if (minutes < 1) {
            return "Vừa xong";
        }
        if (minutes < 60) {
            return minutes + " phút trước";
        }
        long hours = minutes / 60;
        if (hours < 24) {
            return hours + " giờ trước";
        }
        long days = hours / 24;
        return days + " ngày trước";
    }

    private record ActivityData(String id, String type, String message, LocalDateTime timestamp) {
    }
}
