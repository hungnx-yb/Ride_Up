package com.example.demo.entity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalTime;

@Entity
@Table(name = "trip_pickup_point", indexes = {
    @Index(name = "idx_trip_pickup_trip_district", columnList = "trip_id,district_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TripPickupPoint {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    // Chuyến xe (N-1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    Trip trip;

    // Xã/Phường đón (N-1) - phải thuộc tỉnh xuất phát
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "district_id", nullable = false)
    Ward ward;

    // Địa chỉ cụ thể (ví dụ: "Bến xe Mỹ Đình, số 20 Phạm Hùng")
    String address;

    // Giờ đón dự kiến tại điểm này
    LocalTime pickupTime;

    // Thứ tự đón theo thứ tự tăng dần (1 là điểm đón đầu tiên)
    Integer sortOrder;

    // Ghi chú (ví dụ: "Đón trước cổng số 2")
    String note;
}

