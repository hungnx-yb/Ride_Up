package com.example.demo.dto.request;

import com.example.demo.enums.Gender;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UpdateMyProfileRequest {
    String fullName;
    String phoneNumber;
    LocalDate dateOfBirth;
    Gender gender;
    String avatarUrl;
}
