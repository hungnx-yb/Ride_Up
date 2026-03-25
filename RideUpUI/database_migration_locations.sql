-- ============================================================
-- MIGRATION: RideUp Database - Schema địa điểm & routing
-- Province → District (2 cấp) + GPS Tracking + Booking
-- Ngày: 2026-03-04
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │ 1. PROVINCE (Tỉnh/Thành phố) - Cấp 1                   │
-- └──────────────────────────────────────────────────────────┘
ALTER TABLE `province`
  ADD COLUMN `lat` DECIMAL(10, 7) NULL COMMENT 'Vĩ độ trung tâm (từ Overpass API)',
  ADD COLUMN `lng` DECIMAL(10, 7) NULL COMMENT 'Kinh độ trung tâm',
  ADD COLUMN `osm_id` BIGINT NULL COMMENT 'OpenStreetMap ID';

-- ┌──────────────────────────────────────────────────────────┐
-- │ 2. DISTRICT (Xã/Phường/Quận/Huyện) - Cấp 2             │
-- │    District ở đây bao gồm TẤT CẢ: xã, phường, quận, huyện│
-- └──────────────────────────────────────────────────────────┘
ALTER TABLE `district`
  ADD COLUMN `lat` DECIMAL(10, 7) NULL COMMENT 'Vĩ độ',
  ADD COLUMN `lng` DECIMAL(10, 7) NULL COMMENT 'Kinh độ',
  ADD COLUMN `osm_id` BIGINT NULL COMMENT 'OpenStreetMap ID',
  ADD COLUMN `display_name` TEXT NULL COMMENT 'Tên đầy đủ từ OSM (VD: "Quận 1, TP.HCM, VN")';

-- ┌──────────────────────────────────────────────────────────┐
-- │ 3. TRIP_PICKUP_POINT (Điểm đón)                         │
-- └──────────────────────────────────────────────────────────┘
ALTER TABLE `trip_pickup_point`
  ADD COLUMN `lat` DECIMAL(10, 7) NULL COMMENT 'Vĩ độ điểm đón',
  ADD COLUMN `lng` DECIMAL(10, 7) NULL COMMENT 'Kinh độ điểm đón';

-- ┌──────────────────────────────────────────────────────────┐
-- │ 4. TRIP_DROPOFF_POINT (Điểm trả)                        │
-- └──────────────────────────────────────────────────────────┘
ALTER TABLE `trip_dropoff_point`
  ADD COLUMN `lat` DECIMAL(10, 7) NULL COMMENT 'Vĩ độ điểm trả',
  ADD COLUMN `lng` DECIMAL(10, 7) NULL COMMENT 'Kinh độ điểm trả';

-- ┌──────────────────────────────────────────────────────────┐
-- │ 5. TRIP (Lưu lịch sử tuyến đường)                       │
-- └──────────────────────────────────────────────────────────┘
ALTER TABLE `trip`
  ADD COLUMN `actual_route_polyline` TEXT COMMENT 'Tuyến đường thực tế đã đi (khi COMPLETED)',
  ADD COLUMN `actual_departure_time` DATETIME(6) COMMENT 'Thời gian xuất phát thực tế',
  ADD COLUMN `actual_arrival_time` DATETIME(6) COMMENT 'Thời gian kết thúc thực tế',
  ADD COLUMN `total_distance_km` DECIMAL(10, 2) COMMENT 'Tổng km đã đi',
  ADD COLUMN `completed_at` DATETIME(6) COMMENT 'Thời điểm hoàn thành chuyến';

-- route_polyline cũ giữ nguyên = tuyến dự định ban đầu

-- ┌──────────────────────────────────────────────────────────┐
-- │ 6. GPS_TRACKING (Lưu GPS theo thời gian thực)           │
-- │    Dùng để vẽ lại lịch sử tuyến đường chi tiết          │
-- └──────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS `gps_tracking` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `trip_id` VARCHAR(255) NOT NULL,
  `lat` DECIMAL(10, 7) NOT NULL COMMENT 'Vĩ độ',
  `lng` DECIMAL(10, 7) NOT NULL COMMENT 'Kinh độ',
  `speed_kmh` DECIMAL(5, 2) COMMENT 'Tốc độ (km/h)',
  `heading` DECIMAL(5, 2) COMMENT 'Hướng di chuyển (0-360°)',
  `recorded_at` DATETIME(6) NOT NULL COMMENT 'Thời điểm ghi nhận GPS',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Lưu GPS tracking của xe trong chuyến đi - ghi mỗi 30s-1 phút';

