-- Migration script for creating ticket system tables
-- Run this script to create the required tables for the ticket system

-- Create tickets table
CREATE TABLE IF NOT EXISTS `tickets` (
  `ticket_id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL COMMENT 'Reference to customer table',
  `subject` varchar(255) NOT NULL COMMENT 'Ticket subject/title',
  `description` text NOT NULL COMMENT 'Ticket description/message',
  `category` int(11) NOT NULL COMMENT '1=Order Issues, 2=Payment and Billing, 3=Shipping and Delivery, 4=Product Inquiries, 5=Returns and Exchanges, 6=Others',
  `status` enum('open','pending','closed','customer-reply') NOT NULL DEFAULT 'open' COMMENT 'Ticket status',
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium' COMMENT 'Ticket priority',
  `file` varchar(255) DEFAULT NULL COMMENT 'Uploaded file name',
  `date_added` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ticket_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category`),
  KEY `idx_date_added` (`date_added`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Customer support tickets table';

-- Create ticket_replies table
CREATE TABLE IF NOT EXISTS `ticket_replies` (
  `reply_id` int(11) NOT NULL AUTO_INCREMENT,
  `ticket_id` int(11) NOT NULL COMMENT 'Reference to tickets table',
  `message` text NOT NULL COMMENT 'Reply message content',
  `file` varchar(255) DEFAULT NULL COMMENT 'Uploaded file name for reply',
  `sender_type` enum('customer','admin') NOT NULL DEFAULT 'customer' COMMENT 'Who sent the reply',
  `sender_id` int(11) NOT NULL COMMENT 'customer_id or admin_id based on sender_type',
  `is_customer` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 for customer reply, 0 for admin reply',
  `date_added` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reply_id`),
  KEY `idx_ticket_id` (`ticket_id`),
  KEY `idx_sender` (`sender_type`, `sender_id`),
  KEY `idx_date_added` (`date_added`),
  CONSTRAINT `fk_ticket_replies_ticket_id` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`ticket_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ticket replies table';

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