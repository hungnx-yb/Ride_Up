package com.example.demo.dto.response;

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
public class DriverRouteResponse {
    String id;
    String pickupProvince;

    @Builder.Default
    List<String> pickupClusters = new ArrayList<>();

    String dropoffProvince;

    @Builder.Default
    List<String> dropoffClusters = new ArrayList<>();

    Long fixedFare;
    String status;
}
