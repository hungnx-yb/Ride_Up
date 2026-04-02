import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Client } from '@stomp/stompjs';
import { API_CONFIG, STORAGE_CONFIG } from '../config/config';
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
let _refreshInFlight = null;
const _authExpiredListeners = new Set();
let _notificationFeed = [];
const _notificationFeedListeners = new Set();
let _chatUnreadThreadsCount = 0;
const _chatUnreadThreadsListeners = new Set();

export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@rideup_access_token',
  REFRESH_TOKEN: '@rideup_refresh_token',
  USER: '@rideup_user',
  NOTIFICATION_FEED: '@rideup_notification_feed',
};

const API_CACHE_TTL = {
  ADMIN_STATS: 15000,
  LOCATION_STATS: 10000,
  USERS: 20000,
  DRIVER_TRIPS: 60000,
  DRIVER_STATS: 60000,
  DRIVER_PROFILE: 45000,
  CHAT_THREADS: 8000,
};

const CHAT_REQUEST_TIMEOUT = 12000;

const _apiCache = new Map();
const DRIVER_TRIPS_CACHE_KEY = 'DRIVER_TRIPS:LIST';
const DRIVER_STATS_CACHE_KEY = 'DRIVER_STATS:ME';
let _driverTripsSnapshot = [];
let _driverStatsSnapshot = null;

const _rememberDriverTripsSnapshot = (data) => {
  if (Array.isArray(data)) {
    _driverTripsSnapshot = data;
  }
};

const _rememberDriverStatsSnapshot = (data) => {
  if (data && typeof data === 'object') {
    _driverStatsSnapshot = data;
  }
};

export const peekDriverTripsSnapshot = () => (Array.isArray(_driverTripsSnapshot) ? _driverTripsSnapshot : []);
export const peekDriverStatsSnapshot = () => (_driverStatsSnapshot && typeof _driverStatsSnapshot === 'object' ? _driverStatsSnapshot : null);

export const getRealtimeNotificationFeed = () => (Array.isArray(_notificationFeed) ? [..._notificationFeed] : []);

const _emitRealtimeNotificationFeedChange = () => {
  _notificationFeedListeners.forEach((listener) => {
    try {
      listener(getRealtimeNotificationFeed());
    } catch {
      // Ignore listener errors to avoid breaking notification flow.
    }
  });
};

const _persistRealtimeNotificationFeed = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_FEED, JSON.stringify(_notificationFeed));
  } catch {
    // Ignore storage failures to avoid blocking app flow.
  }
};

export const getChatUnreadThreadsCount = () => Number(_chatUnreadThreadsCount || 0);

export const onChatUnreadThreadsCountChange = (listener) => {
  if (typeof listener !== 'function') {
    return () => { };
  }

  _chatUnreadThreadsListeners.add(listener);
  return () => {
    _chatUnreadThreadsListeners.delete(listener);
  };
};

export const updateChatUnreadThreadsCountFromThreads = (threads) => {
  const count = (Array.isArray(threads) ? threads : []).reduce(
    (sum, item) => sum + (Number(item?.myUnreadCount || 0) > 0 ? 1 : 0),
    0
  );
  _chatUnreadThreadsCount = count;
  _chatUnreadThreadsListeners.forEach((listener) => {
    try {
      listener(_chatUnreadThreadsCount);
    } catch {
      // Ignore listener errors to avoid breaking badge flow.
    }
  });
};

export const onRealtimeNotificationFeedChange = (listener) => {
  if (typeof listener !== 'function') {
    return () => { };
  }

  _notificationFeedListeners.add(listener);
  return () => {
    _notificationFeedListeners.delete(listener);
  };
};

export const appendRealtimeNotification = (payload) => {
  const notification = {
    id: String(payload?.id || `${payload?.type || 'EVENT'}:${payload?.referenceId || Date.now()}`),
    type: payload?.type || 'EVENT',
    title: payload?.title || 'Thông báo RideUp',
    message: payload?.message || 'Bạn có cập nhật mới.',
    referenceId: payload?.referenceId || null,
    createdAt: payload?.createdAt || new Date().toISOString(),
    read: false,
  };

  _notificationFeed = [notification, ..._notificationFeed.filter((item) => item?.id !== notification.id)].slice(0, 150);
  _emitRealtimeNotificationFeedChange();
  _persistRealtimeNotificationFeed();

  return notification;
};

