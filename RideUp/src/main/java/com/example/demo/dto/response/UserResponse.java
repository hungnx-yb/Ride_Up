package com.example.demo.dto.response;

import com.example.demo.enums.Gender;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserResponse {
    String id;
    String fullName;
    String phoneNumber;
    String email;
    LocalDate dateOfBirth;
    Gender gender;
    String avatarUrl;
    Boolean verified;
    LocalDateTime createdAt;
}
