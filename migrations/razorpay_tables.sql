-- Create mobile_razorpay_order table
CREATE TABLE IF NOT EXISTS `mobile_razorpay_order` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `razorpay_order_id` varchar(50) NOT NULL COMMENT 'Razorpay order ID from API',
  `oc_order_id` int(11) DEFAULT NULL COMMENT 'Reference to OpenCart order table',
  `customer_id` int(11) NOT NULL COMMENT 'Customer ID from mobile app',
  `amount` decimal(15,4) NOT NULL COMMENT 'Order amount in paise',
  `currency` varchar(3) NOT NULL DEFAULT 'INR',
  `receipt` varchar(40) NOT NULL COMMENT 'Receipt ID for tracking',
  `status` enum('created','attempted','paid','failed','cancelled','refunded') NOT NULL DEFAULT 'created',
  `razorpay_payment_id` varchar(50) DEFAULT NULL COMMENT 'Payment ID after successful payment',
  `razorpay_signature` varchar(255) DEFAULT NULL COMMENT 'Payment signature for verification',
  `payment_method` varchar(50) DEFAULT NULL COMMENT 'Payment method used (card, netbanking, upi, etc.)',
  `notes` TEXT DEFAULT NULL COMMENT 'Additional notes and metadata (JSON string)',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `razorpay_order_id` (`razorpay_order_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_oc_order_id` (`oc_order_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mobile Razorpay orders tracking table';

-- Create mobile_razorpay_webhook_log table
CREATE TABLE IF NOT EXISTS `mobile_razorpay_webhook_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` varchar(50) NOT NULL COMMENT 'Razorpay event ID',
  `event_type` varchar(50) NOT NULL COMMENT 'Type of webhook event (payment.captured, payment.failed, etc.)',
  `entity_type` varchar(20) NOT NULL COMMENT 'Entity type (payment, order, refund, etc.)',
  `entity_id` varchar(50) NOT NULL COMMENT 'Entity ID from Razorpay',
  `payload` TEXT NOT NULL COMMENT 'Complete webhook payload (JSON string)',
  `signature` varchar(255) NOT NULL COMMENT 'Webhook signature for verification',
  `signature_verified` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether signature was verified successfully',
  `processed` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether webhook was processed successfully',
  `processing_error` text DEFAULT NULL COMMENT 'Error message if processing failed',
  `retry_count` int(11) NOT NULL DEFAULT '0' COMMENT 'Number of processing retries',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `event_id` (`event_id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_entity_id` (`entity_id`),
  KEY `idx_processed` (`processed`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Razorpay webhook events log for auditing';

-- Create mobile_razorpay_refund table
CREATE TABLE IF NOT EXISTS `mobile_razorpay_refund` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `razorpay_refund_id` varchar(50) NOT NULL COMMENT 'Razorpay refund ID from API',
  `razorpay_payment_id` varchar(50) NOT NULL COMMENT 'Original payment ID being refunded',
  `razorpay_order_id` varchar(50) NOT NULL COMMENT 'Original order ID',
  `oc_order_id` int(11) DEFAULT NULL COMMENT 'Reference to OpenCart order table',
  `amount` decimal(15,4) NOT NULL COMMENT 'Refund amount in paise',
  `currency` varchar(3) NOT NULL DEFAULT 'INR',
  `status` enum('pending','processed','failed') NOT NULL DEFAULT 'pending',
  `refund_type` enum('full','partial') NOT NULL COMMENT 'Type of refund',
  `reason` varchar(255) DEFAULT NULL COMMENT 'Reason for refund',
  `receipt` varchar(40) DEFAULT NULL COMMENT 'Receipt ID for refund tracking',
  `notes` TEXT DEFAULT NULL COMMENT 'Additional notes and metadata (JSON string)',
  `processed_at` timestamp NULL DEFAULT NULL COMMENT 'When refund was processed by Razorpay',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `razorpay_refund_id` (`razorpay_refund_id`),
  KEY `idx_razorpay_payment_id` (`razorpay_payment_id`),
  KEY `idx_razorpay_order_id` (`razorpay_order_id`),
  KEY `idx_status` (`status`),
  KEY `idx_oc_order_id` (`oc_order_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mobile Razorpay refunds tracking table';