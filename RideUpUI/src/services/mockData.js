// ============================================================
// MOCK DATA CHO RIDEUP - dùng tạm khi chưa có backend API
// ============================================================

import { ROLES } from '../config/config';

// ----------------------------------------
// TÀI KHOẢN TEST
// ----------------------------------------
export const MOCK_ACCOUNTS = [
  {
    id: 1,
    fullName: 'Nguyễn Quản Trị',
    phone: '0900000001',
    email: 'admin@rideup.vn',
    password: '123456',
    role: ROLES.ADMIN,
    avatar: null,
  },
  {
    id: 2,
    fullName: 'Trần Văn Tài Xế',
    phone: '0900000002',
    email: 'driver@rideup.vn',
    password: '123456',
    role: ROLES.DRIVER,
    avatar: null,
    rating: 4.8,
    totalRides: 142,
    vehiclePlate: '29A-12345',
    vehicleModel: 'Toyota Innova 2022',
  },
  {
    id: 3,
    fullName: 'Lê Thị Khách Hàng',
    phone: '0900000003',
    email: 'customer@rideup.vn',
    password: '123456',
    role: ROLES.CUSTOMER,
    avatar: null,
  },
];

// ----------------------------------------
// TUYẾN ĐƯỜNG (driver quản lý)
// ----------------------------------------
export const MOCK_ROUTES = [
  {
    id: 'route_1',
    pickupProvince: 'Hà Nội',
    pickupClusters: ['Thanh Xuân', 'Hà Đông', 'Cầu Giấy'],
    dropoffProvince: 'Hưng Yên',
    dropoffClusters: ['Ân Thi', 'Kim Động', 'Văn Giang'],
    fixedFare: 120000,
    status: 'active',
  },
  {
    id: 'route_2',
    pickupProvince: 'Hà Nội',
    pickupClusters: ['Đống Đa', 'Ba Đình', 'Hoàn Kiếm'],
    dropoffProvince: 'Hải Dương',
    dropoffClusters: ['Chi Linh', 'Nam Sách', 'Kinh Môn'],
    fixedFare: 150000,
    status: 'active',
  },
  {
    id: 'route_3',
    pickupProvince: 'Hà Nội',
    pickupClusters: ['Hoàng Mai', 'Hai Bà Trưng'],
    dropoffProvince: 'Bắc Ninh',
    dropoffClusters: ['Từ Sơn', 'Thuận Thành'],
    fixedFare: 90000,
    status: 'active',
  },
];

// ----------------------------------------
// CHUYẾN XE ĐÃ LÊN LỊCH (driver trips)
// ----------------------------------------
export const MOCK_DRIVER_TRIPS = [
  {
    id: 'trip_1',
    routeId: 'route_1',
    pickupProvince: 'Hà Nội',
    dropoffProvince: 'Hưng Yên',
    departureDate: '2026-02-26',
    departureTime: '07:00',
    totalSeats: 4,
    availableSeats: 1,
    fixedFare: 120000,
    status: 'scheduled',
  },
  {
    id: 'trip_2',
    routeId: 'route_2',
    pickupProvince: 'Hà Nội',
    dropoffProvince: 'Hải Dương',
    departureDate: '2026-02-27',
    departureTime: '06:30',
    totalSeats: 4,
    availableSeats: 4,
    fixedFare: 150000,
    status: 'scheduled',
  },
  {
    id: 'trip_3',
    routeId: 'route_1',
    pickupProvince: 'Hà Nội',
    dropoffProvince: 'Hưng Yên',
    departureDate: '2026-02-25',
    departureTime: '07:00',
    totalSeats: 4,
    availableSeats: 0,
    fixedFare: 120000,
    status: 'ongoing',
  },
  {
    id: 'trip_4',
    routeId: 'route_1',
    pickupProvince: 'Hà Nội',
    dropoffProvince: 'Hưng Yên',
    departureDate: '2026-02-24',
    departureTime: '07:00',
    totalSeats: 4,
    availableSeats: 0,
    fixedFare: 120000,
    status: 'completed',
  },
];

// ----------------------------------------
// CHUYẾN XE CỦA TÀI XẾ (legacy rides)
// ----------------------------------------
export const MOCK_DRIVER_RIDES = [
  {
    id: 1,
    from: 'Thanh Xuân / Hà Đông - Hà Nội',
    to: 'Ân Thi / Kim Động - Hưng Yên',
    departureTime: '2026-02-25T07:00:00',
    totalSeats: 4,
    bookedSeats: 3,
    price: 120000,
    status: 'in_progress',
    passengers: [
      { id: 1, name: 'Lê Thị Khách Hàng', phone: '0900000003', seat: 1, pickupPoint: 'Thanh Xuân', dropPoint: 'Ân Thi' },
      { id: 2, name: 'Phạm Văn Nam', phone: '0911222333', seat: 2, pickupPoint: 'Hà Đông', dropPoint: 'Kim Động' },
    ],
  },
  {
    id: 2,
    from: 'Hoàn Kiếm / Đống Đa - Hà Nội',
    to: 'Văn Giang / Khoái Châu - Hưng Yên',
    departureTime: '2026-02-25T14:30:00',
    totalSeats: 4,
    bookedSeats: 1,
    price: 100000,
    status: 'pending',
    passengers: [
      { id: 4, name: 'Vũ Minh Tú', phone: '0933444555', seat: 1, pickupPoint: 'Đống Đa', dropPoint: 'Khoái Châu' },
    ],
  },
  {
    id: 3,
    from: 'Thanh Xuân / Hà Đông - Hà Nội',
    to: 'Ân Thi / Kim Động - Hưng Yên',
    departureTime: '2026-02-24T07:00:00',
    totalSeats: 4,
    bookedSeats: 4,
    price: 120000,
    status: 'completed',
    passengers: [],
  },
];