-- ┌──────────────────────────────────────────────────────────┐
-- │ 7. TRIP_STOP_LOG (Log thực tế điểm dừng)                │
-- │    Lưu thời gian đến/rời khỏi từng điểm dừng            │
-- └──────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS `trip_stop_log` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `trip_id` VARCHAR(255) NOT NULL,
  `stop_type` ENUM('PICKUP', 'DROPOFF') NOT NULL,
  `point_id` VARCHAR(255) NOT NULL COMMENT 'ID của pickup_point hoặc dropoff_point',
  `address` VARCHAR(255),
  `lat` DECIMAL(10, 7),
  `lng` DECIMAL(10, 7),
  `planned_time` TIME(6) COMMENT 'Giờ dự định',
  `actual_arrival_time` DATETIME(6) COMMENT 'Giờ đến thực tế',
  `actual_departure_time` DATETIME(6) COMMENT 'Giờ rời đi thực tế',
  `delay_minutes` INT COMMENT 'Số phút trễ/sớm (âm = sớm, dương = trễ)',
  `passengers_count` INT COMMENT 'Số khách đón/trả tại điểm này',
  `note` TEXT COMMENT 'Ghi chú (nếu có)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Log thực tế từng điểm dừng - so sánh planned vs actual';

-- ┌──────────────────────────────────────────────────────────┐
-- │ 8. INSERT DỮ LIỆU MẪU (5 tỉnh/TP lớn)                   │
-- └──────────────────────────────────────────────────────────┘
INSERT INTO `province` (`id`, `code`, `name`, `lat`, `lng`)
VALUES
  (UUID(), 'HN', 'Hà Nội', 21.0285, 105.8542),
  (UUID(), 'HCM', 'TP. Hồ Chí Minh', 10.8231, 106.6297),
  (UUID(), 'DN', 'Đà Nẵng', 16.0471, 108.2068),
  (UUID(), 'HP', 'Hải Phòng', 20.8449, 106.6881),
  (UUID(), 'CT', 'Cần Thơ', 10.0452, 105.7469)
ON DUPLICATE KEY UPDATE 
  lat = VALUES(lat),
  lng = VALUES(lng);

