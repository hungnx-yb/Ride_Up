package com.example.demo.service;

import com.example.demo.dto.response.RealtimeNotificationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class NotificationRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

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
