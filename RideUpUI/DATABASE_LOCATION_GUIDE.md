# 📍 Hướng dẫn Database Địa điểm & Routing

## Tổng quan thay đổi

Database đã được nâng cấp để hỗ trợ:
- ✅ Lưu tọa độ (lat/lng) cho tỉnh, quận/huyện, xã/phường
- ✅ Mapping với OpenStreetMap (osm_id)
- ✅ Routing tối ưu theo điểm dừng
- ✅ Tìm kiếm địa điểm gần vị trí người dùng
- ✅ Cache kết quả tìm kiếm

---

## Cấu trúc mới

### 1. **Province** (Tỉnh/Thành phố)
```sql
province {
  id              VARCHAR(255) PK
  code            VARCHAR(255)      -- Mã tỉnh (HN, HCM, DN...)
  name            VARCHAR(255)      -- Hà Nội, TP. Hồ Chí Minh
  name_en         VARCHAR(100)      -- Hanoi, Ho Chi Minh City
  lat             DECIMAL(10,7)     -- 21.0285
  lng             DECIMAL(10,7)     -- 105.8542
  osm_id          BIGINT            -- OpenStreetMap ID
  iso_code        VARCHAR(10)       -- VN-HN, VN-SG
  country_code    VARCHAR(2)        -- VN
}
```

**Dữ liệu từ**: `fetchProvinces()` → Overpass API
```javascript
// API response mapping:
{
  name: el.tags['name:vi'] || el.tags.name,  → province.name
  lat: el.center.lat,                         → province.lat
  lng: el.center.lon,                         → province.lng
  osmId: el.id                                → province.osm_id
}
```

---

### 2. **District** (Quận/Huyện)
```sql
district {
  id              VARCHAR(255) PK
  province_id     VARCHAR(255) FK → province
  code            VARCHAR(255)
  name            VARCHAR(255)      -- Quận 1, Huyện Hoàn Kiếm
  name_en         VARCHAR(100)
  lat             DECIMAL(10,7)
  lng             DECIMAL(10,7)
  osm_id          BIGINT
  osm_type        VARCHAR(20)       -- relation/way/node
  display_name    TEXT              -- "Quận 1, TP.HCM, Việt Nam"
}
```

**Dữ liệu từ**: `searchCommunes()` → OSM Nominatim
```javascript
// API response mapping:
{
  lat: item.lat,                    → district.lat
  lng: item.lon,                    → district.lng
  osm_id: item.osm_id,              → district.osm_id
  osm_type: item.osm_type,          → district.osm_type
  display_name: item.display_name   → district.display_name
}
```

---

### 3. **Commune** (Xã/Phường/Thị trấn) - Optional
```sql
commune {
  id              VARCHAR(255) PK
  district_id     VARCHAR(255) FK → district
  name            VARCHAR(255)
  lat             DECIMAL(10,7)
  lng             DECIMAL(10,7)
  osm_id          BIGINT
  display_name    TEXT
}
```

**Lưu ý**: Dùng khi cần chi tiết đến từng xã/phường. Hiện tại app lưu clusters dạng string array trong `ClusterInput.js`.

---

### 4. **Trip Pickup/Dropoff Points**
Đã thêm tọa độ chính xác:
```sql
trip_pickup_point / trip_dropoff_point {
  ...existing fields...
  lat             DECIMAL(10,7)  ← MỚI
  lng             DECIMAL(10,7)  ← MỚI
  commune_id      VARCHAR(255)   ← MỚI (optional)
  district_id     VARCHAR(255)   ← ĐÃ CÓ
}
```

**Lưu trữ routing**:
- Mỗi điểm dừng cần có `lat`, `lng` chính xác
- `sort_order` xác định thứ tự dừng
- Backend dùng để tính khoảng cách, vẽ polyline

---

## Backend API cần cập nhật

### 1. **Endpoint mới cho địa điểm**

```java
// ProvincesController.java
@GetMapping("/api/provinces")
public List<ProvinceDTO> getAllProvinces() {
  // SELECT id, name, lat, lng, iso_code FROM province
  // ORDER BY name
}

@GetMapping("/api/districts")
public List<DistrictDTO> getDistricts(
  @RequestParam String provinceId
) {
  // SELECT * FROM district 
  // WHERE province_id = ? AND lat IS NOT NULL
  // ORDER BY name
}

@GetMapping("/api/communes/search")
public List<CommuneDTO> searchCommunes(
  @RequestParam String query,
  @RequestParam(required=false) String provinceId
) {
  // 1. Check cache: location_search_cache
  // 2. Nếu không có → call OSM Nominatim
  // 3. Lưu vào cache (expires_at = now + 5 phút)
  // 4. Return JSON
}
```

