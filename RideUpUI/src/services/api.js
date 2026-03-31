import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Client } from '@stomp/stompjs';
import { API_CONFIG } from '../config/config';
import {
  MOCK_ACCOUNTS,
  MOCK_DRIVER_RIDES,
  MOCK_DRIVER_TRIPS,
  MOCK_AVAILABLE_RIDES,
  MOCK_CUSTOMER_BOOKINGS,
  MOCK_ADMIN_STATS,
  MOCK_DRIVER_STATS,
  MOCK_ROUTES,
  mockApiDelay,
} from './mockData';

// ========================================
// CHUYỂN ĐỔI MOCK / API THẬT
// true  = dùng mock (không cần backend)
// false = gọi thật tới backend
// ========================================
export const USE_MOCK_DATA = false;

// ── Token module-level (loaded on app start) ─────────────────
let _accessToken = null;
let _refreshToken = null;
let _isHandlingAuthExpiry = false;
const _authExpiredListeners = new Set();

export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@rideup_access_token',
  REFRESH_TOKEN: '@rideup_refresh_token',
  USER: '@rideup_user',
};

const API_CACHE_TTL = {
  ADMIN_STATS: 15000,
  LOCATION_STATS: 10000,
  USERS: 20000,
};

const _apiCache = new Map();

const _notifyAuthExpired = (reason) => {
  _authExpiredListeners.forEach((listener) => {
    try {
      listener(reason);
    } catch {
      // Ignore listener errors to avoid breaking API flow.
    }
  });
};

const _isTokenExpiredError = (error) => {
  const status = error?.response?.status;
  const rawMessage = String(
    error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || ''
  ).toLowerCase();

  // Some backend flows return 500 with auth-related message (e.g. Redis revoked token).
  if (/expired|revoked|jwt|token|unauthorized|forbidden|invalid token/.test(rawMessage)) {
    return true;
  }

  if (status !== 401 && status !== 403) return false;

  return !!(_accessToken || error?.config?.headers?.Authorization || error?.config?.headers?.authorization);
};

export const onAuthExpired = (listener) => {
  if (typeof listener !== 'function') {
    return () => {};
  }
  _authExpiredListeners.add(listener);
  return () => {
    _authExpiredListeners.delete(listener);
  };
};

// ── Khai báo apiClient TRƯỚC các helper dùng nó ──────────────
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

if (__DEV__) {
  apiClient.interceptors.request.use((config) => {
    const method = (config.method || 'GET').toUpperCase();
    const url = `${config.baseURL || ''}${config.url || ''}`;
    config.metadata = { startTime: Date.now() };
    if (url.includes('/driver/routes')) {
      console.log(`[API][REQ] ${method} ${url}`, config.data || '');
    }
    return config;
  });
}

// ── Response interceptor: unwrap ApiResponse, xử lý lỗi ────────
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      const url = `${response.config?.baseURL || ''}${response.config?.url || ''}`;
      const startTime = response.config?.metadata?.startTime;
      if (startTime) {
        const duration = Date.now() - startTime;
        if (duration > 1200) {
          console.log(`[API][SLOW] ${response.config?.method?.toUpperCase()} ${url} - ${duration}ms`);
        }
      }
      if (url.includes('/driver/routes')) {
        console.log(`[API][RES] ${response.status} ${url}`, response.data);
      }
    }
    return response;
  },
  (error) => {
    if (__DEV__) {
      const url = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
      const startTime = error.config?.metadata?.startTime;
      if (startTime) {
        const duration = Date.now() - startTime;
        if (duration > 1200) {
          console.log(`[API][SLOW-ERR] ${error.config?.method?.toUpperCase()} ${url} - ${duration}ms`);
        }
      }
    }
    if (_isTokenExpiredError(error) && !_isHandlingAuthExpiry) {
      _isHandlingAuthExpiry = true;
      clearStoredAuth()
        .catch(() => {})
        .finally(() => {
          _notifyAuthExpired('TOKEN_EXPIRED');
          _isHandlingAuthExpiry = false;
        });
      const authError = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      authError.code = 'AUTH_EXPIRED';
      return Promise.reject(authError);
    }

    if (!error.response) {
      return Promise.reject(new Error(`Không kết nối được backend (${API_CONFIG.BASE_URL}). Nếu test trên điện thoại thật, hãy đổi localhost thành IP LAN của máy chạy backend.`));
    }
    const data = error.response?.data;
    const message = data?.message || error.message || 'Lỗi kết nối máy chủ';
    return Promise.reject(new Error(message));
  }
);

