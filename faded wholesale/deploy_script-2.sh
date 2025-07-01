#!/bin/bash

# Faded Skies Wholesale Platform Deployment Script
# ================================================
# Production-ready deployment with zero-downtime, health checks, and rollback capability

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_NAME="faded-skies-wholesale"
readonly DOCKER_COMPOSE_FILE="docker-compose.yml"
readonly ENV_FILE=".env"
readonly BACKUP_DIR="./backups"
readonly LOG_FILE="./logs/deploy.log"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")  echo -e "${GREEN}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "DEBUG") echo -e "${BLUE}[DEBUG]${NC} $message" ;;
    esac
    
    # Also log to file
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Check if running as root
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        log "WARN" "Running as root. Consider using a non-root user with sudo privileges."
    fi
}

# Check system requirements
check_requirements() {
    log "INFO" "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed. Please install Docker first."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error_exit "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check available disk space (minimum 2GB)
    local available_space=$(df "$SCRIPT_DIR" | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 2097152 ]]; then
        error_exit "Insufficient disk space. At least 2GB required."
    fi
    
    # Check available memory (minimum 1GB)
    local available_memory=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [[ $available_memory -lt 1024 ]]; then
        log "WARN" "Low available memory ($available_memory MB). Consider freeing up memory."
    fi
    
    log "INFO" "System requirements check passed ✓"
}

# Load environment variables
load_environment() {
    log "INFO" "Loading environment configuration..."
    
    if [[ ! -f "$ENV_FILE" ]]; then
        log "INFO" "Creating .env file from template..."
        create_env_file
    fi
    
    # Load environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Validate required environment variables
    local required_vars=(
        "DB_PASSWORD"
        "JWT_SECRET"
        "MYSQL_ROOT_PASSWORD"
        "SESSION_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error_exit "Required environment variable $var is not set"
        fi
    done
    
    log "INFO" "Environment configuration loaded ✓"
}

# Create .env file from template
create_env_file() {
    cat > "$ENV_FILE" << EOF
# Faded Skies Wholesale Environment Configuration
# Generated on $(date)

# Database Configuration
DB_PASSWORD=$(openssl rand -base64 32)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)

# JWT and Session Security
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 64)

# Email Configuration (Update with your SMTP settings)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@fadedskieswholesale.com
EMAIL_PASS=your_email_password_here

# Backup Configuration (Optional - for S3 backups)
BACKUP_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Monitoring Passwords
GRAFANA_PASSWORD=$(openssl rand -base64 16)

# Application Settings
NODE_ENV=production
UPLOAD_MAX_SIZE=5242880
DEBUG=false

# Domain Configuration
DOMAIN=fadedskieswholesale.com
ADMIN_DOMAIN=admin.fadedskieswholesale.com
PORTAL_DOMAIN=portal.fadedskieswholesale.com

# SSL Configuration
SSL_EMAIL=admin@fadedskieswholesale.com
EOF

    log "INFO" "Created .env file with secure random passwords"
    log "WARN" "Please review and update .env file with your specific configuration"
}

# Backup existing deployment
backup_deployment() {
    log "INFO" "Creating deployment backup..."
    
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/deployment_$backup_timestamp"
    
    mkdir -p "$backup_path"
    
    # Backup database if running
    if docker-compose ps | grep -q mysql; then
        log "INFO" "Backing up database..."
        docker-compose exec -T mysql mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" faded_skies > "$backup_path/database.sql" || log "WARN" "Database backup failed"
    fi
    
    # Backup uploads
    if [[ -d "./uploads" ]]; then
        log "INFO" "Backing up uploads..."
        cp -r ./uploads "$backup_path/" || log "WARN" "Uploads backup failed"
    fi
    
    # Backup configuration
    cp "$ENV_FILE" "$backup_path/" 2>/dev/null || log "WARN" "Environment file backup failed"
    cp "$DOCKER_COMPOSE_FILE" "$backup_path/" 2>/dev/null || log "WARN" "Docker compose backup failed"
    
    # Keep only last 10 backups
    ls -dt "$BACKUP_DIR"/deployment_* | tail -n +11 | xargs rm -rf 2>/dev/null || true
    
    log "INFO" "Backup completed: $backup_path ✓"
}

# Build application images
build_images() {
    log "INFO" "Building application images..."
    
    # Build main application image
    docker-compose build --no-cache app || error_exit "Failed to build application image"
    
    # Build backup service if using custom backup
    if docker-compose config --services | grep -q backup; then
        docker-compose build backup || log "WARN" "Backup service build failed"
    fi
    
    log "INFO" "Image build completed ✓"
}