### 2. **DTO mapping**

```java
// ProvinceDTO.java
public class ProvinceDTO {
  private String id;
  private String name;
  private String nameEn;
  private Double lat;       // ← MỚI
  private Double lng;       // ← MỚI
  private String isoCode;   // ← MỚI
}

// DistrictDTO.java
public class DistrictDTO {
  private String id;
  private String provinceId;
  private String name;
  private Double lat;          // ← MỚI
  private Double lng;          // ← MỚI
  private String displayName;  // ← MỚI
}

// TripPickupPointDTO.java / TripDropoffPointDTO.java
public class TripPickupPointDTO {
  private String id;
  private String address;
  private Double lat;        // ← MỚI
  private Double lng;        // ← MỚI
  private LocalTime pickupTime;
  private Integer sortOrder;
  private String districtId;
  private String communeId;  // ← MỚI (optional)
}
```

### 3. **Tính năng routing mới**

```java
// TripController.java
@GetMapping("/api/trips/nearby")
public List<TripNearbyDTO> findNearbyTrips(
  @RequestParam Double lat,
  @RequestParam Double lng,
  @RequestParam(defaultValue="10") Double radiusKm
) {
  // CALL sp_find_nearby_pickup_points(lat, lng, radiusKm)
  // Return danh sách trip kèm distance_km
}
```

**Response example**:
```json
{
  "trips": [
    {
      "id": "trip-123",
      "departureTime": "2026-03-05T08:00:00",
      "availableSeats": 12,
      "pricePerSeat": 150000,
      "nearestPickupPoint": {
        "address": "Bến xe Mỹ Đình",
        "lat": 21.0285,
        "lng": 105.7764,
        "distanceKm": 2.3,
        "pickupTime": "08:15:00"
      },
      "route": {
        "startProvince": "Hà Nội",
        "endProvince": "Hải Phòng",
        "pickupPoints": [...],
        "dropoffPoints": [...]
      }
    }
  ]
}
```

---

## Script đồng bộ dữ liệu

### 1. **Sync provinces từ Overpass API**

```java
@Service
public class LocationSyncService {
  
  @Scheduled(cron = "0 0 2 * * ?")  // Chạy 2h sáng hàng ngày
  public void syncProvincesFromOverpass() {
    String query = 
      "[out:json][timeout:20];" +
      "area[\"ISO3166-1\"=\"VN\"][admin_level=2];" +
      "rel(area)[\"admin_level\"=\"4\"][\"boundary\"=\"administrative\"];" +
      "out tags center;";
    
    // Call Overpass API
    JsonNode response = restTemplate.postForObject(
      "https://overpass-api.de/api/interpreter",
      query, JsonNode.class
    );
    
    // Parse và lưu vào DB
    for (JsonNode element : response.get("elements")) {
      Province province = new Province();
      province.setName(element.get("tags").get("name:vi").asText());
      province.setNameEn(element.get("tags").get("name:en").asText());
      province.setLat(element.get("center").get("lat").asDouble());
      province.setLng(element.get("center").get("lon").asDouble());
      province.setOsmId(element.get("id").asLong());
      province.setIsoCode(element.get("tags").get("ISO3166-2").asText());
      
      provinceRepository.save(province);
    }
  }
}
```

### 2. **Cache search từ Nominatim**

```java
public List<CommuneDTO> searchCommunes(String query, String provinceId) {
  // 1. Check cache
  String cacheKey = query + "_" + provinceId;
  LocationSearchCache cached = cacheRepository
    .findByQueryAndProvinceAndExpiresAtAfter(
      query, provinceId, LocalDateTime.now()
    );
  
  if (cached != null) {
    return parseJson(cached.getResultsJson());
  }
  
  // 2. Call OSM Nominatim
  String url = String.format(
    "https://nominatim.openstreetmap.org/search?format=json&q=%s&countrycodes=vn&limit=8",
    URLEncoder.encode(query + ", " + provinceName, "UTF-8")
  );
  
  JsonNode response = restTemplate.getForObject(url, JsonNode.class);
  
  // 3. Save to cache
  LocationSearchCache cache = new LocationSearchCache();
  cache.setQuery(query);
  cache.setProvinceFilter(provinceId);
  cache.setResultsJson(response.toString());
  cache.setExpiresAt(LocalDateTime.now().plusMinutes(5));
  cacheRepository.save(cache);
  
  // 4. Return parsed results
  return parseResults(response);
}
```

---

## UI Mobile cần update

### 1. **CreateTripScreen.js** - Lưu tọa độ khi tạo trip

