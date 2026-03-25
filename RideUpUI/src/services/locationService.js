// ============================================================
// LOCATION SERVICE — 2 cấp: Tỉnh/TP → Xã/Phường
// Nguồn dữ liệu: Backend DB (province + ward)
// Fallback: static list nếu DB chưa có dữ liệu
// ============================================================

import { API_CONFIG } from '../config/config';

const BASE = API_CONFIG.BASE_URL;

// ── In-memory cache ──────────────────────────────────────────
const _cache = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 phút

const _get = async (url) => {
  const now = Date.now();
  if (_cache[url] && now - _cache[url].ts < CACHE_TTL) return _cache[url].data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // unwrap ApiResponse { code, result, count }
    const data = json.result ?? json;
    _cache[url] = { data, ts: now };
    return data;
  } finally {
    clearTimeout(timer);
  }
};

// ── Fallback tĩnh (34 tỉnh/TP sau cải cách 2025) ─────────────
const FALLBACK_PROVINCES = [
  { id: null, name: 'Hà Nội',           lat: 21.0285,  lng: 105.8542 },
  { id: null, name: 'TP. Hồ Chí Minh', lat: 10.8231,  lng: 106.6297 },
  { id: null, name: 'Hải Phòng',        lat: 20.8449,  lng: 106.6881 },
  { id: null, name: 'Đà Nẵng',          lat: 16.0471,  lng: 108.2068 },
  { id: null, name: 'Cần Thơ',          lat: 10.0452,  lng: 105.7469 },
  { id: null, name: 'Huế',              lat: 16.4637,  lng: 107.5908 },
  { id: null, name: 'An Giang',         lat: 10.5216,  lng: 105.1259 },
  { id: null, name: 'Bắc Ninh',         lat: 21.1861,  lng: 106.0763 },
  { id: null, name: 'Cà Mau',           lat: 9.1769,   lng: 105.1504 },
  { id: null, name: 'Cao Bằng',         lat: 22.6657,  lng: 106.2522 },
  { id: null, name: 'Điện Biên',        lat: 21.3860,  lng: 103.0230 },
  { id: null, name: 'Đắk Lắk',         lat: 12.7100,  lng: 108.2378 },
  { id: null, name: 'Đồng Nai',         lat: 10.9455,  lng: 106.8246 },
  { id: null, name: 'Đồng Tháp',        lat: 10.4938,  lng: 105.6882 },
  { id: null, name: 'Gia Lai',          lat: 13.9833,  lng: 108.0000 },
  { id: null, name: 'Hà Tĩnh',         lat: 18.3559,  lng: 105.8877 },
  { id: null, name: 'Hưng Yên',         lat: 20.6464,  lng: 106.0511 },
  { id: null, name: 'Khánh Hòa',        lat: 12.2388,  lng: 109.1967 },
  { id: null, name: 'Lai Châu',         lat: 22.3964,  lng: 103.4319 },
  { id: null, name: 'Lâm Đồng',         lat: 11.9465,  lng: 108.4419 },
  { id: null, name: 'Lạng Sơn',         lat: 21.8537,  lng: 106.7614 },
  { id: null, name: 'Lào Cai',          lat: 22.4856,  lng: 103.9753 },
  { id: null, name: 'Nghệ An',          lat: 19.2342,  lng: 104.9200 },
  { id: null, name: 'Ninh Bình',        lat: 20.2506,  lng: 105.9745 },
  { id: null, name: 'Phú Thọ',          lat: 21.3432,  lng: 105.2016 },
  { id: null, name: 'Quảng Ngãi',       lat: 15.1214,  lng: 108.8047 },
  { id: null, name: 'Quảng Ninh',       lat: 21.0064,  lng: 107.2925 },
  { id: null, name: 'Quảng Trị',        lat: 16.7403,  lng: 107.1854 },
  { id: null, name: 'Sơn La',           lat: 21.3256,  lng: 103.9188 },
  { id: null, name: 'Tây Ninh',         lat: 11.3352,  lng: 106.1099 },
  { id: null, name: 'Thái Nguyên',      lat: 21.5942,  lng: 105.8482 },
  { id: null, name: 'Thanh Hóa',        lat: 19.8079,  lng: 105.7764 },
  { id: null, name: 'Tuyên Quang',      lat: 21.8232,  lng: 105.2140 },
  { id: null, name: 'Vĩnh Long',        lat: 10.2397,  lng: 105.9571 },
];

/**
 * Lấy danh sách tỉnh/TP từ backend DB.
 * Fallback sang static list nếu DB chưa có dữ liệu.
 * @returns {Promise<Array<{id, name, lat, lng}>>}
 */
export const fetchProvinces = async () => {
  try {
    const data = await _get(`${BASE}/api/locations/provinces`);
    if (Array.isArray(data) && data.length > 0) return data;
  } catch (e) {
    console.warn('[locationService] fetchProvinces fallback:', e.message);
  }
  return FALLBACK_PROVINCES;
};

/**
 * Lấy danh sách tỉnh/TP bắt buộc từ DB (không fallback tĩnh).
 * Dùng cho các luồng cần provinceId thật để query xã/phường.
 * @returns {Promise<Array<{id, name, lat, lng}>>}
 */
export const fetchProvincesFromDb = async () => {
  try {
    const data = await _get(`${BASE}/api/locations/provinces`);
    if (Array.isArray(data)) {
      return data.filter((p) => p && p.id != null);
    }
  } catch (e) {
    console.warn('[locationService] fetchProvincesFromDb error:', e.message);
  }
  return [];
};

/**
 * Lấy danh sách xã/phường theo tỉnh từ backend DB.
 * @param {string} provinceId - id của tỉnh (từ DB)
 * @param {string} [q]        - từ khóa tìm kiếm
 * @returns {Promise<Array<{id, name, lat, lng, provinceId, provinceName}>>}
 */
export const fetchWards = async (provinceId, q = '') => {
  if (!provinceId) return [];
  try {
    const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    const data = await _get(`${BASE}/api/locations/provinces/${provinceId}/wards${params}`);
    if (Array.isArray(data)) return data;
  } catch (e) {
    console.warn('[locationService] fetchWards error:', e.message);
  }
  return [];
};

/**
 * Tìm xã/phường theo từ khóa trong tỉnh — dùng cho ClusterInput.
 * @param {string} query      - từ khóa (>= 2 ký tự)
 * @param {string} provinceId - id của tỉnh
 * @returns {Promise<Array<{id, name, lat, lng}>>}
 */
export const searchCommunes = async (query, provinceId = '') => {
  if (!provinceId) return [];
  const q = (query || '').trim();
  return fetchWards(provinceId, q);
};

// Alias backward-compat
export const searchDistricts = searchCommunes;

/**
 * Lọc danh sách tỉnh theo từ khóa (client-side).
 */
export const filterProvinces = (list = FALLBACK_PROVINCES, query = '') => {
  if (!query.trim()) return list;
  const q = query.toLowerCase();
  return list.filter((p) => p.name.toLowerCase().includes(q));
};

// Export tên tỉnh thuần
export const VIETNAM_PROVINCES = FALLBACK_PROVINCES.map((p) => p.name);
