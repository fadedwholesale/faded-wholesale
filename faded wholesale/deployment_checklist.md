# 🚀 Faded Skies Production Deployment Checklist

## Pre-Deployment Requirements

### ✅ **Infrastructure Setup**
- [ ] **Server provisioned** (AWS EC2, DigitalOcean, etc.)
- [ ] **Domain configured** (DNS pointing to server)
- [ ] **SSL certificate** obtained and installed
- [ ] **Firewall configured** (ports 80, 443, 22 open)
- [ ] **Database server** setup (PostgreSQL recommended)
- [ ] **Backup storage** configured (S3, local, etc.)

### ✅ **Environment Configuration**
- [ ] **Production .env file** created with secure values
- [ ] **JWT_SECRET** changed from default (32+ characters)
- [ ] **Database credentials** configured
- [ ] **Email credentials** setup (SMTP/SES)
- [ ] **Admin passwords** changed from defaults
- [ ] **CORS origins** set to production domains
- [ ] **Rate limiting** configured appropriately

### ✅ **Security Checklist**
- [ ] **Default credentials** changed
- [ ] **File permissions** set correctly (600 for .env, 400 for SSL keys)
- [ ] **Database access** restricted to application only
- [ ] **SSH keys** configured (disable password auth)
- [ ] **Automatic security updates** enabled
- [ ] **Intrusion detection** configured (optional)
- [ ] **Log aggregation** setup for monitoring

## Deployment Steps

### 🔧 **Step 1: Server Preparation**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx

# Install PostgreSQL (if using)
sudo apt install postgresql postgresql-contrib
```

### 📦 **Step 2: Application Deployment**

```bash
# Clone repository
git clone https://github.com/fadedskies/backend.git /var/www/faded-skies-backend
cd /var/www/faded-skies-backend

# Set ownership
sudo chown -R $USER:$USER /var/www/faded-skies-backend

# Run setup script
chmod +x start.sh
./start.sh --env production --backup
```

### 🔒 **Step 3: SSL Configuration**

```bash
# Setup SSL certificates
sudo ./scripts/ssl-setup.sh setup --domain api.fadedskies.com --email info@fadedskies.com

# Verify SSL configuration
./scripts/security-audit.sh --api-url https://api.fadedskies.com
```

### 📊 **Step 4: Database Setup**

```bash
# Run migrations
./scripts/migrate.sh migrate

# Seed production data (optional)
SEED_ENVIRONMENT=production ./scripts/seed.sh users

# Create initial backup
./scripts/backup.sh
```

### 🔍 **Step 5: Testing & Verification**

```bash
# Run health checks
curl https://api.fadedskies.com/health

# Test authentication
curl -X POST https://api.fadedskies.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fadedskies.com","password":"your-new-password","role":"admin"}'

# Run performance tests
./scripts/performance-test.sh basic --api-url https://api.fadedskies.com

# Run security audit
./scripts/security-audit.sh --api-url https://api.fadedskies.com
```

## Post-Deployment Configuration

### 📈 **Monitoring Setup**

```bash
# Setup log rotation
sudo cp /etc/logrotate.d/faded-skies.example /etc/logrotate.d/faded-skies

# Configure PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30

# Setup system monitoring (optional)
# Install Prometheus/Grafana stack
```

### 🔄 **Backup Configuration**

```bash
# Setup automated backups
echo "0 2 * * * /var/www/faded-skies-backend/scripts/backup.sh" | sudo crontab -

# Test backup restoration
./scripts/backup.sh
# Verify backup files in ./backups/
```

### 📧 **Email Testing**

```bash
# Test email configuration
node -e "
const { emailService } = require('./templates/email.js');
emailService.testEmailConfig().then(console.log);
"