// Helper: lấy .result từ ApiResponse wrapper
const unwrap = (res) => res.data?.result;

const getCached = async (key, ttlMs, fetcher) => {
  const now = Date.now();
  const current = _apiCache.get(key);

  if (current?.data !== undefined && current.expiresAt > now) {
    return current.data;
  }

  if (current?.promise) {
    return current.promise;
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      _apiCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
      });
      return data;
    } finally {
      const latest = _apiCache.get(key);
      if (latest?.promise) {
        _apiCache.set(key, {
          data: latest.data,
          expiresAt: latest.expiresAt || 0,
        });
      }
    }
  })();

  _apiCache.set(key, {
    data: current?.data,
    expiresAt: current?.expiresAt || 0,
    promise,
  });

  return promise;
};

const invalidateCacheByPrefix = (prefix) => {
  for (const key of _apiCache.keys()) {
    if (key.startsWith(prefix)) {
      _apiCache.delete(key);
    }
  }
};

const _buildChatWebSocketUrl = () => {
  const base = String(API_CONFIG.BASE_URL || '').replace(/\/+$/, '');
  return `${base.replace(/^http/i, 'ws')}/ws`;
};

export const createChatRealtimeClient = ({ threadId, onMessage, onConnect, onError }) => {
  if (!threadId || USE_MOCK_DATA) {
    return {
      disconnect: () => {},
    };
  }

  const wsUrl = _buildChatWebSocketUrl();
  const client = new Client({
    webSocketFactory: () => new WebSocket(wsUrl),
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {},
  });

  client.onConnect = () => {
    client.subscribe(`/topic/chat.thread.${threadId}`, (frame) => {
      try {
        const payload = JSON.parse(frame.body);
        onMessage?.(payload);
      } catch (error) {
        onError?.(error);
      }
    });
    onConnect?.();
  };

  client.onStompError = (frame) => {
    onError?.(new Error(frame?.body || 'STOMP broker error'));
  };

  client.onWebSocketError = (event) => {
    onError?.(new Error(event?.message || 'WebSocket connection error'));
  };

  client.activate();

  return {
    disconnect: () => {
      try {
        client.deactivate();
      } catch {
        // Ignore disconnect errors.
      }
    },
  };
};

/** Gọi khi khởi động app để khôi phục token đã lưu */
export const loadStoredAuth = async () => {
  try {
    const [token, refresh, userStr] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.USER),
    ]);
    if (token) {
      _accessToken = token;
      _refreshToken = refresh;
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

/** Sau khi login thành công: lưu token + cập nhật axios header */
const _persistAuth = async (accessToken, refreshToken, user) => {
  _accessToken = accessToken;
  _refreshToken = refreshToken;
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
    AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
    AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
  ]);
};

/** Xoá auth khỏi bộ nhớ và AsyncStorage */
export const clearStoredAuth = async () => {
  _accessToken = null;
  _refreshToken = null;
  delete apiClient.defaults.headers.common['Authorization'];
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER,
  ]);
};

// ==============================
// AUTH
// ==============================

/**
 * Đăng nhập bằng email + password.
 * Trả về { user, token, refreshToken } để App.js dùng.
 */
