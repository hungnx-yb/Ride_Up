package com.example.demo.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiRideSearchAssistant {

    final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${support.ai.enabled:false}")
    boolean enabled;

    @Value("${support.ai.base-url:https://generativelanguage.googleapis.com/v1beta}")
    String baseUrl;

    @Value("${support.ai.model:gemini-1.5-flash}")
    String model;

    @Value("${support.ai.api-key:}")
    String apiKey;

    public Optional<ParsedRideQuery> parseQuery(String queryText) {
        if (!enabled || !StringUtils.hasText(apiKey) || !StringUtils.hasText(queryText)) {
            return Optional.empty();
        }

        try {
            String systemPrompt = "Bạn là bộ phân tích câu lệnh tìm chuyến xe RideUp. "
                    + "Trích xuất ý định từ câu tiếng Việt và trả về DUY NHẤT 1 JSON object hợp lệ. "
                    + "Schema JSON bắt buộc: "
                    + "{\"fromText\":\"...\",\"toText\":\"...\",\"departureDate\":\"YYYY-MM-DD hoặc null\","
                    + "\"seatCount\":number hoặc null,\"maxPrice\":number hoặc null,"
                    + "\"confidence\":number 0..1,\"clarificationQuestions\":[\"...\",\"...\"]}. "
                    + "Nếu người dùng chỉ nêu một đầu tuyến thì vẫn giữ đầu còn lại là null, không tự đoán thêm. "
                    + "Chỉ hỏi làm rõ khi thực sự không xác định được cả điểm đi lẫn điểm đến. "
                    + "Không thêm markdown, không thêm ký tự ngoài JSON.";

            Map<String, Object> payload = new HashMap<>();
            payload.put("generationConfig", Map.of("temperature", 0.1));

            String combinedPrompt = systemPrompt + "\n\nCâu người dùng: " + queryText;
            List<Map<String, Object>> contents = new ArrayList<>();
            contents.add(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", combinedPrompt))));
            payload.put("contents", contents);

            String requestBody = objectMapper.writeValueAsString(payload);
            String encodedApiKey = URLEncoder.encode(apiKey.trim(), StandardCharsets.UTF_8);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(
                            normalizeBaseUrl(baseUrl) + "/models/" + model + ":generateContent?key=" + encodedApiKey))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode parts = root.path("candidates").path(0).path("content").path("parts");

            StringBuilder contentBuilder = new StringBuilder();
            if (parts.isArray()) {
                for (JsonNode part : parts) {
                    String text = part.path("text").asText("").trim();
                    if (StringUtils.hasText(text)) {
                        if (contentBuilder.length() > 0) {
                            contentBuilder.append("\n");
                        }
                        contentBuilder.append(text);
                    }
                }
            }

            String content = contentBuilder.toString().trim();
            if (!StringUtils.hasText(content)) {
                return Optional.empty();
            }

            JsonNode aiJson = parseJsonContent(content);
            if (aiJson == null || !aiJson.isObject()) {
                return Optional.empty();
            }

            List<String> questions = new ArrayList<>();
            JsonNode questionsNode = aiJson.path("clarificationQuestions");
            if (questionsNode.isArray()) {
                for (JsonNode node : questionsNode) {
                    String value = node.asText("").trim();
                    if (StringUtils.hasText(value)) {
                        questions.add(value);
                    }
                }
            }

            BigDecimal maxPrice = null;
            if (!aiJson.path("maxPrice").isNull() && aiJson.has("maxPrice")) {
                String raw = aiJson.path("maxPrice").asText("").trim();
                if (StringUtils.hasText(raw)) {
                    maxPrice = new BigDecimal(raw);
                }
            }

            Integer seatCount = null;
            if (!aiJson.path("seatCount").isNull() && aiJson.has("seatCount")) {
                seatCount = aiJson.path("seatCount").asInt();
                if (seatCount != null && seatCount <= 0) {
                    seatCount = null;
                }
            }

            return Optional.of(ParsedRideQuery.builder()
                    .fromText(textOrNull(aiJson.path("fromText").asText(null)))
                    .toText(textOrNull(aiJson.path("toText").asText(null)))
                    .departureDate(textOrNull(aiJson.path("departureDate").asText(null)))
                    .seatCount(seatCount)
                    .maxPrice(maxPrice)
                    .confidence(aiJson.path("confidence").isNumber() ? aiJson.path("confidence").asDouble() : null)
                    .clarificationQuestions(questions)
                    .build());
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private String normalizeBaseUrl(String value) {
        String v = value == null ? "" : value.trim();
        if (v.endsWith("/")) {
            return v.substring(0, v.length() - 1);
        }
        return v;
    }

    private JsonNode parseJsonContent(String content) {
        try {
            return objectMapper.readTree(content);
        } catch (Exception ignored) {
            int start = content.indexOf('{');
            int end = content.lastIndexOf('}');
            if (start >= 0 && end > start) {
                String raw = content.substring(start, end + 1);
                try {
                    return objectMapper.readTree(raw);
                } catch (Exception ignored2) {
                    return null;
                }
            }
            return null;
        }
    }

    private String textOrNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ParsedRideQuery {
        String fromText;
        String toText;
        String departureDate;
        Integer seatCount;
        BigDecimal maxPrice;
        Double confidence;
        @Builder.Default
        List<String> clarificationQuestions = new ArrayList<>();
    }
}