# Send test registration email
node -e "
const { emailService } = require('./templates/email.js');
emailService.sendPartnerWelcome({
  businessEmail: 'test@example.com',
  businessName: 'Test Business',
  contactName: 'Test User'
}).then(() => console.log('Email sent')).catch(console.error);
"
```

## Environment-Specific Configurations

### 🏭 **Production Environment**

**Required Environment Variables:**
```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secure-production-secret-32-chars-minimum
DATABASE_URL=postgresql://user:password@localhost:5432/fadedskies_prod
EMAIL_USER=info@fadedskies.com
EMAIL_PASS=your-app-specific-password
CORS_ORIGINS=https://fadedskies.com,https://www.fadedskies.com
```

**PM2 Ecosystem (ecosystem.config.js):**
```javascript
module.exports = {
  apps: [{
    name: 'faded-skies-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

### 🧪 **Staging Environment**

**Staging Configuration:**
```bash
NODE_ENV=staging
PORT=3002
DATABASE_URL=postgresql://user:password@localhost:5432/fadedskies_staging
EMAIL_USER=staging@fadedskies.com
CORS_ORIGINS=https://staging.fadedskies.com
```

## Security Hardening

### 🔐 **Server Security**

```bash
# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Setup fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban

# Configure UFW firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Secure shared memory
echo "tmpfs /run/shm tmpfs defaults,noexec,nosuid 0 0" | sudo tee -a /etc/fstab
```

### 🛡️ **Application Security**

```bash
# Set secure file permissions
chmod 600 .env
chmod 600 ssl/*.pem
chmod 700 logs/
chmod 700 backups/

# Secure database
sudo -u postgres psql -c "ALTER USER fadedskies WITH PASSWORD 'strong-database-password';"

# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Performance Optimization

### ⚡ **Server Optimization**

```bash
# Optimize Node.js memory
echo "NODE_OPTIONS=--max-old-space-size=512" >> .env

# Setup Redis for caching (optional)
sudo apt install redis-server
sudo systemctl enable redis-server

# Configure Nginx caching
# Add caching rules to nginx.conf
```

### 📊 **Database Optimization**

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_users_email_active ON users(email) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_products_status_stock ON products(status, stock);
CREATE INDEX CONCURRENTLY idx_orders_user_created ON orders(user_id, created_at);

-- Analyze tables
ANALYZE users;
ANALYZE products;
ANALYZE orders;
```

## Maintenance Procedures

### 🔄 **Regular Maintenance**

**Daily:**
- [ ] Check application logs for errors
- [ ] Verify backup completion
- [ ] Monitor disk space usage
- [ ] Check SSL certificate status

**Weekly:**
- [ ] Review security logs
- [ ] Update dependencies (`npm audit fix`)
- [ ] Performance monitoring review
- [ ] Database maintenance (`VACUUM ANALYZE`)

**Monthly:**
- [ ] Security audit (`./scripts/security-audit.sh`)
- [ ] Performance testing (`./scripts/performance-test.sh`)
- [ ] Backup restoration test
- [ ] SSL certificate renewal check
- [ ] Review and rotate logs

### 🚨 **Emergency Procedures**

**Application Down:**
```bash
# Check PM2 status
pm2 status

# Restart application
pm2 restart faded-skies-api

# Check logs
pm2 logs faded-skies-api --lines 100

# Rollback if needed (git-based deployment)
git checkout HEAD~1
pm2 reload faded-skies-api
```

**Database Issues:**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check database locks
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE NOT granted;"

# Restore from backup if needed
psql $DATABASE_URL < backups/latest-backup.sql
```

## Monitoring & Alerting

### 📊 **Key Metrics to Monitor**

- **Application Health:** Response time, error rate, uptime
- **System Resources:** CPU, memory, disk usage
- **Database:** Connection pool, query performance
- **Security:** Failed login attempts, suspicious activity
- **Business:** Order volume, partner registrations

### 🔔 **Alert Thresholds**

- **Critical:** API down, database unreachable, SSL expired
- **Warning:** High response time (>1s), high error rate (>5%)
- **Info:** New partner registration, high order volume

## Troubleshooting

### 🔍 **Common Issues**

**API Not Responding:**
```bash
# Check if process is running
pm2 status

# Check port availability
sudo lsof -i :3001

# Check firewall
sudo ufw status
```

**Database Connection Failed:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check database service
sudo systemctl status postgresql

# Review database logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

**SSL Certificate Issues:**
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect api.fadedskies.com:443

# Renew certificate
sudo certbot renew
```

## Final Verification

### ✅ **Go-Live Checklist**

- [ ] **All health checks passing**
- [ ] **SSL certificate valid and configured**
- [ ] **Database migrations completed**
- [ ] **Backup system functioning**
- [ ] **Monitoring and alerting configured**
- [ ] **Performance benchmarks met**
- [ ] **Security audit passed**
- [ ] **Documentation updated**
- [ ] **Team notified of deployment**
- [ ] **Rollback plan prepared**

## Support Contacts

**Technical Support:**
- Email: dev@fadedskies.com
- Phone: (210) 835-7834
- Emergency: 24/7 on-call rotation

**Business Support:**
- Email: info@fadedskies.com
- Phone: (210) 835-7834
- Hours: Monday-Friday 9AM-6PM CST

---

## 🎉 Deployment Complete!

Your Faded Skies Wholesale Platform is now live and ready to serve partners nationwide!

**Next Steps:**
1. Monitor initial traffic and performance
2. Gather user feedback
3. Plan feature enhancements
4. Scale infrastructure as needed

**Remember:** Regular maintenance and monitoring are key to a successful production deployment.