package com.example.demo.config;

import com.example.demo.entity.chat.ChatMessageDocument;
import com.example.demo.entity.chat.ChatThreadDocument;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.IndexDefinition;

@Configuration
@Slf4j
public class MongoIndexConfig {

    @Bean
    ApplicationRunner ensureChatMongoIndexes(MongoTemplate mongoTemplate) {
        return args -> {
            IndexOperations threadOps = mongoTemplate.indexOps(ChatThreadDocument.class);
                        safeEnsureIndex(threadOps, new Index().on("bookingId", Sort.Direction.ASC).unique().named("bookingId"), "chat_threads.bookingId");
                        safeEnsureIndex(threadOps, new Index().on("tripId", Sort.Direction.ASC).named("tripId"), "chat_threads.tripId");
                        safeEnsureIndex(threadOps, new CompoundIndexDefinition(
                    new Document("customerUserId", 1)
                            .append("status", 1)
                            .append("lastMessageAt", -1)
                        ).named("idx_customer_status_last"), "chat_threads.idx_customer_status_last");
                        safeEnsureIndex(threadOps, new CompoundIndexDefinition(
                    new Document("driverUserId", 1)
                            .append("status", 1)
                            .append("lastMessageAt", -1)
                        ).named("idx_driver_status_last"), "chat_threads.idx_driver_status_last");

            IndexOperations messageOps = mongoTemplate.indexOps(ChatMessageDocument.class);
                        safeEnsureIndex(messageOps, new CompoundIndexDefinition(
                    new Document("threadId", 1)
                            .append("sentAt", -1)
                        ).named("idx_thread_sent"), "chat_messages.idx_thread_sent");
                        safeEnsureIndex(messageOps, new CompoundIndexDefinition(
                    new Document("bookingId", 1)
                            .append("sentAt", -1)
                        ).named("idx_booking_sent"), "chat_messages.idx_booking_sent");

            log.info("Ensured Mongo indexes for chat_threads and chat_messages");
        };
    }

        private void safeEnsureIndex(IndexOperations operations, IndexDefinition indexDefinition, String label) {
                try {
                        operations.ensureIndex(indexDefinition);
                } catch (Exception ex) {
                        log.warn("Skip ensure index {} due to existing conflict or incompatible options: {}", label, ex.getMessage());
                }
        }
}
