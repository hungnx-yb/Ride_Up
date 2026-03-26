package com.example.demo.repository;

import com.example.demo.entity.BookingReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BookingReviewRepository extends JpaRepository<BookingReview, String> {

    boolean existsByBookingId(String bookingId);

    Optional<BookingReview> findByBookingId(String bookingId);

    @Query("SELECT COALESCE(AVG(br.rating), 0) FROM BookingReview br WHERE br.driver.id = :driverId")
    Double averageRatingByDriverId(@Param("driverId") String driverId);
}
