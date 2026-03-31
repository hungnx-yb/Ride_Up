package com.example.demo.service;

import com.example.demo.dto.response.ChatMessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ChatRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publishThreadMessage(ChatMessageResponse message) {
        if (message == null || message.getThreadId() == null || message.getThreadId().isBlank()) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/chat.thread." + message.getThreadId(), message);
    }
}
