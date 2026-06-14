package com.example.demo.service;

import com.example.demo.dto.request.SendChatMessageRequest;
import com.example.demo.dto.response.ChatMessageResponse;
import com.example.demo.dto.response.ChatThreadResponse;
import com.example.demo.entity.Booking;
import com.example.demo.entity.DriverProfile;
import com.example.demo.entity.Trip;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock
    ChatThreadRepository chatThreadRepository;

    @Mock
    ChatMessageRepository chatMessageRepository;

    @Mock
    BookingRepository bookingRepository;

    @Mock
    UserService userService;

    @Mock
    ChatRealtimePublisher chatRealtimePublisher;

    @Mock
    FileService fileService;

    ChatService chatService;

    User customerUser;
    User driverUser;
    Booking booking;

    @BeforeEach
    void setUp() {
        chatService = new ChatService(
                chatThreadRepository,
                chatMessageRepository,
                bookingRepository,
                userService,
                chatRealtimePublisher,
                fileService
        );

        customerUser = new User();
        customerUser.setId("cust-123");
        customerUser.setFullName("Customer Name");

        driverUser = new User();
        driverUser.setId("driver-123");
        driverUser.setFullName("Driver Name");

        DriverProfile driverProfile = new DriverProfile();
        driverProfile.setUser(driverUser);

        Trip trip = new Trip();
        trip.setId("trip-123");
        trip.setDriver(driverProfile);
        trip.setStatus(TripStatus.OPEN);

        booking = Booking.builder()
                .id("booking-123")
                .customer(customerUser)
                .trip(trip)
                .status(BookingStatus.CONFIRMED)
                .build();
    }

    @Test
    void openThreadByBooking_shouldThrowException_whenUserNotParticipant() {
        User outsider = new User();
        outsider.setId("outsider-123");

        when(bookingRepository.findById("booking-123")).thenReturn(Optional.of(booking));
        when(userService.getCurrentUser()).thenReturn(outsider);

        AppException exception = assertThrows(AppException.class, () -> {
            chatService.openThreadByBooking("booking-123");
        });

        assertEquals(ErrorCode.CHAT_FORBIDDEN, exception.getErrorCode());
    }

    @Test
    void openThreadByBooking_shouldSucceed_whenParticipant() {
        ChatThreadDocument thread = ChatThreadDocument.builder()
                .id("thread-123")
                .bookingId("booking-123")
                .customerUserId("cust-123")
                .driverUserId("driver-123")
                .status(ChatThreadStatus.ACTIVE)
                .build();

        when(bookingRepository.findById("booking-123")).thenReturn(Optional.of(booking));
        when(userService.getCurrentUser()).thenReturn(customerUser);
        when(chatThreadRepository.findByBookingId("booking-123")).thenReturn(Optional.of(thread));

        ChatThreadResponse response = chatService.openThreadByBooking("booking-123");

        assertNotNull(response);
        assertEquals("thread-123", response.getId());
        assertEquals("booking-123", response.getBookingId());
    }

    @Test
    void sendMessage_shouldThrowException_whenThreadClosed() {
        ChatThreadDocument thread = ChatThreadDocument.builder()
                .id("thread-123")
                .bookingId("booking-123")
                .customerUserId("cust-123")
                .driverUserId("driver-123")
                .status(ChatThreadStatus.CLOSED) // closed
                .build();

        when(userService.getCurrentUser()).thenReturn(customerUser);
        when(chatThreadRepository.findById("thread-123")).thenReturn(Optional.of(thread));

        SendChatMessageRequest request = new SendChatMessageRequest("Hello", null, ChatMessageType.MESSAGE);

        AppException exception = assertThrows(AppException.class, () -> {
            chatService.sendMessage("thread-123", request);
        });

        assertEquals(ErrorCode.CHAT_NOT_ALLOWED, exception.getErrorCode());
    }

    @Test
    void sendMessage_shouldSucceed_whenActiveAndValid() {
        ChatThreadDocument thread = ChatThreadDocument.builder()
                .id("thread-123")
                .bookingId("booking-123")
                .customerUserId("cust-123")
                .driverUserId("driver-123")
                .status(ChatThreadStatus.ACTIVE)
                .customerUnreadCount(0)
                .driverUnreadCount(0)
                .build();

        when(userService.getCurrentUser()).thenReturn(customerUser);
        when(chatThreadRepository.findById("thread-123")).thenReturn(Optional.of(thread));
        when(bookingRepository.findById("booking-123")).thenReturn(Optional.of(booking));
        when(chatMessageRepository.save(any(ChatMessageDocument.class))).thenAnswer(invocation -> {
            ChatMessageDocument doc = invocation.getArgument(0);
            doc.setId("msg-123");
            return doc;
        });

        SendChatMessageRequest request = new SendChatMessageRequest("Hello driver", null, ChatMessageType.MESSAGE);

        ChatMessageResponse response = chatService.sendMessage("thread-123", request);

        assertNotNull(response);
        assertEquals("msg-123", response.getId());
        assertEquals("Hello driver", response.getContent());
        assertEquals(Role.CUSTOMER, response.getSenderRole());
        assertEquals(1, thread.getDriverUnreadCount()); // driver has 1 unread message
        verify(chatRealtimePublisher, times(1)).publishThreadMessage(any(ChatMessageResponse.class));
    }
}
