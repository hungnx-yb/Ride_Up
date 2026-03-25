# ROUTING & DATA SYNC - CẦN BỔ SUNG

## 📌 QUAN TRỌNG: CẤU TRÚC ĐIỂM ĐÓN TRẢ (ĐÚNG)

### ✅ FLOW ĐÚNG:

**1. DRIVER TẠO TRIP:**
```
Driver: "Tôi đón ở Thanh Xuân, Hà Đông, Cầu Giấy"
Driver: "Tôi trả ở Ân Thi, Kim Động"

→ Lưu vào trip_pickup_point: ward_id, ward_name (CHỈ VÙNG, KHÔNG CÓ LAT/LNG)
→ Lưu vào trip_dropoff_point: ward_id, ward_name (CHỈ VÙNG, KHÔNG CÓ LAT/LNG)
```

**2. CUSTOMER ĐẶT BOOKING:**
```
Customer chọn trip
Customer chọn: "Tôi muốn đón ở Thanh Xuân"
Customer nhập ĐỊA CHỈ CỤ THỂ: "123 đường Nguyễn Trãi, Thanh Xuân, Hà Nội"

→ Geocode địa chỉ → lấy lat/lng
→ Lưu vào booking:
   - pickup_point_id (tham chiếu trip_pickup_point)
   - pickup_address: "123 đường Nguyễn Trãi"
   - pickup_lat, pickup_lng (TỌA ĐỘ CỤ THỂ NHÀ KHÁCH)
   - dropoff_address, dropoff_lat, dropoff_lng
```

**3. ROUTING:**
```
Khi trip bắt đầu:
1. Lấy TẤT CẢ bookings của trip
2. Sort theo thứ tự pickup/dropoff points
3. Tính route: [
     {lat: booking1.pickup_lat, lng: booking1.pickup_lng},  // Nhà khách 1
     {lat: booking2.pickup_lat, lng: booking2.pickup_lng},  // Nhà khách 2
     {lat: booking1.dropoff_lat, lng: booking1.dropoff_lng}, // Nhà khách 1
     {lat: booking2.dropoff_lat, lng: booking2.dropoff_lng}  // Nhà khách 2
   ]
```

### ✅ CẤU TRÚC DB:

```
TRIP (Driver tạo)
  ├── trip_pickup_point[]     (NHIỀU VÙNG đón - CHỈ ward_name)
  │   ├── ward_id
  │   ├── ward_name: "Thanh Xuân"
  │   └── province_name: "Hà Nội"
  └── trip_dropoff_point[]    (NHIỀU VÙNG trả - CHỈ ward_name)
      ├── ward_id
      ├── ward_name: "Ân Thi"
      └── province_name: "Hưng Yên"

BOOKING (Customer đặt chỗ - CÓ TỌA ĐỘ CỤ THỂ)
  ├── trip_id
  ├── pickup_point_id         → chọn 1 trip_pickup_point (ward)
  ├── dropoff_point_id        → chọn 1 trip_dropoff_point (ward)
  ├── pickup_address: "123 đường ABC, Thanh Xuân"  🔴 ĐỊA CHỈ CỤ THỂ
  ├── pickup_lat, pickup_lng   🔴 TỌA ĐỘ CỤ THỂ (dùng cho routing)
  ├── dropoff_address: "456 đường XYZ, Ân Thi"
  └── dropoff_lat, dropoff_lng
```

**➡️ TRIP chỉ định VÙNG, BOOKING lưu ĐỊA CHỈ CỤ THỂ để routing**

---

## 🗺️ ROUTING API - DÙNG LAT/LNG

✅ Tất cả routing API đều dùng tọa độ:
- **Input:** `[{lat, lng}, {lat, lng}, ...]` (waypoints)
- **Output:** polyline + distance_km + duration_minutes

---

## 1. CẬP NHẬT locationService.js

### ❌ Sửa searchCommunes() để lấy osm_id
```javascript
export const searchCommunes = async (query, province = '') => {
  // ... existing code ...
  
  for (const item of data) {
    const a = item.address || {};
    const name = (
      a.suburb || a.quarter || a.city_district ||
      a.town || a.village || a.county ||
      (item.display_name || '').split(',')[0]
    ).trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      results.push({ 
        name, 
        lat: parseFloat(item.lat), 
        lng: parseFloat(item.lon),
        osmId: item.osm_id,              // 🔴 THÊM DÒNG NÀY
        displayName: item.display_name   // 🔴 THÊM DÒNG NÀY
      });
    }
  }
  return results;
};
```

