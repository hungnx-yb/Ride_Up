package com.example.demo.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.AccessLevel;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RealtimeNotificationResponse {
    // ID thông báo duy nhất (UUID).
    String id;
    // Loại thông báo (PAYMENT_SUCCESS, TRIP_COMPLETED, ...).
    String type;
    // Tiêu đề hiển thị trên app.
    String title;
    // Nội dung chi tiết thông báo.
    String message;
    // User nhận thông báo.
    String targetUserId;
    // Tham chiếu nghiệp vụ (bookingId/tripId).
    String referenceId;
    // Thời điểm tạo thông báo.
    LocalDateTime createdAt;
}