export const login = async (email, password) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(1000);
    const found = MOCK_ACCOUNTS.find(
      (a) => (a.phone === email || a.email === email) && a.password === password
    );
    if (!found) throw new Error('Email hoặc mật khẩu không đúng');
    const { password: _pw, ...user } = found;
    return { token: 'mock_token_' + user.id, refreshToken: 'mock_refresh', user };
  }

  const res = await apiClient.post('/auth/authentication', { email, password });
  const data = unwrap(res); // { token, refreshToken, authenticated, user }

  if (!data?.authenticated) throw new Error('Đăng nhập thất bại');

  await _persistAuth(data.token, data.refreshToken, data.user);
  return { token: data.token, refreshToken: data.refreshToken, user: data.user };
};

/**
 * Đăng ký tài khoản mới.
 * Backend gửi email xác nhận, FE chỉ cần thông báo.
 */
export const register = async ({ fullName, email, password, role }) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(1200);
    return { message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.' };
  }
  const res = await apiClient.post('/auth/register', { fullName, email, password, role });
  return unwrap(res); // UserResponse
};

/** Đăng xuất: thu hồi token trên server + xoá local */
export const logoutApi = async () => {
  try {
    if (!USE_MOCK_DATA && _accessToken) {
      await apiClient.post('/auth/logout', {
        token: _accessToken,
        refreshToken: _refreshToken,
      });
    }
  } finally {
    await clearStoredAuth();
  }
};

/** Lấy thông tin user đang đăng nhập (cần Bearer token) */
export const getMyInfo = async () => {
  if (USE_MOCK_DATA) return null;
  const res = await apiClient.get('/users/me');
  return unwrap(res);
};

export const updateMyInfo = async (payload) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(600);
    return payload || {};
  }
  const res = await apiClient.put('/users/me', payload || {});
  return unwrap(res);
};

export const requestChangePasswordOtp = async (currentPassword) => {
  const res = await apiClient.post('/auth/request-otp', {
    password: currentPassword,
  });
  return unwrap(res);
};

export const changeMyPassword = async ({ otp, newPassword }) => {
  const res = await apiClient.post('/auth/change-password', {
    otp,
    newPassword,
  });
  return unwrap(res);
};

// ==============================
// ADMIN
// ==============================

export const getAdminStats = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay();
    return MOCK_ADMIN_STATS;
  }
  return getCached('admin:stats', API_CACHE_TTL.ADMIN_STATS, async () => {
    const res = await apiClient.get('/admin/stats');
    return res.data?.result || res.data || {};
  });
};

export const getAllUsers = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay();
    return MOCK_ACCOUNTS.filter((a) => a.role !== 'ADMIN');
  }
  return getCached('admin:users', API_CACHE_TTL.USERS, async () => {
    const res = await apiClient.get('/admin/users');
    return res.data?.result || res.data || [];
  });
};

export const getAdminDriverProfiles = async () => {
  const res = await apiClient.get('/admin/driver-profiles');
  return res.data?.result || [];
};

export const approveDriverProfile = async (profileId) => {
  const res = await apiClient.put(`/admin/driver-profiles/${profileId}/approve`);
  invalidateCacheByPrefix('admin:stats');
  return res.data?.result;
};

export const rejectDriverProfile = async (profileId, rejectionReason) => {
  const res = await apiClient.put(`/admin/driver-profiles/${profileId}/reject`, { rejectionReason });
  invalidateCacheByPrefix('admin:stats');
  return res.data?.result;
};

export const getRoutes = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay();
    return MOCK_ROUTES;
  }
  const res = await apiClient.get('/routes');
  return res.data;
};

// ==============================
// DRIVER - QUẢN LÝ TUYẾN
// ==============================

/** Lấy danh sách tuyến của tài xế */
export const getDriverRoutes = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay();
    return MOCK_ROUTES;
  }
  const res = await apiClient.get('/driver/routes');
  return res.data;
};

/** Tạo tuyến mới */
export const createRoute = async (routeData) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(1000);
    return { ...routeData, id: 'route_' + Date.now(), status: 'active' };
  }
  const res = await apiClient.post('/driver/routes', routeData);
  return res.data;
};