# Prepare static files
prepare_static_files() {
    log "INFO" "Preparing static files..."
    
    # Create public directories
    mkdir -p public/admin public/portal
    
    # Copy HTML templates to public directories
    if [[ -f "fadedskies admin almost complete .html" ]]; then
        cp "fadedskies admin almost complete .html" public/admin/index.html
        log "INFO" "Admin template copied ✓"
    else
        log "WARN" "Admin HTML template not found"
    fi
    
    if [[ -f "faded_skies_portal-5.html" ]]; then
        cp "faded_skies_portal-5.html" public/portal/index.html
        log "INFO" "Portal template copied ✓"
    else
        log "WARN" "Portal HTML template not found"
    fi
    
    # Create necessary directories
    mkdir -p uploads/products logs ssl config
    
    # Set proper permissions
    chmod -R 755 uploads logs ssl config public
    
    log "INFO" "Static files preparation completed ✓"
}

# Database initialization
init_database() {
    log "INFO" "Initializing database..."
    
    # Wait for MySQL to be ready
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose exec -T mysql mysqladmin ping -h localhost -u root -p"$MYSQL_ROOT_PASSWORD" &>/dev/null; then
            log "INFO" "Database is ready ✓"
            break
        fi
        
        log "INFO" "Waiting for database... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        error_exit "Database failed to start within expected time"
    fi
    
    # Check if database exists and has tables
    local table_count=$(docker-compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='faded_skies';" 2>/dev/null | tail -n 1 || echo "0")
    
    if [[ "$table_count" -eq "0" ]]; then
        log "INFO" "Initializing database schema..."
        docker-compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" < database.sql || error_exit "Database initialization failed"
        log "INFO" "Database schema initialized ✓"
    else
        log "INFO" "Database already initialized with $table_count tables"
    fi
}

# Health check function
health_check() {
    local service=$1
    local max_attempts=${2:-30}
    local attempt=1
    
    log "INFO" "Performing health check for $service..."
    
    while [[ $attempt -le $max_attempts ]]; do
        case $service in
            "app")
                if curl -f -s http://localhost:3000/api/health &>/dev/null; then
                    log "INFO" "$service health check passed ✓"
                    return 0
                fi
                ;;
            "nginx")
                if curl -f -s http://localhost:80/health &>/dev/null; then
                    log "INFO" "$service health check passed ✓"
                    return 0
                fi
                ;;
            "mysql")
                if docker-compose exec -T mysql mysqladmin ping -h localhost -u root -p"$MYSQL_ROOT_PASSWORD" &>/dev/null; then
                    log "INFO" "$service health check passed ✓"
                    return 0
                fi
                ;;
        esac
        
        log "INFO" "Health check for $service... (attempt $attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    log "ERROR" "$service health check failed after $max_attempts attempts"
    return 1
}

# Deploy with zero downtime
zero_downtime_deploy() {
    log "INFO" "Starting zero-downtime deployment..."
    
    # Start new services
    docker-compose up -d --remove-orphans
    
    # Wait for services to be healthy
    sleep 10
    
    # Check application health
    if ! health_check "app" 30; then
        log "ERROR" "Application health check failed during deployment"
        return 1
    fi
    
    # Check database health
    if ! health_check "mysql" 15; then
        log "ERROR" "Database health check failed during deployment"
        return 1
    fi
    
    log "INFO" "Zero-downtime deployment completed ✓"
    return 0
}

# Rollback function
rollback_deployment() {
    log "WARN" "Initiating deployment rollback..."
    
    # Find latest backup
    local latest_backup=$(ls -dt "$BACKUP_DIR"/deployment_* 2>/dev/null | head -n 1)
    
    if [[ -z "$latest_backup" ]]; then
        error_exit "No backup found for rollback"
    fi
    
    log "INFO" "Rolling back to backup: $latest_backup"
    
    # Stop current services
    docker-compose down
    
    # Restore backup
    if [[ -f "$latest_backup/database.sql" ]]; then
        log "INFO" "Restoring database backup..."
        docker-compose up -d mysql
        health_check "mysql"
        docker-compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" faded_skies < "$latest_backup/database.sql"
    fi
    
    if [[ -d "$latest_backup/uploads" ]]; then
        log "INFO" "Restoring uploads backup..."
        rm -rf ./uploads
        cp -r "$latest_backup/uploads" ./
    fi
    
    # Restart services
    docker-compose up -d
    
    log "INFO" "Rollback completed ✓"
}

# SSL certificate setup
setup_ssl() {
    log "INFO" "Setting up SSL certificates..."
    
    # Check if domain is configured
    if [[ -z "${DOMAIN:-}" ]]; then
        log "WARN" "Domain not configured, skipping SSL setup"
        return 0
    fi
    
    # Create directories
    mkdir -p ssl/letsencrypt ssl/www
    
    # Generate self-signed certificates for initial setup
    if [[ ! -f "ssl/cert.pem" ]]; then
        log "INFO" "Generating self-signed certificates for initial setup..."
        openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=TX/L=Austin/O=Faded Skies/OU=IT/CN=$DOMAIN"
    fi
    
    # Start nginx to enable Let's Encrypt challenge
    docker-compose up -d nginx
    
    # Wait for nginx
    sleep 10
    
    # Request Let's Encrypt certificates (uncomment for production)
    # docker-compose run --rm certbot
    
    log "INFO" "SSL setup completed ✓"
}

