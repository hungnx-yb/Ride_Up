package com.example.demo.service;

import com.example.demo.dto.request.SupportChatRequest;
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
import java.util.concurrent.ConcurrentHashMap;

@Service
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiSupportAssistant {

    private static final int MAX_BOOKING_CONTEXT_LENGTH = 220;
    private static final int MAX_CONVERSATION_CONTEXT_LENGTH = 520;

    final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    final ObjectMapper objectMapper = new ObjectMapper();
    final Map<String, CacheEntry> replyCache = new ConcurrentHashMap<>();

    @Value("${support.ai.enabled:false}")
    boolean enabled;

    @Value("${support.ai.base-url:https://generativelanguage.googleapis.com/v1beta}")
    String baseUrl;

    @Value("${support.ai.model:gemini-1.5-flash}")
    String model;

    @Value("${support.ai.api-key:}")
    String apiKey;

    @Value("${support.ai.cache-ttl-seconds:90}")
    long cacheTtlSeconds;

        public Optional<SupportChatResponse> generateReply(
            String userMessage,
            List<CustomerBookingResponse> bookings,
            List<SupportChatRequest.HistoryItem> history
        ) {
        if (!enabled || !StringUtils.hasText(apiKey) || !StringUtils.hasText(userMessage)) {
            return Optional.empty();
        }

        try {
            String bookingContext = truncateText(buildBookingContext(bookings), MAX_BOOKING_CONTEXT_LENGTH);
            String conversationContext = truncateText(buildConversationContext(history), MAX_CONVERSATION_CONTEXT_LENGTH);
            String cacheKey = buildCacheKey(userMessage, bookingContext, conversationContext);

            Optional<SupportChatResponse> cached = getCachedResponse(cacheKey);
            if (cached.isPresent()) {
                return cached;
            }

            String systemPrompt = "Bạn là trợ lý CSKH của ứng dụng RideUp. "
                    + "Trả lời bằng tiếng Việt, rõ ràng, ngắn gọn, đúng nghiệp vụ đặt xe. "
                    + "Giọng điệu thân thiện, hóm hỉnh vừa phải, tươi mới và có thể dùng icon/emoji phù hợp. "
                    + "Hỗ trợ rộng các chủ đề: booking, thanh toán, hủy chuyến, hoàn tiền, đổi điểm đón/trả, thất lạc đồ, khiếu nại an toàn, mã giảm giá, hóa đơn, tài khoản. "
                    + "Nếu người dùng hỏi về thanh toán/chuyến đi, ưu tiên dựa trên ngữ cảnh booking cung cấp. "
                    + "Phản hồi BẮT BUỘC dưới JSON object với cấu trúc: "
                    + "{\"intent\":\"...\",\"reply\":\"...\",\"suggestions\":[\"...\",\"...\",\"...\"]}. "
                    + "Mảng suggestions cần có 3-6 câu gợi ý ngắn, đa dạng, dễ bấm tiếp. "
                    + "Không lặp lại đúng nguyên văn một câu trả lời giữa các lượt tương tự. "
                    + "Không trả về markdown, không thêm ký tự ngoài JSON.";

            Map<String, Object> payload = new HashMap<>();
                payload.put("generationConfig", Map.of(
                    "temperature", 0.55,
                    "topP", 0.9,
                    "candidateCount", 1
                ));

                String combinedPrompt = systemPrompt
                    + "\n\nNgữ cảnh booking gần đây: " + bookingContext
                    + "\n\nNgữ cảnh hội thoại gần nhất: " + conversationContext
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
                    .timeout(Duration.ofSeconds(4))
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

            SupportChatResponse aiReply = SupportChatResponse.builder()
                    .intent(StringUtils.hasText(intent) ? intent.toUpperCase(Locale.ROOT) : "AI_SUPPORT")
                    .reply(reply)
                    .suggestions(suggestions)
                    .build();

            putCachedResponse(cacheKey, aiReply);
            return Optional.of(aiReply);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private Optional<SupportChatResponse> getCachedResponse(String cacheKey) {
        CacheEntry entry = replyCache.get(cacheKey);
        long now = System.currentTimeMillis();
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.expiresAtMillis <= now) {
            replyCache.remove(cacheKey);
            return Optional.empty();
        }
        return Optional.of(cloneResponse(entry.response));
    }

    private void putCachedResponse(String cacheKey, SupportChatResponse response) {
        long ttlMillis = Math.max(15, cacheTtlSeconds) * 1000;
        replyCache.put(cacheKey, new CacheEntry(cloneResponse(response), System.currentTimeMillis() + ttlMillis));
    }

    private String buildCacheKey(String userMessage, String bookingContext, String conversationContext) {
        return normalizeCachePart(userMessage) + "|" + normalizeCachePart(bookingContext) + "|" + normalizeCachePart(conversationContext);
    }

    private String normalizeCachePart(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private String truncateText(String value, int maxLength) {
        if (!StringUtils.hasText(value) || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength) + "...";
    }

    private SupportChatResponse cloneResponse(SupportChatResponse response) {
        List<String> copiedSuggestions = response.getSuggestions() == null
            ? List.of()
            : new ArrayList<>(response.getSuggestions());

        return SupportChatResponse.builder()
            .intent(response.getIntent())
            .reply(response.getReply())
            .suggestions(copiedSuggestions)
            .build();
    }

    private record CacheEntry(SupportChatResponse response, long expiresAtMillis) {}

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

    private String buildConversationContext(List<SupportChatRequest.HistoryItem> history) {
        if (history == null || history.isEmpty()) {
            return "Không có lịch sử hội thoại gần đây.";
        }

        List<String> lines = new ArrayList<>();
        int start = Math.max(0, history.size() - 5);
        for (int i = start; i < history.size(); i++) {
            SupportChatRequest.HistoryItem item = history.get(i);
            if (item == null) continue;

            String role = StringUtils.hasText(item.getRole()) ? item.getRole().trim().toLowerCase(Locale.ROOT) : "user";
            String text = StringUtils.hasText(item.getText()) ? item.getText().trim() : "";
            if (!StringUtils.hasText(text)) continue;

            if (!"assistant".equals(role) && !"user".equals(role)) {
                role = "user";
            }
            lines.add(role + ": " + text);
        }

        if (lines.isEmpty()) {
            return "Không có lịch sử hội thoại gần đây.";
        }
        return String.join(" | ", lines);
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
