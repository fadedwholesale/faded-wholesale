# Faded Skies Wholesale Platform - Environment Configuration
# Copy this file to .env and update the values for your environment

# Application Configuration
NODE_ENV=production
PORT=3001
APP_VERSION=1.0.0
BASE_URL=https://api.fadedskieswholesale.com

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/faded_skies_wholesale
DB_HOST=localhost
DB_PORT=5432
DB_NAME=faded_skies_wholesale
DB_USER=faded_skies_user
DB_PASSWORD=your_secure_database_password
DB_SSL=true

# Redis Configuration (for sessions and caching)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# Security Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here_make_it_long_and_random
JWT_EXPIRY=8h
BCRYPT_ROUNDS=12

# CORS Configuration
ALLOWED_ORIGINS=https://fadedskieswholesale.com,https://admin.fadedskieswholesale.com,https://portal.fadedskieswholesale.com

# Email Configuration (for notifications and password resets)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
FROM_EMAIL=noreply@fadedskieswholesale.com
FROM_NAME=Faded Skies Wholesale

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=jpeg,jpg,png,gif,webp

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_CONNECTIONS=1000

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_INTERVAL=24h
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=faded-skies-backups
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-west-2

# Monitoring and Logging
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
DATADOG_API_KEY=your_datadog_api_key

# Business Configuration
COMPANY_NAME=Faded Skies Wholesale
COMPANY_EMAIL=info@fadedskieswholesale.com
COMPANY_PHONE=(210) 835-7834
SUPPORT_EMAIL=support@fadedskieswholesale.com

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_REAL_TIME_SYNC=true
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SMS_NOTIFICATIONS=false
ENABLE_AUDIT_LOGGING=true

# Payment Processing (if needed)
STRIPE_PUBLIC_KEY=pk_live_your_stripe_public_key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# External API Keys
SHIPMENT_TRACKING_API_KEY=your_tracking_api_key
INVENTORY_SYNC_API_KEY=your_inventory_api_key

# Development/Testing Configuration
DEV_AUTO_LOGIN=false
DEV_MOCK_EMAILS=false
TEST_DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/faded_skies_test