-- ============================================================
-- HƯỚNG DẪN SỬ DỤNG
-- ============================================================
/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CẤU TRÚC DB (2 CẤP HÀNH CHÍNH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PROVINCE (Tỉnh/Thành phố)
   - id, code, name
   - lat, lng, osm_id  ← Tọa độ trung tâm

2. DISTRICT (Xã/Phường/Quận/Huyện) 
   - id, code, name, province_id
   - lat, lng, osm_id, display_name  ← Tọa độ

3. TRIP_PICKUP_POINT / TRIP_DROPOFF_POINT
   - address, district_id
   - lat, lng  ← Tọa độ chính xác điểm dừng
   
4. TRIP (Chuyến xe)
   - route_polyline             ← Tuyến dự định (khi tạo)
   - actual_route_polyline      ← Tuyến thực tế (sau khi chạy xong)
   - actual_departure_time      ← Giờ xuất phát thực tế
   - actual_arrival_time        ← Giờ kết thúc thực tế
   - total_distance_km          ← Tổng km
   - completed_at               ← Thời điểm hoàn thành

5. GPS_TRACKING
   - trip_id, lat, lng, speed_kmh, heading
   - recorded_at  ← Ghi mỗi 30s-1 phút trong lúc chạy
   
6. TRIP_STOP_LOG
   - trip_id, stop_type (PICKUP/DROPOFF)
   - planned_time vs actual_arrival_time
   - delay_minutes, passengers_count

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 FLOW LƯU LỊCH SỬ TUYẾN ĐƯỜNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A. KHI TẠO CHUYẾN (status = OPEN):
   1. Lưu route_polyline (tuyến dự định)
   2. Tạo trip_pickup_point + trip_dropoff_point với lat/lng
   3. Mỗi điểm có district_id link tới district

B. TRONG CHUYẾN ĐI (status = IN_PROGRESS):
   1. App mobile gọi API mỗi 30s-1 phút:
      POST /api/trips/{tripId}/gps
      Body: { lat, lng, speed, heading, recordedAt }
      → INSERT INTO gps_tracking
   
   2. Khi đến điểm dừng, tài xế bấm "Đã đến":
      POST /api/trips/{tripId}/stops/arrive
      Body: { pointId, stopType, actualTime }
      → INSERT INTO trip_stop_log (actual_arrival_time)
   
   3. Khi rời điểm dừng, tài xế bấm "Xuất phát":
      POST /api/trips/{tripId}/stops/depart
      Body: { pointId, passengersCount }
      → UPDATE trip_stop_log SET actual_departure_time, passengers_count

C. KHI HOÀN THÀNH (status = COMPLETED):
   1. Backend tự động:
      - Lấy tất cả GPS tracking → tạo actual_route_polyline
      - Tính total_distance_km từ GPS points
      - SET completed_at = NOW()
   
   2. UPDATE trip SET:
      actual_route_polyline = <polyline từ GPS>,
      actual_departure_time = <GPS đầu tiên>,
      actual_arrival_time = <GPS cuối cùng>,
      total_distance_km = <tính từ GPS>,
      completed_at = NOW()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 API CẦN TẠO BACKEND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Địa điểm:
   GET  /api/provinces
        → SELECT id, code, name, lat, lng FROM province
   
   GET  /api/districts?provinceId={id}
        → SELECT * FROM district WHERE province_id = ?
   
   POST /api/districts/sync
        → Cào dữ liệu từ OSM Nominatim và lưu vào DB

2. GPS Tracking:
   POST /api/trips/{tripId}/gps
        Body: { lat, lng, speed, heading, recordedAt }
        → INSERT INTO gps_tracking
   
   GET  /api/trips/{tripId}/gps
        → SELECT * FROM gps_tracking WHERE trip_id = ? ORDER BY recorded_at

3. Điểm dừng:
   POST /api/trips/{tripId}/stops/arrive
        Body: { pointId, stopType, actualTime }
   
   POST /api/trips/{tripId}/stops/depart
        Body: { pointId, passengersCount }
   
   GET  /api/trips/{tripId}/stops/logs
        → SELECT * FROM trip_stop_log WHERE trip_id = ?

4. Lịch sử chuyến:
   GET  /api/trips/{tripId}/history
        Response: {
          trip: {...},
          plannedRoute: [[lat, lng], ...],
          actualRoute: [[lat, lng], ...],
          stops: [...],
          stats: { totalKm, duration, avgSpeed }
        }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 CÀO DỮ LIỆU TỪ API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Sync tỉnh/TP từ Overpass API:
   Query: 
   [out:json];
   area["ISO3166-1"="VN"][admin_level=2];
   rel(area)["admin_level"="4"]["boundary"="administrative"];
   out tags center;
   
   Response mapping:
   - el.tags.name            → province.name
   - el.center.lat           → province.lat
   - el.center.lon           → province.lng
   - el.id                   → province.osm_id

2. Sync district từ OSM Nominatim:
   URL: https://nominatim.openstreetmap.org/search
   Params: 
   - q: "{district_name}, {province_name}, Việt Nam"
   - format: json
   - countrycodes: vn
   - limit: 8
   
   Response mapping:
   - item.lat                → district.lat
   - item.lon                → district.lng
   - item.osm_id             → district.osm_id
   - item.display_name       → district.display_name

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 UI MOBILE CẬP NHẬT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CreateTripScreen.js:
   - Khi chọn địa điểm → lưu lat/lng
   - Khi submit → gửi cả tọa độ lên backend

2. DriverHomeScreen.js (trong chuyến):
   - Tracking GPS mỗi 30s-1 phút
   - Gửi lên backend via API

3. AllTripsScreen.js (xem lịch sử):
   - Hiển thị bản đồ với 2 routes:
     * Planned (nét đứt)
     * Actual (nét liền)
   - Hiển thị điểm dừng với thời gian thực tế

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STORAGE DỰ KIẾN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Province (63 tỉnh/TP):              ~5 KB
- District (~11,000 xã/phường):       ~500 KB
- GPS tracking (1 chuyến ~120 điểm):  ~10 KB/chuyến
- Trip stop logs:                     ~1 KB/chuyến

→ 100 chuyến = ~1.1 MB
→ 1000 chuyến = ~11 MB
→ Dễ dàng scale

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
