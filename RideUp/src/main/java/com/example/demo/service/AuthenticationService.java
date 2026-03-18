package com.example.demo.service;

import com.example.demo.constant.RedisKeyTTL;
import com.example.demo.constant.RedisPrefixKeyConstant;
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
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationService {
    UserRepository userRepository;
    RefreshTokenRepository refreshTokenRepository;
    RedisTemplate<String, Object> redisTemplate;
    MailService mailService;
    UserService userService;
    private final ModelMapper modelMapper;

    @NonFinal
    @Value("${jwt.signerKey}")
    protected String SIGNER_KEY;

    @NonFinal
    @Value("${jwt.valid-duration}")
    protected long VALID_DURATION;


    @NonFinal
    @Value("${jwt.refreshable-duration}")
    protected Long REFRESHABLE_DURATION;

    public UserResponse registerAccount(AccountRegisterRequest request) {
        PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);

        User user = modelMapper.map(request, User.class);
        user.setPassword(passwordEncoder.encode(request.getPassword()));

        Role role = "DRIVER".equalsIgnoreCase(request.getRole()) ? Role.DRIVER : Role.CUSTOMER;
        user.setRoles(new HashSet<>(Collections.singletonList(role)));

        // =====================================================================
        // TODO: Bật lại xác minh email khi cần (comment block bên dưới lại)
        // =====================================================================
        user.setVerified(true);

        // =====================================================================
        // [EMAIL VERIFY - TẮT TẠM] Uncomment block này khi muốn bật lại:
        // =====================================================================
//        user.setVerified(false);
//        userRepository.save(user);
//        String verifyToken = UUID.randomUUID().toString();
//        redisTemplate.opsForValue().set(
//                RedisPrefixKeyConstant.ACTIVE_ACCOUNT + verifyToken,
//                user.getId(),
//                RedisKeyTTL.ACTIVE_ACCOUNT_TTL
//        );
//        mailService.sendVerificationEmail(user.getEmail(), verifyToken, user.getFullName());
//        return modelMapper.map(user, UserResponse.class);
        // =====================================================================

        userRepository.save(user);

        return modelMapper.map(user, UserResponse.class);
    }

    public void verifyAccount(String token) {
        String redisKey = RedisPrefixKeyConstant.ACTIVE_ACCOUNT + token;
        String userId = (String)redisTemplate.opsForValue().get(redisKey);
        if (userId == null) {
            throw new AppException(ErrorCode.INVALID_OR_EXPIRED_TOKEN);
        }
        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        user.setVerified(true);
        userRepository.save(user);
        redisTemplate.delete(redisKey);
    }


    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);
        // Dùng findByEmail để không bị chặn khi verified=NULL (đăng ký cũ)
        User user = userRepository.findByEmail(request.getEmail()).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        boolean authenticated = passwordEncoder.matches(request.getPassword(), user.getPassword());
        if (!authenticated) throw new AppException(ErrorCode.PASSWORD_NOT_CORRECT);

        var token = generateToken(user);
        redisTemplate.opsForValue().set(
                RedisPrefixKeyConstant.TOKEN + token,
                user.getId(),
                RedisKeyTTL.TOKEN_TTL
        );

        String rawRefreshToken = UUID.randomUUID().toString();
        String hashedToken = hashToken(rawRefreshToken);
        RefreshToken refreshTokenEntity = RefreshToken.builder()
                .token(hashedToken)
                .user(user)
                .expiresAt(
                        LocalDateTime.now()
                                .plusSeconds(REFRESHABLE_DURATION)
                )
                .isRevoked(false)
                .build();
        refreshTokenRepository.save(refreshTokenEntity);

        return AuthenticationResponse.builder()
                .token(token)
                .refreshToken(rawRefreshToken)
                .authenticated(true)
                .user(modelMapper.map(user, UserResponse.class))
                .build();
    }


    private String generateToken(User user) {
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
                .subject(user.getId())
                .issuer("rideUp.com")
                .issueTime(new Date())
                .expirationTime(new Date(
                        Instant.now().plus(VALID_DURATION, ChronoUnit.SECONDS).toEpochMilli()))
                .jwtID(UUID.randomUUID().toString())
                .claim("scope", buildScope(user))
                .build();

        Payload payload = new Payload(jwtClaimsSet.toJSONObject());

        JWSObject jwsObject = new JWSObject(header, payload);

        try {
            jwsObject.sign(new MACSigner(SIGNER_KEY.getBytes()));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Cannot create token", e);
            throw new RuntimeException(e);
        }
    }

    private String buildScope(User user) {
        StringJoiner stringJoiner = new StringJoiner(",");

        if (!CollectionUtils.isEmpty(user.getRoles())) {
            user.getRoles().forEach(role -> {
                stringJoiner.add("ROLE_" + role.name());
            });
        }

        return stringJoiner.toString();
    }

    @Transactional
    public void logout(LogoutRequest request) {

        redisTemplate.delete(RedisPrefixKeyConstant.TOKEN + request.getToken());

        String hashed = hashToken(request.getRefreshToken());

        refreshTokenRepository
                .findByTokenAndIsRevokedFalseAndExpiresAtAfter(
                        hashed,
                        LocalDateTime.now()
                )
                .ifPresent(token -> {
                    token.setIsRevoked(true);
                    refreshTokenRepository.save(token);
                });
    }

    @Transactional
    public AuthenticationResponse refreshToken(RefreshRequest request) {

        String hashedToken = hashToken(request.getRefreshToken());

        RefreshToken oldToken =
                refreshTokenRepository
                        .findByTokenAndIsRevokedFalseAndExpiresAtAfter(
                                hashedToken,
                                LocalDateTime.now()
                        )
                        .orElseThrow(() ->
                                new AppException(ErrorCode.INVALID_OR_EXPIRED_TOKEN));

        User user = oldToken.getUser();

        oldToken.setIsRevoked(true);
        refreshTokenRepository.save(oldToken);

        String newRawToken = UUID.randomUUID().toString();

        RefreshToken newToken = RefreshToken.builder()
                .token(hashToken(newRawToken))
                .user(user)
                .expiresAt(LocalDateTime.now().plusSeconds(REFRESHABLE_DURATION))
                .isRevoked(false)
                .build();

        refreshTokenRepository.save(newToken);

        String newAccessToken = generateToken(user);

        redisTemplate.opsForValue().set(
                RedisPrefixKeyConstant.TOKEN + newAccessToken,
                user.getId(),
                RedisKeyTTL.TOKEN_TTL
        );

        return AuthenticationResponse.builder()
                .token(newAccessToken)
                .refreshToken(newRawToken)
                .authenticated(true)
                .user(modelMapper.map(user, UserResponse.class))
                .build();
    }

    public void requestOtp(SendOtpRequest request) {
        User user = userService.getCurrentUser();
        PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);
        boolean authenticated = passwordEncoder.matches(request.getPassword(), user.getPassword());
        if (!authenticated) throw new AppException(ErrorCode.PASSWORD_NOT_CORRECT);
        String otp = String.valueOf(100000 + new Random().nextInt(900000));
        redisTemplate.opsForValue().set(
                RedisPrefixKeyConstant.OTP_CHANGE_PASSWORD + user.getId(),
                otp,
                RedisKeyTTL.OTP_CHANGE_PASSWORD_TTL
        );
        mailService.sendOtpChangePasswordEmail(user.getEmail(), otp, user.getFullName());
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        User user = userService.getCurrentUser();
        String cachedOtp = (String) redisTemplate.opsForValue().get(RedisPrefixKeyConstant.OTP_CHANGE_PASSWORD + user.getId());
        if (cachedOtp == null || !cachedOtp.equals(request.getOtp())) {
            throw new AppException(ErrorCode.INVALID_OR_EXPIRED_TOKEN);
        }
        PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        redisTemplate.delete(RedisPrefixKeyConstant.OTP_CHANGE_PASSWORD + user.getId());
        refreshTokenRepository.revokeAllByUser(user);
    }

    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void cleanupExpiredTokens() {
        refreshTokenRepository.deleteExpiredTokens(LocalDateTime.now());
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Cannot hash token", e);
        }
    }
}

