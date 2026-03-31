package com.example.demo.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

@Configuration
@Getter
public class SupabaseStorageConfig {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.api-key}")
    private String apiKey;

    @Value("${supabase.bucket}")
    private String bucket;


    public String getStorageApiUrl() {
        return supabaseUrl + "/storage/v1";
    }

    public String getPublicUrl(String objectPath) {
        String encodedPath = UriUtils.encodePath(objectPath == null ? "" : objectPath, StandardCharsets.UTF_8);
        return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + encodedPath;
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
