package com.example.demo.repository;

import com.example.demo.entity.Trip;
import com.example.demo.enums.TripStatus;

import java.time.LocalDate;
import java.util.List;

public interface TripRepositoryCustom {
    List<Trip> searchTrips(String fromWardId, String toWardId, LocalDate departureDate, TripStatus status, int page, int size);
}
