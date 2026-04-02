package com.example.demo.service;

import com.example.demo.dto.request.SendChatMessageRequest;
import com.example.demo.dto.response.ChatMessageResponse;
import com.example.demo.dto.response.ChatThreadResponse;
import com.example.demo.entity.Booking;
import com.example.demo.entity.Trip;
import com.example.demo.entity.TripDropoffPoint;
import com.example.demo.entity.TripPickupPoint;
import com.example.demo.entity.User;
import com.example.demo.entity.chat.ChatMessageDocument;
import com.example.demo.entity.chat.ChatThreadDocument;
import com.example.demo.enums.BookingStatus;
import com.example.demo.enums.ChatMessageType;
import com.example.demo.enums.ChatThreadStatus;
import com.example.demo.enums.Role;
import com.example.demo.enums.TripStatus;
import com.example.demo.exception.AppException;
import com.example.demo.exception.ErrorCode;
import com.example.demo.repository.BookingRepository;
import com.example.demo.repository.ChatMessageRepository;
import com.example.demo.repository.ChatThreadRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ChatService {

    static final DateTimeFormatter CHAT_TITLE_TIME_FORMAT = DateTimeFormatter.ofPattern("H:mm dd/MM/yyyy");

    ChatThreadRepository chatThreadRepository;
    ChatMessageRepository chatMessageRepository;
    BookingRepository bookingRepository;
    UserService userService;
    ChatRealtimePublisher chatRealtimePublisher;
    FileService fileService;

    @Transactional
    public ChatThreadResponse openThreadByBooking(String bookingId) {
        if (!StringUtils.hasText(bookingId)) {
            throw new AppException(ErrorCode.INVALID_KEY);
        }

        User currentUser = userService.getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        validateParticipant(booking, currentUser.getId());
        validateChatAllowed(booking);

        ChatThreadDocument thread = chatThreadRepository.findByBookingId(bookingId)
                .orElseGet(() -> createThread(booking));

        if (thread.getStatus() != ChatThreadStatus.ACTIVE) {
            thread.setStatus(ChatThreadStatus.ACTIVE);
            thread.setChatAllowedUntil(null);
            thread.setUpdatedAt(LocalDateTime.now());
            thread = chatThreadRepository.save(thread);
        }

        return toThreadResponse(thread, currentUser.getId(), booking);
    }

    @Transactional
    public void ensureThreadForConfirmedBooking(String bookingId) {
        if (!StringUtils.hasText(bookingId)) {
            return;
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (!isChatAllowed(booking)) {
            return;
        }

        ChatThreadDocument thread = chatThreadRepository.findByBookingId(bookingId)
                .orElseGet(() -> createThread(booking));

        if (thread.getStatus() != ChatThreadStatus.ACTIVE) {
            thread.setStatus(ChatThreadStatus.ACTIVE);
            thread.setChatAllowedUntil(null);
            thread.setUpdatedAt(LocalDateTime.now());
            chatThreadRepository.save(thread);
        }
    }

    @Transactional(readOnly = true)
    public List<ChatThreadResponse> getMyThreads() {
        User currentUser = userService.getCurrentUser();
        String userId = currentUser.getId();

        List<ChatThreadDocument> threads = chatThreadRepository.findByParticipantAndStatuses(
            userId,
            List.of(ChatThreadStatus.ACTIVE, ChatThreadStatus.CLOSED)
        );

        if (threads.isEmpty()) {
            return List.of();
        }

        // Defensive de-duplication in case historical records or migrations create duplicates.
        List<ChatThreadDocument> uniqueThreads = new ArrayList<>(threads.stream()
            .collect(Collectors.toMap(ChatThreadDocument::getId, t -> t, (a, b) -> a, java.util.LinkedHashMap::new))
            .values());

        List<String> bookingIds = uniqueThreads.stream()
            .map(ChatThreadDocument::getBookingId)
            .filter(StringUtils::hasText)
            .distinct()
            .collect(Collectors.toList());

        final Map<String, Booking> bookingById = bookingIds.isEmpty()
            ? Map.of()
            : bookingRepository.findAllForChatByIdIn(bookingIds).stream()
                .collect(Collectors.toMap(Booking::getId, b -> b, (a, b) -> a, HashMap::new));

        if (bookingById.isEmpty()) {
            return List.of();
        }

        return uniqueThreads.stream()
            .filter(thread -> bookingById.containsKey(thread.getBookingId()))
            .map(thread -> toThreadResponse(thread, userId, bookingById.get(thread.getBookingId())))
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getMessages(String threadId, Integer limit) {
        User currentUser = userService.getCurrentUser();
        ChatThreadDocument thread = getOwnedThread(threadId, currentUser.getId());

        int pageSize = (limit == null || limit < 1) ? 50 : Math.min(limit, 100);
        List<ChatMessageDocument> rows = chatMessageRepository.findByThreadIdOrderBySentAtDesc(
                thread.getId(),
                PageRequest.of(0, pageSize)
        );

        Collections.reverse(rows);

        return rows.stream()
                .map(message -> toMessageResponse(message, currentUser.getId()))
                .collect(Collectors.toList());
    }

    @Transactional
    public ChatMessageResponse sendMessage(String threadId, SendChatMessageRequest request) {
        String content = request != null ? request.getContent() : null;
        String rawImageUrl = request != null ? request.getImageUrl() : null;
        ChatMessageType requestedType = request != null ? request.getType() : null;

        boolean hasContent = StringUtils.hasText(content);
        boolean hasImage = StringUtils.hasText(rawImageUrl);

        if (!hasContent && !hasImage) {
            throw new AppException(ErrorCode.CHAT_MESSAGE_INVALID);
        }

        if (hasContent && content.trim().length() > 2000) {
            throw new AppException(ErrorCode.CHAT_MESSAGE_INVALID);
        }

        if (hasImage && rawImageUrl.trim().length() > 3000) {
            throw new AppException(ErrorCode.CHAT_MESSAGE_INVALID);
        }

        User currentUser = userService.getCurrentUser();
        ChatThreadDocument thread = getOwnedThread(threadId, currentUser.getId());

        if (thread.getStatus() != ChatThreadStatus.ACTIVE) {
            throw new AppException(ErrorCode.CHAT_NOT_ALLOWED);
        }

        Booking booking = bookingRepository.findById(thread.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (!isChatAllowed(booking)) {
            closeThread(thread, "Trip ended");
            throw new AppException(ErrorCode.CHAT_NOT_ALLOWED);
        }

        Role senderRole = resolveSenderRole(thread, currentUser.getId());
        LocalDateTime now = LocalDateTime.now();
        String normalizedContent = hasContent ? content.trim() : null;
        String normalizedImageUrl = hasImage ? normalizeImageUrl(rawImageUrl) : null;
        ChatMessageType messageType = resolveMessageType(hasContent, hasImage, requestedType);

        ChatMessageDocument message = ChatMessageDocument.builder()
                .threadId(thread.getId())
                .bookingId(thread.getBookingId())
                .senderUserId(currentUser.getId())
                .senderRole(senderRole)
            .type(messageType)
            .content(normalizedContent)
            .imageUrl(normalizedImageUrl)
                .sentAt(now)
                .createdAt(now)
                .build();

        ChatMessageDocument saved = chatMessageRepository.save(message);

        thread.setLastMessageAt(now);
        thread.setLastMessagePreview(buildPreview(saved.getType(), saved.getContent()));
        thread.setUpdatedAt(now);
        if (senderRole == Role.CUSTOMER) {
            thread.setDriverUnreadCount(safeInt(thread.getDriverUnreadCount()) + 1);
        } else {
            thread.setCustomerUnreadCount(safeInt(thread.getCustomerUnreadCount()) + 1);
        }
        chatThreadRepository.save(thread);

        ChatMessageResponse response = toMessageResponse(saved, currentUser.getId());
        chatRealtimePublisher.publishThreadMessage(response);
        return response;
    }

    @Transactional
    public ChatThreadResponse markThreadRead(String threadId) {
        User currentUser = userService.getCurrentUser();
        ChatThreadDocument thread = getOwnedThread(threadId, currentUser.getId());

        if (Objects.equals(thread.getCustomerUserId(), currentUser.getId())) {
            thread.setCustomerUnreadCount(0);
        }
        if (Objects.equals(thread.getDriverUserId(), currentUser.getId())) {
            thread.setDriverUnreadCount(0);
        }
        thread.setUpdatedAt(LocalDateTime.now());

        ChatThreadDocument saved = chatThreadRepository.save(thread);
        return toThreadResponse(
            saved,
            currentUser.getId(),
            bookingRepository.findById(saved.getBookingId()).orElse(null)
        );
    }

    @Transactional
    public void closeThreadsByTripId(String tripId, String reason) {
        if (!StringUtils.hasText(tripId)) {
            return;
        }

        List<ChatThreadDocument> threads = chatThreadRepository.findByTripIdAndStatus(tripId, ChatThreadStatus.ACTIVE);
        if (threads.isEmpty()) {
            return;
        }

        for (ChatThreadDocument thread : threads) {
            closeThread(thread, reason);
        }
    }

    private ChatThreadDocument createThread(Booking booking) {
        LocalDateTime now = LocalDateTime.now();
        return chatThreadRepository.save(ChatThreadDocument.builder()
                .bookingId(booking.getId())
                .tripId(booking.getTrip().getId())
                .customerUserId(booking.getCustomer().getId())
                .driverUserId(booking.getTrip().getDriver().getUser().getId())
                .status(ChatThreadStatus.ACTIVE)
                .chatAllowedFrom(now)
                .chatAllowedUntil(null)
                .lastMessageAt(null)
                .lastMessagePreview(null)
                .customerUnreadCount(0)
                .driverUnreadCount(0)
                .createdAt(now)
                .updatedAt(now)
                .build());
    }

    private void validateParticipant(Booking booking, String currentUserId) {
        String customerUserId = booking.getCustomer() != null ? booking.getCustomer().getId() : null;
        String driverUserId = (booking.getTrip() != null && booking.getTrip().getDriver() != null && booking.getTrip().getDriver().getUser() != null)
                ? booking.getTrip().getDriver().getUser().getId()
                : null;

        if (!Objects.equals(customerUserId, currentUserId) && !Objects.equals(driverUserId, currentUserId)) {
            throw new AppException(ErrorCode.CHAT_FORBIDDEN);
        }
    }

    private void validateChatAllowed(Booking booking) {
        if (!isChatAllowed(booking)) {
            throw new AppException(ErrorCode.CHAT_NOT_ALLOWED);
        }
    }

    private boolean isChatAllowed(Booking booking) {
        if (booking == null || booking.getTrip() == null) {
            return false;
        }

        BookingStatus bookingStatus = booking.getStatus();
        if (bookingStatus == BookingStatus.CANCELLED_BY_CUSTOMER
                || bookingStatus == BookingStatus.CANCELLED_BY_DRIVER
                || bookingStatus == BookingStatus.COMPLETED
                || bookingStatus == BookingStatus.NO_SHOW) {
            return false;
        }

        TripStatus tripStatus = booking.getTrip().getStatus();
        return tripStatus != TripStatus.COMPLETED && tripStatus != TripStatus.CANCELLED;
    }

    private ChatThreadDocument getOwnedThread(String threadId, String userId) {
        if (!StringUtils.hasText(threadId)) {
            throw new AppException(ErrorCode.INVALID_KEY);
        }

        ChatThreadDocument thread = chatThreadRepository.findById(threadId)
                .orElseThrow(() -> new AppException(ErrorCode.CHAT_THREAD_NOT_FOUND));

        if (!Objects.equals(thread.getCustomerUserId(), userId)
                && !Objects.equals(thread.getDriverUserId(), userId)) {
            throw new AppException(ErrorCode.CHAT_FORBIDDEN);
        }

        return thread;
    }

    private Role resolveSenderRole(ChatThreadDocument thread, String userId) {
        if (Objects.equals(thread.getCustomerUserId(), userId)) {
            return Role.CUSTOMER;
        }
        if (Objects.equals(thread.getDriverUserId(), userId)) {
            return Role.DRIVER;
        }
        throw new AppException(ErrorCode.CHAT_FORBIDDEN);
    }

    private void closeThread(ChatThreadDocument thread, String reason) {
        LocalDateTime now = LocalDateTime.now();
        thread.setStatus(ChatThreadStatus.CLOSED);
        thread.setChatAllowedUntil(now);
        thread.setUpdatedAt(now);
        if (StringUtils.hasText(reason)) {
            thread.setLastMessagePreview(reason.trim());
            thread.setLastMessageAt(now);
        }
        chatThreadRepository.save(thread);
    }

        private ChatThreadResponse toThreadResponse(ChatThreadDocument thread, String currentUserId, Booking booking) {
        int myUnread = Objects.equals(thread.getCustomerUserId(), currentUserId)
                ? safeInt(thread.getCustomerUnreadCount())
                : safeInt(thread.getDriverUnreadCount());

        return ChatThreadResponse.builder()
                .id(thread.getId())
                .bookingId(thread.getBookingId())
                .tripId(thread.getTripId())
            .chatTitle(buildChatTitle(booking, currentUserId))
                .customerUserId(thread.getCustomerUserId())
                .driverUserId(thread.getDriverUserId())
                .status(thread.getStatus())
                .chatAllowedFrom(thread.getChatAllowedFrom())
                .chatAllowedUntil(thread.getChatAllowedUntil())
                .lastMessageAt(thread.getLastMessageAt())
                .lastMessagePreview(thread.getLastMessagePreview())
                .customerUnreadCount(safeInt(thread.getCustomerUnreadCount()))
                .driverUnreadCount(safeInt(thread.getDriverUnreadCount()))
                .myUnreadCount(myUnread)
                .createdAt(thread.getCreatedAt())
                .updatedAt(thread.getUpdatedAt())
                .build();
    }

    private String buildChatTitle(Booking booking, String currentUserId) {
        if (booking == null) {
            return "Booking: --";
        }

        Trip trip = booking.getTrip();
        String routeName = buildRouteName(booking, trip);
        String departureLabel = buildDepartureLabel(trip);
        String counterpartName = buildCounterpartName(booking, currentUserId);

        return routeName + " - " + departureLabel + " - " + counterpartName;
    }

    private String buildRouteName(Booking booking, Trip trip) {
        String from = extractProvinceNameFromBookingPickup(booking);
        String to = extractProvinceNameFromBookingDropoff(booking);

        if (!StringUtils.hasText(from) && !StringUtils.hasText(to)) {
            from = extractProvinceNameFromPickup(trip);
            to = extractProvinceNameFromDropoff(trip);
        }

        if (trip == null) {
            return "Tuyen xe";
        }

        if (!StringUtils.hasText(from) && !StringUtils.hasText(to)) {
            return "Tuyen xe";
        }
        if (!StringUtils.hasText(from)) {
            return "-- - " + to;
        }
        if (!StringUtils.hasText(to)) {
            return from + " - --";
        }
        return from + " - " + to;
    }

    private String extractProvinceNameFromBookingPickup(Booking booking) {
        if (booking == null || booking.getPickupPoint() == null
                || booking.getPickupPoint().getWard() == null
                || booking.getPickupPoint().getWard().getProvince() == null) {
            return null;
        }
        return booking.getPickupPoint().getWard().getProvince().getName();
    }

    private String extractProvinceNameFromBookingDropoff(Booking booking) {
        if (booking == null || booking.getDropoffPoint() == null
                || booking.getDropoffPoint().getWard() == null
                || booking.getDropoffPoint().getWard().getProvince() == null) {
            return null;
        }
        return booking.getDropoffPoint().getWard().getProvince().getName();
    }

    private String extractProvinceNameFromPickup(Trip trip) {
        List<TripPickupPoint> points = trip.getPickupPoints();
        if (points == null || points.isEmpty()) {
            return null;
        }

        TripPickupPoint first = points.stream()
                .sorted(Comparator.comparing(TripPickupPoint::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder())))
                .findFirst()
                .orElse(points.get(0));

        return first.getWard() != null && first.getWard().getProvince() != null
                ? first.getWard().getProvince().getName()
                : null;
    }

    private String extractProvinceNameFromDropoff(Trip trip) {
        List<TripDropoffPoint> points = trip.getDropoffPoints();
        if (points == null || points.isEmpty()) {
            return null;
        }

        TripDropoffPoint first = points.stream()
                .sorted(Comparator.comparing(TripDropoffPoint::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder())))
                .findFirst()
                .orElse(points.get(0));

        return first.getWard() != null && first.getWard().getProvince() != null
                ? first.getWard().getProvince().getName()
                : null;
    }

    private String buildDepartureLabel(Trip trip) {
        if (trip == null || trip.getDepartureTime() == null) {
            return "--";
        }
        return trip.getDepartureTime().format(CHAT_TITLE_TIME_FORMAT);
    }

    private String buildCounterpartName(Booking booking, String currentUserId) {
        String customerName = booking.getCustomer() != null ? booking.getCustomer().getFullName() : null;
        String driverName = (booking.getTrip() != null
                && booking.getTrip().getDriver() != null
                && booking.getTrip().getDriver().getUser() != null)
                ? booking.getTrip().getDriver().getUser().getFullName()
                : null;

        boolean isCustomer = booking.getCustomer() != null
                && Objects.equals(booking.getCustomer().getId(), currentUserId);

        if (isCustomer) {
            return StringUtils.hasText(driverName) ? driverName : "Tài xế RideUp";
        }
        return StringUtils.hasText(customerName) ? customerName : "Khách hàng RideUp";
    }

    private ChatMessageResponse toMessageResponse(ChatMessageDocument message, String currentUserId) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .bookingId(message.getBookingId())
                .senderUserId(message.getSenderUserId())
                .senderRole(message.getSenderRole())
            .type(normalizeMessageType(message.getType()))
                .content(message.getContent())
                .imageUrl(message.getImageUrl())
                .sentAt(message.getSentAt())
                .mine(Objects.equals(message.getSenderUserId(), currentUserId))
                .build();
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String buildPreview(ChatMessageType type, String content) {
        if (normalizeMessageType(type) == ChatMessageType.MEDIA) {
            String caption = content == null ? "" : content.trim();
            if (!StringUtils.hasText(caption)) {
                return "[Hinh anh]";
            }
            return buildPreview("[Hinh anh] " + caption);
        }
        return buildPreview(content);
    }

    private String buildPreview(String content) {
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.length() <= 120) {
            return trimmed;
        }
        return trimmed.substring(0, 120);
    }

    private String normalizeImageUrl(String imageUrl) {
        String trimmed = imageUrl == null ? "" : imageUrl.trim();
        if (!StringUtils.hasText(trimmed)) {
            return null;
        }

        String lower = trimmed.toLowerCase();
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            return trimmed;
        }
        return fileService.getFileUrl(trimmed);
    }

    private ChatMessageType resolveMessageType(boolean hasContent, boolean hasImage, ChatMessageType requestedType) {
        ChatMessageType normalizedRequested = normalizeMessageType(requestedType);

        if (normalizedRequested == ChatMessageType.MEDIA) {
            if (!hasImage) {
                throw new AppException(ErrorCode.CHAT_MESSAGE_INVALID);
            }
            return ChatMessageType.MEDIA;
        }

        if (normalizedRequested == ChatMessageType.MESSAGE) {
            if (!hasContent) {
                throw new AppException(ErrorCode.CHAT_MESSAGE_INVALID);
            }
            return ChatMessageType.MESSAGE;
        }

        return hasImage ? ChatMessageType.MEDIA : ChatMessageType.MESSAGE;
    }

    private ChatMessageType normalizeMessageType(ChatMessageType type) {
        if (type == null) {
            return null;
        }

        if (type == ChatMessageType.IMAGE || type == ChatMessageType.MEDIA) {
            return ChatMessageType.MEDIA;
        }

        if (type == ChatMessageType.TEXT || type == ChatMessageType.MESSAGE) {
            return ChatMessageType.MESSAGE;
        }

        return ChatMessageType.MESSAGE;
    }
}
