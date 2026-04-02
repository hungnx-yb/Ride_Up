package com.example.demo.service;
import com.example.demo.constant.StoragePrefixConstant;
import com.example.demo.dto.request.UpdateMyAvatarRequest;
import com.example.demo.dto.request.UpdateMyProfileRequest;
import com.example.demo.dto.response.UserResponse;
import com.example.demo.entity.Booking;
import com.example.demo.entity.Payment;
import com.example.demo.entity.User;
import com.example.demo.enums.BookingStatus;
import com.example.demo.enums.PaymentMethod;
import com.example.demo.enums.PaymentStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.BookingRepository;
import com.example.demo.repository.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserService {
    UserRepository userRepository;
    BookingRepository bookingRepository;
    ModelMapper modelMapper;
    FileService fileService;

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

    public UserResponse updateMyAvatar(UpdateMyAvatarRequest request) {
        User user = getCurrentUser();
        var file = request == null ? null : request.getFile();
        if (file == null || file.isEmpty()) {
            return modelMapper.map(user, UserResponse.class);
        }

        String avatarPath = fileService.upload(file, StoragePrefixConstant.AVATARS);
        user.setAvatarUrl(normalizeNullable(avatarPath));
        User saved = userRepository.save(user);
        return modelMapper.map(saved, UserResponse.class);
    }

    public Map<String, Object> getMyPaymentSummary() {
        User user = getCurrentUser();
        List<Booking> bookings = bookingRepository.findByCustomerIdWithDetails(user.getId());

        int totalTrips = bookings.size();
        int completedTrips = (int) bookings.stream()
                .filter(b -> b.getStatus() == BookingStatus.COMPLETED)
                .count();

        BigDecimal totalSpent = bookings.stream()
                .map(Booking::getTotalPrice)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        PaymentMethod defaultMethod = PaymentMethod.CASH;
        int unpaidCount = 0;
        boolean hasBankTransfer = false;
        boolean hasCash = false;

        for (Booking booking : bookings) {
            Payment payment = booking.getPayment();
            if (payment == null) {
                continue;
            }
            if (payment.getMethod() != null && defaultMethod == PaymentMethod.CASH) {
                defaultMethod = payment.getMethod();
            }
            if (payment.getMethod() == PaymentMethod.CASH) {
                hasCash = true;
            }
            if (payment.getMethod() == PaymentMethod.BANK_TRANSFER || payment.getMethod() == PaymentMethod.VNPAY) {
                hasBankTransfer = true;
            }
            if (payment.getStatus() == PaymentStatus.UNPAID) {
                unpaidCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("defaultPaymentMethod", String.valueOf(defaultMethod));
        result.put("defaultPaymentMethodLabel", mapPaymentMethod(defaultMethod));
        result.put("totalTrips", totalTrips);
        result.put("completedTrips", completedTrips);
        result.put("totalSpent", totalSpent);
        result.put("unpaidBookings", unpaidCount);
        result.put("hasBankTransferHistory", hasBankTransfer);
        result.put("hasCashHistory", hasCash);
        return result;
    }

    public Map<String, Object> getMySecuritySummary() {
        User user = getCurrentUser();

        boolean hasName = StringUtils.hasText(user.getFullName());
        boolean hasPhone = StringUtils.hasText(user.getPhoneNumber());
        boolean hasDob = user.getDateOfBirth() != null;
        boolean hasGender = user.getGender() != null;
        boolean hasAvatar = StringUtils.hasText(user.getAvatarUrl());
        boolean emailVerified = Boolean.TRUE.equals(user.getVerified());

        int completion = 0;
        completion += hasName ? 20 : 0;
        completion += hasPhone ? 20 : 0;
        completion += hasDob ? 20 : 0;
        completion += hasGender ? 20 : 0;
        completion += hasAvatar ? 20 : 0;

        List<String> recommendations = new ArrayList<>();
        if (!emailVerified) {
            recommendations.add("Xác minh email để tăng độ an toàn tài khoản.");
        }
        if (!hasPhone) {
            recommendations.add("Bổ sung số điện thoại để nhận cảnh báo đăng nhập.");
        }
        if (!hasAvatar) {
            recommendations.add("Thêm ảnh đại diện để dễ xác minh tài khoản.");
        }
        if (recommendations.isEmpty()) {
            recommendations.add("Tài khoản đang ở trạng thái tốt. Nên đổi mật khẩu định kỳ 3-6 tháng.");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("emailVerified", emailVerified);
        result.put("hasPhoneNumber", hasPhone);
        result.put("hasAvatar", hasAvatar);
        result.put("profileCompletion", completion);
        result.put("recommendations", recommendations);
        return result;
    }

    public List<Map<String, Object>> getMyOffers() {
        User user = getCurrentUser();
        int totalTrips = bookingRepository.findByCustomerIdWithDetails(user.getId()).size();

        List<Map<String, Object>> offers = new ArrayList<>();
        offers.add(buildOffer("WELCOME10", "Giảm 10% chuyến kế tiếp", "Áp dụng cho chuyến đầu tháng, tối đa 30.000đ.", true));
        offers.add(buildOffer("PAYDAY20", "Hoàn 20.000đ khi thanh toán online", "Áp dụng với VNPAY/BANK_TRANSFER cho đơn từ 120.000đ.", true));

        if (totalTrips >= 10) {
            offers.add(buildOffer("LOYALTY25", "Khách hàng thân thiết -25.000đ", "Bạn đã hoàn thành từ 10 chuyến, ưu đãi tự động kích hoạt.", true));
        } else {
            offers.add(buildOffer("LOYALTY", "Mở khóa ưu đãi thân thiết", "Hoàn thành thêm chuyến để mở khóa mã giảm cho thành viên thường xuyên.", false));
        }
        return offers;
    }

    private Map<String, Object> buildOffer(String code, String title, String description, boolean active) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("code", code);
        item.put("title", title);
        item.put("description", description);
        item.put("active", active);
        return item;
    }

    private String mapPaymentMethod(PaymentMethod method) {
        if (method == null) {
            return "Tiền mặt";
        }
        return switch (method.name().toUpperCase(Locale.ROOT)) {
            case "BANK_TRANSFER", "VNPAY" -> "Chuyển khoản";
            case "CASH" -> "Tiền mặt";
            default -> method.name();
        };
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