---

## 2. TẠO routingService.js MỚI

```javascript
// src/services/routingService.js

// Chọn 1 trong các provider:
// ✅ OSRM (Free, Open Source, unlimited)
// ⚠️ GraphHopper (Free tier: 500 req/day)  
// ⚠️ Google Directions API (Paid: $5/1000 requests)

const OSRM_URL = 'http://router.project-osrm.org/route/v1/driving';

/**
 * Tính route giữa nhiều điểm (pickup → dropoff points)
 * @param {Array<{lat, lng}>} waypoints - Mảng tọa độ
 * @returns {Promise<{
 *   distance_km: number,
 *   duration_minutes: number,
 *   polyline: string,
 *   geometry: Array<[lng, lat]>
 * }>}
 */
export const calculateRoute = async (waypoints) => {
  if (!waypoints || waypoints.length < 2) {
    throw new Error('Cần ít nhất 2 điểm');
  }

  // ⚠️ CHÚ Ý: OSRM dùng lng,lat (không phải lat,lng)
  const coords = waypoints
    .map(p => `${p.lng},${p.lat}`)
    .join(';');

  const url = `${OSRM_URL}/${coords}?overview=full&geometries=polyline`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
    throw new Error('Không tìm được route');
  }

  const route = data.routes[0];
  
  return {
    distance_km: (route.distance / 1000).toFixed(2),
    duration_minutes: Math.ceil(route.duration / 60),
    polyline: route.geometry,  // Encoded polyline string
    geometry: decodePolyline(route.geometry), // [[lng,lat],...]
  };
};

/**
 * Decode polyline string thành mảng tọa độ
 */
export const decodePolyline = (encoded) => {
  // Implementation: https://github.com/mapbox/polyline
  // Hoặc dùng npm: @mapbox/polyline
  const polyline = require('@mapbox/polyline');
  return polyline.decode(encoded);
};

/**
 * Encode mảng tọa độ thành polyline string
 */
export const encodePolyline = (coordinates) => {
  const polyline = require('@mapbox/polyline');
  return polyline.encode(coordinates);
};

/**
 * Tính khoảng cách giữa 2 điểm (Haversine formula)
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // km
};

const toRad = (deg) => deg * (Math.PI / 180);
```

---

## 3. CÀI ĐẶT DEPENDENCIES

```bash
npm install @mapbox/polyline
# Hoặc nếu dùng Expo:
npx expo install @mapbox/polyline
```

---

## 4. SỬ DỤNG TRONG CreateTripScreen.js

```javascript
// CreateTripScreen.js - DRIVER TẠO TRIP
import { searchCommunes } from '../services/locationService';

// State cho các VÙNG đón/trả (chỉ ward, không có tọa độ)
const [pickupWards, setPickupWards] = useState([]);
const [dropoffWards, setDropoffWards] = useState([]);

// Driver chọn VÙNG đón (ví dụ: "Thanh Xuân")
const handleAddPickupWard = (wardName, provinceName) => {
  setPickupWards([...pickupWards, {
    wardName: wardName,
    provinceName: provinceName,
    sortOrder: pickupWards.length
  }]);
  // ⚠️ KHÔNG CẦN geocode, không cần lat/lng
};

// Tương tự cho dropoff wards
const handleAddDropoffWard = (wardName, provinceName) => {
  setDropoffWards([...dropoffWards, {
    wardName: wardName,
    provinceName: provinceName,
    sortOrder: dropoffWards.length
  }]);
};

// Submit tạo trip - KHÔNG CẦN routing lúc này
const handleCreateTrip = async () => {
  const tripData = {
    startProvinceId: selectedStartProvince.id,
    endProvinceId: selectedEndProvince.id,
    departureDate: departureDate,
    departureTime: departureTime,
    totalSeats: totalSeats,
    fixedFare: fare,
    
    // 🔴 CHỈ LƯU VÙNG (ward), KHÔNG CÓ TỌA ĐỘ
    pickupPoints: pickupWards.map((w, idx) => ({
      wardName: w.wardName,
      provinceName: w.provinceName,
      sortOrder: idx
    })),
    
    dropoffPoints: dropoffWards.map((w, idx) => ({
      wardName: w.wardName,
      provinceName: w.provinceName,
      sortOrder: idx
    }))
  };

  // Gửi lên backend (không có routing polyline)
  const response = await api.post('/trips', tripData);
  
  if (response.success) {
    Alert.alert('Thành công', 'Đã tạo chuyến xe');
    navigation.goBack();
  }
};
```

