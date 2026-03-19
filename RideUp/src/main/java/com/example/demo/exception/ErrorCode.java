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
    DRIVER_PROFILE_INCOMPLETE(1021,"Driver profile is incomplete. Please provide required fields before submit", HttpStatus.BAD_REQUEST);

    private Integer code;
    private String message;
    private HttpStatus httpStatus;

    private ErrorCode(Integer code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}