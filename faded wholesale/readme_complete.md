# 🌿 Faded Skies Wholesale Platform - Backend API

[![CI/CD Pipeline](https://github.com/fadedskies/backend/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/fadedskies/backend/actions)
[![Coverage Status](https://codecov.io/gh/fadedskies/backend/branch/main/graph/badge.svg)](https://codecov.io/gh/fadedskies/backend)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=fadedskies_backend&metric=security_rating)](https://sonarcloud.io/dashboard?id=fadedskies_backend)
[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](LICENSE)

> **Premium THCA Wholesale Platform Backend API**  
> Licensed hemp processor delivering premium products with unmatched quality assurance.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ ([Download](https://nodejs.org/))
- **npm** 8+ (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/fadedskies/backend.git
cd faded-skies-backend

# Run automated setup
chmod +x setup.sh && ./setup.sh

# Start development server
npm run dev
```

**🎉 That's it!** Your API is running at `http://localhost:3001`

## 📋 Table of Contents

- [🌿 Faded Skies Wholesale Platform - Backend API](#-faded-skies-wholesale-platform---backend-api)
  - [🚀 Quick Start](#-quick-start)
  - [📋 Table of Contents](#-table-of-contents)
  - [🏗️ Architecture](#️-architecture)
  - [🔗 API Endpoints](#-api-endpoints)
  - [🔐 Authentication](#-authentication)
  - [💾 Database](#-database)
  - [🚀 Deployment](#-deployment)
  - [🧪 Testing](#-testing)
  - [📊 Monitoring](#-monitoring)
  - [🔒 Security](#-security)
  - [🛠️ Development](#️-development)
  - [📧 Support](#-support)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ • Partner Portal│    │ • Authentication│    │ • Users         │
│ • Admin Portal  │    │ • Product Mgmt  │    │ • Products      │
│ • Shopping Cart │    │ • Order Mgmt    │    │ • Orders        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                    ┌─────────────────┐
                    │   External      │
                    │   Services      │
                    │                 │
                    │ • Email (SES)   │
                    │ • S3 Storage    │
                    │ • CloudWatch    │
                    └─────────────────┘
```

### Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Authentication**: JWT + bcrypt
- **Testing**: Jest + Supertest
- **Deployment**: Docker, PM2, AWS Lambda
- **Monitoring**: PM2, CloudWatch, Slack

## 🔗 API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/login` | User login | ❌ |
| `POST` | `/api/auth/register` | Partner registration | ❌ |
| `POST` | `/api/auth/logout` | User logout | ✅ |

### Products
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/products` | Get all products | ❌ |
| `POST` | `/api/products` | Create product | 👨‍💼 Admin |
| `PUT` | `/api/products/:id` | Update product | 👨‍💼 Admin |
| `DELETE` | `/api/products/:id` | Delete product | 👨‍💼 Admin |

### Orders
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/orders` | Get orders | ✅ |
| `POST` | `/api/orders` | Place order | 🤝 Partner |
| `PUT` | `/api/orders/:id/status` | Update order status | 👨‍💼 Admin |

### Users
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/users` | Get all users | 👨‍💼 Admin |
| `PUT` | `/api/users/:id/status` | Update user status | 👨‍💼 Admin |

### System
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/health` | Health check | ❌ |

## 🔐 Authentication

### JWT Token Authentication

```javascript
// Login request
POST /api/auth/login
{
  "email": "partner@store.com",
  "password": "your-password",
  "role": "partner"
}

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "partner@store.com",
    "role": "partner",
    "businessName": "Your Store"
  }
}
```

### Using the Token

```javascript
// Include in request headers
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Roles & Permissions

- **👨‍💼 Admin**: Full system access
- **🤝 Partner**: Order placement, view own orders
- **👀 Public**: View products, register

## 💾 Database

### Schema Overview

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'partner',
    business_name VARCHAR(255),
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    business_type VARCHAR(100),
    license VARCHAR(100),
    expected_volume VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    strain VARCHAR(255) NOT NULL,
    grade VARCHAR(100) NOT NULL,
    type VARCHAR(100) NOT NULL,
    thca DECIMAL(5,2) DEFAULT 0,
    price DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'AVAILABLE',
    stock INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    items TEXT NOT NULL,
    items_detailed JSONB,
    total DECIMAL(10,2) NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Database Commands

```bash
# SQLite (Development)
sqlite3 fadedskies.db ".schema"

# PostgreSQL (Production)
psql $DATABASE_URL -c "\dt"

# Backup database
./scripts/backup.sh

# Restore from backup
psql $DATABASE_URL < backup.sql
```

## 🚀 Deployment

### Option 1: Traditional Server (Recommended)

```bash
# Deploy to production server
SERVER_HOST=your-server-ip ./scripts/deploy.sh production

# Manual deployment
ssh ubuntu@your-server
cd /var/www/faded-skies-backend
git pull origin main
npm ci --production
pm2 reload ecosystem.config.js --env production
```

### Option 2: Docker Deployment

```bash
# Build and run with Docker
docker build -t faded-skies-backend .
docker run -p 3001:3001 --env-file .env faded-skies-backend

# Or use Docker Compose
docker-compose up -d
```

### Option 3: Serverless (AWS Lambda)

```bash
# Install Serverless Framework
npm install -g serverless

# Deploy to AWS
serverless deploy --stage production
```

### Environment Configuration

```bash
# Required environment variables
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secure-jwt-secret
DATABASE_URL=postgresql://user:pass@host:5432/fadedskies

# Optional
EMAIL_USER=info@fadedskies.com
EMAIL_PASS=your-app-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- tests/api.test.js

# Run tests in watch mode
npm test -- --watch
```

### Test Structure

```
tests/
├── api.test.js         # API endpoint tests
├── auth.test.js        # Authentication tests
├── setup.js           # Test configuration
└── utils/
    ├── helpers.js      # Test utilities
    └── fixtures.js     # Test data
```

### Writing Tests

```javascript
describe('POST /api/products', () => {
  it('should create product (admin only)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        strain: 'Test Strain',
        grade: 'GRADE A',
        price: 500
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });
});
```

## 📊 Monitoring

### PM2 Monitoring

```bash
# View process status
pm2 status

# View logs
pm2 logs faded-skies-api

# Monitor in real-time
pm2 monit

# Restart if needed
pm2 restart faded-skies-api
```

### Health Checks

```bash
# Basic health check
curl https://api.fadedskies.com/health

# Detailed monitoring
curl https://api.fadedskies.com/health | jq
```

### Logs

```bash
# Application logs
tail -f logs/combined.log

# Error logs
tail -f logs/error.log

# Access logs (if using nginx)
tail -f /var/log/nginx/access.log
```

## 🔒 Security

### Security Features

- ✅ JWT token authentication
- ✅ Password hashing (bcrypt)
- ✅ Rate limiting
- ✅ Input validation
- ✅ CORS protection
- ✅ Security headers (Helmet)
- ✅ SQL injection prevention
- ✅ XSS protection

### Security Best Practices

```bash
# Change default JWT secret
JWT_SECRET=your-cryptographically-secure-secret

# Use HTTPS in production
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem

# Regular security updates
npm audit fix
npm update
```

### Rate Limiting

- **General API**: 100 requests/15min per IP
- **Authentication**: 5 attempts/15min per IP
- **Registration**: 3 attempts/hour per IP

## 🛠️ Development

### Project Structure

```
faded-skies-backend/
├── server.js              # Main application file
├── package.json           # Dependencies and scripts
├── ecosystem.config.js    # PM2 configuration
├── docker-compose.yml     # Docker services
├── serverless.yml         # Serverless deployment
├── .env.example          # Environment template
├── .gitignore            # Git exclusions
├── README.md             # This file
├── scripts/              # Utility scripts
│   ├── setup.sh          # Quick setup
│   ├── deploy.sh         # Deployment
│   ├── backup.sh         # Database backup
│   └── migrate.sh        # Database migrations
├── tests/                # Test files
│   ├── api.test.js       # API tests
│   ├── setup.js          # Test configuration
│   └── utils/            # Test utilities
├── nginx/                # Nginx configuration
│   └── nginx.conf        # Reverse proxy config
├── logs/                 # Application logs
├── backups/              # Database backups
└── ssl/                  # SSL certificates
```

### Available Scripts

```bash
# Development
npm run dev              # Start with nodemon
npm start               # Start production server
npm test                # Run tests
npm run lint            # Code linting

# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed test data
npm run db:backup       # Create backup

# Deployment
npm run deploy:staging  # Deploy to staging
npm run deploy:prod     # Deploy to production
npm run docker:build    # Build Docker image
```

### Development Workflow

1. **Clone repository**
   ```bash
   git clone https://github.com/fadedskies/backend.git
   cd faded-skies-backend
   ```

2. **Setup environment**
   ```bash
   ./setup.sh
   ```

3. **Start development**
   ```bash
   npm run dev
   ```

4. **Make changes**
   - Edit code in your preferred editor
   - Tests auto-run with nodemon
   - API auto-restarts on changes

5. **Test changes**
   ```bash
   npm test
   curl http://localhost:3001/health
   ```

6. **Commit and deploy**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin main
   ```

### Code Style

```javascript
// Use modern JavaScript features
const express = require('express');
const bcrypt = require('bcryptjs');

// Async/await for promises
const authenticateUser = async (email, password) => {
  try {
    const user = await User.findByEmail(email);
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

// Proper error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    requestId: req.id 
  });
});
```

## 📈 Performance

### Optimization Features

- **Clustering**: PM2 cluster mode for multi-core usage
- **Caching**: Redis for session storage
- **Compression**: Gzip compression enabled
- **Keep-alive**: HTTP keep-alive connections
- **Rate limiting**: Prevents abuse and overload

### Performance Monitoring

```bash
# Monitor CPU and memory
pm2 monit

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.fadedskies.com/health

# Database performance
EXPLAIN ANALYZE SELECT * FROM products WHERE status = 'AVAILABLE';
```

### Scaling Recommendations

- **Horizontal**: Use load balancer with multiple instances
- **Vertical**: Increase server resources (CPU/RAM)
- **Database**: Read replicas for read-heavy workloads
- **Caching**: Redis for frequently accessed data
- **CDN**: CloudFront for static assets

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# Automated pipeline includes:
- Code linting (ESLint)
- Unit testing (Jest)
- Security scanning (Snyk)
- Docker image building
- Deployment to staging/production
- Health checks and monitoring
- Slack notifications
```

### Pipeline Stages

1. **🔍 Code Quality**
   - Linting with ESLint
   - Type checking
   - Code formatting

2. **🧪 Testing**
   - Unit tests
   - Integration tests
   - Coverage reporting

3. **🔒 Security**
   - Dependency audit
   - Security scanning
   - Vulnerability assessment

4. **🏗️ Build**
   - Docker image creation
   - Asset compilation
   - Artifact generation

5. **🚀 Deploy**
   - Staging deployment
   - Production deployment
   - Health verification

6. **📊 Monitor**
   - Health checks
   - Performance monitoring
   - Alert notifications

## 📧 Support

### Contact Information

- **Email**: info@fadedskies.com
- **Phone**: (210) 835-7834
- **Business**: Austin, TX
- **Hours**: Monday-Friday 9AM-6PM CST

### Getting Help

1. **Check Documentation**: Start with this README
2. **Search Issues**: Look through GitHub issues
3. **Create Issue**: Submit detailed bug report
4. **Contact Support**: Email for urgent issues

### Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Bug Reports

When reporting bugs, please include:

- **Environment**: OS, Node.js version, npm version
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Error messages**: Full error output
- **Additional context**: Screenshots, logs, etc.

### Feature Requests

Feature requests are welcome! Please:

- Check existing issues first
- Describe the feature clearly
- Explain the use case
- Consider implementation complexity

---

## 📜 License

This project is **UNLICENSED** - All rights reserved by Faded Skies Wholesale.

## 🙏 Acknowledgments

- **Express.js** - Fast, unopinionated web framework
- **JWT** - Secure authentication tokens
- **bcrypt** - Password hashing library
- **PM2** - Process management
- **Jest** - Testing framework
- **Docker** - Containerization platform

---

**🌿 Ready to launch your wholesale platform!**

For more information, visit [fadedskies.com](https://fadedskies.com) or contact our team at info@fadedskies.com.