# 📐 RideUp — Flow & Kiến trúc Project

## Tổng quan

RideUp là ứng dụng ghép chuyến xe (carpooling). Có 3 loại người dùng:

| Role | Mô tả |
|------|-------|
| `ADMIN` | Quản trị viên hệ thống |
| `DRIVER` | Tài xế — tạo và quản lý chuyến xe |
| `CUSTOMER` | Khách hàng — tìm kiếm và đặt chuyến |

---

## Auth Flow (Luồng đăng nhập)

```
App khởi động
      │
      ▼
  user == null?
      │
   ┌──┴──┐
  Có    Không
   │       │
   ▼       ▼
LoginScreen  Màn hình Home theo role
   │
   ├── Nhập phone + password
   ├── Gọi login() từ api.js
   │     ├── [MOCK] So khớp MOCK_ACCOUNTS
   │     └── [REAL] POST /api/auth/login
   │
   └── Nhận { user, token }
         │
         ├── user.role == ADMIN     → AdminHomeScreen
         ├── user.role == DRIVER    → DriverHomeScreen
         └── user.role == CUSTOMER  → CustomerHomeScreen

Đăng xuất → setUser(null) → về LoginScreen
```

---

## Cấu trúc file & nhiệm vụ

### `App.js` — Entry point

- Giữ **auth state**: `user` (null = chưa đăng nhập)
- Render `NavigationContainer` với `Stack.Navigator`
- Khi `user == null`: hiển thị Auth stack (Login / Register)
- Khi `user != null`: hiển thị màn hình Home theo `user.role`
- Truyền `onLogout` xuống các HomeScreen để logout

```
App.js
 ├── state: { user, token }
 ├── handleLoginSuccess(user, token) → setUser, setToken
 ├── handleLogout()                  → setUser(null)
 └── NavigationContainer
       ├── [user==null] LoginScreen  ← nhận onLoginSuccess
       ├── [user==null] RegisterScreen
       ├── [ADMIN]  AdminHomeScreen  ← nhận user, onLogout
       ├── [DRIVER] DriverHomeScreen ← nhận user, onLogout
       └── [CUSTOMER] CustomerHomeScreen ← nhận user, onLogout
```

---

### `src/config/config.js` — Hằng số toàn app

| Export | Mô tả |
|--------|-------|
| `API_CONFIG` | `BASE_URL` backend, `TIMEOUT` request |
| `COLORS` | Bảng màu toàn app (primary, accent, roleColors...) |
| `ROLES` | Enum: `ADMIN`, `DRIVER`, `CUSTOMER` |
| `APP_CONFIG` | Tên app, version |

Khi cần đổi màu hay URL, **chỉ sửa file này**, không hardcode trong screen.

---

### `src/services/api.js` — Lớp gọi API

Toggle mock/real bằng 1 biến:
```js
export const USE_MOCK_DATA = true;  // false → gọi backend thật
```

**Các hàm xuất ra:**

| Hàm | Role dùng | Mô tả |
|-----|-----------|-------|
| `login(phone, password)` | All | Đăng nhập, trả về `{ user, token }` |
| `register(payload)` | All | Đăng ký tài khoản mới |
| `getAdminStats()` | Admin | Thống kê hôm nay + tháng này |
| `getAllUsers()` | Admin | Danh sách toàn bộ user |
| `getRoutes()` | Admin | Danh sách tuyến đường |
| `getDriverRides()` | Driver | Danh sách chuyến của tài xế |
| `getDriverStats()` | Driver | Doanh thu, rating, số chuyến |
| `getPendingBookings()` | Driver | Yêu cầu đặt chỗ chờ duyệt |
| `createRide(data)` | Driver | Tạo chuyến xe mới |
| `respondToBooking(id, accept)` | Driver | Chấp nhận / từ chối đặt chỗ |
| `updateRideStatus(id, status)` | Driver | Bắt đầu / kết thúc chuyến |
| `searchRides({ from, to, date })` | Customer | Tìm chuyến xe |
| `getCustomerBookings()` | Customer | Lịch sử đặt xe |
| `bookRide(payload)` | Customer | Đặt chỗ trên chuyến xe |
| `rateRide(bookingId, rating, comment)` | Customer | Đánh giá sau chuyến |

---

### `src/services/mockData.js` — Dữ liệu giả

Dùng khi `USE_MOCK_DATA = true`. Các export chính:

| Biến | Dùng trong |
|------|-----------|
| `MOCK_ACCOUNTS` | api.login() — 3 tài khoản test |
| `MOCK_ADMIN_STATS` | api.getAdminStats() |
| `MOCK_DRIVER_RIDES` | api.getDriverRides() |
| `MOCK_DRIVER_STATS` | api.getDriverStats() |
| `MOCK_PENDING_BOOKINGS` | api.getPendingBookings() |
| `MOCK_AVAILABLE_RIDES` | api.searchRides() |
| `MOCK_CUSTOMER_BOOKINGS` | api.getCustomerBookings() |
| `MOCK_ROUTES` | api.getRoutes() |
| `mockApiDelay(ms)` | Giả lập độ trễ mạng (default 800ms) |

Khi backend sẵn sàng → đổi `USE_MOCK_DATA = false`, toàn bộ screens tự động gọi API thật mà không cần sửa thêm gì.

---

### `src/navigation/AppNavigator.js` — Navigator dự phòng

