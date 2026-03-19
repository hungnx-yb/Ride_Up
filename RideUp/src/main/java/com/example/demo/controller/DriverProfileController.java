package com.example.demo.controller;

import com.example.demo.dto.request.DriverProfileUpdateRequest;
import com.example.demo.dto.response.DriverProfileResponse;
import com.example.demo.service.DriverProfileService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/driver/profile")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverProfileController {

    DriverProfileService driverProfileService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public DriverProfileResponse getMyProfile() {
        return driverProfileService.getMyProfile();
    }

    @PutMapping
    @PreAuthorize("isAuthenticated()")
    public DriverProfileResponse updateMyProfile(@RequestBody DriverProfileUpdateRequest request) {
        return driverProfileService.updateMyProfile(request);
    }

    @PostMapping("/submit")
    @PreAuthorize("isAuthenticated()")
    public DriverProfileResponse submitMyProfile(@RequestBody(required = false) DriverProfileUpdateRequest request) {
        if (request != null) {
            driverProfileService.updateMyProfile(request);
        }
        return driverProfileService.submitMyProfile();
    }
}
