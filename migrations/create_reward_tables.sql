-- Migration script for creating reward system tables
-- Run this script to create the required tables for the reward system

-- Create customer_reward table (matching OpenCart structure)
CREATE TABLE IF NOT EXISTS `customer_reward` (
  `customer_reward_id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL COMMENT 'Reference to customer table',
  `order_id` int(11) NOT NULL DEFAULT 0 COMMENT 'Reference to order table (0 for non-order rewards)',
  `description` text NOT NULL COMMENT 'Reward description/reason',
  `points` int(11) NOT NULL DEFAULT 0 COMMENT 'Reward points (can be negative for deductions)',
  `date_added` datetime NOT NULL COMMENT 'Date reward was added',
  PRIMARY KEY (`customer_reward_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_date_added` (`date_added`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Customer reward points table';

-- Insert sample reward data (optional for testing)
INSERT INTO `customer_reward` (`customer_reward_id`, `customer_id`, `order_id`, `description`, `points`, `date_added`) VALUES
(1, 1, 123, 'Welcome bonus for new customer', 100, '2024-01-15 10:30:00'),
(2, 1, 124, 'Purchase reward for order #124', 50, '2024-01-20 14:45:00'),
(3, 1, 0, 'Birthday bonus', 25, '2024-02-01 09:00:00'),
(4, 2, 125, 'Purchase reward for order #125', 75, '2024-02-05 16:20:00'),
(5, 1, 126, 'Purchase reward for order #126', 30, '2024-02-10 11:15:00');

SELECT 'Reward tables created successfully!' as message;