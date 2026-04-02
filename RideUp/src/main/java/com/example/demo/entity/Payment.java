package com.example.demo.entity;

import com.example.demo.enums.PaymentMethod;
import com.example.demo.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment", indexes = {
    @Index(name = "idx_payment_transaction_id", columnList = "transaction_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    // Booking liên quan (1-1)
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    Booking booking;

    // Số tiền thanh toán
    BigDecimal amount;

    // Phương thức thanh toán
    @Enumerated(EnumType.STRING)
    PaymentMethod method;

    // Trạng thái thanh toán
    @Enumerated(EnumType.STRING)
    PaymentStatus status;

    // Mã giao dịch (từ cổng thanh toán)
    String transactionId;

    // Mã giao dịch thực tế do VNPAY gateway trả về sau khi thanh toán thành công.
    String providerTransactionId;

    // Thời gian thanh toán thành công
    LocalDateTime paidAt;

    // Thời gian hoàn tiền thành công
    LocalDateTime refundedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;
}
