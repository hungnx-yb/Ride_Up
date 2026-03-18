package com.example.demo.controller;

import com.example.demo.dto.response.ApiResponse;
import com.example.demo.dto.response.ProvinceResponse;
import com.example.demo.dto.response.WardResponse;
import com.example.demo.entity.Province;
import com.example.demo.entity.Ward;
import com.example.demo.repository.ProvinceRepository;
import com.example.demo.repository.WardRepository;
import com.example.demo.service.LocationDataSeeder;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class LocationController {

    ProvinceRepository provinceRepository;
    WardRepository wardRepository;
    LocationDataSeeder locationDataSeeder;

    /** GET /api/locations/provinces — danh sách tất cả tỉnh/TP */
    @GetMapping("/provinces")
    @Transactional(readOnly = true)
    public ApiResponse<List<ProvinceResponse>> getProvinces() {
        List<ProvinceResponse> data = provinceRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toProvinceResponse)
                .collect(Collectors.toList());
        return ApiResponse.<List<ProvinceResponse>>builder()
                .result(data)
                .count(data.size())
                .build();
    }

    /** GET /api/locations/provinces/{id}/wards?q= — xã/phường theo tỉnh (có tìm kiếm) */
    @GetMapping("/provinces/{provinceId}/wards")
    @Transactional(readOnly = true)
    public ApiResponse<List<WardResponse>> getWardsByProvince(
            @PathVariable String provinceId,
            @RequestParam(required = false) String q) {

        List<Ward> wards = StringUtils.hasText(q)
                ? wardRepository.searchByProvinceIdAndName(provinceId, q.trim())
                : wardRepository.findByProvinceId(provinceId);

        List<WardResponse> data = wards.stream()
                .map(this::toWardResponse)
                .collect(Collectors.toList());

        return ApiResponse.<List<WardResponse>>builder()
                .result(data)
                .count(data.size())
                .build();
    }

    private ProvinceResponse toProvinceResponse(Province p) {
        return ProvinceResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .code(p.getCode())
                .lat(p.getLat())
                .lng(p.getLng())
                .build();
    }

    private WardResponse toWardResponse(Ward w) {
        return WardResponse.builder()
                .id(w.getId())
                .name(w.getName())
                .code(w.getCode())
                .lat(w.getLat())
                .lng(w.getLng())
                .provinceId(w.getProvince() != null ? w.getProvince().getId() : null)
                .provinceName(w.getProvince() != null ? w.getProvince().getName() : null)
                .build();
    }

    // ── Admin endpoints (yêu cầu xác thực) ──────────────────────────────

    /**
     * GET /api/locations/admin/stats
     * Trả về số lượng tỉnh, xã hiện có trong DB và trạng thái đồng bộ gần nhất.
     */
    @GetMapping("/admin/stats")
    @Transactional(readOnly = true)
    public ApiResponse<Map<String, Object>> getLocationStats() {
        LocationDataSeeder.SyncInfo info = locationDataSeeder.getSyncStatus();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("provinceCount", provinceRepository.count());
        data.put("wardCount", wardRepository.count());
        data.put("syncState", info.state().name());
        data.put("startedAt", info.startedAt() != null ? info.startedAt().toString() : null);
        data.put("finishedAt", info.finishedAt() != null ? info.finishedAt().toString() : null);
        data.put("errorMessage", info.errorMessage());
        return ApiResponse.<Map<String, Object>>builder().result(data).build();
    }

    /**
     * POST /api/locations/admin/sync
     * Kích hoạt đồng bộ lại toàn bộ dữ liệu tỉnh/xã từ Overpass (bất đồng bộ).
     * Theo dõi tiến trình qua GET /admin/stats.
     */
    @PostMapping("/admin/sync")
    public ApiResponse<String> triggerSync() {
        LocationDataSeeder.SyncInfo current = locationDataSeeder.getSyncStatus();
        if (current.state() == LocationDataSeeder.SyncState.RUNNING) {
            return ApiResponse.<String>builder()
                    .result("ALREADY_RUNNING")
                    .message("Đồng bộ đang chạy, vui lòng chờ...")
                    .build();
        }
        locationDataSeeder.triggerFullSync();
        return ApiResponse.<String>builder()
                .result("STARTED")
                .message("Đồng bộ dữ liệu địa lý đã bắt đầu. Quá trình có thể mất vài phút.")
                .build();
    }
}
