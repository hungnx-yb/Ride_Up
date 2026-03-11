package com.example.demo.repository;

import com.example.demo.entity.Ward;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WardRepository extends JpaRepository<Ward, String> {
    List<Ward> findByProvinceId(String provinceId);
    boolean existsByOsmId(Long osmId);
}
