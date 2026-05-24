package com.example.demo.service;

import com.example.demo.dto.response.RealtimeNotificationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Component phát sự kiện thông báo realtime đến client qua WebSocket STOMP.
 *
 * <p>Sử dụng {@link SimpMessagingTemplate} của Spring WebSocket để push message
 * đến topic cá nhân của từng user: {@code /topic/notifications.user.{userId}}.
 * Client (React Native app) subscribe vào topic này và hiển thị thông báo
 * tức thì mà không cần polling API.</p>
 *
 * <p>Được gọi bởi {@link DriverTripService} sau các sự kiện:
 * tạo chuyến, bắt đầu chuyến, hoàn thành chuyến, hủy chuyến, xác nhận tiền mặt.</p>
 *
 * @author Phạm Quang Huy (B22DCCN394)
 * @see SimpMessagingTemplate
 */
@Component
@RequiredArgsConstructor
public class NotificationRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Gửi thông báo realtime đến một user cụ thể qua WebSocket STOMP.
     *
     * <p>Payload gửi đi là {@link RealtimeNotificationResponse} với UUID mới,
     * timestamp hiện tại và thông tin sự kiện. Method silent-return (không throw)
     * nếu targetUserId, title hoặc message rỗng, để caller không cần null-check
     * trước khi gọi.</p>
     *
     * <p><b>Các event type trong module Tài xế:</b>
     * <ul>
     *   <li>{@code DRIVER_TRIP_CREATED}         – gửi đến tài xế khi tạo chuyến thành công</li>
     *   <li>{@code DRIVER_TRIP_CANCELLED}        – gửi đến tài xế khi hủy chuyến thành công</li>
     *   <li>{@code TRIP_CANCELLED_BY_DRIVER}     – gửi đến từng hành khách khi tài xế hủy chuyến</li>
     *   <li>{@code DRIVER_TRIP_COMPLETED}        – gửi đến tài xế khi hoàn thành chuyến</li>
     *   <li>{@code TRIP_COMPLETED}               – gửi đến từng hành khách khi chuyến kết thúc</li>
     *   <li>{@code CASH_PAYMENT_CONFIRMED}       – gửi đến hành khách sau khi xác nhận tiền mặt</li>
     * </ul>
     * </p>
     *
     * @param targetUserId ID của user nhận thông báo
     * @param type         loại event (xem danh sách trên)
     * @param title        tiêu đề thông báo hiển thị trên app
     * @param message      nội dung chi tiết thông báo
     * @param referenceId  ID tham chiếu liên quan (tripId, bookingId...) để app navigate
     */
    public void notifyUser(String targetUserId, String type, String title, String message, String referenceId) {
        if (!StringUtils.hasText(targetUserId) || !StringUtils.hasText(title) || !StringUtils.hasText(message)) {
            return;
        }

        RealtimeNotificationResponse payload = RealtimeNotificationResponse.builder()
                .id(UUID.randomUUID().toString())
                .type(StringUtils.hasText(type) ? type.trim() : "GENERAL")
                .title(title.trim())
                .message(message.trim())
                .targetUserId(targetUserId.trim())
                .referenceId(StringUtils.hasText(referenceId) ? referenceId.trim() : null)
                .createdAt(LocalDateTime.now())
                .build();

        messagingTemplate.convertAndSend("/topic/notifications.user." + targetUserId.trim(), payload);
    }
}
