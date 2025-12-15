-- MySQL dump 10.13  Distrib 8.0.43, for Linux (x86_64)
--
-- Host: localhost    Database: chatbot_platform
-- ------------------------------------------------------
-- Server version	8.0.43
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */
;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */
;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */
;
/*!50503 SET NAMES utf8mb4 */
;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */
;
/*!40103 SET TIME_ZONE='+00:00' */
;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */
;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */
;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */
;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */
;
--
-- Table structure for table `appointments`
--
DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `appointments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `api_key` varchar(255) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_email` varchar(255) NOT NULL,
  `customer_phone` varchar(20) DEFAULT NULL,
  `appointment_date` datetime NOT NULL,
  `appointment_duration` int DEFAULT '60',
  `status` varchar(50) DEFAULT 'pending',
  `google_event_id` varchar(255) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
--
-- Table structure for table `assistant_configs`
--
DROP TABLE IF EXISTS `assistant_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `assistant_configs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `chatbot_id` int NOT NULL,
  `api_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assistant_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'OpenAI Assistant ID',
  `vector_store_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'OpenAI Vector Store ID',
  `openai_file_ids` json DEFAULT NULL COMMENT 'List of uploaded file IDs with metadata',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_company` (`chatbot_id`),
  KEY `idx_assistant_id` (`assistant_id`),
  KEY `idx_vector_store_id` (`vector_store_id`),
  KEY `idx_api_key` (`api_key`),
  CONSTRAINT `assistant_configs_ibfk_1` FOREIGN KEY (`chatbot_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 36 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
--
-- Table structure for table `auth_sessions`
--
DROP TABLE IF EXISTS `auth_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `auth_sessions` (
  `auth_session_id` char(36) NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `last_activity_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`auth_session_id`),
  KEY `idx_sessions_user_id` (`user_id`),
  KEY `idx_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
--
-- Table structure for table `companies`
--
DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `companyName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `websiteURL` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `industry` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `industryOther` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `botName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `greeting` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `botRestrictions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `files_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `website_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `prompt_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `api_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `script` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `allowedDomains` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `primaryColor` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '#4f46e5',
  `position` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Bottom Right',
  `themeStyle` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Minimal',
  `suggestedPrompts` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `coreFeatures` json DEFAULT NULL,
  `leadCaptureFields` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `chatbotLanguage` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo_url` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `botAvatar` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `personaSelect` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `defaultFailResponse` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `botTypePreset` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `faq_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `google_credentials` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `appointment_settings` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_key` (`api_key`)
) ENGINE = InnoDB AUTO_INCREMENT = 158 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
--
-- Table structure for table `daily_analytics`
--
DROP TABLE IF EXISTS `daily_analytics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `daily_analytics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `api_key` varchar(100) NOT NULL,
  `date` date NOT NULL,
  `daily_total_messages` int DEFAULT NULL,
  `daily_user_messages` int DEFAULT NULL,
  `daily_assistant_messages` int DEFAULT NULL,
  `daily_total_sessions` int DEFAULT NULL,
  `daily_ratings_sum` int DEFAULT '0',
  `daily_ratings_count` int DEFAULT '0',
  `company_name` varchar(255) DEFAULT NULL,
  `daily_avg_response_time` float DEFAULT '0',
  `daily_avg_rating` float DEFAULT '0',
  `daily_response_time_sum` float DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_daily` (`api_key`, `date`),
  KEY `idx_api_key` (`api_key`),
  KEY `idx_date` (`date`),
  KEY `idx_api_key_date` (`api_key`, `date`)
) ENGINE = InnoDB AUTO_INCREMENT = 68 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
--
-- Table structure for table `leads`
--
DROP TABLE IF EXISTS `leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `leads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `chatbot_id` int NOT NULL,
  `api_key` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  `message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chatbot_id` (`chatbot_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `leads_ibfk_1` FOREIGN KEY (`chatbot_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
--
-- Table structure for table `otp_codes`
--
DROP TABLE IF EXISTS `otp_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `otp_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `verification` varchar(100) NOT NULL,
  `code` varchar(100) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `purpose` enum('register', 'login') NOT NULL DEFAULT 'login',
  `attempts` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_email_code` (`verification`, `code`),
  KEY `idx_otp_lookup` (
    `verification`,
    `purpose`,
    `used`,
    `expires_at`,
    `id`
  ),
  KEY `idx_find_user_otp` (`user_id`, `purpose`, `used`, `expires_at`, `id`)
) ENGINE = InnoDB AUTO_INCREMENT = 190 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
--
-- Table structure for table `total_analytics`
--
DROP TABLE IF EXISTS `total_analytics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `total_analytics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `api_key` varchar(100) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `total_messages` int DEFAULT '0',
  `total_user_messages` int DEFAULT '0',
  `total_assistant_messages` int DEFAULT '0',
  `total_sessions` int DEFAULT '0',
  `total_ratings_sum` int DEFAULT '0',
  `total_ratings_count` int DEFAULT '0',
  `last_updated` date DEFAULT NULL,
  `total_response_time_sum` float DEFAULT '0',
  `last_message_at` datetime DEFAULT NULL,
  PRIMARY KEY (`api_key`),
  UNIQUE KEY `id` (`id`),
  KEY `idx_company_name` (`company_name`),
  KEY `idx_last_updated` (`last_updated`),
  KEY `idx_api_key` (`api_key`)
) ENGINE = InnoDB AUTO_INCREMENT = 19 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
--
-- Table structure for table `user_chatbots`
--
DROP TABLE IF EXISTS `user_chatbots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `user_chatbots` (
  `user_id` int NOT NULL,
  `chatbot_id` int DEFAULT NULL,
  `api_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `api_key`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_api_key` (`api_key`),
  KEY `fk_user_chatbots_bot` (`chatbot_id`),
  CONSTRAINT `fk_user_chatbots_bot` FOREIGN KEY (`chatbot_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_chatbots_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_chatbots_ibfk_2` FOREIGN KEY (`api_key`) REFERENCES `companies` (`api_key`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
--
-- Table structure for table `users`
--
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(100) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `preferred_otp_method` enum('email', 'sms') DEFAULT 'email',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `phone_verified` tinyint(1) DEFAULT '0',
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`)
) ENGINE = InnoDB AUTO_INCREMENT = 60 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */
;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */
;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */
;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */
;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */
;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */
;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */
;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */
;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */
;
--
-- Table structure for table `face_embeddings`
--
DROP TABLE IF EXISTS `face_embeddings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */
;
/*!50503 SET character_set_client = utf8mb4 */
;
CREATE TABLE `face_embeddings` (
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
/*!40101 SET character_set_client = @saved_cs_client */
;
-- Dump completed on 2025-11-03 11:39:49