/** Cập nhật tuyến */
export const updateRoute = async (routeId, data) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(800);
    return { success: true };
  }
  const res = await apiClient.put(`/driver/routes/${routeId}`, data);
  return res.data;
};

/** Xóa tuyến */
export const deleteRoute = async (routeId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(600);
    return { success: true };
  }
  const res = await apiClient.delete(`/driver/routes/${routeId}`);
  return res.data;
};

// ==============================
// DRIVER - QUẢN LÝ CHUYẾN XE
// ==============================

/** Lấy danh sách chuyến (trips) của tài xế */
export const getDriverTrips = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay();
    return MOCK_DRIVER_TRIPS;
  }
  const res = await apiClient.get('/driver/trips');
  return res.data;
};

export const getDriverTripDetail = async (tripId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    const trip = MOCK_DRIVER_TRIPS.find((item) => item.id === tripId);
    if (!trip) {
      throw new Error('Khong tim thay chuyen xe');
    }

    const totalSeats = trip.totalSeats || 0;
    const availableSeats = trip.availableSeats || 0;
    const bookedSeats = Math.max(0, totalSeats - availableSeats);

    return {
      ...trip,
      bookedSeats,
      estimatedRevenue: (trip.fixedFare || 0) * bookedSeats,
      pickupPoints: [
        {
          id: `${trip.id}-pickup-1`,
          wardName: trip.pickupProvince,
          provinceName: trip.pickupProvince,
          address: `Diem don tai ${trip.pickupProvince}`,
          sortOrder: 0,
          time: null,
          note: null,
        },
      ],
      dropoffPoints: [
        {
          id: `${trip.id}-dropoff-1`,
          wardName: trip.dropoffProvince,
          provinceName: trip.dropoffProvince,
          address: `Diem tra tai ${trip.dropoffProvince}`,
          sortOrder: 0,
          time: null,
          note: null,
        },
      ],
      bookings: [],
    };
  }

  const res = await apiClient.get(`/driver/trips/${tripId}`);
  return res.data;
};

/** Lấy danh sách chuyến của tài xế */
export const getDriverRides = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay();
    return MOCK_DRIVER_RIDES;
  }
  const res = await apiClient.get('/driver/rides');
  return res.data;
};

/** Lấy thống kê tài xế */
export const getDriverStats = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    return MOCK_DRIVER_STATS;
  }
  const res = await apiClient.get('/driver/stats');
  return res.data;
};

/** Lấy hồ sơ tài xế hiện tại */
export const getDriverProfile = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    const me = MOCK_ACCOUNTS.find((a) => a.role === 'DRIVER') || {};
    return {
      fullName: me.fullName || 'Tài xế RideUp',
      phoneNumber: me.phone || '',
      email: me.email || '',
      driverRating: 4.8,
      totalDriverRides: 120,
      status: 'APPROVED',
      cccd: '',
      gplx: '',
      plateNumber: '',
      vehicleBrand: '',
      vehicleModel: '',
      vehicleColor: '',
      seatCapacity: 4,
      vehicleType: 'CAR_4_SEAT',
      vehicleActive: true,
      vehicleVerified: false,
    };
  }
  const res = await apiClient.get('/driver/profile');
  return res.data;
};

/** Cập nhật hồ sơ tài xế */
export const updateDriverProfile = async (payload) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(800);
    return { ...payload, updatedAt: new Date().toISOString() };
  }
  const res = await apiClient.put('/driver/profile', payload);
  return res.data;
};

export const submitDriverProfile = async (payload) => {
  const res = await apiClient.post('/driver/profile/submit', payload || {});
  return res.data;
};

