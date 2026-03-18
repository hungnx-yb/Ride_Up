package com.example.demo.controller;

import com.example.demo.dto.request.DriverRouteRequest;
import com.example.demo.dto.response.DriverRouteResponse;
import com.example.demo.service.DriverRouteService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/driver/routes")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverRouteController {

    DriverRouteService driverRouteService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<DriverRouteResponse> getMyRoutes() {
        return driverRouteService.getMyRoutes();
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public DriverRouteResponse createRoute(@RequestBody DriverRouteRequest request) {
        return driverRouteService.createRoute(request);
    }

    @PutMapping("/{routeId}")
    @PreAuthorize("isAuthenticated()")
    public DriverRouteResponse updateRoute(@PathVariable String routeId, @RequestBody DriverRouteRequest request) {
        return driverRouteService.updateRoute(routeId, request);
    }

    @DeleteMapping("/{routeId}")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> deleteRoute(@PathVariable String routeId) {
        return driverRouteService.deleteRoute(routeId);
    }
}
