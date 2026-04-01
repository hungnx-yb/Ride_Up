package com.example.demo.entity;

import com.example.demo.enums.BookingStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "booking", indexes = {
    @Index(name = "idx_booking_customer_created", columnList = "customer_id, created_at"),
    @Index(name = "idx_booking_trip_status", columnList = "trip_id, status"),
    @Index(name = "idx_booking_status_created", columnList = "status, created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    // Chuyến xe (N-1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    Trip trip;

    // Khách đặt chỗ (N-1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    User customer;

    // Điểm đón đã chọn (N-1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pickup_point_id", nullable = false)
    TripPickupPoint pickupPoint;

    // Địa chỉ cụ thể đón (nếu khác địa chỉ mặc định của pickup point)
    String pickupAddress;

    // Tọa độ điểm đón (khách pin trên map)
    Double pickupLat;
    Double pickupLng;

    // Điểm trả đã chọn (N-1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dropoff_point_id", nullable = false)
    TripDropoffPoint dropoffPoint;

    // Địa chỉ cụ thể trả (nếu khác địa chỉ mặc định của dropoff point)
    String dropoffAddress;

    // Tọa độ điểm trả (khách pin trên map)
    Double dropoffLat;
    Double dropoffLng;

    // Số ghế đặt
    Integer seatCount;

    // Tổng tiền (= seatCount * trip.pricePerSeat)
    BigDecimal totalPrice;

    // Trạng thái đặt chỗ
    @Enumerated(EnumType.STRING)
    BookingStatus status;

    // Ghi chú của khách
    String customerNote;

    // Số điện thoại liên hệ (có thể khác SĐT tài khoản)
    String contactPhone;

    // Tên người đi (có thể khác tên tài khoản)
    String passengerName;

    // Thanh toán (1-1)
    @OneToOne(mappedBy = "booking", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    Payment payment;

    // Đánh giá chuyến đi (1-1)
    @OneToOne(mappedBy = "booking", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    BookingReview review;

    // Khoảng cách pickup→dropoff của khách (từ Routing API), đơn vị km
    @Column(name = "distance_km", precision = 10, scale = 2)
    BigDecimal distanceKm;

    // Thời điểm chuyển sang CONFIRMED
    @Column(name = "confirmed_at")
    LocalDateTime confirmedAt;

    // Thời điểm chuyển sang CANCELLED
    @Column(name = "cancelled_at")
    LocalDateTime cancelledAt;

    // Lý do hủy
    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    String cancellationReason;

    // Thời điểm chuyển sang COMPLETED
    @Column(name = "completed_at")
    LocalDateTime completedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    LocalDateTime updatedAt;
}
