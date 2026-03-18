package com.example.demo.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DriverRouteRequest {
    String pickupProvinceId;
    String pickupProvince;

    @Builder.Default
    List<String> pickupClusters = new ArrayList<>();

    String dropoffProvinceId;
    String dropoffProvince;

    @Builder.Default
    List<String> dropoffClusters = new ArrayList<>();

    Long fixedFare;
    String status;
}
