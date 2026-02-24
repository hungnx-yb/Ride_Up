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
public class TripDropoffPoint {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    // Chuyến xe (N-1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    Trip trip;

    // Quận/huyện trả (N-1) - phải thuộc trip.endProvince
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "district_id", nullable = false)
    District district;

    // Địa chỉ cụ thể (VD: "Bến xe Niệm Nghĩa")
    String address;

    // Giờ trả dự kiến tại điểm này
    LocalTime dropoffTime;

    // Thứ tự trả (1, 2, 3...)
    Integer sortOrder;

    // Ghi chú
    String note;
}

