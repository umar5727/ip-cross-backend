# Production Deployment Guide

This guide covers the complete deployment process for the production-ready Razorpay integration.

## 🚀 Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Production server with Node.js >= 16.0.0
- [ ] MySQL database server
- [ ] SSL certificates configured
- [ ] Domain name configured
- [ ] Razorpay live account setup

### 2. Security Configuration
- [ ] Firewall rules configured
- [ ] SSH key-based authentication
- [ ] Non-root user for application
- [ ] Database access restricted
- [ ] Backup strategy implemented

### 3. Razorpay Configuration
- [ ] Live API keys obtained
- [ ] Webhook endpoints configured
- [ ] IP whitelisting setup
- [ ] Test transactions completed

## 🔧 Server Setup

### 1. System Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install MySQL
sudo apt install mysql-server -y

# Install Nginx
sudo apt install nginx -y

# Install certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Application User
```bash
# Create application user
sudo adduser --system --group --home /opt/ecommerce ecommerce

# Switch to application user
sudo su - ecommerce
```

### 3. Application Deployment
```bash
# Clone repository
git clone <your-repository-url> /opt/ecommerce/app
cd /opt/ecommerce/app

# Install dependencies
npm ci --only=production

# Create necessary directories
mkdir -p logs
mkdir -p uploads
mkdir -p temp

# Set permissions
sudo chown -R ecommerce:ecommerce /opt/ecommerce
sudo chmod -R 755 /opt/ecommerce
```

## 🗄️ Database Setup

### 1. MySQL Configuration
```sql
-- Create database
CREATE DATABASE ecommerce_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'ecommerce_user'@'localhost' IDENTIFIED BY 'strong_password_here';

-- Grant permissions
GRANT ALL PRIVILEGES ON ecommerce_prod.* TO 'ecommerce_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Run Migrations
```bash
# Import database schema
mysql -u ecommerce_user -p ecommerce_prod < migrations/create_otp_table.sql
mysql -u ecommerce_user -p ecommerce_prod < migrations/add_unique_constraints.sql

# Import existing data if migrating
mysql -u ecommerce_user -p ecommerce_prod < backup/production_data.sql
```

### 3. Database Optimization
```sql
-- Optimize MySQL for production
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL max_connections = 200;
SET GLOBAL query_cache_size = 67108864; -- 64MB
```

## 🔐 Environment Configuration

### 1. Production Environment File
```bash
# Create production environment file
sudo nano /opt/ecommerce/app/.env
```

```env
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ecommerce_prod
DB_USER=ecommerce_user
DB_PASSWORD=your_secure_database_password

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_minimum_64_characters_long
JWT_EXPIRES_IN=24h

# Razorpay Live Configuration
RAZORPAY_KEY_ID=rzp_live_your_actual_key_id
RAZORPAY_KEY_SECRET=your_actual_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_actual_webhook_secret

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
WEBHOOK_IP_WHITELIST=127.0.0.1,::1,106.51.16.0/24,106.51.17.0/24

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Email Configuration (if applicable)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@yourdomain.com
SMTP_PASS=your_app_password
```

### 2. Secure Environment File
```bash
# Set proper permissions
sudo chmod 600 /opt/ecommerce/app/.env
sudo chown ecommerce:ecommerce /opt/ecommerce/app/.env
```

## 🌐 Nginx Configuration

### 1. Nginx Site Configuration
```bash
sudo nano /etc/nginx/sites-available/ecommerce
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=payment:10m rate=5r/s;

    # Main API
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Payment endpoints with stricter rate limiting
    location /api/payment/ {
        limit_req zone=payment burst=10 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Static files (if any)
    location /static/ {
        alias /opt/ecommerce/app/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
```

### 2. Enable Site
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 3. SSL Certificate
```bash
# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## 🚀 PM2 Configuration

### 1. PM2 Ecosystem File
```bash
nano /opt/ecommerce/app/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'ecommerce-backend',
    script: 'index.js',
    cwd: '/opt/ecommerce/app',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000
  }]
};
```

### 2. Start Application
```bash
# Start with PM2
cd /opt/ecommerce/app
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
sudo pm2 startup systemd -u ecommerce --hp /opt/ecommerce
```

## 📊 Monitoring Setup

### 1. Log Rotation
```bash
sudo nano /etc/logrotate.d/ecommerce
```

```
/opt/ecommerce/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ecommerce ecommerce
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. System Monitoring
```bash
# Install monitoring tools
sudo apt install htop iotop nethogs -y

# Setup basic monitoring script
nano /opt/ecommerce/monitor.sh
```

```bash
#!/bin/bash
# Basic monitoring script

# Check application status
pm2 status

# Check disk space
df -h

# Check memory usage
free -h

# Check recent errors
tail -n 50 /opt/ecommerce/app/logs/error.log
```

## 🔐 Razorpay Production Setup

### 1. Webhook Configuration
```bash
# Webhook URL: https://yourdomain.com/api/payment/razorpay/webhook
# Events to subscribe:
# - payment.captured
# - payment.failed
# - order.paid
# - refund.created
```

### 2. IP Whitelisting
Update your `.env` file with Razorpay's IP ranges:
```env
WEBHOOK_IP_WHITELIST=127.0.0.1,::1,106.51.16.0/24,106.51.17.0/24,106.51.18.0/24
```

### 3. Test Production Setup
```bash
# Test payment creation
curl -X POST https://yourdomain.com/api/payment/razorpay/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token" \
  -d '{
    "order_id": "test_order_123",
    "amount": 100.00,
    "currency": "INR"
  }'
```

## 🔄 Backup Strategy

### 1. Database Backup
```bash
# Create backup script
nano /opt/ecommerce/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/ecommerce/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
mysqldump -u ecommerce_user -p ecommerce_prod > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

# Application files backup
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /opt/ecommerce/app --exclude=node_modules --exclude=logs
```

### 2. Automated Backups
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/ecommerce/backup.sh
```

## 🚨 Security Hardening

### 1. Firewall Configuration
```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Fail2Ban Setup
```bash
# Install Fail2Ban
sudo apt install fail2ban -y

# Configure for Nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
```

## 📋 Post-Deployment Checklist

- [ ] Application starts successfully
- [ ] Database connections working
- [ ] SSL certificate valid
- [ ] Payment endpoints responding
- [ ] Webhook receiving events
- [ ] Logs being written
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Security measures active
- [ ] Performance optimized

## 🔍 Troubleshooting

### Common Issues

1. **Application won't start**
   ```bash
   # Check logs
   pm2 logs ecommerce-backend
   
   # Check environment
   pm2 env 0
   ```

2. **Database connection issues**
   ```bash
   # Test connection
   mysql -u ecommerce_user -p ecommerce_prod -e "SELECT 1;"
   ```

3. **SSL certificate issues**
   ```bash
   # Check certificate
   sudo certbot certificates
   
   # Renew if needed
   sudo certbot renew
   ```

4. **Payment issues**
   ```bash
   # Check Razorpay logs
   tail -f /opt/ecommerce/app/logs/app.log | grep payment
   ```

## 📞 Support

For deployment issues:
1. Check application logs: `/opt/ecommerce/app/logs/`
2. Check system logs: `sudo journalctl -u nginx`
3. Check PM2 status: `pm2 status`
4. Review this deployment guide

---

**Note**: Always test the deployment process in a staging environment before deploying to production.