# 🚀 Faded Skies Backend Deployment Guide

## 📦 Quick Setup

### 1. Local Development Setup

```bash
# Clone or create your backend directory
mkdir faded-skies-backend
cd faded-skies-backend

# Save the server.js code to server.js
# Save the package.json code to package.json

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your actual values

# Start development server
npm run dev

# Server will run on http://localhost:3001
```

### 2. Production Environment Variables

```bash
# Required for production
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-chars
NODE_ENV=production
PORT=3001

# Database (upgrade to PostgreSQL for production)
DATABASE_URL=postgresql://user:pass@host:5432/fadedskies

# Email notifications
EMAIL_USER=info@fadedskies.com
EMAIL_PASS=your-app-password

# CORS origins
CORS_ORIGINS=https://fadedskies.com,https://www.fadedskies.com
```

## ☁️ AWS Deployment Options

### Option 1: AWS EC2 (Recommended)

1. **Launch EC2 Instance**
   ```bash
   # Ubuntu 22.04 LTS
   # Instance type: t3.micro (free tier) or t3.small
   # Security group: Allow HTTP (80), HTTPS (443), SSH (22)
   ```

2. **Server Setup**
   ```bash
   # Connect to instance
   ssh -i your-key.pem ubuntu@your-ec2-ip

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install PM2 for process management
   sudo npm install -g pm2

   # Clone your code
   git clone your-repo-url
   cd faded-skies-backend

   # Install dependencies
   npm install --production

   # Set up environment
   cp .env.example .env
   nano .env  # Edit with production values

   # Start with PM2
   pm2 start server.js --name "faded-skies-api"
   pm2 startup
   pm2 save
   ```

3. **Nginx Reverse Proxy**
   ```bash
   # Install Nginx
   sudo apt update
   sudo apt install nginx

   # Configure Nginx
   sudo nano /etc/nginx/sites-available/fadedskies
   ```

   ```nginx
   server {
       listen 80;
       server_name api.fadedskies.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/fadedskies /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **SSL Certificate (Let's Encrypt)**
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx

   # Get certificate
   sudo certbot --nginx -d api.fadedskies.com
   ```

### Option 2: AWS Lambda + API Gateway

1. **Create deployment package**
   ```bash
   # Install serverless framework
   npm install -g serverless

   # Create serverless.yml
   ```

2. **Serverless Configuration**
   ```yaml
   service: faded-skies-api

   provider:
     name: aws
     runtime: nodejs18.x
     region: us-east-1
     environment:
       NODE_ENV: production
       JWT_SECRET: ${env:JWT_SECRET}

   functions:
     api:
       handler: lambda.handler
       events:
         - http:
             path: /{proxy+}
             method: ANY
             cors: true
   ```

### Option 3: AWS ECS (Docker)

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine

   WORKDIR /app

   COPY package*.json ./
   RUN npm ci --only=production

   COPY . .

   EXPOSE 3001

   USER node

   CMD ["npm", "start"]
   ```

## 🌐 Database Options

### SQLite (Development/Small Scale)
- Included by default
- File-based database
- Perfect for getting started

### PostgreSQL (Production Recommended)

1. **AWS RDS Setup**
   ```bash
   # Create RDS PostgreSQL instance
   # Update .env with connection string
   DATABASE_URL=postgresql://username:password@rds-endpoint:5432/fadedskies
   ```

2. **Update server.js**
   ```javascript
   // Replace SQLite with PostgreSQL
   const { Pool } = require('pg');
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: process.env.NODE_ENV === 'production'
   });
   ```

## 📧 Email Configuration

### Gmail Setup
```bash
# In your .env file
EMAIL_SERVICE=gmail
EMAIL_USER=info@fadedskies.com
EMAIL_PASS=your-app-specific-password
```

### AWS SES Setup
```bash
# In your .env file
EMAIL_SERVICE=ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

## 🔐 Security Checklist

- [ ] Change default JWT secret
- [ ] Use HTTPS in production
- [ ] Set up proper CORS origins
- [ ] Enable rate limiting
- [ ] Use environment variables for secrets
- [ ] Set up monitoring and logging
- [ ] Regular security updates

## 📊 Monitoring & Logging

### PM2 Monitoring
```bash
# View logs
pm2 logs faded-skies-api

# Monitor processes
pm2 monit

# Restart if needed
pm2 restart faded-skies-api
```

### CloudWatch (AWS)
```bash
# Install CloudWatch agent
# Configure log groups
# Set up alarms
```

## 🚀 Frontend Integration

Your frontend will automatically connect to:
- **Local**: `http://localhost:3001/api`
- **Production**: `https://api.fadedskies.com/api`

## 📋 Testing Your API

```bash
# Health check
curl https://api.fadedskies.com/health

# Test login
curl -X POST https://api.fadedskies.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fadedskies.com","password":"admin123","role":"admin"}'

# Test products
curl https://api.fadedskies.com/api/products
```

## 🔄 Backup Strategy

### Database Backup
```bash
# SQLite backup
cp fadedskies.db fadedskies-backup-$(date +%Y%m%d).db

# PostgreSQL backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Automated Backups
```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

## 📞 Support

- **Email**: info@fadedskies.com
- **Phone**: (210) 835-7834
- **Business**: Austin, TX

---

## 🎯 Next Steps

1. **Deploy backend** to your chosen AWS service
2. **Update frontend** with your API URL
3. **Set up domain** (api.fadedskies.com)
4. **Configure SSL** certificates
5. **Test all endpoints** thoroughly
6. **Go live** with your wholesale platform!

Your Faded Skies platform will be ready for production use! 🌿✨