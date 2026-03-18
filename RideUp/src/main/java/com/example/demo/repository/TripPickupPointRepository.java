package com.example.demo.repository;

import com.example.demo.entity.TripPickupPoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TripPickupPointRepository extends JpaRepository<TripPickupPoint, String> {
    void deleteByTripId(String tripId);
}
