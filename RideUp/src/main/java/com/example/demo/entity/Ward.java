package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Entity
@Table(name = "ward")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Ward {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    /** Tên xã / phường / thị trấn */
    String name;

    /** Mã đơn vị hành chính */
    String code;

    /** Vĩ độ trung tâm (từ OSM) */
    @Column(precision = 10, scale = 7)
    BigDecimal lat;

    /** Kinh độ trung tâm (từ OSM) */
    @Column(precision = 10, scale = 7)
    BigDecimal lng;

    /** OSM relation id (dùng để tra cứu/cào dữ liệu) */
    Long osmId;

    /** Tên đầy đủ (display_name từ Nominatim) */
    @Column(length = 500)
    String displayName;

    /** Tỉnh / TP chứa ward này */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "province_id", nullable = false)
    Province province;
}
