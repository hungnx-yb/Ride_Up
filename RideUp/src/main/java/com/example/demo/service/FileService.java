package com.example.demo.service;

import com.example.demo.config.SupabaseStorageConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
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
            String fileName = prefix + "/" + UUID.randomUUID() + "-" + file.getOriginalFilename();

            String uploadUrl = supabaseConfig.getStorageApiUrl()
                    + "/object/" + supabaseConfig.getBucket() + "/" + fileName;

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseConfig.getApiKey());
            headers.set("apikey", supabaseConfig.getApiKey());
            headers.setContentType(MediaType.parseMediaType(
                    file.getContentType() != null ? file.getContentType() : "application/octet-stream"
            ));
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

        } catch (Exception e) {
            throw new RuntimeException("Upload failed: " + e.getMessage(), e);
        }
    }


    public String getFileUrl(String objectPath) {
        return supabaseConfig.getPublicUrl(objectPath);
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



