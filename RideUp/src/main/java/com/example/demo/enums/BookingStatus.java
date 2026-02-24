package com.example.demo.enums;
public enum BookingStatus {
    // Chờ xác nhận
    PENDING,
    // Đã xác nhận
    CONFIRMED,
    // Đã hủy bởi khách
    CANCELLED_BY_CUSTOMER,
    // Đã hủy bởi tài xế
    CANCELLED_BY_DRIVER,
    // Hoàn thành
    COMPLETED,
    // Khách không đến
    NO_SHOW
}

