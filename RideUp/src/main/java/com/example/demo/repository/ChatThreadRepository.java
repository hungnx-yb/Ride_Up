package com.example.demo.repository;

import com.example.demo.entity.chat.ChatThreadDocument;
import com.example.demo.enums.ChatThreadStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChatThreadRepository extends MongoRepository<ChatThreadDocument, String> {
	Optional<ChatThreadDocument> findByBookingId(String bookingId);

	List<ChatThreadDocument> findByCustomerUserIdAndStatusOrderByLastMessageAtDesc(String customerUserId, ChatThreadStatus status);

	List<ChatThreadDocument> findByDriverUserIdAndStatusOrderByLastMessageAtDesc(String driverUserId, ChatThreadStatus status);

	@Query(value = "{ '$or': [ {'customerUserId': ?0}, {'driverUserId': ?0} ], 'status': { '$in': ?1 } }", sort = "{ 'lastMessageAt': -1 }")
	List<ChatThreadDocument> findByParticipantAndStatuses(String userId, List<ChatThreadStatus> statuses);

	List<ChatThreadDocument> findByTripIdAndStatus(String tripId, ChatThreadStatus status);
}
