package com.example.demo.entity.chat;

import com.example.demo.enums.ChatThreadStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "chat_threads")
@CompoundIndexes({
		@CompoundIndex(name = "idx_customer_status_last", def = "{'customerUserId': 1, 'status': 1, 'lastMessageAt': -1}"),
		@CompoundIndex(name = "idx_driver_status_last", def = "{'driverUserId': 1, 'status': 1, 'lastMessageAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ChatThreadDocument {
	@Id
	String id;

	@Indexed(unique = true)
	String bookingId;

	@Indexed
	String tripId;

	String customerUserId;

	String driverUserId;

	ChatThreadStatus status;

	LocalDateTime chatAllowedFrom;

	LocalDateTime chatAllowedUntil;

	LocalDateTime lastMessageAt;

	String lastMessagePreview;

	@Builder.Default
	Integer customerUnreadCount = 0;

	@Builder.Default
	Integer driverUnreadCount = 0;

	LocalDateTime createdAt;

	LocalDateTime updatedAt;
}
