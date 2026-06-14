package com.example.demo.service;

import com.example.demo.dto.request.DriverProfileUpdateRequest;
import com.example.demo.dto.response.DriverProfileResponse;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.User;
import com.example.demo.entity.Vehicle;
import com.example.demo.enums.DriverStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.DriverProfileRepository;
import com.example.demo.repository.TripRepository;
import com.example.demo.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DriverProfileServiceTest {

    @Mock
    UserService userService;

    @Mock
    DriverProfileRepository driverProfileRepository;

    @Mock
    VehicleRepository vehicleRepository;

    @Mock
    TripRepository tripRepository;

    DriverProfileService driverProfileService;

    User currentUser;

    @BeforeEach
    void setUp() {
        driverProfileService = new DriverProfileService(
                userService,
                driverProfileRepository,
                vehicleRepository,
                tripRepository
        );

        currentUser = new User();
        currentUser.setId("user-123");
        currentUser.setFullName("Nguyen Van A");
        currentUser.setEmail("driver@gmail.com");
    }

    @Test
    void getMyProfile_shouldReturnProfile_whenAlreadyExists() {
        DriverProfile profile = DriverProfile.builder()
                .id("driver-123")
                .user(currentUser)
                .status(DriverStatus.PENDING)
                .driverRating(4.5)
                .totalDriverRides(10)
                .submitted(false)
                .build();

        when(userService.getCurrentUser()).thenReturn(currentUser);
        when(driverProfileRepository.findAllByUserIdOrderByCreatedAtDesc(currentUser.getId()))
                .thenReturn(List.of(profile));

        DriverProfileResponse response = driverProfileService.getMyProfile();

        assertNotNull(response);
        assertEquals("driver-123", response.getDriverProfileId());
        assertEquals("Nguyen Van A", response.getFullName());
        assertEquals(DriverStatus.PENDING, response.getStatus());
        assertFalse(response.getSubmitted());
    }

    @Test
    void submitMyProfile_shouldThrowException_whenIncomplete() {
        DriverProfile profile = DriverProfile.builder()
                .id("driver-123")
                .user(currentUser)
                .status(DriverStatus.PENDING)
                .submitted(false)
                .build(); // Missing CCCD, GPLX, Vehicle

        when(userService.getCurrentUser()).thenReturn(currentUser);
        when(driverProfileRepository.findAllByUserIdOrderByCreatedAtDesc(currentUser.getId()))
                .thenReturn(List.of(profile));

        AppException exception = assertThrows(AppException.class, () -> {
            driverProfileService.submitMyProfile();
        });

        assertEquals(ErrorCode.DRIVER_PROFILE_INCOMPLETE, exception.getErrorCode());
    }

    @Test
    void submitMyProfile_shouldSucceed_whenDataIsComplete() {
        DriverProfile profile = DriverProfile.builder()
                .id("driver-123")
                .user(currentUser)
                .cccd("123456789012")
                .gplx("GPLX123456")
                .status(DriverStatus.PENDING)
                .submitted(false)
                .build();
        Vehicle vehicle = Vehicle.builder()
                .id("vehicle-123")
                .plateNumber("29A-12345")
                .vehicleBrand("Toyota")
                .vehicleModel("Vios")
                .build();
        profile.setVehicle(vehicle);

        when(userService.getCurrentUser()).thenReturn(currentUser);
        when(driverProfileRepository.findAllByUserIdOrderByCreatedAtDesc(currentUser.getId()))
                .thenReturn(List.of(profile));
        when(driverProfileRepository.save(any(DriverProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DriverProfileResponse response = driverProfileService.submitMyProfile();

        assertNotNull(response);
        assertTrue(response.getSubmitted());
        assertEquals(DriverStatus.PENDING, response.getStatus());
        verify(driverProfileRepository, times(1)).save(profile);
    }

    @Test
    void updateMyProfile_shouldThrowException_whenProfileLocked() {
        // Locked profile has submitted = true and status = PENDING
        DriverProfile profile = DriverProfile.builder()
                .id("driver-123")
                .user(currentUser)
                .status(DriverStatus.PENDING)
                .submitted(true)
                .build();

        when(userService.getCurrentUser()).thenReturn(currentUser);
        when(driverProfileRepository.findAllByUserIdOrderByCreatedAtDesc(currentUser.getId()))
                .thenReturn(List.of(profile));

        DriverProfileUpdateRequest request = new DriverProfileUpdateRequest();
        request.setFullName("New Name");

        AppException exception = assertThrows(AppException.class, () -> {
            driverProfileService.updateMyProfile(request);
        });

        assertEquals(ErrorCode.DRIVER_PROFILE_LOCKED, exception.getErrorCode());
    }

    @Test
    void updateMyProfile_shouldTransitionToPending_whenApprovedProfileIsEdited() {
        DriverProfile profile = DriverProfile.builder()
                .id("driver-123")
                .user(currentUser)
                .status(DriverStatus.APPROVED)
                .submitted(true)
                .build();

        when(userService.getCurrentUser()).thenReturn(currentUser);
        when(driverProfileRepository.findAllByUserIdOrderByCreatedAtDesc(currentUser.getId()))
                .thenReturn(List.of(profile));
        when(driverProfileRepository.save(any(DriverProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DriverProfileUpdateRequest request = new DriverProfileUpdateRequest();
        request.setFullName("Nguyen Van B");

        DriverProfileResponse response = driverProfileService.updateMyProfile(request);

        assertNotNull(response);
        assertEquals(DriverStatus.PENDING, response.getStatus()); // Changed from APPROVED to PENDING
        assertTrue(response.getSubmitted());
    }
}