export const markAllRealtimeNotificationsRead = () => {
  _notificationFeed = _notificationFeed.map((item) => ({ ...item, read: true }));
  _emitRealtimeNotificationFeedChange();
  _persistRealtimeNotificationFeed();
};

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

const _isRefreshableAuthError = (error) => {
  const status = error?.response?.status;
  const code = error?.response?.data?.code;
  const rawMessage = String(
    error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || ''
  ).toLowerCase();

  const hasTokenSignal = code === 1010 || /expired|revoked|jwt|token|unauthorized|forbidden|invalid token/.test(rawMessage);
  if (!hasTokenSignal) return false;

  return status === 400 || status === 401 || status === 403;
};

const _isAuthEndpoint = (url = '') => {
  const normalized = String(url || '').toLowerCase();
  return normalized.includes('/auth/authentication')
    || normalized.includes('/auth/register')
    || normalized.includes('/auth/refresh-token')
    || normalized.includes('/auth/logout');
};

const _refreshAccessToken = async () => {
  if (_refreshInFlight) {
    return _refreshInFlight;
  }

  if (!_refreshToken) {
    throw new Error('Missing refresh token');
  }

  _refreshInFlight = (async () => {
    const res = await axios.post(
      `${API_CONFIG.BASE_URL}/auth/refresh-token`,
      { refreshToken: _refreshToken },
      {
        timeout: API_CONFIG.TIMEOUT,
        headers: { Accept: 'application/json' },
      }
    );

    const data = res?.data?.result;
    if (!data?.token) {
      throw new Error('Refresh token response missing access token');
    }

    const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    const fallbackUser = storedUser ? JSON.parse(storedUser) : null;

    await _persistAuth(
      data.token,
      data.refreshToken || _refreshToken,
      data.user || fallbackUser,
    );

    return data.token;
  })().finally(() => {
    _refreshInFlight = null;
  });

  return _refreshInFlight;
};

