package com.example.demo.controller;

import com.example.demo.dto.request.CreateBookingRequest;
import com.example.demo.dto.request.CreateBookingReviewRequest;
import com.example.demo.dto.request.ConfirmPaymentRequest;
import com.example.demo.dto.response.BookingReviewResponse;
import com.example.demo.dto.response.CustomerBookingResponse;
import com.example.demo.dto.response.RideSearchResponse;
import com.example.demo.service.CustomerBookingService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CustomerBookingController {

    CustomerBookingService customerBookingService;

    @GetMapping("/rides/search")
    @PreAuthorize("isAuthenticated()")
    public List<RideSearchResponse> searchRides(@RequestParam(required = false) String fromProvinceId,
                                                @RequestParam(required = false) String toProvinceId,
                                                @RequestParam(required = false) String fromWardId,
                                                @RequestParam(required = false) String toWardId,
                                                @RequestParam(required = false) String departureDate) {
        return customerBookingService.searchRides(fromProvinceId, toProvinceId, fromWardId, toWardId, departureDate);
    }

    @GetMapping("/customer/bookings")
    @PreAuthorize("isAuthenticated()")
    public List<CustomerBookingResponse> getMyBookings() {
        return customerBookingService.getMyBookings();
    }

    @PostMapping("/customer/bookings")
    @PreAuthorize("isAuthenticated()")
    public CustomerBookingResponse createBooking(@RequestBody CreateBookingRequest request) {
        return customerBookingService.createBooking(request);
    }

    @PostMapping("/customer/bookings/{bookingId}/payment/confirm")
    @PreAuthorize("isAuthenticated()")
    public CustomerBookingResponse confirmBookingPayment(@PathVariable String bookingId,
                                                         @RequestBody(required = false) ConfirmPaymentRequest request) {
        return customerBookingService.confirmBookingPayment(bookingId, request);
    }

    @PostMapping("/customer/bookings/{bookingId}/rate")
    @PreAuthorize("isAuthenticated()")
    public BookingReviewResponse createBookingReview(@PathVariable String bookingId,
                                                     @RequestBody CreateBookingReviewRequest request) {
        return customerBookingService.createBookingReview(bookingId, request);
    }
}