```javascript
// Khi thêm pickup/dropoff point
const addPickupPoint = async (address, districtId) => {
  // Call geocoding để lấy lat/lng
  const coords = await geocodeAddress(address);
  
  const point = {
    address,
    lat: coords.lat,        // ← THÊM
    lng: coords.lng,        // ← THÊM
    districtId,
    pickupTime: selectedTime,
    sortOrder: pickupPoints.length
  };
  
  setPickupPoints([...pickupPoints, point]);
};

// Gửi lên backend
await api.post('/api/trips', {
  ...tripData,
  pickupPoints: pickupPoints.map(p => ({
    address: p.address,
    lat: p.lat,           // ← THÊM
    lng: p.lng,           // ← THÊM
    districtId: p.districtId,
    pickupTime: p.pickupTime,
    sortOrder: p.sortOrder
  }))
});
```

### 2. **CustomerHomeScreen.js** - Tìm chuyến gần vị trí

```javascript
import * as Location from 'expo-location';

const findNearbyTrips = async () => {
  // 1. Lấy vị trí hiện tại
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;
  
  const location = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = location.coords;
  
  // 2. Call API backend
  const response = await api.get('/api/trips/nearby', {
    params: { lat: latitude, lng: longitude, radiusKm: 10 }
  });
  
  // 3. Hiển thị danh sách
  setNearbyTrips(response.data.trips);
};
```

---

## Checklist triển khai

### Backend (Spring Boot)
- [ ] Chạy migration script: `database_migration_locations.sql`
- [ ] Tạo Entity mới: `Province`, `District`, `Commune`, `LocationSearchCache`
- [ ] Cập nhật Entity: `TripPickupPoint`, `TripDropoffPoint` thêm `lat`, `lng`
- [ ] Tạo Controller: `ProvinceController`, `LocationController`
- [ ] Viết Service: `LocationSyncService` (sync từ Overpass/Nominatim)
- [ ] Thêm endpoint: `/api/trips/nearby` (tìm chuyến gần)
- [ ] Test stored procedure: `sp_find_nearby_pickup_points`

### Frontend (React Native)
- [ ] Update `locationService.js`: thêm function lưu data vào DB
- [ ] Update `CreateTripScreen.js`: lưu lat/lng khi tạo điểm dừng
- [ ] Update `CustomerHomeScreen.js`: thêm tính năng "Tìm chuyến gần tôi"
- [ ] Update `api.js`: thêm endpoints provinces/districts/communes
- [ ] Test flow: Tạo trip → Lưu tọa độ → Tìm kiếm theo vị trí

### Database
- [ ] Backup database hiện tại
- [ ] Chạy migration
- [ ] Import dữ liệu 63 tỉnh/TP mẫu
- [ ] Kiểm tra indexes đã tạo
- [ ] Test stored procedure với dữ liệu thật

---

## Performance tips

1. **Index quan trọng**:
   - `idx_lat_lng`: Tăng tốc query theo tọa độ (routing)
   - `idx_trip_order`: Sort điểm dừng nhanh
   - `idx_expires`: Dọn cache hết hạn

2. **Cache strategy**:
   - Cache Nominatim search: 5 phút
   - Cache provinces/districts: 1 giờ (trong memory backend)
   - Job xóa cache hết hạn: chạy 1 lần/ngày

3. **Giới hạn kết quả**:
   - Search communes: max 8 kết quả
   - Nearby trips: max 20 chuyến
   - Bán kính mặc định: 10km

---

## Tham khảo API

- **Overpass API**: https://overpass-api.de/api/interpreter
- **OSM Nominatim**: https://nominatim.openstreetmap.org/search
- **Haversine formula**: Tính khoảng cách 2 điểm GPS
- **Polyline encoding**: Dùng cho `route_polyline` trong bảng `trip`

---

## Troubleshooting

**Q: Làm sao biết tọa độ đã chính xác?**
- Kiểm tra trên Google Maps: `https://www.google.com/maps?q=21.0285,105.8542`
- Lat phải trong khoảng 8-24 (Việt Nam)
- Lng phải trong khoảng 102-110

**Q: Nominatim trả về kết quả lạ?**
- Thêm `countrycodes=vn` để chỉ tìm trong VN
- Thêm tên tỉnh vào query: `"Quận 1, TP.HCM, Việt Nam"`

**Q: Stored procedure chạy chậm?**
- Đảm bảo index `idx_lat_lng` đã tạo
- Giới hạn `LIMIT 20` để tránh scan toàn bộ bảng
- Chỉ query trip có status OPEN/IN_PROGRESS

---

**File tạo**: `database_migration_locations.sql`
**Tác giả**: GitHub Copilot  
**Ngày**: 2026-03-04
