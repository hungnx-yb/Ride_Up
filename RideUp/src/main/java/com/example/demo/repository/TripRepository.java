package com.example.demo.repository;

import com.example.demo.entity.Trip;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TripRepository extends JpaRepository<Trip, String>, TripRepositoryCustom {

    List<Trip> findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(String driverId);

    Optional<Trip> findByIdAndDriverIdAndDepartureTimeIsNull(String id, String driverId);

    List<Trip> findByDriverIdAndDepartureTimeIsNotNullOrderByDepartureTimeDesc(String driverId);

    Optional<Trip> findByIdAndDriverIdAndDepartureTimeIsNotNull(String id, String driverId);

    List<Trip> findByDriverIdOrderByCreatedAtDesc(String driverId);

    long countByDriverId(String driverId);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT t FROM Trip t WHERE t.id = :tripId")
        Optional<Trip> findByIdForUpdate(@Param("tripId") String tripId);
}
