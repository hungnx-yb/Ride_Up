package com.example.demo.service;

import com.example.demo.dto.response.AdminDriverProfileResponse;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.User;
import com.example.demo.enums.DriverStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.DriverProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminDriverProfileServiceTest {

    @Mock
    DriverProfileRepository driverProfileRepository;

    @Mock
    UserService userService;

    @Mock
    FileService fileService;

    AdminDriverProfileService adminDriverProfileService;

    User adminUser;

    @BeforeEach
    void setUp() {
        adminDriverProfileService = new AdminDriverProfileService(
                driverProfileRepository,
                userService,
                fileService
        );

        adminUser = new User();
        adminUser.setId("admin-123");
        adminUser.setFullName("Admin User");
    }

    @Test
    void approveProfile_shouldSucceed() {
        DriverProfile profile = DriverProfile.builder()
                .id("driver-123")
                .status(DriverStatus.PENDING)
                .submitted(true)
                .user(new User())
                .build();

        when(driverProfileRepository.findById("driver-123")).thenReturn(Optional.of(profile));
        when(userService.getCurrentUser()).thenReturn(adminUser);
        when(driverProfileRepository.save(any(DriverProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminDriverProfileResponse response = adminDriverProfileService.approveProfile("driver-123");

        assertNotNull(response);
        assertEquals(DriverStatus.APPROVED, response.getStatus());
        assertEquals("admin-123", response.getApprovedBy());
        assertNotNull(response.getApprovedAt());
        assertNull(response.getRejectionReason());
        verify(driverProfileRepository, times(1)).save(profile);
    }

    @Test
    void rejectProfile_shouldSucceed() {
        DriverProfile profile = DriverProfile.builder()
                .id("driver-123")
                .status(DriverStatus.PENDING)
                .submitted(true)
                .user(new User())
                .build();

        when(driverProfileRepository.findById("driver-123")).thenReturn(Optional.of(profile));
        when(driverProfileRepository.save(any(DriverProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminDriverProfileResponse response = adminDriverProfileService.rejectProfile("driver-123", "GPLX is blurred");

        assertNotNull(response);
        assertEquals(DriverStatus.REJECTED, response.getStatus());
        assertFalse(response.getSubmitted());
        assertEquals("GPLX is blurred", response.getRejectionReason());
        assertNotNull(response.getRejectedAt());
        verify(driverProfileRepository, times(1)).save(profile);
    }

    @Test
    void approveProfile_shouldThrowException_whenNotFound() {
        when(driverProfileRepository.findById("non-existent")).thenReturn(Optional.empty());

        AppException exception = assertThrows(AppException.class, () -> {
            adminDriverProfileService.approveProfile("non-existent");
        });

        assertEquals(ErrorCode.DRIVER_PROFILE_NOT_FOUND, exception.getErrorCode());
    }
}