---

## 5. BACKEND - TripController.java (Tạo trip)

```java
@PostMapping("/trips")
public ResponseEntity<TripDTO> createTrip(@RequestBody CreateTripRequest request) {
    // 1. Tạo Trip (chưa có routing polyline)
    Trip trip = new Trip();
    trip.setStartProvinceId(request.getStartProvinceId());
    trip.setEndProvinceId(request.getEndProvinceId());
    trip.setDepartureDate(request.getDepartureDate());
    trip.setDepartureTime(request.getDepartureTime());
    trip.setTotalSeats(request.getTotalSeats());
    trip.setFixedFare(request.getFixedFare());
    tripRepo.save(trip);
    
    // 2. Lưu pickup wards (CHỈ ward_name, KHÔNG CÓ lat/lng)
    for (PickupPointDTO p : request.getPickupPoints()) {
        TripPickupPoint point = new TripPickupPoint();
        point.setTripId(trip.getId());
        point.setWardName(p.getWardName());
        point.setProvinceName(p.getProvinceName());
        point.setSortOrder(p.getSortOrder());
        pickupPointRepo.save(point);
    }
    
    // 3. Lưu dropoff wards (tương tự)
    for (DropoffPointDTO d : request.getDropoffPoints()) {
        TripDropoffPoint point = new TripDropoffPoint();
        point.setTripId(trip.getId());
        point.setWardName(d.getWardName());
        point.setProvinceName(d.getProvinceName());
        point.setSortOrder(d.getSortOrder());
        dropoffPointRepo.save(point);
    }
    
    return ResponseEntity.ok(new TripDTO(trip));
}
```

---

## 6. CUSTOMER BOOKING FLOW (ĐÂY LÀ QUAN TRỌNG NHẤT)

```javascript
// CustomerHomeScreen.js - Khi customer đặt booking

import { calculateRoute } from '../services/routingService';

const handleBookTrip = async (trip) => {
  // ===== BƯỚC 1: Chọn vùng đón =====
  const pickupWards = await api.get(`/trips/${trip.id}/pickup-points`);
  // → [{id, wardName: "Thanh Xuân", provinceName: "Hà Nội"}, ...]
  
  // User chọn 1 ward đón (ví dụ: "Thanh Xuân")
  const selectedPickupWard = pickupWards[0];
  
  // ===== BƯỚC 2: Nhập ĐỊA CHỈ CỤ THỂ (số nhà, đường) =====
  Alert.prompt(
    'Nhập địa chỉ đón', 
    `Bạn đã chọn ${selectedPickupWard.wardName}.\nVui lòng nhập địa chỉ cụ thể:`,
    async (pickupAddress) => {
      // Ví dụ user nhập: "123 đường Nguyễn Trãi"
      
      // ===== BƯỚC 3: Geocode để lấy lat/lng =====
      const fullAddress = `${pickupAddress}, ${selectedPickupWard.wardName}, ${selectedPickupWard.provinceName}`;
      
      // Gọi Nominatim API để geocode
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(fullAddress)}&format=json&limit=1`;
      const geocodeResult = await fetch(geocodeUrl).then(r => r.json());
      
      if (!geocodeResult || geocodeResult.length === 0) {
        Alert.alert('Lỗi', 'Không tìm thấy địa chỉ này');
        return;
      }
      
      const pickupLat = parseFloat(geocodeResult[0].lat);
      const pickupLng = parseFloat(geocodeResult[0].lon);
      
      // ===== BƯỚC 4: Chọn vùng trả và nhập địa chỉ trả =====
      const dropoffWards = await api.get(`/trips/${trip.id}/dropoff-points`);
      const selectedDropoffWard = dropoffWards[0];
      
      Alert.prompt('Nhập địa chỉ trả', '', async (dropoffAddress) => {
        const fullDropoffAddress = `${dropoffAddress}, ${selectedDropoffWard.wardName}, ${selectedDropoffWard.provinceName}`;
        const dropoffGeocodeUrl = `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(fullDropoffAddress)}&format=json&limit=1`;
        const dropoffGeocodeResult = await fetch(dropoffGeocodeUrl).then(r => r.json());
        
        const dropoffLat = parseFloat(dropoffGeocodeResult[0].lat);
        const dropoffLng = parseFloat(dropoffGeocodeResult[0].lon);
        
        // ===== BƯỚC 5: Tính khoảng cách cho booking này =====
        const route = await calculateRoute([
          {lat: pickupLat, lng: pickupLng},
          {lat: dropoffLat, lng: dropoffLng}
        ]);
        
        // ===== BƯỚC 6: Submit booking với ĐỊA CHỈ CỤ THỂ + TỌA ĐỘ =====
        const bookingData = {
          tripId: trip.id,
          customerId: user.id,
          
          // Vùng ward (tham chiếu)
          pickupPointId: selectedPickupWard.id,
          dropoffPointId: selectedDropoffWard.id,
          pickupWardId: selectedPickupWard.wardId,
          dropoffWardId: selectedDropoffWard.wardId,
          
          // 🔴 ĐỊA CHỈ CỤ THỂ + TỌA ĐỘ (dùng cho routing)
          pickupAddress: pickupAddress,  // "123 đường Nguyễn Trãi"
          pickupLat: pickupLat,
          pickupLng: pickupLng,
          dropoffAddress: dropoffAddress,
          dropoffLat: dropoffLat,
          dropoffLng: dropoffLng,
          
          numberOfSeats: 1,
          distanceKm: route.distance_km,
          totalPrice: trip.fixedFare
        };
        
        await api.post('/bookings', bookingData);
        Alert.alert('Thành công', 'Đã đặt chỗ');
      });
    }
  );
};
```

---

## 7. BACKEND - ROUTING KHI TRIP BẮT ĐẦU

```java
@Service
public class TripRoutingService {
    