File này định nghĩa các Stack navigator riêng theo role (`AuthStack`, `AdminStack`, `DriverStack`, `CustomerStack`). Hiện tại `App.js` quản lý navigation trực tiếp để đơn giản hơn. `AppNavigator` có thể dùng để mở rộng sau khi thêm nhiều màn hình con.

---

### `src/screens/auth/LoginScreen.js`

**Props nhận:** `onLoginSuccess(user, token)`, `navigation`

**Luồng:**
1. Nhập phone + password
2. Gọi `login()` → nhận `{ user, token }`
3. Gọi `onLoginSuccess(user, token)` → App.js cập nhật state → chuyển màn hình

**Tính năng:**
- Ẩn/hiện mật khẩu
- 3 nút điền nhanh tài khoản test (chỉ hiện ở DEMO MODE)
- Validation cơ bản trước khi gọi API

---

### `src/screens/auth/RegisterScreen.js`

**Luồng:**
1. Nhập: họ tên, số điện thoại, mật khẩu, xác nhận mật khẩu
2. Chọn role: **Khách hàng** hoặc **Tài xế** (Admin không tự đăng ký)
3. Gọi `register(payload)` → thành công → Alert → navigate về Login

---

### `src/screens/admin/AdminHomeScreen.js`

**Props nhận:** `user`, `onLogout`

**Dữ liệu:** `getAdminStats()`

**Nội dung hiển thị:**
- Header với tên admin + nút đăng xuất
- 4 stat cards: tổng chuyến, hoàn thành, đã hủy, doanh thu hôm nay
- Thống kê tháng: tổng chuyến, doanh thu, user mới, tài xế mới
- 4 quick action: Quản lý người dùng, Tuyến đường, Báo cáo, Cài đặt
- Feed hoạt động gần đây (`recentActivity`)

**Màn hình cần triển khai tiếp:**
- `ManageUsers` — CRUD người dùng
- `ManageRoutes` — Quản lý tuyến đường hệ thống  
- `Reports` — Báo cáo doanh thu chi tiết
- `Settings` — Cấu hình hệ thống

---

### `src/screens/driver/DriverHomeScreen.js`

**Props nhận:** `user`, `onLogout`

**Dữ liệu:** `getDriverRides()` + `getPendingBookings()` + `getDriverStats()`

**Nội dung hiển thị:**
- Header: tên tài xế, rating ⭐, thông tin xe
- Stats tháng: số chuyến, hoàn thành, doanh thu
- 4 quick action: Tạo chuyến, Tất cả chuyến, Tin nhắn, Doanh thu
- **Yêu cầu chờ duyệt** (badge đỏ): mỗi card có nút Chấp nhận / Từ chối
- **Chuyến hôm nay**: lọc theo ngày, status badge màu
- **Chuyến sắp tới**: các chuyến status=`pending`

**Màn hình cần triển khai tiếp:**
- `CreateRide` — Form tạo chuyến xe mới
- `RideDetail` — Chi tiết chuyến + danh sách khách
- `PassengerList` — Quản lý khách trên chuyến
- `Revenue` — Lịch sử doanh thu theo tháng
- `Messages` / `Chat` — Chat với khách

---

### `src/screens/customer/CustomerHomeScreen.js`

**Props nhận:** `user`, `onLogout`

**Dữ liệu:** `getCustomerBookings()`

**Nội dung hiển thị:**
- Header: tên khách + nút đăng xuất
- **Search card**: nhập điểm đi / điểm đến → navigate SearchRides
- 4 quick action: Tìm chuyến, Đặt xe của tôi, Tin nhắn, Đánh giá
- **Chuyến xe đang diễn ra**: các booking status pending/confirmed/in_progress
  - Nút "Chat tài xế" và "Theo dõi"
- **Lịch sử**: booking status completed
  - Nút "Đánh giá" nếu chưa rate
- Empty state khi chưa có booking

**Màn hình cần triển khai tiếp:**
- `SearchRides` — Kết quả tìm kiếm chuyến xe
- `RideDetail` — Chi tiết chuyến + nút đặt chỗ
- `BookingDetail` — Chi tiết booking + theo dõi realtime
- `Payment` — Thanh toán
- `RateRide` — Form đánh giá sau chuyến
- `Messages` / `Chat` — Chat với tài xế

---

## Thêm màn hình mới (hướng dẫn nhanh)

1. Tạo file trong đúng folder role:
   ```
   src/screens/driver/CreateRideScreen.js
   ```

2. Đăng ký trong `App.js` (trong Stack của role đó):
   ```js
   import CreateRideScreen from './src/screens/driver/CreateRideScreen';
   // ...
   <Stack.Screen name="CreateRide" component={CreateRideScreen} />
   ```

3. Navigate từ màn hình khác:
   ```js
   navigation.navigate('CreateRide');
   // Hoặc truyền params:
   navigation.navigate('RideDetail', { rideId: ride.id });
   ```

4. Nếu cần gọi API, thêm hàm vào `api.js` (mock + real).

---

## Chuyển từ Mock sang Backend thật

```
src/services/api.js
  └── USE_MOCK_DATA = true   →   false

src/config/config.js
  └── API_CONFIG.BASE_URL    →   http://<IP>:<PORT>/api
```

Mỗi hàm trong `api.js` có cấu trúc:
```js
export const tenHam = async (params) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay();
    return MOCK_DATA; // ← thay bằng real call
  }
  const response = await axios.get(`${API_CONFIG.BASE_URL}/endpoint`, { params });
  return response.data;
};
```

Khi đổi sang real, chỉ cần viết phần `else` (bỏ khối `if`) cho đúng endpoint.
