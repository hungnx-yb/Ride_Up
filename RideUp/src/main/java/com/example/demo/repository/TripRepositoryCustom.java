package com.example.demo.repository;

import com.example.demo.entity.Trip;

import java.time.LocalDate;
import java.util.List;

public interface TripRepositoryCustom {
    List<Trip> searchTrips(String fromWardId, String toWardId, LocalDate departureDate);
}
