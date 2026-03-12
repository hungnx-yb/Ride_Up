package com.example.demo.controller;

import com.example.demo.dto.request.*;
import com.example.demo.dto.response.ApiResponse;
import com.example.demo.dto.response.AuthenticationResponse;
import com.example.demo.dto.response.UserResponse;
import com.example.demo.service.AuthenticationService;
import com.example.demo.service.UserService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationController {

    AuthenticationService authenticationService;
    RedisTemplate<String, Object> redisTemplate;


    @PostMapping("/register")
    public ApiResponse<UserResponse> registerAccount(@RequestBody AccountRegisterRequest request) {
        return ApiResponse.<UserResponse>builder()
                .result(authenticationService.registerAccount(request))
                .message("Register account successfully")
                .build();
    }

    @GetMapping("/verification")
    public ApiResponse<String> verifyAccount(@RequestParam("token") String token) {
        authenticationService.verifyAccount(token);
        return ApiResponse.<String>builder()
                .message("Verify account successfully")
                .build();
    }

    @PostMapping("/authentication")
    public ApiResponse<AuthenticationResponse> login(@RequestBody AuthenticationRequest request){
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authenticationService.authenticate(request))
                .message("Login successfully")
                .build();
    }

    @PostMapping("/logout")
    public ApiResponse<Void > logout(@RequestBody LogoutRequest request){
        authenticationService.logout(request);
        return ApiResponse.<Void>builder()
                .message("Logout successfully")
                .build();
    }

    @PostMapping("/refresh-token")
    public ApiResponse<AuthenticationResponse> refreshToken(@RequestBody RefreshRequest refreshToken){
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authenticationService.refreshToken(refreshToken))
                .message("Refresh token successfully")
                .build();
    }

    @PostMapping("/request-otp")
    public ApiResponse<Void> requestOtp(@RequestBody SendOtpRequest request) {
        authenticationService.requestOtp(request);
        return ApiResponse.<Void>builder()
                .message("OTP has been send successfully")
                .build();
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(@RequestBody ChangePasswordRequest request) {
        authenticationService.changePassword(request);
        return ApiResponse.<Void>builder()
                .message("Change password successfully")
                .build();
    }


    @GetMapping("/set")
    public ApiResponse<String> set() {
        redisTemplate.opsForValue().set("key", "value");
        return ApiResponse.<String>builder()
                .result("OK")
                .message("Set value successfully")
                .build();
    }



}
