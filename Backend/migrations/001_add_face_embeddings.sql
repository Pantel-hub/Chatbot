-- Migration: Add face_embeddings table
-- Date: 2025-12-15
-- Description: Create table to store face embeddings for facial recognition authentication
CREATE TABLE IF NOT EXISTS `face_embeddings` (
    `id` int NOT NULL AUTO_INCREMENT,
    `user_id` int NOT NULL,
    `embedding` blob NOT NULL COMMENT 'Face embedding vector stored as binary',
    `model_name` varchar(50) NOT NULL DEFAULT 'Facenet512' COMMENT 'DeepFace model used for embedding',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_user_face` (`user_id`),
    KEY `idx_user_id` (`user_id`),
    CONSTRAINT `face_embeddings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;