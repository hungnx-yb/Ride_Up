package com.example.demo.entity.chat;

import com.example.demo.enums.ChatMessageType;
import com.example.demo.enums.Role;
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
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "chat_messages")
@CompoundIndexes({
		@CompoundIndex(name = "idx_thread_sent", def = "{'threadId': 1, 'sentAt': -1}"),
		@CompoundIndex(name = "idx_booking_sent", def = "{'bookingId': 1, 'sentAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ChatMessageDocument {
	@Id
	String id;

	String threadId;

	String bookingId;

	String senderUserId;

	Role senderRole;

	@Builder.Default
	ChatMessageType type = ChatMessageType.MESSAGE;

	String content;

	String imageUrl;

	@Builder.Default
	Boolean isDeleted = false;

	LocalDateTime sentAt;

	LocalDateTime createdAt;
}
