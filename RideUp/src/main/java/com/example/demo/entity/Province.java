package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Province {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    /** Tên tỉnh / thành phố */
    String name;

    /** Mã tỉnh (01, 02, ...) */
    String code;

    /** Vĩ độ trung tâm tỉnh (từ OSM) */
    @Column(precision = 10, scale = 7)
    BigDecimal lat;

    /** Kinh độ trung tâm tỉnh (từ OSM) */
    @Column(precision = 10, scale = 7)
    BigDecimal lng;

    /** OSM relation id (dùng để cào ward con) */
    Long osmId;

    /** Danh sách xã / phường / thị trấn thuộc tỉnh */
    @OneToMany(mappedBy = "province", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    List<Ward> wards = new ArrayList<>();
}