export const uploadFile = async ({ uri, name, type }) => {
  if (!uri) {
    throw new Error('Khong tim thay tep de tai len');
  }

  const formData = new FormData();
  formData.append('file', {
    uri,
    name: name || `upload_${Date.now()}.jpg`,
    type: type || 'image/jpeg',
  });

  const res = await apiClient.post('/file/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return res.data?.result || res.data;
};

/** Không còn dùng - khách thanh toán là có chỗ luôn */
export const getPendingBookings = async () => [];

/** Tạo chuyến xe mới (trip từ route) */
export const createTrip = async (tripData) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(1000);
    return { ...tripData, id: 'trip_' + Date.now(), availableSeats: tripData.totalSeats };
  }
  const res = await apiClient.post('/driver/trips', tripData);
  return res.data;
};

/** Hủy chuyến xe đã tạo */
export const cancelDriverTrip = async (tripId, cancellationReason = null) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(700);
    return { success: true, id: tripId, status: 'cancelled', cancellationReason };
  }
  const payload = cancellationReason ? { cancellationReason } : {};
  const res = await apiClient.put(`/driver/trips/${tripId}/cancel`, payload);
  return res.data;
};

export const startDriverTrip = async (tripId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(600);
    return { id: tripId, status: 'ongoing' };
  }
  const res = await apiClient.put(`/driver/trips/${tripId}/start`);
  return res.data;
};

export const completeDriverTrip = async (tripId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(600);
    return { id: tripId, status: 'completed' };
  }
  const res = await apiClient.put(`/driver/trips/${tripId}/complete`);
  return res.data;
};

/** Tạo chuyến xe mới */
export const createRide = async (rideData) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(1000);
    return { ...rideData, id: Date.now(), status: 'pending', bookedSeats: 0 };
  }
  const res = await apiClient.post('/driver/rides', rideData);
  return res.data;
};

/** Không còn dùng - khách thanh toán là có chỗ luôn */
export const respondToBooking = async () => ({ success: true });

/** Bắt đầu / kết thúc chuyến xe */
export const updateRideStatus = async (rideId, status) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(800);
    return { success: true, rideId, status };
  }
  const res = await apiClient.put(`/driver/rides/${rideId}/status`, { status });
  return res.data;
};

// ==============================
// CUSTOMER
// ==============================

/** Tìm kiếm chuyến xe */
export const searchRides = async ({ from, to, date }) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(1000);
    return MOCK_AVAILABLE_RIDES;
  }
  const res = await apiClient.get('/rides/search', { params: { fromProvinceId: from, toProvinceId: to, departureDate: date } });
  return res.data?.result ?? res.data;
};

/** Tìm chuyến xe theo tỉnh/phường + ngày */
export const searchRidesAdvanced = async ({
  fromProvinceId,
  toProvinceId,
  fromWardId,
  toWardId,
  departureDate,
}) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(1000);
    return MOCK_AVAILABLE_RIDES;
  }
  const res = await apiClient.get('/rides/search', {
    params: {
      fromProvinceId,
      toProvinceId,
      fromWardId,
      toWardId,
      departureDate,
    },
  });
  return res.data?.result ?? res.data;
};

/** Lấy chi tiết xã/phường theo wardId */
export const getWardById = async (wardId) => {
  if (!wardId) return null;
  if (USE_MOCK_DATA) {
    await mockApiDelay(300);
    return null;
  }
  const res = await apiClient.get(`/api/locations/wards/${wardId}`);
  return res.data?.result ?? res.data;
};

/** Lấy lịch sử đặt xe */
export const getCustomerBookings = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay();
    return MOCK_CUSTOMER_BOOKINGS;
  }
  const res = await apiClient.get('/customer/bookings');
  return res.data?.result ?? res.data;
};

/** Đặt chỗ */
export const bookRide = async (payload) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(1200);
    return { success: true, bookingId: Date.now(), message: 'Đặt chỗ thành công!' };
  }
  const res = await apiClient.post('/customer/bookings', payload);
  return res.data?.result ?? res.data;
};

