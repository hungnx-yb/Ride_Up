package com.example.demo.entity;

import com.example.demo.enums.DriverStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity lưu trữ hồ sơ xác minh của tài xế.
 *
 * <p>Mỗi User chỉ có tối đa một DriverProfile (quan hệ 1-1).
 * Hồ sơ chứa thông tin pháp lý (CCCD, GPLX) và trạng thái duyệt.
 * Tài xế chỉ được tạo chuyến khi {@code status = APPROVED}.</p>
 *
 * <p><b>Cơ chế submitted:</b> {@code submitted = true} đánh dấu tài xế đã
 * chủ động nộp hồ sơ. Kết hợp với {@code status = PENDING} sẽ khóa hồ sơ
 * không cho chỉnh sửa đến khi Admin ra quyết định.</p>
 *
 * @author Phạm Quang Huy (B22DCCN394)
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DriverProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;
    String cccd;
    String cccdImageFront;
    String cccdImageBack;
    String gplx;
    LocalDate gplxExpiryDate;
    String gplxImage;
    /** Điểm đánh giá trung bình từ hành khách, thang 0.0 - 5.0. */
    Double driverRating;
    /** Tổng số chuyến đã hoàn thành, tăng mỗi khi có Trip chuyển sang COMPLETED. */
    Integer totalDriverRides;
    /** Trạng thái hồ sơ: PENDING (mới/đang duyệt), APPROVED, REJECTED. */
    @Enumerated(EnumType.STRING)
    DriverStatus status;
    LocalDateTime approvedAt;
    String approvedBy;
    LocalDateTime rejectedAt;
    String rejectionReason;
    /**
     * True khi tài xế đã bấm "Nộp hồ sơ". Kết hợp với status=PENDING
     * để xác định hồ sơ đang bị khóa chỉnh sửa.
     */
    @Builder.Default
    Boolean submitted = false;
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    // User liên kết (1-1)
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    User user;

    // Xe của tài xế (1-1)
    @OneToOne(mappedBy = "driver", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    Vehicle vehicle;

    // Danh sách chuyến xe của tài xế (1-N)
    @OneToMany(mappedBy = "driver", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    List<Trip> trips = new ArrayList<>();
}
