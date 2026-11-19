-- ============================================================================
-- Caravan Accounting: Income & Expense Management System (Rebuild)
-- Database Schema (Version 1.0)
-- Target DBMS: MariaDB 10.6+ / MySQL 8.0+ / MySQL 5.7+
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. Table: schema_migrations
-- Keeps track of applied migrations for forward-only migrations (Section 8.7)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `schema_migrations` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `version` VARCHAR(100) NOT NULL UNIQUE,
    `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Table: users
-- User accounts with RBAC (Admin / Viewer) and bcrypt/Argon2 password hashes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'viewer') NOT NULL DEFAULT 'viewer',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `last_login_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_role` (`role`),
    INDEX `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Table: categories
-- System categories for Income and Expense transactions. 
-- Inactive categories stay on historical records (FR-CAT-3).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('income', 'expense') NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_categories_name_type` (`name`, `type`),
    INDEX `idx_categories_type_active` (`type`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Table: transactions
-- Core ledger entries for Income and Expense with optional bill attachment
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transactions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `type` ENUM('income', 'expense') NOT NULL,
    `category_id` INT UNSIGNED NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_mode` ENUM('Cash', 'Bank', 'UPI', 'Cheque', 'Card') NOT NULL DEFAULT 'Cash',
    `description` TEXT NULL,
    `txn_date` DATE NOT NULL,
    `bill_file` VARCHAR(255) NULL,
    `bill_original_name` VARCHAR(255) NULL,
    `created_by` INT UNSIGNED NOT NULL,
    `updated_by` INT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `chk_transactions_amount` CHECK (`amount` > 0),
    CONSTRAINT `fk_transactions_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_transactions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_transactions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_transactions_date` (`txn_date`),
    INDEX `idx_transactions_type` (`type`),
    INDEX `idx_transactions_category` (`category_id`),
    INDEX `idx_transactions_mode` (`payment_mode`),
    INDEX `idx_transactions_type_date` (`type`, `txn_date`),
    INDEX `idx_transactions_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Table: audit_log
-- Audit log of actions (creates, updates, deletes, logins, password resets)
-- Read-only in UI, retained indefinitely (Section 3.11 & 5.1)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_log` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NULL,
    `action` VARCHAR(50) NOT NULL,
    `entity` VARCHAR(50) NOT NULL,
    `entity_id` VARCHAR(50) NULL,
    `details` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_audit_user_action` (`user_id`, `action`),
    INDEX `idx_audit_entity` (`entity`, `entity_id`),
    INDEX `idx_audit_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Table: login_attempts
-- Tracks failed authentication attempts for IP/account lockouts (FR-AUTH-5)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login_attempts` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `attempted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_login_attempts_email_ip_time` (`email`, `ip_address`, `attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