/** Xác nhận đã chuyển khoản cho booking */
export const confirmBookingPayment = async (bookingId, transactionId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(800);
    return { success: true, bookingId, status: 'confirmed' };
  }
  const res = await apiClient.post(`/customer/bookings/${bookingId}/payment/confirm`, {
    transactionId,
  });
  return res.data?.result ?? res.data;
};

/** Tạo link thanh toán VNPAY cho booking */
export const createVnpayPaymentUrl = async (bookingId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    return {
      bookingId,
      paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      transactionRef: 'mock_vnp_txn_ref',
    };
  }
  const res = await apiClient.post(`/customer/bookings/${bookingId}/payment/vnpay-url`);
  return res.data?.result ?? res.data;
};

/** Đánh giá chuyến xe */
export const rateRide = async (bookingId, rating, comment) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(800);
    return { success: true, message: 'Cảm ơn đánh giá của bạn!' };
  }
  const res = await apiClient.post(`/customer/bookings/${bookingId}/rate`, {
    rating,
    comment,
  });
  return res.data;
};

/** Chat hỗ trợ CSKH (FAQ + tra cứu booking/thanh toán) */
export const supportChat = async (message) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    return {
      intent: 'FAQ',
      reply: 'Đây là phản hồi mock. Bạn có thể hỏi về hủy chuyến, thanh toán, kiểm tra booking gần nhất.',
      suggestions: ['Kiểm tra booking gần nhất', 'Tôi muốn hủy chuyến'],
    };
  }
  const res = await apiClient.post('/support/chat', { message });
  return res.data?.result ?? res.data;
};

// ==============================
// CHAT
// ==============================

/** Mở (hoặc tạo) phòng chat theo booking */
export const openChatThread = async (bookingId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    return {
      id: `thread_${bookingId}`,
      bookingId,
      tripId: 'trip_mock',
      status: 'ACTIVE',
      customerUnreadCount: 0,
      driverUnreadCount: 0,
      myUnreadCount: 0,
    };
  }
  const res = await apiClient.post('/chat/threads/open', { bookingId });
  return res.data?.result ?? res.data;
};

/** Lấy danh sách phòng chat của user hiện tại */
export const getMyChatThreads = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(400);
    return [];
  }
  const res = await apiClient.get('/chat/threads');
  return res.data?.result ?? res.data;
};

/** Lấy tin nhắn của một phòng chat */
export const getChatMessages = async (threadId, limit = 50) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(400);
    return [];
  }
  const res = await apiClient.get(`/chat/threads/${threadId}/messages`, {
    params: { limit },
  });
  return res.data?.result ?? res.data;
};

/** Gửi tin nhắn text */
export const sendChatMessage = async (threadId, content) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(300);
    return {
      id: `msg_${Date.now()}`,
      threadId,
      content,
      type: 'TEXT',
      mine: true,
      sentAt: new Date().toISOString(),
    };
  }
  const res = await apiClient.post(`/chat/threads/${threadId}/messages`, { content });
  return res.data?.result ?? res.data;
};

/** Đánh dấu đã đọc phòng chat */
export const markChatThreadRead = async (threadId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(250);
    return { id: threadId, myUnreadCount: 0 };
  }
  const res = await apiClient.post(`/chat/threads/${threadId}/read`);
  return res.data?.result ?? res.data;
};

// ── Admin: đồng bộ dữ liệu địa lý ──────────────────────────────────────

/** Lấy trạng thái đồng bộ và số lượng tỉnh/xã trong DB */
export const getLocationStats = async () => {
  return getCached('admin:location-stats', API_CACHE_TTL.LOCATION_STATS, async () => {
    const res = await apiClient.get('/api/locations/admin/stats');
    return res.data.result;
  });
};

/** Kích hoạt đồng bộ lại dữ liệu tỉnh/xã từ Overpass (chạy nền) */
export const triggerLocationSync = async () => {
  const res = await apiClient.post('/api/locations/admin/sync');
  invalidateCacheByPrefix('admin:location-stats');
  invalidateCacheByPrefix('admin:stats');
  return res.data;
};

export default apiClient;
