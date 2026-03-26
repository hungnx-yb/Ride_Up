package com.example.demo.repository;

import com.example.demo.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, String> {

    @Query("""
            SELECT b FROM Booking b
            JOIN FETCH b.trip t
            JOIN FETCH t.driver d
            JOIN FETCH d.user du
            JOIN FETCH b.pickupPoint pp
            JOIN FETCH pp.ward pw
            JOIN FETCH pw.province
            JOIN FETCH b.dropoffPoint dp
            JOIN FETCH dp.ward dw
            JOIN FETCH dw.province
            LEFT JOIN FETCH b.payment pay
            LEFT JOIN FETCH b.review r
            WHERE b.customer.id = :customerId
            ORDER BY b.createdAt DESC
            """)
    List<Booking> findByCustomerIdWithDetails(@Param("customerId") String customerId);
}
