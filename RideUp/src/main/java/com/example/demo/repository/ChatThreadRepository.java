package com.example.demo.repository;

import com.example.demo.entity.chat.ChatThreadDocument;
import com.example.demo.enums.ChatThreadStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ChatThreadRepository extends MongoRepository<ChatThreadDocument, String> {
	Optional<ChatThreadDocument> findByBookingId(String bookingId);

	List<ChatThreadDocument> findByCustomerUserIdAndStatusOrderByLastMessageAtDesc(String customerUserId, ChatThreadStatus status);

	List<ChatThreadDocument> findByDriverUserIdAndStatusOrderByLastMessageAtDesc(String driverUserId, ChatThreadStatus status);

	List<ChatThreadDocument> findByTripIdAndStatus(String tripId, ChatThreadStatus status);
}
