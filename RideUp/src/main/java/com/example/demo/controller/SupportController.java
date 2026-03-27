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

@RestController
@RequestMapping("/support")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SupportController {

    SupportChatService supportChatService;

    @PostMapping("/chat")
    @PreAuthorize("isAuthenticated()")
    public SupportChatResponse chat(@RequestBody(required = false) SupportChatRequest request) {
        return supportChatService.reply(request);
    }
}
