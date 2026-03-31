package com.example.demo.dto.response;

import com.example.demo.enums.ChatThreadStatus;
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
public class ChatThreadResponse {
    String id;
    String bookingId;
    String tripId;
    String chatTitle;
    String customerUserId;
    String driverUserId;
    ChatThreadStatus status;
    LocalDateTime chatAllowedFrom;
    LocalDateTime chatAllowedUntil;
    LocalDateTime lastMessageAt;
    String lastMessagePreview;
    Integer customerUnreadCount;
    Integer driverUnreadCount;
    Integer myUnreadCount;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
