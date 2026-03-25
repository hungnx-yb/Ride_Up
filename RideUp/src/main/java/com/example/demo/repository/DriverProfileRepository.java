package com.example.demo.repository;

import com.example.demo.entity.DriverProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DriverProfileRepository extends JpaRepository<DriverProfile, String> {
    Optional<DriverProfile> findByUserId(String userId);

    List<DriverProfile> findAllByUserIdOrderByCreatedAtDesc(String userId);

    List<DriverProfile> findAllByOrderByCreatedAtDesc();

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    List<DriverProfile> findTop8ByOrderByCreatedAtDesc();
}
