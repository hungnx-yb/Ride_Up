package com.example.demo.service;
import com.example.demo.dto.request.UpdateMyProfileRequest;
import com.example.demo.dto.response.UserResponse;
import com.example.demo.entity.User;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserService {
    UserRepository userRepository;
    ModelMapper modelMapper;

    public User getCurrentUser() {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }

    public UserResponse getMyInfo() {
        return modelMapper.map(getCurrentUser(), UserResponse.class);
    }

    public UserResponse updateMyInfo(UpdateMyProfileRequest request) {
        User user = getCurrentUser();
        if (request == null) {
            return modelMapper.map(user, UserResponse.class);
        }

        if (request.getFullName() != null) {
            user.setFullName(normalize(request.getFullName()));
        }
        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(normalize(request.getPhoneNumber()));
        }
        if (request.getDateOfBirth() != null) {
            user.setDateOfBirth(request.getDateOfBirth());
        }
        if (request.getGender() != null) {
            user.setGender(request.getGender());
        }
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(normalizeNullable(request.getAvatarUrl()));
        }

        User saved = userRepository.save(user);
        return modelMapper.map(saved, UserResponse.class);
    }

    private String normalize(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.trim();
    }

    private String normalizeNullable(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