    /**
     * Tính route thực tế khi trip bắt đầu (có đủ bookings)
     * Gọi khi driver click "Bắt đầu chuyến"
     */
    public RouteResult calculateActualRoute(String tripId) {
        Trip trip = tripRepo.findById(tripId).orElseThrow();
        
        // 1. Lấy TẤT CẢ bookings đã confirmed
        List<Booking> bookings = bookingRepo.findByTripIdAndStatus(tripId, "CONFIRMED");
        
        // 2. Sort bookings theo pickup_point_id và dropoff_point_id
        List<TripPickupPoint> pickupPoints = pickupPointRepo.findByTripIdOrderBySortOrder(tripId);
        List<TripDropoffPoint> dropoffPoints = dropoffPointRepo.findByTripIdOrderBySortOrder(tripId);
        
        // 3. Tạo danh sách waypoints từ địa chỉ cụ thể của khách hàng
        List<Waypoint> waypoints = new ArrayList<>();
        
        // Thêm tất cả pickup addresses
        for (TripPickupPoint pp : pickupPoints) {
            List<Booking> pickupsHere = bookings.stream()
                .filter(b -> b.getPickupPointId().equals(pp.getId()))
                .collect(Collectors.toList());
            
            for (Booking b : pickupsHere) {
                waypoints.add(new Waypoint(
                    b.getPickupLat(), 
                    b.getPickupLng(), 
                    "PICKUP", 
                    b.getId(),
                    b.getPickupAddress()
                ));
            }
        }
        
        // Thêm tất cả dropoff addresses
        for (TripDropoffPoint dp : dropoffPoints) {
            List<Booking> dropoffsHere = bookings.stream()
                .filter(b -> b.getDropoffPointId().equals(dp.getId()))
                .collect(Collectors.toList());
            
            for (Booking b : dropoffsHere) {
                waypoints.add(new Waypoint(
                    b.getDropoffLat(), 
                    b.getDropoffLng(), 
                    "DROPOFF", 
                    b.getId(),
                    b.getDropoffAddress()
                ));
            }
        }
        
        // 4. Gọi OSRM API để tính route
        String coords = waypoints.stream()
            .map(w -> w.getLng() + "," + w.getLat())
            .collect(Collectors.joining(";"));
        
        String url = "http://router.project-osrm.org/route/v1/driving/" + 
                    coords + "?overview=full&geometries=polyline";
        
        RestTemplate rest = new RestTemplate();
        OsrmResponse response = rest.getForObject(url, OsrmResponse.class);
        
        if (response.getCode().equals("Ok")) {
            OsrmRoute route = response.getRoutes().get(0);
            
            // 5. Cập nhật trip với route thực tế
            trip.setRoutePolyline(route.getGeometry());
            trip.setEstimatedDistanceKm(route.getDistance() / 1000.0);
            trip.setEstimatedDurationMinutes((int)(route.getDuration() / 60));
            tripRepo.save(trip);
            
            return new RouteResult(
                route.getGeometry(), 
                route.getDistance() / 1000.0,
                route.getDuration() / 60,
                waypoints
            );
        }
        
        throw new RuntimeException("Không tính được route");
    }
}
```

---

## 8. BACKEND - LocationSyncService.java

```java
@Service
public class LocationSyncService {
    
