package com.example.demo.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    UNCATEGOEIZED_EXCEPTION(9999, "Uncategized error", HttpStatus.INTERNAL_SERVER_ERROR),
    USER_EXISTED(1001, "User already exists", HttpStatus.BAD_REQUEST),
    USER_NAME_WRONG(1002, "Username must be at least {min} characters", HttpStatus.BAD_REQUEST),
    PASSWORD_WRONG(1003, "Password must be at least {min} characters", HttpStatus.BAD_REQUEST),
    INVALID_KEY(1004, "Invalid message key", HttpStatus.BAD_REQUEST),
    USER_NOT_EXISTED(1005, "User does not exist", HttpStatus.NOT_FOUND),
    UNAUTHENTICATED(1006, "Unauthicated", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(1007, "You do not have permision", HttpStatus.FORBIDDEN),
    INVALID_DOB(1008, "Your age must be at least {min}", HttpStatus.BAD_REQUEST),
    EMAIL_EXISTED(1009,"Email is already used with another account", HttpStatus.BAD_REQUEST),
    INVALID_OR_EXPIRED_TOKEN(1010,"Your token has been expired" ,HttpStatus.BAD_REQUEST ),
    CONVERSATION_NOT_FOUND(1012,"Conversation hasn't been found" ,HttpStatus.NOT_FOUND ),
    PARTNER_NOT_FOUND(1013,"Partner has been not found" ,HttpStatus.NOT_FOUND ),
    PASSWORD_NOT_CORRECT(1017,"Password is not correct" ,HttpStatus.BAD_REQUEST ),
    DRIVER_PROFILE_NOT_FOUND(1018,"Driver profile not found. Please complete driver registration first", HttpStatus.FORBIDDEN),
    DRIVER_PROFILE_NOT_APPROVED(1019,"Driver profile is not approved. You cannot create trips yet", HttpStatus.FORBIDDEN),
    DRIVER_PROFILE_LOCKED(1020,"Driver profile is pending review and cannot be edited", HttpStatus.FORBIDDEN),
    DRIVER_PROFILE_INCOMPLETE(1021,"Driver profile is incomplete. Please provide required fields before submit", HttpStatus.BAD_REQUEST),
    TRIP_NOT_FOUND(1022, "Trip not found", HttpStatus.NOT_FOUND),
    TRIP_CANCEL_NOT_ALLOWED(1023, "Trip cannot be cancelled at current status", HttpStatus.BAD_REQUEST),
    TRIP_START_NOT_ALLOWED(1024, "Trip cannot be started at current status", HttpStatus.BAD_REQUEST),
    TRIP_COMPLETE_NOT_ALLOWED(1025, "Trip cannot be completed at current status", HttpStatus.BAD_REQUEST),
    TRIP_START_BEFORE_SCHEDULE(1026, "Chua den gio khoi hanh. Ban chi co the bat dau chuyen sau thoi gian da khai bao", HttpStatus.BAD_REQUEST),
    BOOKING_NOT_FOUND(1027, "Booking not found", HttpStatus.NOT_FOUND),
    REVIEW_ALREADY_EXISTS(1028, "Booking already reviewed", HttpStatus.BAD_REQUEST),
    REVIEW_NOT_ALLOWED(1029, "Only completed bookings can be reviewed", HttpStatus.BAD_REQUEST),
    REVIEW_INVALID_RATING(1030, "Rating must be between 1 and 5", HttpStatus.BAD_REQUEST),
    PAYMENT_NOT_FOUND(1031, "Payment not found", HttpStatus.NOT_FOUND),
    PAYMENT_CONFIRM_NOT_ALLOWED(1032, "Payment confirmation is not allowed", HttpStatus.BAD_REQUEST),
    BOOKING_LOCATION_OUT_OF_RANGE(1033, "Selected pickup/dropoff location must be within 20km of ward center", HttpStatus.BAD_REQUEST),
    CHAT_THREAD_NOT_FOUND(1034, "Chat thread not found", HttpStatus.NOT_FOUND),
    CHAT_FORBIDDEN(1035, "You are not allowed to access this chat", HttpStatus.FORBIDDEN),
    CHAT_NOT_ALLOWED(1036, "Chat is only allowed before the trip ends", HttpStatus.BAD_REQUEST),
    CHAT_MESSAGE_INVALID(1037, "Chat message is invalid", HttpStatus.BAD_REQUEST),
    VNPAY_NOT_CONFIGURED(1038, "VNPAY is not configured on backend", HttpStatus.BAD_REQUEST),
    BOOKING_REQUEST_INVALID(1039, "Booking request is invalid", HttpStatus.BAD_REQUEST),
    BOOKING_POINT_NOT_FOUND(1040, "Selected pickup/dropoff point does not belong to this trip", HttpStatus.BAD_REQUEST),
    TRIP_NO_AVAILABLE_SEATS(1041, "Trip does not have enough available seats", HttpStatus.BAD_REQUEST),
    BOOKING_CANCEL_NOT_ALLOWED(1042, "Booking cannot be cancelled at current status", HttpStatus.BAD_REQUEST),
    BOOKING_CANCEL_TOO_LATE(1043, "Booking can only be cancelled at least 1 hour before departure", HttpStatus.BAD_REQUEST),
    PAYMENT_REFUND_FAILED(1044, "VNPAY refund failed", HttpStatus.BAD_REQUEST);

    private Integer code;
    private String message;
    private HttpStatus httpStatus;

    private ErrorCode(Integer code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}