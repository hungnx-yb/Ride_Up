package com.example.demo.service;

import com.example.demo.dto.request.DriverRouteRequest;
import com.example.demo.dto.response.DriverRouteResponse;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.Province;
import com.example.demo.entity.Trip;
import com.example.demo.entity.TripDropoffPoint;
import com.example.demo.entity.TripPickupPoint;
import com.example.demo.entity.User;
import com.example.demo.entity.Ward;
import com.example.demo.enums.DriverStatus;
import com.example.demo.enums.TripStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.DriverProfileRepository;
import com.example.demo.repository.ProvinceRepository;
import com.example.demo.repository.TripDropoffPointRepository;
import com.example.demo.repository.TripPickupPointRepository;
import com.example.demo.repository.TripRepository;
import com.example.demo.repository.WardRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverRouteService {

    UserService userService;
    DriverProfileRepository driverProfileRepository;
    ProvinceRepository provinceRepository;
    WardRepository wardRepository;
    TripRepository tripRepository;
    TripPickupPointRepository tripPickupPointRepository;
    TripDropoffPointRepository tripDropoffPointRepository;

    @Transactional(readOnly = true)
    public List<DriverRouteResponse> getMyRoutes() {
        DriverProfile driverProfile = getCurrentDriverProfile();
        return tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId())
                .stream()
                .map(this::toRouteResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public DriverRouteResponse createRoute(DriverRouteRequest request) {
        validateRequest(request);
        DriverProfile driverProfile = getCurrentDriverProfile();

        Trip trip = Trip.builder()
                .driver(driverProfile)
                .pricePerSeat(BigDecimal.valueOf(request.getFixedFare()))
                .status(toTripStatus(request.getStatus()))
                .pickupPoints(new ArrayList<>())
                .dropoffPoints(new ArrayList<>())
                .build();

        Trip saved = tripRepository.save(trip);

        List<TripPickupPoint> pickupPoints = buildPickupPoints(
                saved,
            request.getPickupProvinceId(),
                request.getPickupProvince(),
                request.getPickupClusters()
        );
        List<TripDropoffPoint> dropoffPoints = buildDropoffPoints(
                saved,
            request.getDropoffProvinceId(),
                request.getDropoffProvince(),
                request.getDropoffClusters()
        );

        saved.setPickupPoints(pickupPoints);
        saved.setDropoffPoints(dropoffPoints);

        return toRouteResponse(tripRepository.save(saved));
    }

    @Transactional
    public DriverRouteResponse updateRoute(String routeId, DriverRouteRequest request) {
        validateRequest(request);

        DriverProfile driverProfile = getCurrentDriverProfile();
        Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNull(routeId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        tripPickupPointRepository.deleteByTripId(trip.getId());
        tripDropoffPointRepository.deleteByTripId(trip.getId());

        trip.setPricePerSeat(BigDecimal.valueOf(request.getFixedFare()));
        trip.setStatus(toTripStatus(request.getStatus()));
        trip.setPickupPoints(buildPickupPoints(trip, request.getPickupProvinceId(), request.getPickupProvince(), request.getPickupClusters()));
        trip.setDropoffPoints(buildDropoffPoints(trip, request.getDropoffProvinceId(), request.getDropoffProvince(), request.getDropoffClusters()));

        return toRouteResponse(tripRepository.save(trip));
    }

    @Transactional
    public Map<String, Object> deleteRoute(String routeId) {
        DriverProfile driverProfile = getCurrentDriverProfile();
        Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNull(routeId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        tripRepository.delete(trip);
        return Map.of("success", true, "id", routeId);
    }

    private DriverProfile getCurrentDriverProfile() {
        User currentUser = userService.getCurrentUser();
        return driverProfileRepository.findByUserId(currentUser.getId())
            .orElseGet(() -> driverProfileRepository.save(
                DriverProfile.builder()
                    .user(currentUser)
                    .status(DriverStatus.PENDING)
                    .driverRating(0.0)
                    .totalDriverRides(0)
                    .build()
            ));
    }

    private void validateRequest(DriverRouteRequest request) {
        if (request == null
                || !StringUtils.hasText(request.getPickupProvince())
                || !StringUtils.hasText(request.getDropoffProvince())
                || request.getFixedFare() == null
                || request.getFixedFare() < 1000
                || request.getPickupClusters() == null
                || request.getPickupClusters().isEmpty()
                || request.getDropoffClusters() == null
                || request.getDropoffClusters().isEmpty()) {
            throw new AppException(ErrorCode.INVALID_KEY);
        }
    }

    private TripStatus toTripStatus(String status) {
        if (!StringUtils.hasText(status)) {
            return TripStatus.OPEN;
        }
        if ("inactive".equalsIgnoreCase(status.trim())) {
            return TripStatus.CANCELLED;
        }
        return TripStatus.OPEN;
    }

    private String toRouteStatus(TripStatus tripStatus) {
        return tripStatus == TripStatus.CANCELLED ? "inactive" : "active";
    }

    private List<TripPickupPoint> buildPickupPoints(Trip trip, String provinceId, String provinceName, List<String> clusterNames) {
        Province province = resolveProvince(provinceId, provinceName);
        List<String> cleaned = cleanClusters(clusterNames);

        List<TripPickupPoint> points = new ArrayList<>();
        for (int i = 0; i < cleaned.size(); i++) {
            String wardName = cleaned.get(i);
            Ward ward = resolveWard(province.getId(), wardName);
            points.add(TripPickupPoint.builder()
                    .trip(trip)
                    .ward(ward)
                    .sortOrder(i)
                    .address(ward.getName())
                    .build());
        }
        return points;
    }

    private List<TripDropoffPoint> buildDropoffPoints(Trip trip, String provinceId, String provinceName, List<String> clusterNames) {
        Province province = resolveProvince(provinceId, provinceName);
        List<String> cleaned = cleanClusters(clusterNames);

        List<TripDropoffPoint> points = new ArrayList<>();
        for (int i = 0; i < cleaned.size(); i++) {
            String wardName = cleaned.get(i);
            Ward ward = resolveWard(province.getId(), wardName);
            points.add(TripDropoffPoint.builder()
                    .trip(trip)
                    .ward(ward)
                    .sortOrder(i)
                    .address(ward.getName())
                    .build());
        }
        return points;
    }

    private Province resolveProvince(String provinceId, String provinceName) {
        if (StringUtils.hasText(provinceId)) {
            return provinceRepository.findById(provinceId.trim())
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));
        }
        if (StringUtils.hasText(provinceName)) {
            return provinceRepository.findByName(provinceName.trim())
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));
        }
        throw new AppException(ErrorCode.INVALID_KEY);
    }

    private Ward resolveWard(String provinceId, String wardName) {
        return wardRepository.findByProvinceIdAndWardName(provinceId, wardName.trim())
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));
    }

    private List<String> cleanClusters(List<String> clusters) {
        return clusters.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .collect(Collectors.toList());
    }

    private DriverRouteResponse toRouteResponse(Trip trip) {
        List<TripPickupPoint> pickupPoints = trip.getPickupPoints() == null ? List.of() : trip.getPickupPoints();
        List<TripDropoffPoint> dropoffPoints = trip.getDropoffPoints() == null ? List.of() : trip.getDropoffPoints();

        List<String> pickupClusters = pickupPoints.stream()
                .sorted((a, b) -> Integer.compare(a.getSortOrder() == null ? 0 : a.getSortOrder(), b.getSortOrder() == null ? 0 : b.getSortOrder()))
                .map(p -> p.getWard() != null ? p.getWard().getName() : null)
                .filter(StringUtils::hasText)
                .collect(Collectors.toList());

        List<String> dropoffClusters = dropoffPoints.stream()
                .sorted((a, b) -> Integer.compare(a.getSortOrder() == null ? 0 : a.getSortOrder(), b.getSortOrder() == null ? 0 : b.getSortOrder()))
                .map(p -> p.getWard() != null ? p.getWard().getName() : null)
                .filter(StringUtils::hasText)
                .collect(Collectors.toList());

        String pickupProvince = pickupPoints.stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

        String dropoffProvince = dropoffPoints.stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

        return DriverRouteResponse.builder()
                .id(trip.getId())
                .pickupProvince(pickupProvince)
                .pickupClusters(pickupClusters)
                .dropoffProvince(dropoffProvince)
                .dropoffClusters(dropoffClusters)
                .fixedFare(trip.getPricePerSeat() == null ? 0L : trip.getPricePerSeat().longValue())
                .status(toRouteStatus(trip.getStatus()))
                .build();
    }
}
