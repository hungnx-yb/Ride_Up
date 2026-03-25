SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE `province`
  ADD COLUMN `lat`    DECIMAL(10, 7) NULL ,
  ADD COLUMN `lng`    DECIMAL(10, 7) NULL ,
  ADD COLUMN `osm_id` BIGINT         NULL ;

-- ----------------------------------------------------------
-- 2. DISTRICT -> WARD
--    Đổi tên bảng, thêm tọa độ (dữ liệu từ Nominatim)
--    Dùng làm vùng đón/trả do tài xế quy định
-- ----------------------------------------------------------
RENAME TABLE `district` TO `ward`;

ALTER TABLE `ward`
  ADD COLUMN `lat`          DECIMAL(10, 7) NULL ,
  ADD COLUMN `lng`          DECIMAL(10, 7) NULL ,
  ADD COLUMN `osm_id`       BIGINT         NULL ,
  ADD COLUMN `display_name` VARCHAR(500)   NULL ;

-- NOTE: Sau RENAME, các FK sau vẫn hoạt động đúng (MySQL tự cập nhật):
--   trip_pickup_point.district_id  → ward(id)
--   trip_dropoff_point.district_id → ward(id)

-- ----------------------------------------------------------
-- 3. TRIP - Thêm province liên kết và dữ liệu route
-- ----------------------------------------------------------
ALTER TABLE `trip`
  -- Dự kiến: tính từ routing API khi driver tạo trip (dùng lat/lng trung tâm ward)
  ADD COLUMN `estimated_distance_km`      DECIMAL(10, 2) NULL,
  ADD COLUMN `estimated_duration_minutes` INT            NULL,

  -- Thực tế: cập nhật khi trip hoàn thành
  ADD COLUMN `actual_departure_time`      DATETIME(6)    NULL   ,
  ADD COLUMN `actual_arrival_time`        DATETIME(6)    NULL ,
  ADD COLUMN `actual_distance_km`         DECIMAL(10, 2) NULL,
  ADD COLUMN `actual_route_polyline`      TEXT           NULL ,
  ADD COLUMN `completed_at`              DATETIME(6)    NULL ;
  -- Tỉnh truy ngược qua: trip_pickup_point.district_id → ward.province_id → province

-- route_polyline (đã có sẵn) = polyline dự kiến, tính khi driver tạo trip

-- ----------------------------------------------------------
-- 4. TRIP_PICKUP_POINT - GIỮ NGUYÊN (cấu trúc đã đúng)
--    district_id -> ward: vùng đón do tài xế quy định
--    address: mô tả điểm gặp (vd: "Trước cổng Big C")
--    pickup_time, sort_order: thứ tự và giờ đón dự kiến
--    lat/lng của vùng -> JOIN qua ward.lat, ward.lng
-- ----------------------------------------------------------
-- (Không ALTER - cấu trúc đã chuẩn)

-- ----------------------------------------------------------
-- 5. TRIP_DROPOFF_POINT - GIỮ NGUYÊN (cấu trúc đã đúng)
--    Tương tự trip_pickup_point
-- ----------------------------------------------------------
-- (Không ALTER - cấu trúc đã chuẩn)

-- ----------------------------------------------------------
-- 6. BOOKING - Chỉ thêm analytics fields
--
--  ĐÃ CÓ SẴN trong DB gốc (KHÔNG ALTER LẠI):
--    pickup_address    VARCHAR(255) -> địa chỉ cụ thể
--    pickup_lat        DOUBLE       -> INPUT routing API
--    pickup_lng        DOUBLE       -> INPUT routing API
--    dropoff_address   VARCHAR(255)
--    dropoff_lat       DOUBLE       -> INPUT routing API
--    dropoff_lng       DOUBLE       -> INPUT routing API
--    pickup_point_id   -> trip_pickup_point  (vùng ward)
--    dropoff_point_id  -> trip_dropoff_point (vùng ward)
-- ----------------------------------------------------------
ALTER TABLE `booking`
  ADD COLUMN `distance_km`         DECIMAL(10, 2) NULL COMMENT 'Km pickup→dropoff của khách (từ Routing API)',
  ADD COLUMN `confirmed_at`        DATETIME(6)    NULL COMMENT 'Thời điểm chuyển sang CONFIRMED',
  ADD COLUMN `cancelled_at`        DATETIME(6)    NULL COMMENT 'Thời điểm chuyển sang CANCELLED',
  ADD COLUMN `cancellation_reason` TEXT           NULL COMMENT 'Lý do hủy',
  ADD COLUMN `completed_at`        DATETIME(6)    NULL COMMENT 'Thời điểm chuyển sang COMPLETED';

