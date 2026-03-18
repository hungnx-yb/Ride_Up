package com.example.demo.repository;

import com.example.demo.entity.Ward;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WardRepository extends JpaRepository<Ward, String> {

    /** Lấy tất cả ward theo tỉnh – JOIN FETCH tránh N+1 */
    @Query("SELECT w FROM Ward w JOIN FETCH w.province WHERE w.province.id = :provinceId ORDER BY w.name")
    List<Ward> findByProvinceId(@Param("provinceId") String provinceId);

    boolean existsByOsmId(Long osmId);

    /** Tìm kiếm theo tỉnh + tên – JOIN FETCH tránh N+1 */
    @Query("SELECT w FROM Ward w JOIN FETCH w.province " +
           "WHERE w.province.id = :provinceId AND LOWER(w.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "ORDER BY w.name")
    List<Ward> searchByProvinceIdAndName(@Param("provinceId") String provinceId, @Param("q") String q);

    /** Tìm kiếm toàn bộ ward theo tên – JOIN FETCH tránh N+1 */
    @Query("SELECT w FROM Ward w JOIN FETCH w.province WHERE LOWER(w.name) LIKE LOWER(CONCAT('%', :q, '%')) ORDER BY w.name")
    List<Ward> searchByName(@Param("q") String q);

    @Query("SELECT w FROM Ward w JOIN FETCH w.province WHERE w.province.id = :provinceId AND LOWER(w.name) = LOWER(:wardName)")
    Optional<Ward> findByProvinceIdAndWardName(@Param("provinceId") String provinceId, @Param("wardName") String wardName);
}
