package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Vết GPS của driver – ghi mỗi ~30 giây khi trip = IN_PROGRESS.
 */
@Entity
@Table(name = "gps_tracking", indexes = {
        @Index(name = "fk_gps_trip", columnList = "trip_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GpsTracking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    /** Chuyến xe đang theo dõi */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gps_trip"))
    Trip trip;

    /** Vĩ độ */
    @Column(nullable = false, precision = 10, scale = 7)
    BigDecimal lat;

    /** Kinh độ */
    @Column(nullable = false, precision = 10, scale = 7)
    BigDecimal lng;

    /** Tốc độ (km/h) */
    @Column(name = "speed_kmh", precision = 5, scale = 2)
    BigDecimal speedKmh;

    /** Hướng 0–360° */
    @Column(precision = 5, scale = 2)
    BigDecimal heading;

    /** Độ chính xác GPS (m) */
    @Column(name = "accuracy_m", precision = 6, scale = 2)
    BigDecimal accuracyM;

    /** Thời điểm ghi trên thiết bị driver (device time) */
    @Column(name = "recorded_at", nullable = false)
    LocalDateTime recordedAt;

    /** Thời điểm server nhận bản ghi */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt;
}
