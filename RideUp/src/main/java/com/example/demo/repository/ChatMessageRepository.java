package com.example.demo.repository;

import com.example.demo.entity.chat.ChatMessageDocument;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ChatMessageRepository extends MongoRepository<ChatMessageDocument, String> {
	List<ChatMessageDocument> findByThreadIdOrderBySentAtDesc(String threadId, Pageable pageable);
}
