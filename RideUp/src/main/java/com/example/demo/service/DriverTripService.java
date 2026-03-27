package com.example.demo.service;

import com.example.demo.dto.request.DriverTripRequest;
import com.example.demo.dto.request.TripCancellationRequest;
import com.example.demo.dto.response.DriverTripDetailResponse;
import com.example.demo.dto.response.DriverTripResponse;
import com.example.demo.entity.Booking;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.Payment;
import com.example.demo.entity.Province;
import com.example.demo.entity.Trip;
import com.example.demo.entity.TripDropoffPoint;
import com.example.demo.entity.TripPickupPoint;
import com.example.demo.entity.User;
import com.example.demo.entity.Ward;
import com.example.demo.enums.BookingStatus;
import com.example.demo.enums.DriverStatus;
import com.example.demo.enums.TripStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.DriverProfileRepository;
import com.example.demo.repository.ProvinceRepository;
import com.example.demo.repository.TripRepository;
import com.example.demo.repository.WardRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DriverTripService {

    UserService userService;
    DriverProfileRepository driverProfileRepository;
    TripRepository tripRepository;
    ProvinceRepository provinceRepository;
    WardRepository wardRepository;
    ChatService chatService;

    DateTimeFormatter isoDate = DateTimeFormatter.ISO_LOCAL_DATE;
    DateTimeFormatter viDate = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    DateTimeFormatter uiTime = DateTimeFormatter.ofPattern("HH:mm");

    @Transactional(readOnly = true)
    public List<DriverTripResponse> getMyTrips() {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        List<Trip> actualTrips = tripRepository.findByDriverIdAndDepartureTimeIsNotNullOrderByDepartureTimeDesc(driverProfile.getId());
        List<Trip> routeTemplates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());

        return actualTrips.stream()
                .map(trip -> toTripResponse(trip, routeTemplates))
                .collect(Collectors.toList());
    }

            @Transactional(readOnly = true)
            public DriverTripDetailResponse getTripDetail(String tripId) {
            DriverProfile driverProfile = getOrCreateDriverProfile();
            Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNotNull(tripId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.TRIP_NOT_FOUND));

            List<Trip> routeTemplates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());

            List<DriverTripDetailResponse.PointInfo> pickupPoints = mapPickupPoints(trip.getPickupPoints());
            List<DriverTripDetailResponse.PointInfo> dropoffPoints = mapDropoffPoints(trip.getDropoffPoints());
            List<DriverTripDetailResponse.BookingInfo> bookings = mapBookings(trip.getBookings());

            int totalSeats = trip.getTotalSeats() == null ? 0 : trip.getTotalSeats();
            int availableSeats = trip.getAvailableSeats() == null ? 0 : trip.getAvailableSeats();
            int bookedSeats = Math.max(0, totalSeats - availableSeats);
            long fixedFare = trip.getPricePerSeat() == null ? 0L : trip.getPricePerSeat().longValue();

            String pickupProvince = pickupPoints.stream()
                .map(DriverTripDetailResponse.PointInfo::getProvinceName)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

            String dropoffProvince = dropoffPoints.stream()
                .map(DriverTripDetailResponse.PointInfo::getProvinceName)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

            LocalDateTime departure = trip.getDepartureTime();
            return DriverTripDetailResponse.builder()
                .id(trip.getId())
                .routeId(matchTemplateId(trip, routeTemplates).orElse(trip.getId()))
                .status(toUiStatus(trip.getStatus()))
                .pickupProvince(pickupProvince)
                .dropoffProvince(dropoffProvince)
                .departureDate(departure == null ? null : departure.toLocalDate().format(isoDate))
                .departureTime(departure == null ? null : departure.toLocalTime().format(uiTime))
                .createdAt(formatDateTime(trip.getCreatedAt()))
                .updatedAt(formatDateTime(trip.getUpdatedAt()))
                .actualDepartureTime(formatDateTime(trip.getActualDepartureTime()))
                .actualArrivalTime(formatDateTime(trip.getActualArrivalTime()))
                .completedAt(formatDateTime(trip.getCompletedAt()))
                .totalSeats(totalSeats)
                .availableSeats(availableSeats)
                .bookedSeats(bookedSeats)
                .fixedFare(fixedFare)
                .estimatedRevenue(fixedFare * bookedSeats)
                .driverNote(trip.getDriverNote())
                .pickupPoints(pickupPoints)
                .dropoffPoints(dropoffPoints)
                .bookings(bookings)
                .build();
            }

    @Transactional
    public DriverTripResponse createTrip(DriverTripRequest request) {
        validateCreateRequest(request);
        DriverProfile driverProfile = getOrCreateDriverProfile();
        if (driverProfile.getStatus() != DriverStatus.APPROVED) {
            throw new AppException(ErrorCode.DRIVER_PROFILE_NOT_APPROVED);
        }

        Trip template = resolveOrCreateTemplate(driverProfile, request);

        int totalSeats = request.getTotalSeats() == null || request.getTotalSeats() < 1 ? 4 : request.getTotalSeats();
        int availableSeats = request.getAvailableSeats() == null
                ? totalSeats
                : Math.max(0, Math.min(request.getAvailableSeats(), totalSeats));

        BigDecimal fare = request.getFixedFare() != null
                ? BigDecimal.valueOf(request.getFixedFare())
                : (template.getPricePerSeat() == null ? BigDecimal.ZERO : template.getPricePerSeat());

        Trip newTrip = Trip.builder()
                .driver(driverProfile)
                .departureTime(parseDepartureDateTime(request.getDepartureDate(), request.getDepartureTime()))
                .totalSeats(totalSeats)
                .availableSeats(availableSeats)
                .pricePerSeat(fare)
                .status(toTripStatus(request.getStatus()))
                .driverNote(StringUtils.hasText(request.getNotes()) ? request.getNotes().trim() : null)
                .pickupPoints(new ArrayList<>())
                .dropoffPoints(new ArrayList<>())
                .build();

        List<TripPickupPoint> pickupPoints = template.getPickupPoints().stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> TripPickupPoint.builder()
                        .trip(newTrip)
                        .ward(p.getWard())
                        .address(p.getAddress())
                        .pickupTime(p.getPickupTime())
                        .sortOrder(p.getSortOrder())
                        .note(p.getNote())
                        .build())
                .collect(Collectors.toList());

        List<TripDropoffPoint> dropoffPoints = template.getDropoffPoints().stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> TripDropoffPoint.builder()
                        .trip(newTrip)
                        .ward(p.getWard())
                        .address(p.getAddress())
                        .dropoffTime(p.getDropoffTime())
                        .sortOrder(p.getSortOrder())
                        .note(p.getNote())
                        .build())
                .collect(Collectors.toList());

        newTrip.setPickupPoints(pickupPoints);
        newTrip.setDropoffPoints(dropoffPoints);

        Trip saved = tripRepository.save(newTrip);
        DriverTripResponse response = toTripResponse(saved, List.of(template));
        response.setRouteId(template.getId());
        return response;
    }

    @Transactional
    public DriverTripResponse cancelTrip(String tripId, TripCancellationRequest request) {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNotNull(tripId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.TRIP_NOT_FOUND));

        TripStatus status = trip.getStatus();
        if (status == TripStatus.COMPLETED || status == TripStatus.CANCELLED || status == TripStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.TRIP_CANCEL_NOT_ALLOWED);
        }

        trip.setStatus(TripStatus.CANCELLED);
        trip.setCompletedAt(null);

        String reason = request == null ? null : request.getCancellationReason();
        if (StringUtils.hasText(reason)) {
            trip.setDriverNote(reason.trim());
        }

        markBookingsCancelledByDriver(trip, reason);

        Trip saved = tripRepository.save(trip);
        chatService.closeThreadsByTripId(saved.getId(), "Trip was cancelled by driver");

        List<Trip> routeTemplates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());
        return toTripResponse(saved, routeTemplates);
    }

    @Transactional
    public DriverTripResponse startTrip(String tripId) {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNotNull(tripId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.TRIP_NOT_FOUND));

        if (trip.getStatus() != TripStatus.OPEN && trip.getStatus() != TripStatus.FULL) {
            throw new AppException(ErrorCode.TRIP_START_NOT_ALLOWED);
        }

        LocalDateTime now = LocalDateTime.now();
        if (trip.getDepartureTime() != null && now.isBefore(trip.getDepartureTime())) {
            throw new AppException(ErrorCode.TRIP_START_BEFORE_SCHEDULE);
        }

        trip.setStatus(TripStatus.IN_PROGRESS);
        trip.setActualDepartureTime(now);
        trip.setActualArrivalTime(null);
        trip.setCompletedAt(null);

        markBookingsInProgress(trip, now);

        Trip saved = tripRepository.save(trip);
        List<Trip> routeTemplates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());
        return toTripResponse(saved, routeTemplates);
    }

    @Transactional
    public DriverTripResponse completeTrip(String tripId) {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        Trip trip = tripRepository.findByIdAndDriverIdAndDepartureTimeIsNotNull(tripId, driverProfile.getId())
                .orElseThrow(() -> new AppException(ErrorCode.TRIP_NOT_FOUND));

        if (trip.getStatus() != TripStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.TRIP_COMPLETE_NOT_ALLOWED);
        }

        LocalDateTime now = LocalDateTime.now();
        trip.setStatus(TripStatus.COMPLETED);
        if (trip.getActualDepartureTime() == null) {
            trip.setActualDepartureTime(now);
        }
        trip.setActualArrivalTime(now);
        trip.setCompletedAt(now);

        markBookingsCompleted(trip, now);

        Trip saved = tripRepository.save(trip);
        chatService.closeThreadsByTripId(saved.getId(), "Trip has been completed");
        List<Trip> routeTemplates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());
        return toTripResponse(saved, routeTemplates);
    }

    private void markBookingsCancelledByDriver(Trip trip, String reason) {
        if (trip.getBookings() == null || trip.getBookings().isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        String normalizedReason = StringUtils.hasText(reason) ? reason.trim() : "Driver cancelled trip";

        for (Booking booking : trip.getBookings()) {
            if (booking == null || booking.getStatus() == null) {
                continue;
            }

            if (booking.getStatus() == BookingStatus.PENDING || booking.getStatus() == BookingStatus.CONFIRMED) {
                booking.setStatus(BookingStatus.CANCELLED_BY_DRIVER);
                booking.setCancelledAt(now);
                booking.setCancellationReason(normalizedReason);
                booking.setConfirmedAt(null);
                booking.setCompletedAt(null);
            }
        }
    }

    private void markBookingsInProgress(Trip trip, LocalDateTime startedAt) {
        if (trip.getBookings() == null || trip.getBookings().isEmpty()) {
            return;
        }

        for (Booking booking : trip.getBookings()) {
            if (booking == null || booking.getStatus() == null) {
                continue;
            }

            if (booking.getStatus() == BookingStatus.CONFIRMED) {
                booking.setStatus(BookingStatus.CONFIRMED);
                if (booking.getConfirmedAt() == null) {
                    booking.setConfirmedAt(startedAt);
                }
                booking.setCancelledAt(null);
                booking.setCancellationReason(null);
                booking.setCompletedAt(null);
            }
        }
    }

    private void markBookingsCompleted(Trip trip, LocalDateTime completedAt) {
        if (trip.getBookings() == null || trip.getBookings().isEmpty()) {
            return;
        }

        for (Booking booking : trip.getBookings()) {
            if (booking == null || booking.getStatus() == null) {
                continue;
            }

            if (booking.getStatus() == BookingStatus.CONFIRMED) {
                booking.setStatus(BookingStatus.COMPLETED);
                if (booking.getConfirmedAt() == null) {
                    booking.setConfirmedAt(completedAt);
                }
                booking.setCompletedAt(completedAt);
                booking.setCancelledAt(null);
                booking.setCancellationReason(null);
            }
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDriverStats() {
        DriverProfile driverProfile = getOrCreateDriverProfile();
        List<Trip> actualTrips = tripRepository.findByDriverIdAndDepartureTimeIsNotNullOrderByDepartureTimeDesc(driverProfile.getId());

        YearMonth now = YearMonth.now();
        List<Trip> thisMonthTrips = actualTrips.stream()
                .filter(t -> t.getDepartureTime() != null && YearMonth.from(t.getDepartureTime()).equals(now))
                .collect(Collectors.toList());

        int totalRides = thisMonthTrips.size();
        int completedRides = (int) thisMonthTrips.stream().filter(t -> t.getStatus() == TripStatus.COMPLETED).count();
        int cancelledRides = (int) thisMonthTrips.stream().filter(t -> t.getStatus() == TripStatus.CANCELLED).count();

        long revenue = thisMonthTrips.stream()
                .filter(t -> t.getStatus() != TripStatus.CANCELLED)
                .mapToLong(this::calculateTripRevenue)
                .sum();

        Map<String, Object> thisMonth = new HashMap<>();
        thisMonth.put("totalRides", totalRides);
        thisMonth.put("completedRides", completedRides);
        thisMonth.put("cancelledRides", cancelledRides);
        thisMonth.put("revenue", revenue);

        Map<String, Object> data = new HashMap<>();
        data.put("thisMonth", thisMonth);
        data.put("rating", driverProfile.getDriverRating() == null ? 0.0 : driverProfile.getDriverRating());
        data.put("totalReviews", driverProfile.getTotalDriverRides() == null ? 0 : driverProfile.getTotalDriverRides());
        return data;
    }

    private long calculateTripRevenue(Trip t) {
        long fare = t.getPricePerSeat() == null ? 0L : t.getPricePerSeat().longValue();
        int total = t.getTotalSeats() == null ? 0 : t.getTotalSeats();
        int available = t.getAvailableSeats() == null ? 0 : t.getAvailableSeats();
        int booked = Math.max(0, total - available);
        return fare * booked;
    }

    private void validateCreateRequest(DriverTripRequest request) {
        if (request == null
                || !StringUtils.hasText(request.getDepartureDate())
                || !StringUtils.hasText(request.getDepartureTime())) {
            throw new AppException(ErrorCode.INVALID_KEY);
        }

        if (!StringUtils.hasText(request.getRouteId())) {
            if (!StringUtils.hasText(request.getPickupProvince())
                    && !StringUtils.hasText(request.getPickupProvinceId())) {
                throw new AppException(ErrorCode.INVALID_KEY);
            }
            if (!StringUtils.hasText(request.getDropoffProvince())
                    && !StringUtils.hasText(request.getDropoffProvinceId())) {
                throw new AppException(ErrorCode.INVALID_KEY);
            }
            if (request.getPickupClusters() == null || request.getPickupClusters().isEmpty()
                    || request.getDropoffClusters() == null || request.getDropoffClusters().isEmpty()) {
                throw new AppException(ErrorCode.INVALID_KEY);
            }
            if (request.getFixedFare() == null || request.getFixedFare() < 1000) {
                throw new AppException(ErrorCode.INVALID_KEY);
            }
        }
    }

    private Trip resolveOrCreateTemplate(DriverProfile driverProfile, DriverTripRequest request) {
        if (StringUtils.hasText(request.getRouteId())) {
            return tripRepository.findByIdAndDriverIdAndDepartureTimeIsNull(request.getRouteId(), driverProfile.getId())
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));
        }

        Province pickupProvince = resolveProvince(request.getPickupProvinceId(), request.getPickupProvince());
        Province dropoffProvince = resolveProvince(request.getDropoffProvinceId(), request.getDropoffProvince());

        List<String> pickupClusterNames = cleanClusters(request.getPickupClusters());
        List<String> dropoffClusterNames = cleanClusters(request.getDropoffClusters());

        List<Ward> pickupWards = resolveWards(pickupProvince.getId(), pickupClusterNames);
        List<Ward> dropoffWards = resolveWards(dropoffProvince.getId(), dropoffClusterNames);

        BigDecimal fare = BigDecimal.valueOf(request.getFixedFare());

        List<Trip> templates = tripRepository.findByDriverIdAndDepartureTimeIsNullOrderByUpdatedAtDesc(driverProfile.getId());
        Optional<Trip> matchedTemplate = templates.stream()
            .filter(t -> isSameRouteTemplate(t, pickupWards, dropoffWards, fare))
                .findFirst();

        if (matchedTemplate.isPresent()) {
            return matchedTemplate.get();
        }

        Trip template = Trip.builder()
                .driver(driverProfile)
                .pricePerSeat(fare)
                .status(TripStatus.OPEN)
                .pickupPoints(new ArrayList<>())
                .dropoffPoints(new ArrayList<>())
                .build();

        List<TripPickupPoint> pickupPoints = new ArrayList<>();
        for (int i = 0; i < pickupWards.size(); i++) {
            Ward ward = pickupWards.get(i);
            pickupPoints.add(TripPickupPoint.builder()
                    .trip(template)
                    .ward(ward)
                    .address(ward.getName())
                    .sortOrder(i)
                    .build());
        }

        List<TripDropoffPoint> dropoffPoints = new ArrayList<>();
        for (int i = 0; i < dropoffWards.size(); i++) {
            Ward ward = dropoffWards.get(i);
            dropoffPoints.add(TripDropoffPoint.builder()
                    .trip(template)
                    .ward(ward)
                    .address(ward.getName())
                    .sortOrder(i)
                    .build());
        }

        template.setPickupPoints(pickupPoints);
        template.setDropoffPoints(dropoffPoints);

        return tripRepository.save(template);
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

    private List<String> cleanClusters(List<String> clusters) {
        if (clusters == null) {
            return List.of();
        }
        return clusters.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<Ward> resolveWards(String provinceId, List<String> wardNames) {
        List<Ward> wards = new ArrayList<>();
        for (String wardName : wardNames) {
            Ward ward = wardRepository.findByProvinceIdAndWardName(provinceId, wardName)
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_KEY));
            wards.add(ward);
        }
        return wards;
    }

    private boolean isSameRouteTemplate(Trip template, List<Ward> pickupWards, List<Ward> dropoffWards, BigDecimal fare) {
        List<String> templatePickup = extractPickupWardIds(template.getPickupPoints());
        List<String> templateDropoff = extractDropoffWardIds(template.getDropoffPoints());
        List<String> requestPickup = pickupWards.stream().map(Ward::getId).collect(Collectors.toList());
        List<String> requestDropoff = dropoffWards.stream().map(Ward::getId).collect(Collectors.toList());
        long templateFare = template.getPricePerSeat() == null ? 0L : template.getPricePerSeat().longValue();

        return templatePickup.equals(requestPickup)
                && templateDropoff.equals(requestDropoff)
                && templateFare == fare.longValue();
    }

    private DriverProfile getOrCreateDriverProfile() {
        User currentUser = userService.getCurrentUser();
        List<DriverProfile> profiles = driverProfileRepository.findAllByUserIdOrderByCreatedAtDesc(currentUser.getId());
        if (!profiles.isEmpty()) {
            return profiles.stream()
                .max(Comparator.comparingLong(p -> tripRepository.countByDriverId(p.getId())))
                .orElse(profiles.get(0));
        }

        return driverProfileRepository.save(
            DriverProfile.builder()
                .user(currentUser)
                .status(DriverStatus.PENDING)
                .driverRating(0.0)
                .totalDriverRides(0)
                .submitted(false)
                .build()
        );
    }

    private LocalDateTime parseDepartureDateTime(String departureDate, String departureTime) {
        LocalDate date = parseDateFlexible(departureDate);
        LocalTime time = parseTimeFlexible(departureTime);
        return LocalDateTime.of(date, time);
    }

    private LocalDate parseDateFlexible(String text) {
        String raw = text.trim();
        try {
            return LocalDate.parse(raw, isoDate);
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDate.parse(raw, viDate);
        } catch (DateTimeParseException ignored) {
        }
        throw new AppException(ErrorCode.INVALID_KEY);
    }

    private LocalTime parseTimeFlexible(String text) {
        String raw = text.trim();
        try {
            return LocalTime.parse(raw, uiTime);
        } catch (DateTimeParseException ignored) {
        }
        throw new AppException(ErrorCode.INVALID_KEY);
    }

    private DriverTripResponse toTripResponse(Trip trip, List<Trip> routeTemplates) {
        String routeId = matchTemplateId(trip, routeTemplates).orElse(trip.getId());

        String pickupProvince = trip.getPickupPoints().stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

        String dropoffProvince = trip.getDropoffPoints().stream()
                .map(p -> p.getWard() != null && p.getWard().getProvince() != null ? p.getWard().getProvince().getName() : null)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");

        LocalDateTime departure = trip.getDepartureTime();

        return DriverTripResponse.builder()
                .id(trip.getId())
                .routeId(routeId)
                .pickupProvince(pickupProvince)
                .dropoffProvince(dropoffProvince)
                .departureDate(departure == null ? null : departure.toLocalDate().format(isoDate))
                .departureTime(departure == null ? null : departure.toLocalTime().format(uiTime))
                .totalSeats(trip.getTotalSeats() == null ? 0 : trip.getTotalSeats())
                .availableSeats(trip.getAvailableSeats() == null ? 0 : trip.getAvailableSeats())
                .fixedFare(trip.getPricePerSeat() == null ? 0L : trip.getPricePerSeat().longValue())
                .status(toUiStatus(trip.getStatus()))
                .build();
    }

    private List<DriverTripDetailResponse.PointInfo> mapPickupPoints(List<TripPickupPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }

        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> DriverTripDetailResponse.PointInfo.builder()
                        .id(p.getId())
                        .wardName(p.getWard() == null ? null : p.getWard().getName())
                        .provinceName(p.getWard() == null || p.getWard().getProvince() == null ? null : p.getWard().getProvince().getName())
                        .address(p.getAddress())
                        .sortOrder(p.getSortOrder())
                        .time(p.getPickupTime() == null ? null : p.getPickupTime().toString())
                        .note(p.getNote())
                        .build())
                .collect(Collectors.toList());
    }

    private List<DriverTripDetailResponse.PointInfo> mapDropoffPoints(List<TripDropoffPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }

        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> DriverTripDetailResponse.PointInfo.builder()
                        .id(p.getId())
                        .wardName(p.getWard() == null ? null : p.getWard().getName())
                        .provinceName(p.getWard() == null || p.getWard().getProvince() == null ? null : p.getWard().getProvince().getName())
                        .address(p.getAddress())
                        .sortOrder(p.getSortOrder())
                        .time(p.getDropoffTime() == null ? null : p.getDropoffTime().toString())
                        .note(p.getNote())
                        .build())
                .collect(Collectors.toList());
    }

    private List<DriverTripDetailResponse.BookingInfo> mapBookings(List<Booking> bookings) {
        if (bookings == null || bookings.isEmpty()) {
            return List.of();
        }

        return bookings.stream()
                .sorted(Comparator.comparing(Booking::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toBookingInfo)
                .collect(Collectors.toList());
    }

    private DriverTripDetailResponse.BookingInfo toBookingInfo(Booking booking) {
        Payment payment = booking.getPayment();
        User customer = booking.getCustomer();

        return DriverTripDetailResponse.BookingInfo.builder()
                .id(booking.getId())
                .status(booking.getStatus() == null ? null : booking.getStatus().name())
                .seatCount(booking.getSeatCount())
                .totalPrice(booking.getTotalPrice())
                .distanceKm(booking.getDistanceKm())
                .pickupAddress(booking.getPickupAddress())
                .pickupLat(booking.getPickupLat())
                .pickupLng(booking.getPickupLng())
                .dropoffAddress(booking.getDropoffAddress())
                .dropoffLat(booking.getDropoffLat())
                .dropoffLng(booking.getDropoffLng())
                .passengerName(booking.getPassengerName())
                .contactPhone(booking.getContactPhone())
                .customerNote(booking.getCustomerNote())
                .createdAt(formatDateTime(booking.getCreatedAt()))
                .confirmedAt(formatDateTime(booking.getConfirmedAt()))
                .cancelledAt(formatDateTime(booking.getCancelledAt()))
                .cancellationReason(booking.getCancellationReason())
                .completedAt(formatDateTime(booking.getCompletedAt()))
                .customerId(customer == null ? null : customer.getId())
                .customerName(customer == null ? null : customer.getFullName())
                .customerPhone(customer == null ? null : customer.getPhoneNumber())
                .customerEmail(customer == null ? null : customer.getEmail())
                .customerAvatarUrl(customer == null ? null : customer.getAvatarUrl())
                .paymentMethod(payment == null || payment.getMethod() == null ? null : payment.getMethod().name())
                .paymentStatus(payment == null || payment.getStatus() == null ? null : payment.getStatus().name())
                .paymentAmount(payment == null ? null : payment.getAmount())
                .transactionId(payment == null ? null : payment.getTransactionId())
                .paidAt(payment == null ? null : formatDateTime(payment.getPaidAt()))
                .build();
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? null : value.toString();
    }

    private Optional<String> matchTemplateId(Trip trip, List<Trip> templates) {
        List<String> pickup = extractPickupWardIds(trip.getPickupPoints());
        List<String> dropoff = extractDropoffWardIds(trip.getDropoffPoints());

        return templates.stream()
            .filter(t -> pickup.equals(extractPickupWardIds(t.getPickupPoints()))
                && dropoff.equals(extractDropoffWardIds(t.getDropoffPoints())))
                .map(Trip::getId)
                .findFirst();
    }

        private List<String> extractPickupWardIds(List<TripPickupPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        return points.stream()
            .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
            .map(p -> p.getWard() != null ? p.getWard().getId() : "")
            .collect(Collectors.toList());
        }

        private List<String> extractDropoffWardIds(List<TripDropoffPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        return points.stream()
            .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
            .map(p -> p.getWard() != null ? p.getWard().getId() : "")
            .collect(Collectors.toList());
        }

    private List<String> extractPickupWardNames(List<TripPickupPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> p.getWard() != null ? p.getWard().getName() : "")
                .collect(Collectors.toList());
    }

    private List<String> extractDropoffWardNames(List<TripDropoffPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        return points.stream()
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> p.getWard() != null ? p.getWard().getName() : "")
                .collect(Collectors.toList());
    }

    private TripStatus toTripStatus(String uiStatus) {
        if (!StringUtils.hasText(uiStatus)) {
            return TripStatus.OPEN;
        }

        switch (uiStatus.trim().toLowerCase(Locale.ROOT)) {
            case "scheduled":
            case "pending":
                return TripStatus.OPEN;
            case "ongoing":
            case "in_progress":
                return TripStatus.IN_PROGRESS;
            case "completed":
                return TripStatus.COMPLETED;
            case "cancelled":
                return TripStatus.CANCELLED;
            default:
                return TripStatus.OPEN;
        }
    }

    private String toUiStatus(TripStatus status) {
        if (status == null) {
            return "scheduled";
        }
        switch (status) {
            case IN_PROGRESS:
                return "ongoing";
            case COMPLETED:
                return "completed";
            case CANCELLED:
                return "cancelled";
            case OPEN:
            case FULL:
            default:
                return "scheduled";
        }
    }
}
