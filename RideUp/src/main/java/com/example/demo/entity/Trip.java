package com.example.demo.entity;
import com.example.demo.enums.TripStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "trip", indexes = {
    @Index(name = "idx_trip_status_departure", columnList = "status,departure_time"),
    @Index(name = "idx_trip_departure", columnList = "departure_time"),
    @Index(name = "idx_trip_driver_departure", columnList = "driver_id,departure_time")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Trip {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    // Tài xế tạo chuyến (N-1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id", nullable = false)
    DriverProfile driver;

    // Thời gian khởi hành
    LocalDateTime departureTime;

    // Tổng số ghế (copy từ vehicle.seatCapacity khi tạo)
    Integer totalSeats;

    // Số ghế còn trống
    Integer availableSeats;

    // Giá mỗi ghế (cố định cho cả chuyến)
    BigDecimal pricePerSeat;

    // Trạng thái chuyến
    @Enumerated(EnumType.STRING)
    TripStatus status;

    // Ghi chú của tài xế
    String driverNote;

    // Route polyline (dự kiến, encoded)
    @Column(columnDefinition = "TEXT")
    String routePolyline;

    // Khoảng cách ước tính (km) – từ Routing API khi tạo chuyến
    @Column(precision = 10, scale = 2)
    BigDecimal estimatedDistanceKm;

    // Thời gian di chuyển ước tính (phút)
    Integer estimatedDurationMinutes;

    // Thời điểm thực tế xuất phát (khi driver bấm "Bắt đầu")
    LocalDateTime actualDepartureTime;

    // Thời điểm thực tế đến điểm cuối
    LocalDateTime actualArrivalTime;

    // Khoảng cách thực tế (km) – tính từ GPS tracking
    @Column(precision = 10, scale = 2)
    BigDecimal actualDistanceKm;

    // Route polyline thực tế (ghi lại từ GPS)
    @Column(columnDefinition = "TEXT")
    String actualRoutePolyline;

    // Thời điểm trip chuyển sang COMPLETED
    LocalDateTime completedAt;

    // Danh sách điểm đón (1-N)
    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    List<TripPickupPoint> pickupPoints = new ArrayList<>();

    // Danh sách điểm trả (1-N)
    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    List<TripDropoffPoint> dropoffPoints = new ArrayList<>();

    // Danh sách booking (1-N)
    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    List<Booking> bookings = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    LocalDateTime updatedAt;
}
