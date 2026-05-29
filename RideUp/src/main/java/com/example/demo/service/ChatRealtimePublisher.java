package com.example.demo.service;

import com.example.demo.dto.response.ChatMessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Phát tin nhắn chat realtime theo từng thread qua STOMP.
 */
@Component
@RequiredArgsConstructor
public class ChatRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Đẩy payload lên topic /topic/chat.thread.{threadId} để client đang subscribe nhận ngay.
     */
    public void publishThreadMessage(ChatMessageResponse message) {
        if (message == null || message.getThreadId() == null || message.getThreadId().isBlank()) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/chat.thread." + message.getThreadId(), message);
    }
}
