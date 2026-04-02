package com.example.demo.repository;

import com.example.demo.entity.Booking;
import com.example.demo.enums.BookingStatus;
import com.example.demo.enums.PaymentMethod;
import com.example.demo.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.time.LocalDateTime;
import java.util.Optional;

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

        @Query("""
            SELECT b.id FROM Booking b
            WHERE b.customer.id = :customerId
            ORDER BY b.createdAt DESC
            """)
        Page<String> findIdsByCustomerId(@Param("customerId") String customerId, Pageable pageable);

        @Query("""
            SELECT DISTINCT b FROM Booking b
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
            WHERE b.id IN :bookingIds
            ORDER BY b.createdAt DESC
            """)
        List<Booking> findByIdInWithDetailsOrderByCreatedAtDesc(@Param("bookingIds") List<String> bookingIds);

        @Query("""
            SELECT b FROM Booking b
            LEFT JOIN FETCH b.payment pay
            WHERE b.id = :bookingId
            """)
        Optional<Booking> findByIdWithPayment(@Param("bookingId") String bookingId);

        @Query("""
            SELECT b FROM Booking b
            LEFT JOIN FETCH b.payment pay
            WHERE pay.transactionId = :transactionId
            """)
        Optional<Booking> findByPaymentTransactionId(@Param("transactionId") String transactionId);

    @Query("""
            SELECT DISTINCT b FROM Booking b
            JOIN FETCH b.customer c
            JOIN FETCH b.trip t
            JOIN FETCH t.driver d
            JOIN FETCH d.user du
            LEFT JOIN FETCH b.pickupPoint pp
            LEFT JOIN FETCH pp.ward ppw
            LEFT JOIN FETCH ppw.province
            LEFT JOIN FETCH b.dropoffPoint dp
            LEFT JOIN FETCH dp.ward dpw
            LEFT JOIN FETCH dpw.province
            WHERE b.id IN :bookingIds
            """)
    List<Booking> findAllForChatByIdIn(@Param("bookingIds") List<String> bookingIds);

        @Query("""
            SELECT DISTINCT b FROM Booking b
            JOIN FETCH b.customer c
            JOIN FETCH b.trip t
            LEFT JOIN FETCH b.payment p
            WHERE b.status = :bookingStatus
              AND p.method = :paymentMethod
              AND p.status = :paymentStatus
              AND b.createdAt <= :createdBefore
            """)
        List<Booking> findExpiredUnpaidVnpayBookings(
            @Param("bookingStatus") BookingStatus bookingStatus,
            @Param("paymentMethod") PaymentMethod paymentMethod,
            @Param("paymentStatus") PaymentStatus paymentStatus,
            @Param("createdBefore") LocalDateTime createdBefore
        );
}
