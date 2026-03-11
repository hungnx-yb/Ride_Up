package com.example.demo.repository;

import com.example.demo.entity.GpsTracking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GpsTrackingRepository extends JpaRepository<GpsTracking, String> {
    List<GpsTracking> findByTripIdOrderByRecordedAtAsc(String tripId);
}
