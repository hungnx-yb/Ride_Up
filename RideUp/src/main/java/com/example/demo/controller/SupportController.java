package com.example.demo.controller;

import com.example.demo.dto.request.SupportChatRequest;
import com.example.demo.dto.response.SupportChatResponse;
import com.example.demo.service.SupportChatService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller for handling AI customer support (Chatbot chăm sóc khách hàng).
 * 
 * Controller chịu trách nhiệm tiếp nhận và phản hồi các tin nhắn của người dùng 
 * thông qua hệ thống Chatbot AI.
 */
@RestController
@RequestMapping("/support")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SupportController {

    SupportChatService supportChatService;

    /**
     * Send a message to the AI Support Chatbot and receive a reply.
     * 
     * API Gửi tin nhắn tới Chatbot hỗ trợ khách hàng. 
     * Hệ thống sẽ dùng AI để hiểu ý định của người dùng và trả lời các câu hỏi
     * liên quan đến dịch vụ (chuyến đi, giá cả, v.v.).
     * 
     * @param request Chứa đoạn text người dùng chat và lịch sử chat (nếu có)
     * @return Câu trả lời của Chatbot (SupportChatResponse)
     */
    @PostMapping("/chat")
    @PreAuthorize("isAuthenticated()")
    public SupportChatResponse chat(@RequestBody(required = false) SupportChatRequest request) {
        return supportChatService.reply(request);
    }
}
