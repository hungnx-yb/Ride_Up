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

/**
 * Repository thao tác với bảng {@code trip} trong PostgreSQL.
 *
 * <p>Kế thừa {@link JpaRepository} và {@link TripRepositoryCustom}.
 * Các method đặt tên theo convention Spring Data JPA được tự động
 * sinh câu SQL tại runtime.</p>
 *
 * <p><b>Convention đặt tên quan trọng:</b>
 * <ul>
 *   <li>{@code DepartureTimeIsNull} – query lấy route template</li>
 *   <li>{@code DepartureTimeIsNotNull} – query lấy chuyến thực tế</li>
 *   <li>{@code WithBookings} – fetch eager booking để tránh N+1 query</li>
 * </ul>
 * </p>
 *
 * @author Phạm Quang Huy (B22DCCN394)
 */
@Repository
public interface TripRepository extends JpaRepository<Trip, String>, TripRepositoryCustom {

    /**
     * Lấy danh sách route template (chuyến không có lịch) của tài xế,
     * sắp xếp theo updatedAt giảm dần để template mới nhất lên đầu.
     * Dùng khi tài xế muốn tạo chuyến từ template có sẵn.
     */
    List<Trip> findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(String driverId);

    /**
     * Tìm một route template theo ID với điều kiện thuộc tài xế đang login.
     */
    Optional<Trip> findByIdAndDriverIdAndDepartureTimeIsNull(String id, String driverId);

    /**
     * Lấy danh sách tất cả chuyến có lịch (chuyến thực tế) của tài xế,
     * sắp xếp theo departureTime giảm dần (chuyến mới nhất lên trước).
     */
    List<Trip> findByDriverIdAndDepartureTimeIsNotNullOrderByDepartureTimeDesc(String driverId);

    /**
     * Tìm một chuyến thực tế theo ID với điều kiện chuyến thuộc tài xế đang login.
     * Điều kiện {@code driverId} ngăn IDOR – tài xế không thể thao tác chuyến của người khác.
     */
    Optional<Trip> findByIdAndDriverIdAndDepartureTimeIsNotNull(String id, String driverId);

    /**
     * Tìm chuyến thực tế và fetch eager booking + payment bằng JPQL với LEFT JOIN FETCH.
     *
     * <p>Dùng khi cần xử lý toàn bộ danh sách booking trong một transaction
     * (cancelTrip, confirmCashPayment). Việc fetch eager ở đây tránh
     * LazyInitializationException và N+1 query khi duyệt qua bookings.</p>
     */
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

    /**
     * Lấy danh sách trip của tài xế theo createdAt giảm dần.
     */
    List<Trip> findByDriverIdOrderByCreatedAtDesc(String driverId);

    /**
     * Đếm tổng số trip của một driver profile. Dùng trong logic fallback
     * getOrCreateDriverProfile() để chọn profile "chính" khi có nhiều profile
     * trùng userId (legacy data).
     */
    long countByDriverId(String driverId);

    /**
     * Lấy trip với PESSIMISTIC_WRITE lock để tránh race condition
     * khi nhiều request đồng thời cập nhật cùng một trip (ví dụ: 2 hành khách
     * đồng thời đặt ghế cuối cùng còn lại).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Trip t WHERE t.id = :tripId")
    Optional<Trip> findByIdForUpdate(@Param("tripId") String tripId);

    /**
     * Đếm tổng số trip được tạo trong một khoảng thời gian.
     */
    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    /**
     * Đếm tổng số trip được tạo trong khoảng thời gian theo trạng thái.
     */
    long countByCreatedAtBetweenAndStatus(LocalDateTime start, LocalDateTime end, TripStatus status);

    /**
     * Tính tổng doanh thu dự kiến từ các trip trong khoảng thời gian.
     * Công thức: SUM(pricePerSeat x (totalSeats - availableSeats)).
     * Dùng cho admin dashboard thống kê doanh thu hệ thống.
     */
    @Query("""
            SELECT COALESCE(SUM(t.pricePerSeat * (t.totalSeats - t.availableSeats)), 0)
            FROM Trip t
            WHERE t.createdAt >= :start AND t.createdAt < :end AND t.status = :status
            """)
    Long sumRevenueForPeriod(@Param("start") LocalDateTime start,
                             @Param("end") LocalDateTime end,
                             @Param("status") TripStatus status);

    /**
     * Lấy 8 trip mới nhất hệ thống, dùng cho màn hình tổng quan.
     */
    List<Trip> findTop8ByOrderByCreatedAtDesc();
}
