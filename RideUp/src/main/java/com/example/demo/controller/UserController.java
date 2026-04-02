package com.example.demo.controller;

import com.example.demo.dto.request.UpdateMyProfileRequest;
import com.example.demo.dto.request.UpdateMyAvatarRequest;
import com.example.demo.dto.response.ApiResponse;
import com.example.demo.dto.response.UserResponse;
import com.example.demo.service.UserService;
import org.springframework.http.MediaType;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserController {

    UserService userService;

    /** Lấy thông tin của user đang đăng nhập (yêu cầu Bearer token) */
    @GetMapping("/me")
    public ApiResponse<UserResponse> getMyInfo() {
        return ApiResponse.<UserResponse>builder()
                .result(userService.getMyInfo())
                .build();
    }

    @PutMapping("/me")
    public ApiResponse<UserResponse> updateMyInfo(@RequestBody UpdateMyProfileRequest request) {
        return ApiResponse.<UserResponse>builder()
                .result(userService.updateMyInfo(request))
                .message("Update profile successfully")
                .build();
    }

    @PutMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<UserResponse> updateMyAvatar(@ModelAttribute UpdateMyAvatarRequest request) {
        return ApiResponse.<UserResponse>builder()
                .result(userService.updateMyAvatar(request))
                .message("Update avatar successfully")
                .build();
    }

    @GetMapping("/me/quick/payment-summary")
    public ApiResponse<Map<String, Object>> getMyPaymentSummary() {
        return ApiResponse.<Map<String, Object>>builder()
                .result(userService.getMyPaymentSummary())
                .build();
    }

    @GetMapping("/me/quick/security-summary")
    public ApiResponse<Map<String, Object>> getMySecuritySummary() {
        return ApiResponse.<Map<String, Object>>builder()
                .result(userService.getMySecuritySummary())
                .build();
    }

    @GetMapping("/me/quick/offers")
    public ApiResponse<List<Map<String, Object>>> getMyOffers() {
        return ApiResponse.<List<Map<String, Object>>>builder()
                .result(userService.getMyOffers())
                .build();
    }
}
