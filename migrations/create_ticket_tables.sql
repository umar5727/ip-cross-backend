-- Migration script for creating ticket system tables
-- Run this script to create the required tables for the ticket system

-- Create customer_ticket table (matching OpenCart structure)
CREATE TABLE IF NOT EXISTS `oc_customer_ticket` (
  `ticket_id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL COMMENT 'Reference to customer table',
  `subject` varchar(255) NOT NULL COMMENT 'Ticket subject/title',
  `description` text NOT NULL COMMENT 'Ticket description/message',
  `category` varchar(255) NOT NULL COMMENT 'Category name (Order Issues, Payment and Billing Issues, etc.)',
  `status` varchar(32) NOT NULL DEFAULT 'open' COMMENT 'Ticket status (open, pending, closed, customer-reply)',
  `file` varchar(255) NOT NULL DEFAULT '' COMMENT 'Uploaded file name',
  `date_added` datetime NOT NULL COMMENT 'Date ticket was created',
  PRIMARY KEY (`ticket_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category`),
  KEY `idx_date_added` (`date_added`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Customer support tickets table';

-- Create customer_ticket_reply table (matching OpenCart structure)
CREATE TABLE IF NOT EXISTS `oc_customer_ticket_reply` (
  `reply_id` int(11) NOT NULL AUTO_INCREMENT,
  `ticket_id` int(11) NOT NULL COMMENT 'Reference to oc_customer_ticket table',
  `customer_id` int(11) NOT NULL COMMENT 'Customer ID who made the reply',
  `message` text NOT NULL COMMENT 'Reply message content',
  `file` varchar(255) NOT NULL DEFAULT '' COMMENT 'Uploaded file name for reply',
  `user_type` varchar(32) NOT NULL DEFAULT 'customer' COMMENT 'Type of user (customer, admin)',
  `date_added` datetime NOT NULL COMMENT 'Date reply was added',
  PRIMARY KEY (`reply_id`),
  KEY `idx_ticket_id` (`ticket_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_date_added` (`date_added`),
  CONSTRAINT `fk_customer_ticket_reply_ticket_id` FOREIGN KEY (`ticket_id`) REFERENCES `oc_customer_ticket` (`ticket_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Customer ticket replies table';

-- Insert sample ticket categories data (optional)
-- You can uncomment these if you want to store categories in a separate table
-- CREATE TABLE IF NOT EXISTS `ticket_categories` (
--   `category_id` int(11) NOT NULL AUTO_INCREMENT,
--   `name` varchar(100) NOT NULL,
--   `description` text DEFAULT NULL,
--   `status` tinyint(1) NOT NULL DEFAULT 1,
--   PRIMARY KEY (`category_id`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- 
-- INSERT INTO `ticket_categories` (`category_id`, `name`, `description`) VALUES
-- (1, 'Order Issues', 'Problems related to orders'),
-- (2, 'Payment and Billing Issues', 'Payment and billing related problems'),
-- (3, 'Shipping and Delivery', 'Shipping and delivery related issues'),
-- (4, 'Product or Service Inquiries', 'Questions about products or services'),
-- (5, 'Returns and Exchanges', 'Return and exchange requests'),
-- (6, 'Others', 'Other general inquiries');

SELECT 'Ticket tables created successfully!' as message;