package com.example.demo.service;

import com.example.demo.config.SupabaseStorageConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileService {

    private final SupabaseStorageConfig supabaseConfig;
    private final RestTemplate restTemplate;


    public String upload(MultipartFile file, String prefix) {
        try {
            String originalName = file.getOriginalFilename();
            String safeOriginalName = sanitizeFileName(originalName);
            String fileName = prefix + "/" + UUID.randomUUID() + "-" + safeOriginalName;

            String uploadUrl = supabaseConfig.getStorageApiUrl()
                    + "/object/" + supabaseConfig.getBucket() + "/" + fileName;

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseConfig.getApiKey());
            headers.set("apikey", supabaseConfig.getApiKey());
            String rawContentType = file.getContentType();
            MediaType mediaType;
            try {
                mediaType = StringUtils.hasText(rawContentType)
                        ? MediaType.parseMediaType(rawContentType)
                        : MediaType.APPLICATION_OCTET_STREAM;
            } catch (InvalidMediaTypeException ex) {
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            }
            headers.setContentType(mediaType);
            headers.set("x-upsert", "true");

            HttpEntity<byte[]> requestEntity = new HttpEntity<>(file.getBytes(), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    uploadUrl, HttpMethod.POST, requestEntity, String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("File uploaded successfully: {}", fileName);
                return fileName;
            } else {
                throw new RuntimeException("Upload failed with status: " + response.getStatusCode());
            }

        } catch (HttpStatusCodeException e) {
            log.error("Supabase upload failed status={} body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Upload failed: " + e.getStatusCode() + " - " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            log.error("Upload failed", e);
            throw new RuntimeException("Upload failed: " + e.getMessage(), e);
        }
    }


    public String getFileUrl(String objectPath) {
        return supabaseConfig.getPublicUrl(objectPath);
    }

    private String sanitizeFileName(String originalName) {
        String fallback = "file.bin";
        if (originalName == null || originalName.isBlank()) {
            return fallback;
        }
        String sanitized = originalName.replaceAll("[\\\\/:*?\"<>|]+", "_").trim();
        return sanitized.isEmpty() ? fallback : sanitized;
    }

    public void delete(String objectPath) {
        try {
            String deleteUrl = supabaseConfig.getStorageApiUrl()
                    + "/object/" + supabaseConfig.getBucket() + "/" + objectPath;

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseConfig.getApiKey());
            headers.set("apikey", supabaseConfig.getApiKey());

            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            restTemplate.exchange(deleteUrl, HttpMethod.DELETE, requestEntity, String.class);
            log.info("File deleted successfully: {}", objectPath);

        } catch (Exception e) {
            throw new RuntimeException("Delete failed: " + e.getMessage(), e);
        }
    }
}



