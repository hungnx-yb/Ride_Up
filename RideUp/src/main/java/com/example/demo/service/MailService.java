package com.example.demo.service;

import jakarta.mail.internet.MimeMessage;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MailService {
    JavaMailSender mailSender;
    public void sendVerificationEmail(String to, String token, String username) throws Exception {
        String subject = "Xác minh tài khoản của "+ username+" trên RideUp";
        String verificationUrl = "http://localhost:8080/rideUp/auth/verification?token=" + token + "&username=" + username;
        String content = "<b>Chúc mừng bạn đã đăng kí tài khoản thành công trên ứng dụng RideUp!</b><br><br>"
                + "Nhấn vào <a href=\"" + verificationUrl + "\">đây</a> để xác minh tài khoản.";

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(content, true); //
        mailSender.send(message);
    }

    public void sendOtpChangePasswordEmail(String email, String otp, String username) {
        String subject = "Mã OTP thay đổi mật khẩu cho tài khoản " + username;
        String content = "<b>Đây là mã OTP để thay đổi mật khẩu cho tài khoản " + username + " trên ứng dụng RideUp:</b><br><br>"
                + "<h2>" + otp + "</h2><br>"
                + "Mã OTP có hiệu lực trong 5 phút.";
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(content, true); //
            mailSender.send(message);
        } catch (Exception e) {
            log.error("Failed to send OTP change password email to {}: {}", email, e.getMessage());
        }
    }
}