// MOCK_PENDING_BOOKINGS - không còn dùng (khách thanh toán là có chỗ luôn)
export const MOCK_PENDING_BOOKINGS = [];

// ----------------------------------------
// CHUYẾN XE KHẢ DỤNG (CUSTOMER)
// ----------------------------------------
export const MOCK_AVAILABLE_RIDES = [
  {
    id: 2,
    driverName: 'Trần Văn Tài Xế',
    driverRating: 4.8,
    from: 'Hoàn Kiếm / Đống Đa - Hà Nội',
    to: 'Văn Giang / Khoái Châu - Hưng Yên',
    departureTime: '2026-02-25T14:30:00',
    availableSeats: 3,
    price: 100000,
    vehicleModel: 'Toyota Innova 2022',
    vehiclePlate: '29A-12345',
  },
  {
    id: 4,
    driverName: 'Hoàng Văn Sơn',
    driverRating: 4.6,
    from: 'Cầu Giấy / Đống Đa - Hà Nội',
    to: 'Phù Cừ / Tiên Lữ - Hưng Yên',
    departureTime: '2026-02-25T16:00:00',
    availableSeats: 2,
    price: 150000,
    vehicleModel: 'Ford Transit 2021',
    vehiclePlate: '30A-98765',
  },
];

// ----------------------------------------
// LỊCH SỬ ĐẶT XE (CUSTOMER)
// ----------------------------------------
export const MOCK_CUSTOMER_BOOKINGS = [
  {
    id: 101,
    from: 'Thanh Xuân / Hà Đông - Hà Nội',
    to: 'Ân Thi / Kim Động - Hưng Yên',
    departureTime: '2026-02-25T07:00:00',
    driverName: 'Trần Văn Tài Xế',
    driverRating: 4.8,
    price: 120000,
    status: 'in_progress',
    pickupPoint: 'Thanh Xuân',
    dropPoint: 'Ân Thi',
    paymentStatus: 'paid',
    hasRated: false,
  },
  {
    id: 102,
    from: 'Thanh Xuân / Hà Đông - Hà Nội',
    to: 'Ân Thi / Kim Động - Hưng Yên',
    departureTime: '2026-02-24T07:00:00',
    driverName: 'Trần Văn Tài Xế',
    driverRating: 4.8,
    price: 120000,
    status: 'completed',
    pickupPoint: 'Hà Đông',
    dropPoint: 'Kim Động',
    paymentStatus: 'paid',
    hasRated: true,
    myRating: 5,
  },
];

// ----------------------------------------
// THỐNG KÊ ADMIN
// ----------------------------------------
export const MOCK_ADMIN_STATS = {
  today: {
    totalRides: 28,
    completedRides: 19,
    cancelledRides: 2,
    revenue: 3360000,
  },
  thisMonth: {
    totalRides: 612,
    completedRides: 578,
    revenue: 73440000,
    totalUsers: 245,
    newUsers: 38,
    totalDrivers: 42,
    newDrivers: 5,
  },
  recentActivity: [
    { id: 1, type: 'new_booking', message: 'Lê Thị Khách Hàng đặt chuyến Hà Nội → Hưng Yên', time: '10 phút trước' },
    { id: 2, type: 'ride_completed', message: 'Chuyến xe 29A-12345 hoàn thành', time: '25 phút trước' },
    { id: 3, type: 'new_driver', message: 'Tài xế mới Nguyễn Văn Long đăng ký', time: '1 giờ trước' },
    { id: 4, type: 'payment', message: 'Thanh toán 120,000đ từ Phạm Văn Nam', time: '2 giờ trước' },
    { id: 5, type: 'cancelled', message: 'Khách hàng Bùi Thị Hà hủy đặt chỗ', time: '3 giờ trước' },
  ],
};

// ----------------------------------------
// THỐNG KÊ TÀI XẾ
// ----------------------------------------
export const MOCK_DRIVER_STATS = {
  thisMonth: {
    totalRides: 32,
    completedRides: 30,
    cancelledRides: 2,
    revenue: 3840000,
  },
  rating: 4.8,
  totalReviews: 142,
};

// ----------------------------------------
// HELPER
// ----------------------------------------
export const mockApiDelay = (ms = 800) =>
  new Promise((resolve) => setTimeout(resolve, ms));