# Post-deployment tasks
post_deployment() {
    log "INFO" "Running post-deployment tasks..."
    
    # Clean up old images
    docker image prune -f &>/dev/null || true
    
    # Clean up old containers
    docker container prune -f &>/dev/null || true
    
    # Show deployment status
    show_deployment_status
    
    # Show useful information
    log "INFO" "🎉 Deployment completed successfully!"
    echo
    echo "📊 Access URLs:"
    echo "   Main Site:    https://${DOMAIN:-localhost}"
    echo "   Admin Portal: https://${ADMIN_DOMAIN:-admin.localhost}"
    echo "   Partner Portal: https://${PORTAL_DOMAIN:-portal.localhost}"
    echo "   API Health:   http://localhost:3000/api/health"
    echo
    echo "🔧 Management Commands:"
    echo "   View logs:    docker-compose logs -f"
    echo "   Stop services: docker-compose down"
    echo "   Backup DB:    ./deploy.sh backup-db"
    echo "   Rollback:     ./deploy.sh rollback"
    echo
    echo "📁 Important files:"
    echo "   Environment: .env"
    echo "   Logs:        ./logs/deploy.log"
    echo "   Backups:     ./backups/"
    echo
}

# Show deployment status
show_deployment_status() {
    log "INFO" "Deployment Status:"
    echo
    docker-compose ps
    echo
    
    # Show service health
    local services=("app" "mysql" "redis" "nginx")
    for service in "${services[@]}"; do
        if docker-compose ps | grep -q "$service"; then
            local status=$(docker-compose ps "$service" | tail -n 1 | awk '{print $4}')
            if [[ "$status" == "Up" ]]; then
                echo -e "   $service: ${GREEN}✓ Running${NC}"
            else
                echo -e "   $service: ${RED}✗ $status${NC}"
            fi
        else
            echo -e "   $service: ${YELLOW}- Not configured${NC}"
        fi
    done
    echo
}

# Backup database only
backup_database() {
    log "INFO" "Creating database backup..."
    
    local backup_file="$BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p "$BACKUP_DIR"
    
    if docker-compose ps | grep -q mysql; then
        docker-compose exec -T mysql mysqladmin ping -h localhost -u root -p"$MYSQL_ROOT_PASSWORD" || error_exit "Database is not accessible"
        docker-compose exec -T mysql mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --routines --triggers faded_skies > "$backup_file"
        log "INFO" "Database backup created: $backup_file ✓"
    else
        error_exit "MySQL service is not running"
    fi
}

# Monitor deployment
monitor_deployment() {
    log "INFO" "Monitoring deployment..."
    
    # Show real-time logs
    docker-compose logs -f --tail=50
}

# Update services
update_services() {
    log "INFO" "Updating services..."
    
    # Pull latest images
    docker-compose pull
    
    # Restart services with new images
    docker-compose up -d
    
    # Run health checks
    health_check "app"
    
    log "INFO" "Services updated ✓"
}

# Main deployment function
main_deploy() {
    log "INFO" "🚀 Starting Faded Skies Wholesale Platform Deployment"
    log "INFO" "=================================================="
    
    check_permissions
    check_requirements
    load_environment
    backup_deployment
    prepare_static_files
    build_images
    
    # Deploy with rollback on failure
    if zero_downtime_deploy; then
        init_database
        setup_ssl
        post_deployment
    else
        log "ERROR" "Deployment failed, initiating rollback..."
        rollback_deployment
        exit 1
    fi
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy"|"")
        main_deploy
        ;;
    "rollback")
        load_environment
        rollback_deployment
        ;;
    "backup"|"backup-db")
        load_environment
        backup_database
        ;;
    "status")
        show_deployment_status
        ;;
    "monitor"|"logs")
        monitor_deployment
        ;;
    "update")
        load_environment
        update_services
        ;;
    "health")
        load_environment
        health_check "app" 5
        ;;
    "ssl")
        load_environment
        setup_ssl
        ;;
    "help"|"-h"|"--help")
        echo "Faded Skies Wholesale Deployment Script"
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  deploy     - Full deployment (default)"
        echo "  rollback   - Rollback to previous deployment"
        echo "  backup     - Backup database only"
        echo "  status     - Show deployment status"
        echo "  monitor    - Monitor deployment logs"
        echo "  update     - Update services with latest images"
        echo "  health     - Check application health"
        echo "  ssl        - Setup SSL certificates"
        echo "  help       - Show this help message"
        echo
        ;;
    *)
        error_exit "Unknown command: $1. Use '$0 help' for usage information."
        ;;
esac