package com.example.demo.service;

import com.example.demo.dto.response.CustomerBookingResponse;
import com.example.demo.dto.response.SupportChatResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

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
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiSupportAssistant {

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

    public Optional<SupportChatResponse> generateReply(String userMessage, List<CustomerBookingResponse> bookings) {
        if (!enabled || !StringUtils.hasText(apiKey) || !StringUtils.hasText(userMessage)) {
            return Optional.empty();
        }

        try {
            String bookingContext = buildBookingContext(bookings);

            String systemPrompt = "Bạn là trợ lý CSKH của ứng dụng RideUp. "
                    + "Trả lời bằng tiếng Việt, rõ ràng, ngắn gọn, đúng nghiệp vụ đặt xe. "
                    + "Nếu người dùng hỏi về thanh toán/chuyến đi, ưu tiên dựa trên ngữ cảnh booking cung cấp. "
                    + "Phản hồi BẮT BUỘC dưới JSON object với cấu trúc: "
                    + "{\"intent\":\"...\",\"reply\":\"...\",\"suggestions\":[\"...\",\"...\",\"...\"]}. "
                    + "Không trả về markdown, không thêm ký tự ngoài JSON.";

            Map<String, Object> payload = new HashMap<>();
                payload.put("generationConfig", Map.of("temperature", 0.2));

                String combinedPrompt = systemPrompt
                    + "\n\nNgữ cảnh booking gần đây: " + bookingContext
                    + "\n\nCâu hỏi người dùng: " + userMessage;

                List<Map<String, Object>> contents = new ArrayList<>();
                contents.add(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", combinedPrompt))
                ));
                payload.put("contents", contents);

            String requestBody = objectMapper.writeValueAsString(payload);
                String encodedApiKey = URLEncoder.encode(apiKey.trim(), StandardCharsets.UTF_8);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(baseUrl) + "/models/" + model + ":generateContent?key=" + encodedApiKey))
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

            String intent = aiJson.path("intent").asText("AI_SUPPORT");
            String reply = aiJson.path("reply").asText("");
            if (!StringUtils.hasText(reply)) {
                return Optional.empty();
            }

            List<String> suggestions = new ArrayList<>();
            JsonNode suggestionsNode = aiJson.path("suggestions");
            if (suggestionsNode.isArray()) {
                for (JsonNode n : suggestionsNode) {
                    String value = n.asText("").trim();
                    if (StringUtils.hasText(value)) {
                        suggestions.add(value);
                    }
                }
            }

            if (suggestions.isEmpty()) {
                suggestions = List.of("Kiểm tra booking gần nhất", "Tôi muốn hủy chuyến", "Tôi đã chuyển khoản nhưng chưa xác nhận");
            }

            return Optional.of(SupportChatResponse.builder()
                    .intent(StringUtils.hasText(intent) ? intent.toUpperCase(Locale.ROOT) : "AI_SUPPORT")
                    .reply(reply)
                    .suggestions(suggestions)
                    .build());
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private String buildBookingContext(List<CustomerBookingResponse> bookings) {
        if (bookings == null || bookings.isEmpty()) {
            return "Không có booking nào.";
        }

        CustomerBookingResponse b = bookings.get(0);
        return String.format(
                "bookingId=%s, route=%s-%s, status=%s, paymentMethod=%s, paymentStatus=%s, departureTime=%s",
                nvl(b.getId()),
                nvl(b.getFrom()),
                nvl(b.getTo()),
                nvl(b.getStatus()),
                nvl(b.getPaymentMethod()),
                nvl(b.getPaymentStatus()),
                String.valueOf(b.getDepartureTime())
        );
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

    private String nvl(String text) {
        return StringUtils.hasText(text) ? text : "--";
    }
}