-- ----------------------------------------------------------
-- 7. GPS_TRACKING (bảng mới)
--    Lưu vết GPS driver trong chuyến - mỗi 30s-1 phút
--    Dùng để ghép actual_route_polyline sau khi trip xong
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gps_tracking` (
  `id`          VARCHAR(255)   NOT NULL,
  `trip_id`     VARCHAR(255)   NOT NULL,
  `lat`         DECIMAL(10, 7) NOT NULL COMMENT 'Vĩ độ',
  `lng`         DECIMAL(10, 7) NOT NULL COMMENT 'Kinh độ',
  `speed_kmh`   DECIMAL(5, 2)  NULL     COMMENT 'Tốc độ (km/h)',
  `heading`     DECIMAL(5, 2)  NULL     COMMENT 'Hướng 0–360°',
  `accuracy_m`  DECIMAL(6, 2)  NULL     COMMENT 'Độ chính xác GPS (m)',
  `recorded_at` DATETIME(6)    NOT NULL COMMENT 'Thời điểm ghi (thiết bị driver)',
  `created_at`  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_gps_trip` FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Vết GPS driver - ghi mỗi 30s khi trip = IN_PROGRESS';

SET FOREIGN_KEY_CHECKS=1;

-- ============================================================
-- TỔNG KẾT
-- ============================================================
/*
SCHEMA SAU MIGRATION:

  province (id, code, name, lat, lng, osm_id)
      │
      └─ ward (id, code, name, province_id, lat, lng, osm_id, display_name)
              │
              ├─ trip_pickup_point  (id, trip_id, district_id→ward, address, pickup_time, sort_order)
              └─ trip_dropoff_point (id, trip_id, district_id→ward, address, dropoff_time, sort_order)
                          │
  trip (id, driver_id, departure_time, status,         booking (id, trip_id, customer_id,
        route_polyline,                                          pickup_point_id → trip_pickup_point,
        estimated_distance_km,                                   dropoff_point_id → trip_dropoff_point,
        estimated_duration_minutes,                              pickup_address, pickup_lat, pickup_lng,
        actual_departure_time,                                   dropoff_address, dropoff_lat, dropoff_lng,
        actual_arrival_time,                                     distance_km, seat_count, total_price,
        actual_distance_km,                                      status, confirmed_at, cancelled_at,
        actual_route_polyline,                                   cancellation_reason, completed_at)
        completed_at)
      │
      └─ gps_tracking (id, trip_id, lat, lng, speed_kmh, heading, accuracy_m, recorded_at)

LUỒNG DỮ LIỆU:

① CÀO DỮ LIỆU ĐỊA CHỈ (1 lần, chạy nền - backend):
   Overpass API → province.name, lat, lng, osm_id
   Nominatim    → ward.name, display_name, lat, lng, osm_id  (province_id = FK)

② DRIVER TẠO TRIP:
   Chọn VÙNG đón (ward)     → trip_pickup_point.district_id = ward.id
                               trip_pickup_point.address = mô tả thêm (tuỳ chọn)
   Chọn VÙNG trả (ward)     → trip_dropoff_point.district_id = ward.id
   Routing qua ward.lat/lng → trip.estimated_distance_km, estimated_duration_minutes
                             → trip.route_polyline (dự kiến)

③ CUSTOMER ĐẶT BOOKING:
   Chọn vùng đón            → booking.pickup_point_id
   Nhập địa chỉ cụ thể      → booking.pickup_address = "123 đường ABC"
   Geocode → tọa độ         → booking.pickup_lat, booking.pickup_lng  ← INPUT ROUTING API
   Tương tự cho trả         → booking.dropoff_address, dropoff_lat, dropoff_lng
   Gọi Routing API          → booking.distance_km (km khách này đi)

④ DRIVER BẮT ĐẦU CHUYẾN (IN_PROGRESS):
   Lấy tất cả bookings CONFIRMED
   Waypoints = [booking.pickup_lat/lng] + [booking.dropoff_lat/lng]
   Gọi OSRM/routing API     → trip.route_polyline (cập nhật chính xác)
   Bắt đầu ghi GPS          → gps_tracking (mỗi 30s)

⑤ TRIP HOÀN THÀNH:
   Ghép gps_tracking        → trip.actual_route_polyline
   Cập nhật                 → trip.actual_distance_km, actual_departure/arrival_time, completed_at
   Cập nhật booking         → booking.completed_at

MAPPING API → COLUMN:
   Overpass: element.tags["name:vi"] → province.name
             element.center.lat      → province.lat
             element.center.lon      → province.lng
             element.id              → province.osm_id

   Nominatim: result.display_name   → ward.display_name
              result.lat            → ward.lat
              result.lon            → ward.lng
              result.osm_id         → ward.osm_id

   Routing API (OSRM/Google/Mapbox):
     INPUT:  booking.pickup_lat,  booking.pickup_lng
             booking.dropoff_lat, booking.dropoff_lng
     OUTPUT: booking.distance_km
             trip.route_polyline
             trip.estimated_distance_km
             trip.estimated_duration_minutes
*/