export const onAuthExpired = (listener) => {
  if (typeof listener !== 'function') {
    return () => { };
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
  headers: { Accept: 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config?.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }
  return config;
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
    const originalRequest = error?.config || {};
    const alreadyRetried = originalRequest.__retriedWithRefresh === true;
    const canRefresh = _refreshToken && !alreadyRetried && !_isAuthEndpoint(originalRequest?.url);

    if (canRefresh && _isRefreshableAuthError(error)) {
      return _refreshAccessToken()
        .then((newToken) => {
          originalRequest.__retriedWithRefresh = true;
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${newToken}`,
          };
          return apiClient(originalRequest);
        })
        .catch(() => {
          if (_isTokenExpiredError(error) && !_isHandlingAuthExpiry) {
            _isHandlingAuthExpiry = true;
            clearStoredAuth()
              .catch(() => { })
              .finally(() => {
                _notifyAuthExpired('TOKEN_EXPIRED');
                _isHandlingAuthExpiry = false;
              });
            const authError = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            authError.code = 'AUTH_EXPIRED';
            return Promise.reject(authError);
          }
          return Promise.reject(error);
        });
    }

    if (_isTokenExpiredError(error) && !_isHandlingAuthExpiry) {
      _isHandlingAuthExpiry = true;
      clearStoredAuth()
        .catch(() => { })
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

const appendMultipartFile = async (formData, fieldName, { uri, name, type, file } = {}) => {
  const fallbackName = name || `upload_${Date.now()}.jpg`;
  const fallbackType = type || 'image/jpeg';

  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    formData.append(fieldName, file, fallbackName);
    return;
  }

  const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (isWeb) {
    if (!uri) {
      throw new Error('Không tìm thấy tệp để tải lên');
    }
    const response = await fetch(uri);
    const rawBlob = await response.blob();
    const blob = rawBlob.type === fallbackType
      ? rawBlob
      : rawBlob.slice(0, rawBlob.size, fallbackType);
    formData.append(fieldName, blob, fallbackName);
    return;
  }

  formData.append(fieldName, {
    uri,
    name: fallbackName,
    type: fallbackType,
  });
};

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

export const resolveStoragePublicUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }

  const base = String(STORAGE_CONFIG.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const bucket = String(STORAGE_CONFIG.SUPABASE_BUCKET || '').trim();
  if (!base || !bucket) {
    return raw;
  }

  const objectPath = raw.replace(/^\/+/, '');
  const encodedPath = objectPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  if (!encodedPath) {
    return '';
  }

  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
};

const _buildChatWebSocketUrl = () => {
  const base = String(API_CONFIG.BASE_URL || '').replace(/\/+$/, '');
  return `${base.replace(/^http/i, 'ws')}/ws`;
};

export const createChatRealtimeClient = ({ threadId, onMessage, onConnect, onError }) => {
  if (!threadId || USE_MOCK_DATA) {
    return {
      disconnect: () => { },
    };
  }

  const wsUrl = _buildChatWebSocketUrl();
  const client = new Client({
    webSocketFactory: () => new WebSocket(wsUrl),
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => { },
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

export const createUserNotificationRealtimeClient = ({ userId, onNotification, onConnect, onError }) => {
  if (!userId || USE_MOCK_DATA) {
    return {
      disconnect: () => { },
    };
  }

  const wsUrl = _buildChatWebSocketUrl();
  const client = new Client({
    webSocketFactory: () => new WebSocket(wsUrl),
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => { },
  });

  client.onConnect = () => {
    client.subscribe(`/topic/notifications.user.${userId}`, (frame) => {
      try {
        const payload = JSON.parse(frame.body);
        onNotification?.(payload);
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
    const [token, refresh, userStr, notificationFeedStr] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.USER),
      AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_FEED),
    ]);
    if (token) {
      _accessToken = token;
      _refreshToken = refresh;
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    if (notificationFeedStr) {
      try {
        const parsed = JSON.parse(notificationFeedStr);
        _notificationFeed = Array.isArray(parsed) ? parsed.slice(0, 150) : [];
      } catch {
        _notificationFeed = [];
      }
      _emitRealtimeNotificationFeedChange();
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
  _apiCache.clear();
  _notificationFeed = [];
  _emitRealtimeNotificationFeedChange();
  _chatUnreadThreadsCount = 0;
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.NOTIFICATION_FEED,
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

export const updateMyAvatar = async ({ uri, name, type }) => {
  if (!uri) {
    throw new Error('Không tìm thấy ảnh avatar để tải lên');
  }

  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    return { avatarUrl: uri || null };
  }

  const formData = new FormData();
  await appendMultipartFile(formData, 'file', {
    uri,
    name: name || `customer-avatar-${Date.now()}.jpg`,
    type: type || 'image/jpeg',
  });

  const res = await apiClient.put('/users/me/avatar', formData);

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

export const getMyPaymentSummary = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(400);
    return {
      defaultPaymentMethod: 'CASH',
      defaultPaymentMethodLabel: 'Tien mat',
      totalTrips: 0,
      completedTrips: 0,
      totalSpent: 0,
      unpaidBookings: 0,
      hasBankTransferHistory: false,
      hasCashHistory: true,
    };
  }
  const res = await apiClient.get('/users/me/quick/payment-summary');
  return unwrap(res) || {};
};

export const getMySecuritySummary = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(350);
    return {
      emailVerified: true,
      hasPhoneNumber: true,
      hasAvatar: false,
      profileCompletion: 80,
      recommendations: ['Them anh dai dien de tang do tin cay.'],
    };
  }
  const res = await apiClient.get('/users/me/quick/security-summary');
  return unwrap(res) || {};
};

export const getMyOffers = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(350);
    return [
      {
        code: 'WELCOME10',
        title: 'Giảm 10% chuyến kế tiếp',
        description: 'Áp dụng cho chuyến đầu tháng, tối đa 30.000đ.',
        active: true,
      },
    ];
  }
  const res = await apiClient.get('/users/me/quick/offers');
  return unwrap(res) || [];
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
export const getDriverTrips = async (options = {}) => {
  const force = options?.force === true;
  if (USE_MOCK_DATA) {
    await mockApiDelay();
    _rememberDriverTripsSnapshot(MOCK_DRIVER_TRIPS);
    return MOCK_DRIVER_TRIPS;
  }

  if (force) {
    _apiCache.delete(DRIVER_TRIPS_CACHE_KEY);
  }

  const trips = await getCached(DRIVER_TRIPS_CACHE_KEY, API_CACHE_TTL.DRIVER_TRIPS, async () => {
    const res = await apiClient.get('/driver/trips');
    return res.data;
  });

  _rememberDriverTripsSnapshot(trips);
  return trips;
};

export const getDriverTripDetail = async (tripId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    const trip = MOCK_DRIVER_TRIPS.find((item) => item.id === tripId);
    if (!trip) {
      throw new Error('Không tìm thấy chuyến xe');
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
export const getDriverStats = async (options = {}) => {
  const force = options?.force === true;
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    _rememberDriverStatsSnapshot(MOCK_DRIVER_STATS);
    return MOCK_DRIVER_STATS;
  }

  if (force) {
    _apiCache.delete(DRIVER_STATS_CACHE_KEY);
  }

  const stats = await getCached(DRIVER_STATS_CACHE_KEY, API_CACHE_TTL.DRIVER_STATS, async () => {
    const res = await apiClient.get('/driver/stats');
    return res.data;
  });

  _rememberDriverStatsSnapshot(stats);
  return stats;
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
  return getCached('DRIVER_PROFILE:ME', API_CACHE_TTL.DRIVER_PROFILE, async () => {
    const res = await apiClient.get('/driver/profile');
    return res.data;
  });
};

/** Cập nhật hồ sơ tài xế */
export const updateDriverProfile = async (payload) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(800);
    return { ...payload, updatedAt: new Date().toISOString() };
  }
  const res = await apiClient.put('/driver/profile', payload);
  invalidateCacheByPrefix('DRIVER_PROFILE:');
  return res.data;
};

export const submitDriverProfile = async (payload) => {
  const res = await apiClient.post('/driver/profile/submit', payload || {});
  invalidateCacheByPrefix('DRIVER_PROFILE:');
  return res.data;
};

export const uploadFile = async ({ uri, name, type, file }) => {
  if (!uri && !file) {
    throw new Error('Không tìm thấy tệp để tải lên');
  }

  const formData = new FormData();
  const fallbackName = name || `upload_${Date.now()}.jpg`;
  const fallbackType = type || 'image/jpeg';
  const isWebRuntime = typeof window !== 'undefined' && typeof document !== 'undefined';

  if (isWebRuntime) {
    if (file instanceof File || file instanceof Blob) {
      const blobType = file.type || fallbackType;
      const blobName = file.name || fallbackName;
      formData.append('file', file, blobName);
      if (!type) {
        type = blobType;
      }
    } else if (uri) {
      const response = await fetch(uri);
      const blob = await response.blob();
      formData.append('file', blob, fallbackName);
    }
  } else {
    formData.append('file', {
      uri,
      name: fallbackName,
      type: fallbackType,
    });
  }
  await appendMultipartFile(formData, 'file', {
    uri,
    name: name || `upload_${Date.now()}.jpg`,
    type: type || 'image/jpeg',
  });

  const res = await apiClient.post('/file/upload', formData);

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
  invalidateCacheByPrefix('DRIVER_TRIPS:');
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
  invalidateCacheByPrefix('DRIVER_TRIPS:');
  return res.data;
};

export const startDriverTrip = async (tripId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(600);
    return { id: tripId, status: 'ongoing' };
  }
  const res = await apiClient.put(`/driver/trips/${tripId}/start`);
  invalidateCacheByPrefix('DRIVER_TRIPS:');
  return res.data;
};

export const completeDriverTrip = async (tripId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(600);
    return { id: tripId, status: 'completed' };
  }
  const res = await apiClient.put(`/driver/trips/${tripId}/complete`);
  invalidateCacheByPrefix('DRIVER_TRIPS:');
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
export const searchRides = async ({ from, to, date, status = 'OPEN', page = 0, size = 20 }) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(1000);
    return MOCK_AVAILABLE_RIDES;
  }
  const res = await apiClient.get('/rides/search', {
    params: {
      fromProvinceId: from,
      toProvinceId: to,
      departureDate: date,
      status,
      page,
      size,
    },
  });
  return res.data?.result ?? res.data;
};

/** Tìm chuyến xe theo tỉnh/phường + ngày */
export const searchRidesAdvanced = async ({
  fromProvinceId,
  toProvinceId,
  fromWardId,
  toWardId,
  departureDate,
  status = 'OPEN',
  page = 0,
  size = 20,
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
      status,
      page,
      size,
    },
  });
  return res.data?.result ?? res.data;
};

/** Dán văn bản để AI phân tích tiêu chí tìm chuyến */
export const searchRidesFromText = async (queryText) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(800);
    return {
      queryText,
      confidence: 0.88,
      needsClarification: false,
      clarificationQuestions: [],
      criteria: {
        fromProvinceId: null,
        fromProvinceName: 'Hà Nội',
        fromWardId: null,
        fromWardName: null,
        toProvinceId: null,
        toProvinceName: 'Hải Phòng',
        toWardId: null,
        toWardName: null,
        departureDate: null,
        seatCount: 1,
        maxPrice: null,
      },
      rides: MOCK_AVAILABLE_RIDES,
    };
  }
  const res = await apiClient.post('/rides/search-from-text', { queryText });
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

/** Hủy booking của khách hàng */
export const cancelCustomerBooking = async (bookingId, cancellationReason) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    return { id: bookingId, status: 'cancelled', cancellationReason: cancellationReason || null };
  }
  const payload = String(cancellationReason || '').trim()
    ? { cancellationReason: String(cancellationReason).trim() }
    : {};
  const res = await apiClient.post(`/customer/bookings/${bookingId}/cancel`, payload);
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
export const supportChat = async (message, history = []) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(500);
    return {
      intent: 'FAQ',
      reply: 'Đây là phản hồi mock. Bạn có thể hỏi về hủy chuyến, thanh toán, kiểm tra booking gần nhất.',
      suggestions: ['Kiểm tra booking gần nhất', 'Tôi muốn hủy chuyến'],
    };
  }
  const cleanedHistory = Array.isArray(history)
    ? history
      .filter((h) => h && h.role && h.text)
      .slice(-5)
      .map((h) => ({ role: h.role, text: h.text }))
    : [];

  const res = await apiClient.post('/support/chat', { message, history: cleanedHistory });
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
  const res = await apiClient.post('/chat/threads/open', { bookingId }, {
    timeout: CHAT_REQUEST_TIMEOUT,
  });
  return res.data?.result ?? res.data;
};

/** Lấy danh sách phòng chat của user hiện tại */
export const getMyChatThreads = async () => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(400);
    updateChatUnreadThreadsCountFromThreads([]);
    return [];
  }
  return getCached('CHAT_THREADS:ME', API_CACHE_TTL.CHAT_THREADS, async () => {
    const res = await apiClient.get('/chat/threads', {
      timeout: CHAT_REQUEST_TIMEOUT,
    });
    const rows = res.data?.result ?? res.data;
    updateChatUnreadThreadsCountFromThreads(rows);
    return rows;
  });
};

/** Lấy tin nhắn của một phòng chat */
export const getChatMessages = async (threadId, limit = 50) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(400);
    return [];
  }
  const res = await apiClient.get(`/chat/threads/${threadId}/messages`, {
    params: { limit },
    timeout: CHAT_REQUEST_TIMEOUT,
  });
  return res.data?.result ?? res.data;
};

/** Gửi tin nhắn chat (text/image) */
export const sendChatMessage = async (threadId, payload) => {
  const requestBody = typeof payload === 'string'
    ? { content: payload }
    : {
      content: payload?.content ?? null,
      imageUrl: payload?.imageUrl ?? null,
      type: payload?.type ?? null,
    };

  if (!requestBody.content && !requestBody.imageUrl) {
    throw new Error('Tin nhắn không hợp lệ');
  }

  if (USE_MOCK_DATA) {
    await mockApiDelay(300);
    return {
      id: `msg_${Date.now()}`,
      threadId,
      content: requestBody.content,
      imageUrl: requestBody.imageUrl,
      type: requestBody.imageUrl ? 'IMAGE' : 'TEXT',
      mine: true,
      sentAt: new Date().toISOString(),
    };
  }
  const res = await apiClient.post(`/chat/threads/${threadId}/messages`, requestBody, {
    timeout: CHAT_REQUEST_TIMEOUT,
  });
  invalidateCacheByPrefix('CHAT_THREADS:');
  return res.data?.result ?? res.data;
};

/** Đánh dấu đã đọc phòng chat */
export const markChatThreadRead = async (threadId) => {
  if (USE_MOCK_DATA) {
    await mockApiDelay(250);
    return { id: threadId, myUnreadCount: 0 };
  }
  const res = await apiClient.post(`/chat/threads/${threadId}/read`, undefined, {
    timeout: CHAT_REQUEST_TIMEOUT,
  });
  invalidateCacheByPrefix('CHAT_THREADS:');
  return res.data?.result ?? res.data;
};

export const prefetchDriverBootstrapData = async (options = {}) => {
  if (USE_MOCK_DATA) {
    return;
  }

  const force = options?.force === true;

  await Promise.allSettled([
    getDriverTrips({ force }),
    getDriverStats({ force }),
    getDriverProfile(),
    getMyChatThreads(),
  ]);
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
