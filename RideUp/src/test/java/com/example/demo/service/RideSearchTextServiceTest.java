package com.example.demo.service;

import com.example.demo.dto.response.RideSearchFromTextResponse;
import com.example.demo.entity.Province;
import com.example.demo.repository.ProvinceRepository;
import com.example.demo.repository.WardRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RideSearchTextServiceTest {

    @Mock
    CustomerBookingService customerBookingService;

    @Mock
    AiRideSearchAssistant aiRideSearchAssistant;

    @Mock
    ProvinceRepository provinceRepository;

    @Mock
    WardRepository wardRepository;

    @Test
    void searchFromText_shouldResolveOriginOnlyQueryByProvince_withoutForcingDestination() {
        RideSearchTextService service = new RideSearchTextService(
                customerBookingService,
                aiRideSearchAssistant,
                provinceRepository,
                wardRepository);

        Province haNoi = Province.builder()
                .id("province-ha-noi")
                .name("Hà Nội")
                .build();

        when(aiRideSearchAssistant.parseQuery(anyString())).thenReturn(Optional.empty());
        when(wardRepository.searchByName(anyString())).thenReturn(List.of());
        when(provinceRepository.findAllByOrderByNameAsc()).thenReturn(List.of(haNoi));
        when(customerBookingService.searchRides(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of());

        RideSearchFromTextResponse response = service.searchFromText("đi từ Hà Nội");

        assertFalse(response.isNeedsClarification());
        assertEquals("province-ha-noi", response.getCriteria().getFromProvinceId());
        assertEquals("Hà Nội", response.getCriteria().getFromProvinceName());
        assertNull(response.getCriteria().getToProvinceId());
        assertNull(response.getCriteria().getToWardId());
        assertTrue(response.getClarificationQuestions().isEmpty());
    }

    @Test
    void searchFromText_shouldParseProvinceSeatPriceAndDateWithoutAi() {
        RideSearchTextService service = new RideSearchTextService(
                customerBookingService,
                aiRideSearchAssistant,
                provinceRepository,
                wardRepository);

        Province haNoi = Province.builder()
                .id("province-ha-noi")
                .name("Hà Nội")
                .build();
        Province haiPhong = Province.builder()
                .id("province-hai-phong")
                .name("Hải Phòng")
                .build();

        when(aiRideSearchAssistant.parseQuery(anyString())).thenReturn(Optional.empty());
        when(wardRepository.searchByName(anyString())).thenReturn(List.of());
        when(provinceRepository.findAllByOrderByNameAsc()).thenReturn(List.of(haNoi, haiPhong));
        when(customerBookingService.searchRides(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of());

        String queryDate = LocalDate.now().plusDays(3).toString();
        RideSearchFromTextResponse response = service.searchFromText(
                "đi từ Hà Nội đến Hải Phòng 3 ghế dưới 200k " + queryDate);

        assertFalse(response.isNeedsClarification());
        assertEquals("province-ha-noi", response.getCriteria().getFromProvinceId());
        assertEquals("province-hai-phong", response.getCriteria().getToProvinceId());
        assertEquals(Integer.valueOf(3), response.getCriteria().getSeatCount());
        assertEquals(new BigDecimal("200000"), response.getCriteria().getMaxPrice());
        assertEquals(queryDate, response.getCriteria().getDepartureDate());
        assertTrue(response.getClarificationQuestions().isEmpty());
    }

    @Test
    void searchFromText_shouldParseTomorrowWhenUserSaysMai() {
        RideSearchTextService service = new RideSearchTextService(
                customerBookingService,
                aiRideSearchAssistant,
                provinceRepository,
                wardRepository);

        Province haNoi = Province.builder()
                .id("province-ha-noi")
                .name("Hà Nội")
                .build();

        when(aiRideSearchAssistant.parseQuery(anyString())).thenReturn(Optional.empty());
        when(wardRepository.searchByName(anyString())).thenReturn(List.of());
        when(provinceRepository.findAllByOrderByNameAsc()).thenReturn(List.of(haNoi));
        when(customerBookingService.searchRides(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of());

        String expectedDate = LocalDate.now().plusDays(1).toString();
        RideSearchFromTextResponse response = service.searchFromText("đi từ Hà Nội mai");

        assertFalse(response.isNeedsClarification());
        assertEquals("province-ha-noi", response.getCriteria().getFromProvinceId());
        assertEquals(expectedDate, response.getCriteria().getDepartureDate());
        assertTrue(response.getClarificationQuestions().isEmpty());
    }

    @Test
    void searchFromText_shouldParseTonightAsToday() {
        RideSearchTextService service = new RideSearchTextService(
                customerBookingService,
                aiRideSearchAssistant,
                provinceRepository,
                wardRepository);

        Province haNoi = Province.builder()
                .id("province-ha-noi")
                .name("Hà Nội")
                .build();

        when(aiRideSearchAssistant.parseQuery(anyString())).thenReturn(Optional.empty());
        when(wardRepository.searchByName(anyString())).thenReturn(List.of());
        when(provinceRepository.findAllByOrderByNameAsc()).thenReturn(List.of(haNoi));
        when(customerBookingService.searchRides(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of());

        String expectedDate = LocalDate.now().toString();
        RideSearchFromTextResponse response = service.searchFromText("đi từ Hà Nội tối nay");

        assertFalse(response.isNeedsClarification());
        assertEquals("province-ha-noi", response.getCriteria().getFromProvinceId());
        assertEquals(expectedDate, response.getCriteria().getDepartureDate());
        assertTrue(response.getClarificationQuestions().isEmpty());
    }
}
