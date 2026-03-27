package com.example.demo.service;

import com.example.demo.dto.request.SupportChatRequest;
import com.example.demo.dto.response.CustomerBookingResponse;
import com.example.demo.dto.response.SupportChatResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SupportChatService {

    CustomerBookingService customerBookingService;
    AiSupportAssistant aiSupportAssistant;

    public SupportChatResponse reply(SupportChatRequest request) {
        String message = request == null ? null : request.getMessage();
        String normalized = normalize(message);

        List<CustomerBookingResponse> bookings = customerBookingService.getMyBookings();

        // Try real AI response first when configured. If unavailable, fallback to deterministic rules.
        var aiResponse = aiSupportAssistant.generateReply(message, bookings);
        if (aiResponse.isPresent()) {
            return aiResponse.get();
        }

        if (!StringUtils.hasText(normalized)) {
            return SupportChatResponse.builder()
                .intent("FAQ")
                .reply("Mình có thể hỗ trợ chi tiết các mục sau:\n"
                    + "1) Hủy chuyến và điều kiện áp dụng.\n"
                    + "2) Thanh toán tiền mặt/chuyển khoản.\n"
                    + "3) Tra cứu booking gần nhất.\n"
                    + "4) Đánh giá chuyến sau khi hoàn thành.\n"
                    + "5) Hoàn tiền và xử lý sự cố.")
                .suggestions(List.of("Kiểm tra booking gần nhất", "Tôi muốn hủy chuyến", "Tôi đã chuyển khoản nhưng chưa xác nhận"))
                .build();
        }

        if (isBookingOrPaymentLookup(normalized)) {
            return buildBookingLookupResponse(bookings);
        }

        if (containsAny(normalized, "hoan tien", "hoàn tiền", "refund", "tra lai tien")) {
            return SupportChatResponse.builder()
                .intent("FAQ_REFUND")
                .reply("Chính sách hoàn tiền tham khảo:\n"
                    + "- Booking hủy trước giờ xuất phát: có thể được hoàn theo quy định từng chuyến.\n"
                    + "- Chuyến bị hủy bởi tài xế/hệ thống: ưu tiên hoàn tiền hoặc chuyển chuyến.\n"
                    + "- Chuyển khoản lỗi/trùng: cần cung cấp mã giao dịch để CSKH đối soát.\n\n"
                    + "Để xử lý nhanh, bạn gửi: mã booking + thời gian thanh toán + 4 số cuối tài khoản (nếu có).")
                .suggestions(List.of("Kiểm tra booking gần nhất", "Gọi hotline 1900 1234", "Tôi muốn hủy chuyến"))
                .build();
        }

        if (containsAny(normalized, "huy", "hủy", "cancel")) {
            return SupportChatResponse.builder()
                    .intent("FAQ_CANCEL")
                .reply("Hướng dẫn hủy chuyến:\n"
                    + "1) Vào Chuyến của tôi.\n"
                    + "2) Chọn booking cần hủy.\n"
                    + "3) Bấm Hủy chuyến và xác nhận.\n\n"
                    + "Lưu ý:\n"
                    + "- Không thể hủy khi chuyến đã bắt đầu/đã hoàn thành.\n"
                    + "- Nếu đã thanh toán chuyển khoản, hoàn tiền sẽ theo chính sách từng trường hợp.")
                .suggestions(List.of("Kiểm tra booking gần nhất", "Chính sách hoàn tiền", "Tôi đã chuyển khoản nhưng chưa xác nhận"))
                    .build();
        }

        if (containsAny(normalized, "chuyen khoan", "chuyển khoản", "thanh toan", "thanh toán", "tien mat", "tiền mặt")) {
            return SupportChatResponse.builder()
                    .intent("FAQ_PAYMENT")
                .reply("Chi tiết phương thức thanh toán:\n"
                    + "- Tiền mặt (CASH): booking xác nhận ngay, thanh toán khi lên xe/kết thúc chuyến.\n"
                    + "- Chuyển khoản (BANK_TRANSFER): booking ở trạng thái chờ thanh toán (UNPAID).\n"
                    + "  Sau khi chuyển khoản, bạn mở chi tiết booking và bấm Tôi đã chuyển khoản để xác nhận.\n\n"
                    + "Nếu vẫn chưa cập nhật, bạn gửi mã booking và mã giao dịch để CSKH kiểm tra.")
                .suggestions(List.of("Kiểm tra booking gần nhất", "Tôi đã chuyển khoản nhưng chưa xác nhận", "Hoàn tiền như thế nào"))
                    .build();
        }

        if (containsAny(normalized, "danh gia", "đánh giá", "review", "sao")) {
            return SupportChatResponse.builder()
                    .intent("FAQ_REVIEW")
                .reply("Hướng dẫn đánh giá chuyến:\n"
                    + "1) Vào Chuyến của tôi.\n"
                    + "2) Mở booking đã COMPLETED.\n"
                    + "3) Bấm Đánh giá chuyến đi, chọn sao và nhập nhận xét.\n\n"
                    + "Lưu ý: mỗi booking chỉ đánh giá một lần.")
                .suggestions(List.of("Kiểm tra booking gần nhất", "Tôi muốn hủy chuyến", "Hỗ trợ thêm"))
                .build();
        }

        if (containsAny(normalized, "tai khoan", "tài khoản", "dang nhap", "đăng nhập", "mat khau", "mật khẩu")) {
            return SupportChatResponse.builder()
                .intent("FAQ_ACCOUNT")
                .reply("Hỗ trợ tài khoản:\n"
                    + "- Quên mật khẩu: dùng chức năng gửi OTP để đổi mật khẩu.\n"
                    + "- Không nhận OTP: kiểm tra email/sđt và thư rác.\n"
                    + "- Sai thông tin cá nhân: vào mục Tài khoản để cập nhật.\n\n"
                    + "Nếu vẫn lỗi đăng nhập, vui lòng liên hệ hotline để kiểm tra trạng thái tài khoản.")
                .suggestions(List.of("Gọi hotline 1900 1234", "Kiểm tra booking gần nhất", "Tôi muốn hủy chuyến"))
                    .build();
        }

        return SupportChatResponse.builder()
                .intent("FAQ_GENERAL")
            .reply("Mình chưa hiểu rõ yêu cầu. Bạn có thể thử một trong các câu sau:\n"
                + "- Kiểm tra booking gần nhất\n"
                + "- Tôi muốn hủy chuyến\n"
                + "- Tôi đã chuyển khoản nhưng chưa xác nhận\n"
                + "- Hoàn tiền như thế nào")
            .suggestions(List.of("Kiểm tra booking gần nhất", "Tôi muốn hủy chuyến", "Hoàn tiền như thế nào"))
                .build();
    }

    private SupportChatResponse buildBookingLookupResponse(List<CustomerBookingResponse> bookings) {

        if (bookings.isEmpty()) {
            return SupportChatResponse.builder()
                    .intent("BOOKING_LOOKUP")
                    .reply("Bạn chưa có booking nào. Hãy vào Trang chủ để tìm và đặt chuyến.")
                    .suggestions(List.of("Tìm chuyến ngay", "Hướng dẫn thanh toán"))
                    .build();
        }

        CustomerBookingResponse latest = bookings.get(0);

        String paymentMethod = "--";
        if (StringUtils.hasText(latest.getPaymentMethod())) {
            paymentMethod = "BANK_TRANSFER".equalsIgnoreCase(latest.getPaymentMethod()) ? "Chuyển khoản" : "Tiền mặt";
        }

        String paymentStatus = "--";
        if (StringUtils.hasText(latest.getPaymentStatus())) {
            paymentStatus = switch (latest.getPaymentStatus().toUpperCase(Locale.ROOT)) {
                case "PAID" -> "Đã thanh toán";
                case "UNPAID" -> "Chưa thanh toán";
                case "FAILED" -> "Thất bại";
                case "REFUNDED" -> "Đã hoàn tiền";
                default -> latest.getPaymentStatus();
            };
        }

        String statusLabel = mapTripStatusLabel(latest.getStatus());
        String nextAction = buildNextAction(latest.getStatus(), latest.getPaymentMethod(), latest.getPaymentStatus());

        String reply = String.format(
            "Booking gần nhất của bạn:\n"
                + "- Tuyến: %s - %s\n"
                + "- Trạng thái chuyến: %s\n"
                + "- Thanh toán: %s (%s)\n"
                + "- Gợi ý tiếp theo: %s",
            nvl(latest.getFrom()),
            nvl(latest.getTo()),
            statusLabel,
            paymentMethod,
            paymentStatus,
            nextAction
        );

        return SupportChatResponse.builder()
                .intent("BOOKING_LOOKUP")
                .reply(reply)
                .suggestions(List.of("Chi tiết thanh toán", "Tôi muốn hủy chuyến", "Hoàn tiền như thế nào"))
                .build();
    }

    private boolean isBookingOrPaymentLookup(String normalized) {
        return containsAny(
                normalized,
                "booking",
                "dat cho",
                "đặt chỗ",
                "trang thai",
                "trạng thái",
                "kiem tra",
                "kiểm tra",
                "thanh toan",
                "thanh toán",
                "chuyen khoan",
                "chuyển khoản"
        );
    }

    private boolean containsAny(String text, String... keywords) {
        if (!StringUtils.hasText(text) || keywords == null) return false;
        for (String k : keywords) {
            if (text.contains(k)) return true;
        }
        return false;
    }

    private String normalize(String text) {
        if (!StringUtils.hasText(text)) return "";
        return text.trim().toLowerCase(Locale.ROOT);
    }

    private String nvl(String text) {
        return StringUtils.hasText(text) ? text : "--";
    }

    private String mapTripStatusLabel(String status) {
        if (!StringUtils.hasText(status)) return "Không xác định";
        return switch (status.toLowerCase(Locale.ROOT)) {
            case "pending" -> "Chờ thanh toán";
            case "confirmed" -> "Đặt chỗ thành công";
            case "in_progress" -> "Đang di chuyển";
            case "completed" -> "Hoàn thành";
            case "cancelled" -> "Đã hủy";
            default -> status;
        };
    }

    private String buildNextAction(String bookingStatus, String paymentMethod, String paymentStatus) {
        String bStatus = bookingStatus == null ? "" : bookingStatus.toUpperCase(Locale.ROOT);
        String pMethod = paymentMethod == null ? "" : paymentMethod.toUpperCase(Locale.ROOT);
        String pStatus = paymentStatus == null ? "" : paymentStatus.toUpperCase(Locale.ROOT);

        if ("PENDING".equals(bStatus) && "BANK_TRANSFER".equals(pMethod) && "UNPAID".equals(pStatus)) {
            return "Mở Chi tiết booking và bấm 'Tôi đã chuyển khoản' để hoàn tất xác nhận.";
        }
        if ("CONFIRMED".equals(bStatus)) {
            return "Theo dõi thời gian đón và giữ liên lạc với tài xế trong tab Tin nhắn.";
        }
        if ("IN_PROGRESS".equals(bStatus)) {
            return "Chuyến đang diễn ra, bạn có thể nhắn trực tiếp với tài xế nếu cần hỗ trợ.";
        }
        if ("COMPLETED".equals(bStatus)) {
            return "Bạn có thể đánh giá chuyến để cải thiện chất lượng dịch vụ.";
        }
        if ("CANCELLED".equals(bStatus)) {
            return "Nếu đã thanh toán, bạn có thể hỏi thêm về hoàn tiền với mã booking.";
        }
        return "Bạn có thể hỏi thêm về hủy chuyến, thanh toán hoặc hoàn tiền.";
    }
}
