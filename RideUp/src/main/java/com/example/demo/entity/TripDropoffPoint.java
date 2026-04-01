package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalTime;

@Entity
@Table(name = "trip_dropoff_point", indexes = {
    @Index(name = "idx_trip_dropoff_trip_district", columnList = "trip_id,district_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TripDropoffPoint {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    // Chuyến xe (N-1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    Trip trip;

    // Xã/Phường trả (N-1) - phải thuộc tỉnh đích
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "district_id", nullable = false)
    Ward ward;

    // Địa chỉ cụ thể (VD: "Bến xe Niệm Nghĩa")
    String address;

    // Giờ trả dự kiến tại điểm này
    LocalTime dropoffTime;

    // Thứ tự trả (1, 2, 3...)
    Integer sortOrder;

    // Ghi chú
    String note;
}

