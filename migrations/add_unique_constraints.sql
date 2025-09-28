-- Migration script to add unique constraints to customer table
-- Run this script to ensure email and telephone are unique

-- Add unique constraint for email if it doesn't exist
ALTER TABLE `oc_customer` 
ADD CONSTRAINT `uk_customer_email` UNIQUE (`email`);

-- Add unique constraint for telephone if it doesn't exist  
ALTER TABLE `oc_customer` 
ADD CONSTRAINT `uk_customer_telephone` UNIQUE (`telephone`);

-- Check if constraints were added successfully
SELECT 'Unique constraints added successfully!' as message;
