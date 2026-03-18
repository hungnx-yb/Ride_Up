package com.example.demo.controller;

import com.example.demo.dto.request.DriverTripRequest;
import com.example.demo.dto.response.DriverTripResponse;
import com.example.demo.service.DriverTripService;
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

    @PutMapping("/trips/{tripId}/cancel")
    @PreAuthorize("isAuthenticated()")
    public DriverTripResponse cancelTrip(@PathVariable String tripId) {
        return driverTripService.cancelTrip(tripId);
    }

    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> getDriverStats() {
        return driverTripService.getDriverStats();
    }
}
