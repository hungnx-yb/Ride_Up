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

@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ChatController {

    ChatService chatService;

    @PostMapping("/threads/open")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ChatThreadResponse> openThread(@RequestBody OpenChatThreadRequest request) {
        return ApiResponse.<ChatThreadResponse>builder()
                                .result(chatService.openThreadByBooking(request != null ? request.getBookingId() : null))
                .message("Open chat thread successfully")
                .build();
    }

    @GetMapping("/threads")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<ChatThreadResponse>> getMyThreads() {
        List<ChatThreadResponse> data = chatService.getMyThreads();
        return ApiResponse.<List<ChatThreadResponse>>builder()
                .result(data)
                .count(data.size())
                .build();
    }

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

    @PostMapping("/threads/{threadId}/read")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ChatThreadResponse> markRead(@PathVariable String threadId) {
        return ApiResponse.<ChatThreadResponse>builder()
                .result(chatService.markThreadRead(threadId))
                .message("Marked chat as read")
                .build();
    }
}
