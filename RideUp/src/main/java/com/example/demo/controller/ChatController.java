package com.example.demo.controller;

import com.example.demo.dto.request.OpenChatThreadRequest;
import com.example.demo.dto.request.SendChatMessageRequest;
import com.example.demo.dto.response.ApiResponse;
import com.example.demo.dto.response.ChatMessageResponse;
import com.example.demo.dto.response.ChatThreadResponse;
import com.example.demo.service.ChatService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controller quản lý các chức năng chat giữa hành khách, tài xế và hệ thống hỗ trợ.
 *
 * <p>Phạm vi API gồm:
 * <ul>
 *   <li>Mở hoặc lấy lại luồng chat (thread) gắn với booking</li>
 *   <li>Lấy danh sách các thread của người dùng hiện tại</li>
 *   <li>Gửi tin nhắn mới (text/ảnh) và trả về tin vừa gửi</li>
 *   <li>Đánh dấu thread đã đọc để reset unread</li>
 * </ul>
 * </p>
 */
@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ChatController {

    ChatService chatService;

    /**
     * Mở hoặc lấy lại thread chat gắn với booking.
     *
     * <p>Nếu thread đã tồn tại thì trả về dữ liệu hiện có; nếu chưa có thì tạo mới.
     * Chỉ user là hành khách/tài xế của booking mới được phép truy cập.</p>
     *
     * @param request yêu cầu chứa bookingId
     * @return thông tin thread chat tương ứng
     */
    @PostMapping("/threads/open")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ChatThreadResponse> openThread(@RequestBody OpenChatThreadRequest request) {
        return ApiResponse.<ChatThreadResponse>builder()
                                .result(chatService.openThreadByBooking(request != null ? request.getBookingId() : null))
                .message("Open chat thread successfully")
                .build();
    }

    /**
     * Lấy danh sách thread chat của user hiện tại.
     *
     * <p>Kết quả đã được chuẩn hóa theo trạng thái và số lượng unread.</p>
     */
    @GetMapping("/threads")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<ChatThreadResponse>> getMyThreads() {
        List<ChatThreadResponse> data = chatService.getMyThreads();
        return ApiResponse.<List<ChatThreadResponse>>builder()
                .result(data)
                .count(data.size())
                .build();
    }

    /**
     * Lấy danh sách tin nhắn của một thread.
     *
     * <p>Mặc định trả tối đa 50 tin mới nhất, có thể giới hạn bằng param limit.</p>
     */
    @GetMapping("/threads/{threadId}/messages")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<ChatMessageResponse>> getMessages(
            @PathVariable String threadId,
            @RequestParam(required = false) Integer limit
    ) {
        List<ChatMessageResponse> data = chatService.getMessages(threadId, limit);
        return ApiResponse.<List<ChatMessageResponse>>builder()
                .result(data)
                .count(data.size())
                .build();
    }

    /**
     * Gửi tin nhắn mới vào một thread cụ thể.
     *
     * <p>Nội dung có thể là text hoặc ảnh; sau khi lưu sẽ phát realtime qua STOMP.</p>
     *
     * @param threadId mã thread
     * @param request payload tin nhắn
     * @return thông tin tin nhắn vừa gửi
     */
    @PostMapping("/threads/{threadId}/messages")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ChatMessageResponse> sendMessage(
            @PathVariable String threadId,
            @RequestBody SendChatMessageRequest request
    ) {
        return ApiResponse.<ChatMessageResponse>builder()
                .result(chatService.sendMessage(threadId, request))
                .message("Send message successfully")
                .build();
    }

    /**
     * Đánh dấu thread đã đọc cho user hiện tại.
     *
     * <p>Reset unread count theo vai trò (customer/driver).</p>
     */
    @PostMapping("/threads/{threadId}/read")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ChatThreadResponse> markRead(@PathVariable String threadId) {
        return ApiResponse.<ChatThreadResponse>builder()
                .result(chatService.markThreadRead(threadId))
                .message("Marked chat as read")
                .build();
    }
}
