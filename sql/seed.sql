-- ============================================================================
-- Caravan Accounting: Initial Seed Data
-- ============================================================================

-- 1. Initial migration version record
INSERT IGNORE INTO `schema_migrations` (`version`, `applied_at`) VALUES ('v1.0.0_initial_schema', NOW());

-- 2. Standard Business Categories
-- Income Categories
INSERT IGNORE INTO `categories` (`name`, `type`, `is_active`) VALUES
('Sales Revenue', 'income', 1),
('Service Income', 'income', 1),
('Consulting Fees', 'income', 1),
('Rental Income', 'income', 1),
('Interest & Dividends', 'income', 1),
('Other Income', 'income', 1);

-- Expense Categories
INSERT IGNORE INTO `categories` (`name`, `type`, `is_active`) VALUES
('Office Rent', 'expense', 1),
('Salaries & Wages', 'expense', 1),
('Electricity & Water', 'expense', 1),
('Internet & Telephone', 'expense', 1),
('Office Supplies & Stationery', 'expense', 1),
('Travel & Conveyance', 'expense', 1),
('Repairs & Maintenance', 'expense', 1),
('Meals & Refreshments', 'expense', 1),
('Software & Subscriptions', 'expense', 1),
('Courier & Postage', 'expense', 1),
('Bank Charges & Fees', 'expense', 1),
('Advertising & Marketing', 'expense', 1),
('Miscellaneous Expenses', 'expense', 1);

-- 3. Note regarding Initial Admin User:
-- Per SRS Section 8.4 ("Create the first admin user with setup script; no default passwords are shipped"):
-- Use the CLI setup command or the initial setup endpoint to generate your admin account:
-- Example command: php bin/create_admin.php "Administrator" "admin@caravan.local" "YourSecurePassword"
