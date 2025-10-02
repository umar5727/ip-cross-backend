# E-commerce Backend with Production-Ready Razorpay Integration

A robust Node.js e-commerce backend with secure Razorpay payment integration, built for production deployment.

## 🚀 Features

### Payment Integration
- **Secure Razorpay Integration**: Production-ready payment processing
- **Multi-currency Support**: INR, USD, EUR, GBP with proper validation
- **Webhook Security**: IP whitelisting, signature validation, replay protection
- **Transaction Management**: Database transactions for payment consistency
- **Refund Processing**: Automated refund handling with validation

### Security
- **Rate Limiting**: Configurable limits for payment endpoints
- **Request Validation**: Comprehensive input sanitization
- **Security Headers**: Helmet.js integration with CSP
- **Environment Validation**: Secure credential management
- **Audit Logging**: Structured logging for security events

### Production Features
- **Structured Logging**: Winston-based logging with rotation
- **Error Handling**: Comprehensive error management
- **Retry Logic**: Exponential backoff for API calls
- **Health Monitoring**: Payment operation monitoring
- **Database Optimization**: Connection pooling and transactions

## 📋 Prerequisites

- Node.js >= 16.0.0
- MySQL >= 5.7
- Redis (optional, for caching)
- Razorpay Account (Live/Test)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ip-cross-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file with:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password

   # Razorpay Configuration
   RAZORPAY_KEY_ID=rzp_live_your_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

   # Security Configuration
   JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
   WEBHOOK_IP_WHITELIST=127.0.0.1,::1,razorpay_ips
   ```

4. **Database Setup**
   ```bash
   # Run migrations
   mysql -u username -p database_name < migrations/create_otp_table.sql
   mysql -u username -p database_name < migrations/add_unique_constraints.sql
   ```

5. **Create Logs Directory**
   ```bash
   mkdir logs
   ```

## 🚀 Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## 🔐 Razorpay Integration

### Payment Flow

1. **Create Order**
   ```javascript
   POST /api/payment/razorpay/create-order
   {
     "order_id": "12345",
     "amount": 1000.50,
     "currency": "INR"
   }
   ```

2. **Verify Payment**
   ```javascript
   POST /api/payment/razorpay/verify-payment
   {
     "razorpay_order_id": "order_xxx",
     "razorpay_payment_id": "pay_xxx",
     "razorpay_signature": "signature_xxx",
     "order_id": "12345"
   }
   ```

3. **Webhook Handling**
   ```javascript
   POST /api/payment/razorpay/webhook
   // Automatically processes payment events
   ```

4. **Create Refund**
   ```javascript
   POST /api/payment/razorpay/create-refund
   {
     "payment_id": "pay_xxx",
     "amount": 500.25,
     "currency": "INR"
   }
   ```

### Security Features

- **Amount Validation**: Precision handling for floating-point arithmetic
- **Signature Verification**: Timing-safe comparison to prevent attacks
- **Replay Protection**: Timestamp validation for webhooks
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **IP Whitelisting**: Configurable IP restrictions for webhooks

## 📊 Monitoring & Logging

### Log Levels
- **Error**: Payment failures, security violations
- **Warn**: Suspicious activities, validation failures
- **Info**: Payment events, order creation
- **Debug**: Detailed operation logs (development only)

### Log Files
- `logs/app.log`: General application logs
- `logs/error.log`: Error-specific logs
- `logs/payment.log`: Payment operation logs

### Monitoring Events
- Payment creation and verification
- Webhook processing
- Refund operations
- Security violations
- Rate limit exceeded

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | Required |
| `RAZORPAY_KEY_SECRET` | Razorpay Secret | Required |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook Secret | Required |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `LOG_LEVEL` | Logging level | `info` |

### Security Configuration

```javascript
// Rate limiting
RATE_LIMIT_WINDOW_MS=900000  // 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  // 100 requests per window

// IP Whitelisting (comma-separated)
WEBHOOK_IP_WHITELIST=127.0.0.1,::1,razorpay_ip_ranges

// CORS Origins (comma-separated)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

## 🧪 Testing

### Manual Testing
Use the provided Postman collections:
- `Reward_API_Postman_Collection.json`
- `all_categories_postman_collection.json`
- `home_content_postman_collection.json`

### Payment Testing
1. Use Razorpay test credentials
2. Test with various amounts and currencies
3. Verify webhook processing
4. Test refund functionality

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use live Razorpay credentials
- [ ] Configure proper IP whitelisting
- [ ] Set up log rotation
- [ ] Configure reverse proxy (Nginx)
- [ ] Set up SSL certificates
- [ ] Configure database connection pooling
- [ ] Set up monitoring and alerts

### Docker Deployment
```bash
docker-compose up -d
```

### PM2 Deployment
```bash
npm install -g pm2
pm2 start index.js --name "ecommerce-backend"
pm2 startup
pm2 save
```

## 🔍 Troubleshooting

### Common Issues

1. **Payment Creation Fails**
   - Check Razorpay credentials
   - Verify amount validation
   - Check database connectivity

2. **Webhook Verification Fails**
   - Verify webhook secret
   - Check IP whitelisting
   - Validate signature format

3. **Rate Limiting Issues**
   - Adjust rate limit configuration
   - Implement proper retry logic
   - Check IP-based limits

### Debug Mode
```bash
LOG_LEVEL=debug npm start
```

## 📝 API Documentation

### Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment/razorpay/create-order` | Create payment order |
| POST | `/api/payment/razorpay/verify-payment` | Verify payment |
| POST | `/api/payment/razorpay/webhook` | Process webhooks |
| POST | `/api/payment/razorpay/create-refund` | Create refund |

### Response Format
```javascript
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### Error Format
```javascript
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the logs for detailed error information

---

**Note**: This implementation is production-ready with comprehensive security measures, error handling, and monitoring capabilities.