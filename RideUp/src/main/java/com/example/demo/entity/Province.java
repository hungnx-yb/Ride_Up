package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

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

    // Tên tỉnh/thành phố
    String name;

    // Mã tỉnh (01, 02, ...)
    String code;

    // Danh sách quận/huyện
    @OneToMany(mappedBy = "province", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    List<District> districts = new ArrayList<>();
}
