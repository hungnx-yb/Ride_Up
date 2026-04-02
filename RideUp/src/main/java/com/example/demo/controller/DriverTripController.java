package com.example.demo.controller;

import com.example.demo.dto.request.DriverTripRequest;
import com.example.demo.dto.request.TripCancellationRequest;
import com.example.demo.dto.response.DriverTripDetailResponse;
import com.example.demo.dto.response.DriverTripResponse;
import com.example.demo.service.DriverTripService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/driver")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverTripController {

    DriverTripService driverTripService;

    @GetMapping("/trips")
    @PreAuthorize("isAuthenticated()")
    public List<DriverTripResponse> getDriverTrips() {
        return driverTripService.getMyTrips();
    }

    @PostMapping("/trips")
    @PreAuthorize("isAuthenticated()")
    public DriverTripResponse createTrip(@RequestBody DriverTripRequest request) {
        return driverTripService.createTrip(request);
    }

    @GetMapping("/trips/{tripId}")
    @PreAuthorize("isAuthenticated()")
    public DriverTripDetailResponse getTripDetail(@PathVariable String tripId) {
        return driverTripService.getTripDetail(tripId);
    }

    @PutMapping("/trips/{tripId}/cancel")
    @PreAuthorize("isAuthenticated()")
    public DriverTripResponse cancelTrip(
            @PathVariable String tripId,
            @RequestBody(required = false) TripCancellationRequest request,
            HttpServletRequest httpServletRequest
    ) {
        return driverTripService.cancelTrip(tripId, request, getClientIp(httpServletRequest));
    }

    @PutMapping("/trips/{tripId}/start")
    @PreAuthorize("isAuthenticated()")
    public DriverTripResponse startTrip(@PathVariable String tripId) {
        return driverTripService.startTrip(tripId);
    }

    @PutMapping("/trips/{tripId}/complete")
    @PreAuthorize("isAuthenticated()")
    public DriverTripResponse completeTrip(@PathVariable String tripId) {
        return driverTripService.completeTrip(tripId);
    }

    @PutMapping("/trips/{tripId}/bookings/{bookingId}/confirm-cash-payment")
    @PreAuthorize("isAuthenticated()")
    public DriverTripDetailResponse.BookingInfo confirmCashPayment(
            @PathVariable String tripId,
            @PathVariable String bookingId
    ) {
        return driverTripService.confirmCashPayment(tripId, bookingId);
    }

    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> getDriverStats() {
        return driverTripService.getDriverStats();
    }

    private String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int commaIdx = forwarded.indexOf(',');
            return (commaIdx > 0 ? forwarded.substring(0, commaIdx) : forwarded).trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr == null || remoteAddr.isBlank()) ? "127.0.0.1" : remoteAddr.trim();
    }
}
