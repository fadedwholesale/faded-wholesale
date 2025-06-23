# ========================================
# FADED SKIES BACKEND ENVIRONMENT CONFIG
# ========================================

# Server Configuration
NODE_ENV=production
PORT=3001

# Security
JWT_SECRET=your-super-secure-jwt-secret-key-minimum-32-characters-long-random-string
BCRYPT_ROUNDS=12

# Database Configuration
DB_PATH=./fadedskies.db
# For PostgreSQL (production):
# DATABASE_URL=postgresql://username:password@localhost:5432/fadedskies
# DB_TYPE=postgres

# Email Configuration (for notifications)
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=info@fadedskies.com
EMAIL_PASS=your-app-specific-password
EMAIL_FROM=info@fadedskies.com

# AWS Configuration (if using AWS services)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=fadedskies-uploads

# CORS Origins (comma-separated)
CORS_ORIGINS=https://fadedskies.com,https://www.fadedskies.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# SSL Configuration (for HTTPS)
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem

# Admin Configuration
ADMIN_EMAIL=admin@fadedskies.com
ADMIN_PASSWORD=your-super-secure-admin-password

# Business Configuration
BUSINESS_NAME=Faded Skies Wholesale
BUSINESS_EMAIL=info@fadedskies.com
BUSINESS_PHONE=(210) 835-7834
BUSINESS_ADDRESS=Austin, TX

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SMS_NOTIFICATIONS=false
ENABLE_ANALYTICS=true