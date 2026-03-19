package com.example.demo.service;

import com.example.demo.entity.Province;
import com.example.demo.entity.Ward;
import com.example.demo.repository.ProvinceRepository;
import com.example.demo.repository.WardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.context.event.ApplicationReadyEvent;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
@Slf4j
public class LocationDataSeeder {

    private static final String PROVINCES_API_URL = "https://provinces.open-api.vn/api/?depth=3";

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

    private final ProvinceRepository provinceRepository;
    private final WardRepository wardRepository;
    private final RestTemplateBuilder restTemplateBuilder;

    public SyncInfo getSyncStatus() {
        return syncStatus.get();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seedIfEmpty() {
        if (provinceRepository.count() > 0) {
            return;
        }

        LocalDateTime started = LocalDateTime.now();
        syncStatus.set(new SyncInfo(SyncState.RUNNING, started, null, 0, 0, null));
        try {
            seedAll();
            syncStatus.set(new SyncInfo(
                    SyncState.DONE,
                    started,
                    LocalDateTime.now(),
                    provinceRepository.count(),
                    wardRepository.count(),
                    null
            ));
        } catch (Exception ex) {
            log.error("[LocationSeeder] Initial seed failed", ex);
            syncStatus.set(new SyncInfo(SyncState.FAILED, started, LocalDateTime.now(), 0, 0, ex.getMessage()));
        }
    }

    @Async
    public void triggerFullSync() {
        SyncInfo current = syncStatus.get();
        if (current.state() == SyncState.RUNNING) {
            return;
        }

        LocalDateTime started = LocalDateTime.now();
        syncStatus.set(new SyncInfo(SyncState.RUNNING, started, null, 0, 0, null));
        try {
            wardRepository.deleteAllInBatch();
            provinceRepository.deleteAllInBatch();
            seedAll();
            syncStatus.set(new SyncInfo(
                    SyncState.DONE,
                    started,
                    LocalDateTime.now(),
                    provinceRepository.count(),
                    wardRepository.count(),
                    null
            ));
        } catch (Exception ex) {
            log.error("[LocationSeeder] Full sync failed", ex);
            syncStatus.set(new SyncInfo(SyncState.FAILED, started, LocalDateTime.now(), 0, 0, ex.getMessage()));
        }
    }

    @Transactional
    protected void seedAll() {
        RestTemplate http = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(15))
                .setReadTimeout(Duration.ofSeconds(60))
                .build();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> apiProvinces = http.getForObject(PROVINCES_API_URL, List.class);

        if (apiProvinces == null || apiProvinces.isEmpty()) {
            throw new IllegalStateException("Province API returned empty response");
        }

        for (Map<String, Object> pData : apiProvinces) {
            Province province = Province.builder()
                    .name(getString(pData.get("name")))
                    .code(getString(pData.get("code")))
                    .build();
            Province savedProvince = provinceRepository.save(province);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> districts = (List<Map<String, Object>>) pData.getOrDefault("districts", List.of());

            List<Ward> wards = new ArrayList<>();
            for (Map<String, Object> district : districts) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> wardList = (List<Map<String, Object>>) district.getOrDefault("wards", List.of());
                for (Map<String, Object> wData : wardList) {
                    wards.add(Ward.builder()
                            .name(getString(wData.get("name")))
                            .code(getString(wData.get("code")))
                            .province(savedProvince)
                            .build());
                }
            }

            if (!wards.isEmpty()) {
                wardRepository.saveAll(wards);
            }
        }
    }

    private String getString(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }
}
