package com.example.demo.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RideSearchFromTextResponse {
    String queryText;
    Double confidence;
    boolean needsClarification;
    List<String> clarificationQuestions;
    ParsedCriteria criteria;
    List<RideSearchResponse> rides;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ParsedCriteria {
        String fromProvinceId;
        String fromProvinceName;
        String fromWardId;
        String fromWardName;
        String toProvinceId;
        String toProvinceName;
        String toWardId;
        String toWardName;
        String departureDate;
        Integer seatCount;
        BigDecimal maxPrice;
    }
}
