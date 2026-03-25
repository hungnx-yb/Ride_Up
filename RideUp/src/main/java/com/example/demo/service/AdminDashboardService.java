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

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminDashboardService {

    UserRepository userRepository;
    DriverProfileRepository driverProfileRepository;
    TripRepository tripRepository;
    ModelMapper modelMapper;

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
