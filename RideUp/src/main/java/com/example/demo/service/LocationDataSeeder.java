package com.example.demo.service;

import com.example.demo.entity.Province;
import com.example.demo.entity.Ward;
import com.example.demo.repository.ProvinceRepository;
import com.example.demo.repository.WardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * CÃ o dá»¯ liá»‡u tá»‰nh vÃ  xÃ£/phÆ°á»ng tá»« provinces.open-api.vn.
 *
 * <p>Chá»‰ cáº§n 1 HTTP GET duy nháº¥t â€“ tráº£ vá» toÃ n bá»™ tá»‰nh / quáº­n / xÃ£ phÆ°á»ng
 * cá»§a Viá»‡t Nam trong 1 JSON, thay vÃ¬ 60+ láº§n gá»i Overpass.</p>
 *
 * <p>Endpoint: GET https://provinces.open-api.vn/api/?depth=3</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LocationDataSeeder {

    // â”€â”€ Nguá»“n dá»¯ liá»‡u â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    private static final String PROVINCES_API_URL =
            "https://provinces.open-api.vn/api/?depth=3";

    // â”€â”€ Sync status tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public enum SyncState { IDLE, RUNNING, DONE, FAILED }

    public record SyncInfo(
            SyncState state,
            LocalDateTime startedAt,
            LocalDateTime finishedAt,
            long provinceCount,
            long wardCount,
            String errorMessage
    ) {}

    private final AtomicReference<SyncInfo> syncStatus =
            new AtomicReference<>(new SyncInfo(SyncState.IDLE, null, null, 0, 0, null));

    public SyncInfo getSyncStatus() { return syncStatus.get(); }

    // â”€â”€ Dependencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private final ProvinceRepository provinceRepository;
    private final WardRepository wardRepository;
    private final RestTemplateBuilder restTemplateBuilder;

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Startup auto-seed
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @EventListener(ApplicationReadyEvent.class)
    public void seedIfEmpty() {
        if (provinceRepository.count() > 0) {
            log.info("[LocationSeeder] Province data already exists â€“ skipping seed.");
            return;
        }
        log.info("[LocationSeeder] Province table is empty â€“ seeding from provinces.open-api.vn...");
        try {
            seedAll();
            long pCount = provinceRepository.count();
            long wCount = wardRepository.count();
            syncStatus.set(new SyncInfo(SyncState.DONE, LocalDateTime.now(), LocalDateTime.now(), pCount, wCount, null));
            log.info("[LocationSeeder] Seed completed: {} provinces, {} wards.", pCount, wCount);
        } catch (Exception ex) {
            log.error("[LocationSeeder] Seed failed: {}", ex.getMessage(), ex);
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Admin-triggered full sync
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Admin-triggered full sync â€“ cháº¡y báº¥t Ä‘á»“ng bá»™ (@Async).
     * Káº¿t quáº£ poll qua getSyncStatus().
     */
    @Async
    public void triggerFullSync() {
        if (syncStatus.get().state() == SyncState.RUNNING) {
            log.warn("[LocationSeeder] Sync already running â€“ ignoring duplicate call.");
            return;
        }
        LocalDateTime started = LocalDateTime.now();
        syncStatus.set(new SyncInfo(SyncState.RUNNING, started, null, 0, 0, null));
        log.info("[LocationSeeder] Admin-triggered full sync started.");
        try {
            log.info("[LocationSeeder] Deleting existing data...");
            wardRepository.deleteAllInBatch();
            provinceRepository.deleteAllInBatch();
            seedAll();
            long pCount = provinceRepository.count();
            long wCount = wardRepository.count();
            syncStatus.set(new SyncInfo(SyncState.DONE, started, LocalDateTime.now(), pCount, wCount, null));
            log.info("[LocationSeeder] Full sync done: {} provinces, {} wards.", pCount, wCount);
        } catch (Exception ex) {
            log.error("[LocationSeeder] Full sync failed", ex);
            syncStatus.set(new SyncInfo(SyncState.FAILED, started, LocalDateTime.now(), 0, 0, ex.getMessage()));
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Core: 1 API call â†’ parse â†’ save
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Transactional
    protected void seedAll() {
        RestTemplate http = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(15))
                .setReadTimeout(Duration.ofSeconds(60))
                .build();

        log.info("[LocationSeeder] Calling provinces.open-api.vn (1 request for all data)...");

        // 1 HTTP GET â€“ tráº£ vá» List<Province{name, code, districts:[{wards:[...]}]}>
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> apiProvinces = http.getForObject(PROVINCES_API_URL, List.class);

        if (apiProvinces == null || apiProvinces.isEmpty()) {
            throw new RuntimeException("provinces.open-api.vn returned empty response");
        }

        log.info("[LocationSeeder] Received {} provinces from API. Mapping to DB...", apiProvinces.size());

        int totalWards = 0;

        for (Map<String, Object> pData : apiProvinces) {
            // â”€â”€ Province â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            Province province = Province.builder()
                    .name((String) pData.get("name"))
                    .code(String.valueOf(pData.get("code")))
                    .build();
            province = provinceRepository.save(province);

            // â”€â”€ Wards (qua táº§ng district) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> districts =
                    (List<Map<String, Object>>) pData.get("districts");

            List<Ward> wards = new ArrayList<>();
            if (districts != null) {
                for (Map<String, Object> district : districts) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> wardList =
                            (List<Map<String, Object>>) district.get("wards");
                    if (wardList == null) continue;
                    for (Map<String, Object> wData : wardList) {
                        wards.add(Ward.builder()
                                .name((String) wData.get("name"))
                                .code(String.valueOf(wData.get("code")))
                                .province(province)
                                .build());
                    }
                }
            }

            if (!wards.isEmpty()) {
                wardRepository.saveAll(wards);
                totalWards += wards.size();
            }

            log.debug("[LocationSeeder]  âœ“ {} â€“ {} wards", province.getName(), wards.size());
        }

        log.info("[LocationSeeder] Mapping complete: {} provinces, {} wards total.", apiProvinces.size(), totalWards);
    }
}
