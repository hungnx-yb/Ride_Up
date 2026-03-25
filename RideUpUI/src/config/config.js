// Cấu hình chung cho ứng dụng RideUp

// ========================================
// CẤU HÌNH API
// ========================================
export const API_CONFIG = {
  // Backend context-path: /rideUp, port: 8080
  // Thay IP bên dưới theo máy đang chạy backend (dùng IP LAN, không dùng localhost trên thiết bị thật)
  BASE_URL: 'http://localhost:8080/rideUp',
  TIMEOUT: 30000,
};

// ========================================
// CẤU HÌNH MÀU SẮC - RIDEUP THEME
// ========================================
export const COLORS = {
  primary: '#1565C0',       // Xanh dương đậm
  primaryLight: '#1E88E5',  // Xanh nhạt hơn
  primaryDark: '#0D47A1',   // Xanh đậm hơn
  accent: '#FF6F00',        // Cam - nổi bật
  accentLight: '#FFA726',   // Cam nhạt
  background: '#F5F7FA',    // Nền xám nhạt
  surface: '#FFFFFF',       // Trắng cho card
  white: '#FFFFFF',
  black: '#000000',
  text: '#1A1A2E',          // Chữ đậm
  textLight: '#6B7280',     // Chữ phụ
  textMuted: '#9CA3AF',     // Chữ mờ
  error: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
  info: '#2563EB',
  border: '#E5E7EB',
  // Role colors
  adminColor: '#7C3AED',    // Tím - Admin
  driverColor: '#0891B2',   // Xanh cyan - Tài xế
  customerColor: '#059669', // Xanh lá - Khách hàng
};

// ========================================
// CẤU HÌNH APP
// ========================================
export const APP_CONFIG = {
  APP_NAME: 'RideUp',
  VERSION: '1.0.0',
};

// ========================================
// ROLES
// ========================================
export const ROLES = {
  ADMIN: 'ADMIN',
  DRIVER: 'DRIVER',
  CUSTOMER: 'CUSTOMER',
};

export default {
  API_CONFIG,
  COLORS,
  APP_CONFIG,
  ROLES,
};
