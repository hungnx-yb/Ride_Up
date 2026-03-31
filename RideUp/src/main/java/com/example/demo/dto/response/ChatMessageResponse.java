package com.example.demo.dto.response;

import com.example.demo.enums.ChatMessageType;
import com.example.demo.enums.Role;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ChatMessageResponse {
    String id;
    String threadId;
    String bookingId;
    String senderUserId;
    Role senderRole;
    ChatMessageType type;
    String content;
    String imageUrl;
    LocalDateTime sentAt;
    Boolean mine;
}
