// Cấu hình chung cho ứng dụng RideUp

import Constants from 'expo-constants';

// ========================================
// CẤU HÌNH API
// ========================================
const ENV_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
const WEB_HOSTNAME = typeof window !== 'undefined' ? window.location.hostname : '';
const WEB_AUTO_BASE_URL = WEB_HOSTNAME && WEB_HOSTNAME !== 'localhost' && WEB_HOSTNAME !== '127.0.0.1'
  ? `http://${WEB_HOSTNAME}:8080/rideUp`
  : '';
const EXPO_HOST_URI =
  Constants?.expoConfig?.hostUri
  || Constants?.manifest?.hostUri
  || '';

const getHostnameFromHostUri = (hostUri) => {
  if (!hostUri) {
    return '';
  }

  try {
    const normalizedUri = String(hostUri).includes('://') ? String(hostUri) : `http://${hostUri}`;
    return new URL(normalizedUri).hostname;
  } catch {
    return String(hostUri).split('/')[0].split(':')[0];
  }
};

const EXPO_HOSTNAME = getHostnameFromHostUri(EXPO_HOST_URI);
const EXPO_AUTO_BASE_URL = EXPO_HOSTNAME && EXPO_HOSTNAME !== 'localhost' && EXPO_HOSTNAME !== '127.0.0.1'
  ? `http://${EXPO_HOSTNAME}:8080/rideUp`
  : '';

export const API_CONFIG = {
  // Backend context-path: /rideUp, port: 8080
  // Ưu tiên EXPO_PUBLIC_API_BASE_URL để tránh sửa code mỗi lần đổi mạng.
  // Ví dụ: EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/rideUp
  BASE_URL: ENV_BASE_URL || WEB_AUTO_BASE_URL || EXPO_AUTO_BASE_URL || 'http://localhost:8080/rideUp',
  TIMEOUT: 30000,
};

const ENV_SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const ENV_SUPABASE_BUCKET = (process.env.EXPO_PUBLIC_SUPABASE_BUCKET || '').trim();

export const STORAGE_CONFIG = {
  SUPABASE_URL: ENV_SUPABASE_URL || 'https://tgbtragwxkulpittcjzw.supabase.co',
  SUPABASE_BUCKET: ENV_SUPABASE_BUCKET || 'rideup',
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
  STORAGE_CONFIG,
  COLORS,
  APP_CONFIG,
  ROLES,
};
