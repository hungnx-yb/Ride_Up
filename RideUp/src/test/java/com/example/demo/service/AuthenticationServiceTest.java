package com.example.demo.service;

import com.example.demo.dto.request.*;
import com.example.demo.dto.response.AuthenticationResponse;
import com.example.demo.dto.response.UserResponse;
import com.example.demo.entity.RefreshToken;
import com.example.demo.entity.User;
import com.example.demo.enums.Role;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.RefreshTokenRepository;
import com.example.demo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceTest {

    @Mock
    UserRepository userRepository;

    @Mock
    RefreshTokenRepository refreshTokenRepository;

    @Mock
    RedisTemplate<String, Object> redisTemplate;

    @Mock
    ValueOperations<String, Object> valueOperations;

    @Mock
    MailService mailService;

    @Mock
    UserService userService;

    ModelMapper modelMapper = new ModelMapper();

    AuthenticationService authenticationService;

    @BeforeEach
    void setUp() {
        authenticationService = new AuthenticationService(
                userRepository,
                refreshTokenRepository,
                redisTemplate,
                mailService,
                userService,
                modelMapper
        );
        ReflectionTestUtils.setField(authenticationService, "SIGNER_KEY", "1234567890123456789012345678901234567890123456789012345678901234");
        ReflectionTestUtils.setField(authenticationService, "VALID_DURATION", 3600L);
        ReflectionTestUtils.setField(authenticationService, "REFRESHABLE_DURATION", 86400L);
    }

    @Test
    void registerAccount_shouldRegisterCustomerSuccessfully() {
        AccountRegisterRequest request = AccountRegisterRequest.builder()
                .email("test@gmail.com")
                .password("12345678")
                .fullName("Test User")
                .role("CUSTOMER")
                .build();

        User user = new User();
        user.setId("user-id");
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            saved.setId("user-id");
            return saved;
        });

        UserResponse response = authenticationService.registerAccount(request);

        assertNotNull(response);
        assertEquals("user-id", response.getId());
        assertEquals("test@gmail.com", response.getEmail());
        assertEquals("Test User", response.getFullName());
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void verifyAccount_shouldSucceedWhenTokenExists() {
        String token = "valid-token";
        String userId = "user-id";
        User user = new User();
        user.setId(userId);
        user.setVerified(false);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        authenticationService.verifyAccount(token);

        assertTrue(user.getVerified());
        verify(userRepository, times(1)).save(user);
        verify(redisTemplate, times(1)).delete(anyString());
    }

    @Test
    void verifyAccount_shouldThrowExceptionWhenTokenExpired() {
        String token = "expired-token";
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        AppException exception = assertThrows(AppException.class, () -> {
            authenticationService.verifyAccount(token);
        });

        assertEquals(ErrorCode.INVALID_OR_EXPIRED_TOKEN, exception.getErrorCode());
    }

    @Test
    void authenticate_shouldSucceedWithCorrectCredentials() {
        AuthenticationRequest request = new AuthenticationRequest("test@gmail.com", "password123");
        User user = new User();
        user.setId("user-id");
        user.setEmail("test@gmail.com");
        user.setPassword(new BCryptPasswordEncoder(10).encode("password123"));
        user.setRoles(Set.of(Role.CUSTOMER));

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(user));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        AuthenticationResponse response = authenticationService.authenticate(request);

        assertNotNull(response);
        assertTrue(response.isAuthenticated());
        assertNotNull(response.getToken());
        assertNotNull(response.getRefreshToken());
        verify(refreshTokenRepository, times(1)).save(any(RefreshToken.class));
    }

    @Test
    void authenticate_shouldThrowExceptionWhenPasswordIncorrect() {
        AuthenticationRequest request = new AuthenticationRequest("test@gmail.com", "wrongpassword");
        User user = new User();
        user.setId("user-id");
        user.setEmail("test@gmail.com");
        user.setPassword(new BCryptPasswordEncoder(10).encode("password123"));

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(user));

        AppException exception = assertThrows(AppException.class, () -> {
            authenticationService.authenticate(request);
        });

        assertEquals(ErrorCode.PASSWORD_NOT_CORRECT, exception.getErrorCode());
    }

    @Test
    void logout_shouldSucceed() {
        LogoutRequest request = LogoutRequest.builder()
                .token("jwt-token")
                .refreshToken("refresh-token")
                .build();

        RefreshToken oldToken = RefreshToken.builder()
                .token("hashed-refresh-token")
                .isRevoked(false)
                .build();

        when(refreshTokenRepository.findByTokenAndIsRevokedFalseAndExpiresAtAfter(anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.of(oldToken));

        authenticationService.logout(request);

        assertTrue(oldToken.getIsRevoked());
        verify(redisTemplate, times(1)).delete(anyString());
        verify(refreshTokenRepository, times(1)).save(oldToken);
    }
}
