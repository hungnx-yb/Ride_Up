package com.example.demo.constant;

import java.time.Duration;

public class RedisKeyTTL {
    public static final Duration TOKEN_TTL = Duration.ofMinutes(30);        // AccessToken sống 30 phút
    public static final Duration OTP_CHANGE_PASSWORD_TTL = Duration.ofMinutes(5);  // OTP sống 5 phút
    public static final Duration ACTIVE_ACCOUNT_TTL = Duration.ofHours(24); // Link kích hoạt sống 24 giờ
    public static final Duration USER_INFO_TTL = Duration.ofHours(1);       // Cache thông tin user 1 giờ

    private RedisKeyTTL() {
    }
}
