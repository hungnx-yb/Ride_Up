package com.example.demo.service;

import com.example.demo.entity.Province;
import com.example.demo.entity.Ward;
import com.example.demo.repository.ProvinceRepository;
import com.example.demo.repository.WardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Cào dữ liệu tỉnh/thành phố (province) và xã/phường/thị trấn (ward) từ
 * Overpass API – cùng nguồn dữ liệu với FE (locationService.js).
 *
 * <p>Chỉ chạy một lần khi bảng province trống.  Nếu muốn chạy lại, xóa
 * toàn bộ dữ liệu trong province + ward trước, rồi restart ứng dụng.</p>
 *
 * <p>Chiến lược query:</p>
 * <ul>
 *   <li>Tỉnh: Overpass admin_level=4 bên trong Vietnam (admin_level=2)</li>
 *   <li>Ward: Overpass admin_level=8 bên trong từng tỉnh (theo OSM relation id)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LocationDataSeeder {

    private static final String OVERPASS_URL = "https://overpass-api.de/api/interpreter";

    /** Khoảng chờ giữa các request ward (ms) – tránh bị block bởi Overpass */
    private static final long DELAY_BETWEEN_PROVINCE_MS = 2_000;

    private final ProvinceRepository provinceRepository;
    private final WardRepository wardRepository;
    private final RestTemplateBuilder restTemplateBuilder;

    // ──────────────────────────────────────────────────────────────────────
    // Entry point
    // ──────────────────────────────────────────────────────────────────────

    @EventListener(ApplicationReadyEvent.class)
    public void seedIfEmpty() {
        if (provinceRepository.count() > 0) {
            log.info("[LocationSeeder] Province data already exists – skipping seed.");
            return;
        }
        log.info("[LocationSeeder] Province table is empty – starting data seed from Overpass API...");
        try {
            seedAll();
            log.info("[LocationSeeder] Seed completed successfully.");
        } catch (Exception ex) {
            log.error("[LocationSeeder] Seed failed: {}", ex.getMessage(), ex);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Orchestration
    // ──────────────────────────────────────────────────────────────────────

    private void seedAll() throws InterruptedException {
        RestTemplate http = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(15))
                .setReadTimeout(Duration.ofSeconds(30))
                .build();

        List<Province> provinces = fetchAndSaveProvinces(http);
        log.info("[LocationSeeder] Saved {} provinces.", provinces.size());

        int totalWards = 0;
        for (Province province : provinces) {
            try {
                int count = fetchAndSaveWards(http, province);
                totalWards += count;
                log.info("[LocationSeeder]  → {} wards for {}", count, province.getName());
            } catch (Exception ex) {
                log.warn("[LocationSeeder]  ↳ Could not fetch wards for {}: {}",
                        province.getName(), ex.getMessage());
            }
            Thread.sleep(DELAY_BETWEEN_PROVINCE_MS);
        }
        log.info("[LocationSeeder] Total wards saved: {}", totalWards);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Fetch + persist provinces
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Query Overpass cho tất cả quan hệ hành chính cấp tỉnh của Việt Nam
     * (admin_level=4, cùng truy vấn với FE locationService.fetchProvinces).
     */
    @Transactional
    public List<Province> fetchAndSaveProvinces(RestTemplate http) {
        // Giống hệt query trong FE locationService.js
        String query =
                "[out:json][timeout:30];" +
                "area[\"ISO3166-1\"=\"VN\"][admin_level=2];" +
                "rel(area)[\"admin_level\"=\"4\"][\"boundary\"=\"administrative\"];" +
                "out tags center;";

        Map<String, Object> body = callOverpass(http, query, 30_000);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> elements = (List<Map<String, Object>>) body.get("elements");
        if (elements == null || elements.isEmpty()) {
            throw new RuntimeException("Overpass returned no province elements");
        }

        List<Province> provinces = elements.stream()
                .filter(el -> el.get("tags") != null && el.get("center") != null)
                .map(el -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> tags   = (Map<String, Object>) el.get("tags");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> center = (Map<String, Object>) el.get("center");

                    String name = tags.containsKey("name:vi")
                            ? (String) tags.get("name:vi")
                            : (String) tags.get("name");

                    return Province.builder()
                            .name(name)
                            .osmId(toLong(el.get("id")))
                            .lat(toBigDecimal(center.get("lat")))
                            .lng(toBigDecimal(center.get("lon")))
                            .build();
                })
                .sorted((a, b) -> a.getName().compareToIgnoreCase(b.getName()))
                .toList();

        return provinceRepository.saveAll(provinces);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Fetch + persist wards for one province
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Query Overpass lấy tất cả xã/phường/thị trấn (admin_level=8)
     * bên trong relation OSM của tỉnh.
     *
     * <p>Nếu admin_level=8 không có kết quả (dữ liệu OSM chưa cập nhật theo
     * cải cách 2025), tự động thử lại với admin_level=6.</p>
     */
    @Transactional
    public int fetchAndSaveWards(RestTemplate http, Province province) {
        if (province.getOsmId() == null) return 0;

        // Thử admin_level=8 trước (xã/phường/thị trấn truyền thống)
        int saved = doFetchWards(http, province, 8);
        if (saved == 0) {
            // Fallback: sau cải cách 2025, nhiều tỉnh dùng level 6 cho đơn vị trực thuộc
            log.debug("[LocationSeeder]  ↳ Retrying {} with admin_level=6", province.getName());
            saved = doFetchWards(http, province, 6);
        }
        return saved;
    }

    private int doFetchWards(RestTemplate http, Province province, int adminLevel) {
        // Tìm area bao gồm tỉnh qua OSM relation id, rồi lấy các ward bên trong
        String query = String.format(
                "[out:json][timeout:30];" +
                "rel(%d)->.prov;" +
                "map_to_area.prov->.provArea;" +
                "rel(area.provArea)[\"admin_level\"=\"%d\"][\"boundary\"=\"administrative\"];" +
                "out tags center;",
                province.getOsmId(), adminLevel);

        Map<String, Object> body;
        try {
            body = callOverpass(http, query, 35_000);
        } catch (Exception ex) {
            log.warn("[LocationSeeder]   ↳ Overpass error for {} (level {}): {}",
                    province.getName(), adminLevel, ex.getMessage());
            return 0;
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> elements = (List<Map<String, Object>>) body.get("elements");
        if (elements == null || elements.isEmpty()) return 0;

        List<Ward> wards = elements.stream()
                .filter(el -> el.get("tags") != null && el.get("center") != null)
                .filter(el -> {
                    // Bỏ qua ward đã tồn tại (idempotent)
                    Long osmId = toLong(el.get("id"));
                    return osmId == null || !wardRepository.existsByOsmId(osmId);
                })
                .map(el -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> tags   = (Map<String, Object>) el.get("tags");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> center = (Map<String, Object>) el.get("center");

                    String name = tags.containsKey("name:vi")
                            ? (String) tags.get("name:vi")
                            : (String) tags.get("name");
                    String displayName = (String) tags.getOrDefault("name", name);

                    return Ward.builder()
                            .name(name)
                            .displayName(displayName)
                            .osmId(toLong(el.get("id")))
                            .lat(toBigDecimal(center.get("lat")))
                            .lng(toBigDecimal(center.get("lon")))
                            .province(province)
                            .build();
                })
                .toList();

        wardRepository.saveAll(wards);
        return wards.size();
    }

    // ──────────────────────────────────────────────────────────────────────
    // HTTP helper
    // ──────────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> callOverpass(RestTemplate http, String query, int timeoutMs) {
        String url = OVERPASS_URL + "?data=" + encode(query);
        Map<String, Object> response = http.getForObject(url, Map.class);
        if (response == null) throw new RuntimeException("Empty response from Overpass");
        return response;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Utility
    // ──────────────────────────────────────────────────────────────────────

    private static String encode(String s) {
        try {
            return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return s;
        }
    }

    private static Long toLong(Object val) {
        if (val == null) return null;
        if (val instanceof Long l) return l;
        if (val instanceof Integer i) return i.longValue();
        if (val instanceof Number n) return n.longValue();
        try { return Long.parseLong(val.toString()); } catch (Exception e) { return null; }
    }

    private static BigDecimal toBigDecimal(Object val) {
        if (val == null) return null;
        if (val instanceof BigDecimal bd) return bd;
        if (val instanceof Double d) return BigDecimal.valueOf(d);
        if (val instanceof Float f) return BigDecimal.valueOf(f);
        try { return new BigDecimal(val.toString()); } catch (Exception e) { return null; }
    }
}
