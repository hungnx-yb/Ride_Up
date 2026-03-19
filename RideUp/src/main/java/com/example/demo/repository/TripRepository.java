package com.example.demo.repository;

import com.example.demo.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TripRepository extends JpaRepository<Trip, String> {

    List<Trip> findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(String driverId);

    Optional<Trip> findByIdAndDriverIdAndDepartureTimeIsNull(String id, String driverId);

    List<Trip> findByDriverIdAndDepartureTimeIsNotNullOrderByDepartureTimeDesc(String driverId);

    Optional<Trip> findByIdAndDriverIdAndDepartureTimeIsNotNull(String id, String driverId);

    List<Trip> findByDriverIdOrderByCreatedAtDesc(String driverId);

    long countByDriverId(String driverId);
}
