package com.example.demo.entity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalTime;

@Entity
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

    // Địa chỉ cụ thể (VD: "Bến xe Mỹ Đình, số 20 Phạm Hùng")
    String address;

    // Giờ đón dự kiến tại điểm này
    LocalTime pickupTime;

    // Thứ tự đón (1, 2, 3...)
    Integer sortOrder;

    // Ghi chú (VD: "Đón trước cổng số 2")
    String note;
}

