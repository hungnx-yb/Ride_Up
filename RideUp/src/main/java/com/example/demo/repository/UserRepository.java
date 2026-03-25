package com.example.demo.repository;

import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String > {
    Optional<User> findByEmailAndVerifiedIsTrue(String email);
    Optional<User> findByEmail(String email);
    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    List<User> findAllByOrderByCreatedAtDesc();
}