    @Autowired
    private ProvinceRepository provinceRepo;
    
    @Autowired
    private WardRepository wardRepo;
    
    /**
     * Sync provinces từ Overpass API
     * Gọi sau khi chạy migration
     */
    public void syncProvincesFromOverpass() {
        String query = "[out:json][timeout:20];" +
                      "area[\"ISO3166-1\"=\"VN\"][admin_level=2];" +
                      "rel(area)[\"admin_level\"=\"4\"][\"boundary\"=\"administrative\"];" +
                      "out tags center;";
        
        String url = "https://overpass-api.de/api/interpreter?data=" 
                   + URLEncoder.encode(query, StandardCharsets.UTF_8);
        
        // Call API, parse JSON, save to province table
        RestTemplate rest = new RestTemplate();
        OverpassResponse response = rest.getForObject(url, OverpassResponse.class);
        
        for (OverpassElement el : response.getElements()) {
            Province p = new Province();
            p.setName(el.getTags().get("name:vi"));
            p.setLat(el.getCenter().getLat());
            p.setLng(el.getCenter().getLon());
            p.setOsmId(el.getId());
            provinceRepo.save(p);
        }
    }
    
    /**
     * Sync wards cho 1 tỉnh từ Nominatim
     */
    public void syncWardsByProvince(String provinceId) {
        Province province = provinceRepo.findById(provinceId)
            .orElseThrow();
        
        String url = String.format(
            "https://nominatim.openstreetmap.org/search" +
            "?q=%s,Việt Nam&format=json&limit=500&addressdetails=1",
            URLEncoder.encode(province.getName(), StandardCharsets.UTF_8)
        );
        
        // Call API, parse, save wards
        // Filter by: item.address.suburb || quarter || city_district || town
    }
}
```

---

## 9. BACKEND - LocationController.java (API ENDPOINTS)

```java
@RestController
@RequestMapping("/api")
public class LocationController {
    
    @Autowired
    private LocationSyncService syncService;
    
    // Trigger sync provinces (1 lần sau migration)
    @PostMapping("/admin/sync/provinces")
    public ResponseEntity<String> syncProvinces() {
        syncService.syncProvincesFromOverpass();
        return ResponseEntity.ok("Synced provinces");
    }
    
    // Trigger sync wards for a province
    @PostMapping("/admin/sync/wards/{provinceId}")
    public ResponseEntity<String> syncWards(@PathVariable String provinceId) {
        syncService.syncWardsByProvince(provinceId);
        return ResponseEntity.ok("Synced wards");
    }
    
    // Get provinces
    @GetMapping("/provinces")
    public List<ProvinceDTO> getProvinces() {
        return provinceRepo.findAll().stream()
            .map(p -> new ProvinceDTO(p.getId(), p.getName(), p.getLat(), p.getLng()))
            .collect(Collectors.toList());
    }
    
