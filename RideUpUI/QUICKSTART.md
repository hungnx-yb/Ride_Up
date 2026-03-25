# 🚀 Hướng dẫn chạy RideUp

## Yêu cầu

| Tool | Version | Link |
|------|---------|------|
| Node.js | ≥ 18 | https://nodejs.org |
| Expo CLI | latest | `npm install -g expo-cli` |
| Expo Go (điện thoại) | latest | App Store / Google Play |

> Điện thoại và máy tính phải **cùng mạng Wi-Fi**.

---

## Cài đặt lần đầu

```bash
# Clone hoặc mở folder project
cd RideUpUI

# Cài dependencies
npm install
```

---

## Chạy app

```bash
npx expo start --web
```

Sau khi chạy, terminal hiển thị **QR code**.

- **Android**: Mở app **Expo Go** → quét QR code
- **iOS**: Mở camera → quét QR code

### Tuỳ chọn khởi động

```bash
npx expo start --clear        # Xóa cache, dùng khi gặp lỗi lạ
npx expo start --tunnel       # Dùng khi khác mạng (chậm hơn)
npx expo start --android      # Mở emulator Android (cần cài Android Studio)
npx expo start --ios          # Mở simulator iOS (chỉ trên macOS)
```

---

## Đăng nhập test (DEMO MODE)

Khi `USE_MOCK_DATA = true` trong `src/services/api.js`, dùng các tài khoản sau:

| Role | Số điện thoại | Mật khẩu |
|------|--------------|----------|
| 👑 Admin | `0900000001` | `123456` |
| 🚗 Tài xế | `0900000002` | `123456` |
| 👤 Khách hàng | `0900000003` | `123456` |

Màn hình Login có 3 nút gợi ý để điền nhanh tài khoản test.

---

## Kết nối Backend thật

1. Mở `src/services/api.js`
2. Đổi `USE_MOCK_DATA = false`
3. Mở `src/config/config.js`
4. Sửa `BASE_URL` thành địa chỉ backend:

```js
// src/config/config.js
export const API_CONFIG = {
  BASE_URL: 'http://<IP_SERVER>:8000/api',
  TIMEOUT: 10000,
};
```

---

## Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|------------|---------|
| `Unable to connect` | Khác mạng Wi-Fi | Dùng `--tunnel` hoặc cùng mạng |
| `Module not found` | Thiếu package | Chạy `npm install` |
| App trắng / crash | Cache cũ | Chạy `npx expo start --clear` |
| `Network request failed` | Sai IP backend | Kiểm tra `BASE_URL` trong config |

---

## Cấu trúc thư mục

```
RideUpUI/
├── App.js                    ← Entry point, quản lý auth state + navigation
├── src/
│   ├── config/
│   │   └── config.js         ← Màu sắc, URL, hằng số toàn app
│   ├── services/
│   │   ├── api.js            ← Tất cả API calls (có toggle mock)
│   │   ├── mockData.js       ← Dữ liệu giả để test UI
│   │   └── locationService.js← OpenMap.vn: danh sách tỉnh thành + tìm quận/huyện
│   ├── components/
│   │   ├── ProvincePicker.js ← Modal chọn tỉnh / TP (63 tỉnh)
│   │   └── ClusterInput.js   ← Input khu vực với autocomplete từ OpenMap.vn
│   └── screens/
│       ├── auth/             ← LoginScreen, RegisterScreen
│       ├── admin/            ← AdminHomeScreen
│       ├── driver/           ← DriverHomeScreen, ManageRoutesScreen,
│       │                         CreateTripScreen, AllTripsScreen
│       └── customer/         ← CustomerHomeScreen
├── QUICKSTART.md             ← File này
└── PROJECT_DOCS.md           ← Flow và kiến trúc chi tiết
```
