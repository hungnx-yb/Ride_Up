package com.example.demo.controller;

import com.example.demo.dto.request.DriverProfileRejectRequest;
import com.example.demo.dto.response.AdminDriverProfileResponse;
import com.example.demo.dto.response.ApiResponse;
import com.example.demo.service.AdminDriverProfileService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/driver-profiles")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminDriverProfileController {

    AdminDriverProfileService adminDriverProfileService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<List<AdminDriverProfileResponse>> getAllDriverProfiles() {
        List<AdminDriverProfileResponse> data = adminDriverProfileService.getAllProfiles();
        return ApiResponse.<List<AdminDriverProfileResponse>>builder()
                .result(data)
                .count(data.size())
                .build();
    }

    @PutMapping("/{profileId}/approve")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<AdminDriverProfileResponse> approveProfile(@PathVariable String profileId) {
        return ApiResponse.<AdminDriverProfileResponse>builder()
                .result(adminDriverProfileService.approveProfile(profileId))
                .message("Approved")
                .build();
    }

    @PutMapping("/{profileId}/reject")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<AdminDriverProfileResponse> rejectProfile(
            @PathVariable String profileId,
            @RequestBody(required = false) DriverProfileRejectRequest request) {

        return ApiResponse.<AdminDriverProfileResponse>builder()
                .result(adminDriverProfileService.rejectProfile(profileId, request != null ? request.getRejectionReason() : null))
                .message("Rejected")
                .build();
    }
}
