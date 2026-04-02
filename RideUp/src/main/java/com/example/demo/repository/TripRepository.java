package com.example.demo.repository;

import com.example.demo.entity.Trip;
import com.example.demo.enums.TripStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TripRepository extends JpaRepository<Trip, String>, TripRepositoryCustom {

    List<Trip> findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(String driverId);

    Optional<Trip> findByIdAndDriverIdAndDepartureTimeIsNull(String id, String driverId);

    List<Trip> findByDriverIdAndDepartureTimeIsNotNullOrderByDepartureTimeDesc(String driverId);

    Optional<Trip> findByIdAndDriverIdAndDepartureTimeIsNotNull(String id, String driverId);

        @Query("""
                        SELECT DISTINCT t FROM Trip t
                        LEFT JOIN FETCH t.bookings b
                        LEFT JOIN FETCH b.payment p
                        WHERE t.id = :tripId
                            AND t.driver.id = :driverId
                            AND t.departureTime IS NOT NULL
                        """)
        Optional<Trip> findByIdAndDriverIdAndDepartureTimeIsNotNullWithBookings(@Param("tripId") String tripId,
                                                                                                                                                         @Param("driverId") String driverId);

    List<Trip> findByDriverIdOrderByCreatedAtDesc(String driverId);

    long countByDriverId(String driverId);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT t FROM Trip t WHERE t.id = :tripId")
        Optional<Trip> findByIdForUpdate(@Param("tripId") String tripId);

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    long countByCreatedAtBetweenAndStatus(LocalDateTime start, LocalDateTime end, TripStatus status);

    @Query("""
            SELECT COALESCE(SUM(t.pricePerSeat * (t.totalSeats - t.availableSeats)), 0)
            FROM Trip t
            WHERE t.createdAt >= :start AND t.createdAt < :end AND t.status = :status
            """)
    Long sumRevenueForPeriod(@Param("start") LocalDateTime start,
                             @Param("end") LocalDateTime end,
                             @Param("status") TripStatus status);

    List<Trip> findTop8ByOrderByCreatedAtDesc();
}