    // Get wards by province
    @GetMapping("/wards")
    public List<WardDTO> getWards(@RequestParam String provinceId) {
        return wardRepo.findByProvinceId(provinceId).stream()
            .map(w -> new WardDTO(w.getId(), w.getName(), w.getLat(), w.getLng()))
            .collect(Collectors.toList());
    }
}
```

---

## 10. CHECKLIST

### Database ✅
- [x] Province table có lat, lng, osm_id
- [x] Ward table có lat, lng, osm_id, display_name
- [x] Trip có route_polyline (tính sau khi có bookings), estimated_distance_km, estimated_duration_minutes
- [x] trip_pickup_point: CHỈ CÓ ward_id, ward_name, province_name (KHÔNG CÓ lat/lng)
- [x] trip_dropoff_point: CHỈ CÓ ward_id, ward_name, province_name (KHÔNG CÓ lat/lng)
- [x] booking: CÓ pickup_address, pickup_lat, pickup_lng + dropoff_address, dropoff_lat, dropoff_lng
- [x] GPS tracking table

### Mobile App ⚠️
- [ ] Sửa locationService.searchCommunes() lấy osmId, displayName
- [ ] Tạo routingService.js mới
- [ ] Cài @mapbox/polyline
- [ ] Update CreateTripScreen:
  - Driver chỉ chọn VÙNG ward (Thanh Xuân, Hà Đông)
  - KHÔNG cần geocode, không có lat/lng
- [ ] Update CustomerHomeScreen: 
  - Customer chọn ward từ trip
  - Customer NHẬP ĐỊA CHỈ CỤ THỂ (số nhà, đường)
  - Geocode địa chỉ → lấy lat/lng
  - Submit booking với pickup_address + pickup_lat/lng
- [ ] Update DriverHomeScreen: 
  - Khi driver click "Bắt đầu chuyến" → gọi API tính route từ tất cả bookings
  - GPS tracking mỗi 30s
- [ ] Update AllTripsScreen: hiển thị route history

### Backend ⚠️
- [ ] Tạo LocationSyncService.java (sync province/ward data)
- [ ] Tạo TripRoutingService.java (tính route từ bookings)
- [ ] Tạo Entity: Province, Ward (update), GpsTracking, TripStopLog
- [ ] Update TripController: createTrip() không cần routing lúc tạo
- [ ] Update TripController: addStartTripRoute() để tính routing khi bắt đầu
- [ ] Tạo API: POST /admin/sync/provinces, GET /api/provinces, GET /api/wards
- [ ] Tạo API: POST /api/trips/{id}/start-route (tính route từ bookings)
- [ ] Tạo API: POST /api/trips/{id}/gps, GET /api/trips/{id}/history

---

## 11. CHẠY SAU KHI SETUP

```bash
# 1. Chạy migration
mysql -u root -p rideUp < database_migration_complete.sql

# 2. Gọi backend để sync provinces (1 lần)
curl -X POST http://localhost:8080/api/admin/sync/provinces

# 3. Gọi sync wards cho từng tỉnh (có thể chạy background job)
curl -X POST http://localhost:8080/api/admin/sync/wards/{provinceId}

# 4. Test flow:
#    A. Driver tạo trip → chọn ward (không có geocode)
#    B. Customer đặt booking → nhập địa chỉ cụ thể → geocode → lưu lat/lng
#    C. Driver bắt đầu chuyến → backend tính route từ tất cả bookings
```

---

## 📋 TÓM TẮT FLOW ĐÚNG

### ✅ DRIVER TẠO TRIP:
```
1. Chọn province: Hà Nội → Hưng Yên
2. Chọn VÙNG đón: Thanh Xuân, Hà Đông, Cầu Giấy (chỉ ward_name)
3. Chọn VÙNG trả: Ân Thi, Kim Động (chỉ ward_name)
4. Submit → LƯU trip_pickup_point, trip_dropoff_point (KHÔNG CÓ LAT/LNG)
```

### ✅ CUSTOMER ĐẶT BOOKING:
```
1. Chọn trip
2. Chọn vùng đón: "Thanh Xuân"
3. Nhập ĐỊA CHỈ CỤ THỂ: "123 đường Nguyễn Trãi"
4. Geocode → lấy lat/lng
5. Chọn vùng trả: "Ân Thi"
6. Nhập địa chỉ trả: "456 đường Lê Lợi"
7. Geocode → lấy lat/lng
8. Submit booking với: pickup_address, pickup_lat, pickup_lng
```

### ✅ DRIVER BẮT ĐẦU CHUYẾN:
```
1. Driver click "Bắt đầu chuyến"
2. Backend:
   - Lấy TẤT CẢ bookings đã confirmed
   - Tạo waypoints từ booking.pickup_lat/lng và booking.dropoff_lat/lng
   - Gọi OSRM API với waypoints
   - Lưu route_polyline vào trip
3. Driver thấy route trên map
4. GPS tracking bắt đầu (mỗi 30s)
```
# CreateTripScreen → Add points → Xem polyline trên map
```

---

## ROUTING API COMPARISON

| Provider | Free Tier | Polyline | Multi-waypoints | Notes |
|----------|-----------|----------|-----------------|-------|
| **OSRM** | ✅ Unlimited | ✅ | ✅ Max 100 points | Self-host hoặc dùng demo server |
| **GraphHopper** | 500 req/day | ✅ | ✅ | Cần API key |
| **Google Directions** | ❌ Paid only | ✅ | ✅ Max 25 waypoints | $5/1000 requests |
| **Mapbox** | 100k req/month | ✅ | ✅ | Cần API key |

**Đề xuất:** Dùng OSRM cho development, sau đó self-host hoặc chuyển sang Mapbox/Google nếu cần tính năng cao cấp.
