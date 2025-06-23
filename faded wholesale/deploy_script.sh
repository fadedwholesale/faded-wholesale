#!/bin/bash

# ========================================
# FADED SKIES AUTOMATED DEPLOYMENT SCRIPT
# ========================================

set -e  # Exit on any error

# Configuration
DEPLOY_ENV="${1:-production}"
SERVER_USER="${SERVER_USER:-ubuntu}"
SERVER_HOST="${SERVER_HOST:-your-server-ip}"
APP_DIR="${APP_DIR:-/var/www/faded-skies-backend}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-https://api.fadedskies.com/health}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to send Slack notification
send_slack_notification() {
    local message="$1"
    local status="$2"
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        local emoji="🚀"
        
        case "$status" in
            "error")
                color="danger"
                emoji="❌"
                ;;
            "warning")
                color="warning"
                emoji="⚠️"
                ;;
            "start")
                color="#439FE0"
                emoji="🔄"
                ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$emoji Faded Skies Deployment\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {
                            \"title\": \"Environment\",
                            \"value\": \"$DEPLOY_ENV\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Server\",
                            \"value\": \"$SERVER_HOST\",
                            \"short\": true
                        }
                    ],
                    \"footer\": \"Faded Skies Deploy Bot\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || warning "Failed to send Slack notification"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if git is installed
    if ! command -v git &> /dev/null; then
        error "Git is not installed"
        exit 1
    fi
    
    # Check if SSH key exists
    if [ ! -f ~/.ssh/id_rsa ] && [ ! -f ~/.ssh/id_ed25519 ]; then
        error "SSH key not found. Please set up SSH key authentication."
        exit 1
    fi
    
    # Check if environment variables are set
    if [ -z "$SERVER_HOST" ] || [ "$SERVER_HOST" = "your-server-ip" ]; then
        error "SERVER_HOST environment variable not set"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Function to run tests
run_tests() {
    log "Running tests..."
    
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        npm test || {
            error "Tests failed. Deployment aborted."
            send_slack_notification "❌ Deployment aborted: Tests failed" "error"
            exit 1
        }
        success "Tests passed"
    else
        warning "No tests found, skipping test phase"
    fi
}

# Function to backup database
backup_database() {
    if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
        log "Creating pre-deployment backup..."
        
        ssh "$SERVER_USER@$SERVER_HOST" "cd $APP_DIR && ./scripts/backup.sh" || {
            warning "Backup failed, but continuing with deployment"
        }
        
        success "Backup completed"
    fi
}

# Function to deploy code
deploy_code() {
    log "Deploying code to $DEPLOY_ENV environment..."
    
    # Get current branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    COMMIT_HASH=$(git rev-parse --short HEAD)
    
    log "Deploying branch: $CURRENT_BRANCH ($COMMIT_HASH)"
    
    # Deploy based on environment
    case "$DEPLOY_ENV" in
        "production")
            deploy_production
            ;;
        "staging")
            deploy_staging
            ;;
        "docker")
            deploy_docker
            ;;
        "serverless")
            deploy_serverless
            ;;
        *)
            error "Unknown deployment environment: $DEPLOY_ENV"
            exit 1
            ;;
    esac
}

# Function to deploy to production server
deploy_production() {
    log "Deploying to production server..."
    
    ssh "$SERVER_USER@$SERVER_HOST" << EOF
        set -e
        cd $APP_DIR
        
        # Pull latest code
        git fetch origin
        git checkout main
        git pull origin main
        
        # Install dependencies
        npm ci --production
        
        # Run migrations if they exist
        if [ -f "scripts/migrate.sh" ]; then
            ./scripts/migrate.sh
        fi
        
        # Restart application with PM2
        pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
        
        # Wait for application to start
        sleep 10
EOF
    
    success "Production deployment completed"
}

# Function to deploy to staging
deploy_staging() {
    log "Deploying to staging environment..."
    
    ssh "$SERVER_USER@$SERVER_HOST" << EOF
        set -e
        cd /var/www/faded-skies-staging
        
        git fetch origin
        git checkout develop
        git pull origin develop
        
        npm ci
        pm2 reload faded-skies-staging || pm2 start ecosystem.config.js --name faded-skies-staging
EOF
    
    success "Staging deployment completed"
}

# Function to deploy with Docker
deploy_docker() {
    log "Deploying with Docker..."
    
    # Build and push image
    docker build -t faded-skies-backend:latest .
    
    if [ -n "$DOCKER_REGISTRY" ]; then
        docker tag faded-skies-backend:latest "$DOCKER_REGISTRY/faded-skies-backend:latest"
        docker push "$DOCKER_REGISTRY/faded-skies-backend:latest"
    fi
    
    # Deploy to server
    ssh "$SERVER_USER@$SERVER_HOST" << EOF
        cd $APP_DIR
        docker-compose down
        docker-compose pull
        docker-compose up -d
EOF
    
    success "Docker deployment completed"
}

# Function to deploy with Serverless
deploy_serverless() {
    log "Deploying with Serverless Framework..."
    
    if ! command -v serverless &> /dev/null; then
        error "Serverless CLI not installed. Run: npm install -g serverless"
        exit 1
    fi
    
    serverless deploy --stage "$DEPLOY_ENV" --verbose
    
    success "Serverless deployment completed"
}

# Function to run health check
health_check() {
    log "Running health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null; then
            success "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
    return 1
}

# Function to run smoke tests
smoke_tests() {
    log "Running smoke tests..."
    
    # Test authentication endpoint
    local auth_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$HEALTH_CHECK_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"invalid","password":"invalid","role":"partner"}')
    
    if [ "$auth_status" = "400" ] || [ "$auth_status" = "401" ]; then
        success "Authentication endpoint responding correctly"
    else
        error "Authentication endpoint failed smoke test (status: $auth_status)"
        return 1
    fi
    
    # Test products endpoint
    local products_status=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL/api/products")
    
    if [ "$products_status" = "200" ]; then
        success "Products endpoint responding correctly"
    else
        error "Products endpoint failed smoke test (status: $products_status)"
        return 1
    fi
    
    success "All smoke tests passed"
}

# Function to rollback deployment
rollback() {
    error "Deployment failed, initiating rollback..."
    
    ssh "$SERVER_USER@$SERVER_HOST" << EOF
        cd $APP_DIR
        git checkout HEAD~1
        npm ci --production
        pm2 reload ecosystem.config.js --env production
EOF
    
    send_slack_notification "🔄 Deployment failed, rollback completed" "warning"
}

# Main deployment function
main() {
    local start_time=$(date)
    
    log "Starting deployment to $DEPLOY_ENV environment..."
    send_slack_notification "🔄 Starting deployment to $DEPLOY_ENV" "start"
    
    # Trap errors and rollback
    trap 'rollback; exit 1' ERR
    
    check_prerequisites
    run_tests
    backup_database
    deploy_code
    
    if ! health_check; then
        error "Health check failed, rolling back..."
        rollback
        exit 1
    fi
    
    if ! smoke_tests; then
        error "Smoke tests failed, rolling back..."
        rollback
        exit 1
    fi
    
    local end_time=$(date)
    local deploy_time=$(($(date -d "$end_time" +%s) - $(date -d "$start_time" +%s)))
    
    success "Deployment completed successfully in ${deploy_time}s"
    
    send_slack_notification "✅ Deployment completed successfully
🕒 Duration: ${deploy_time}s
🌐 Environment: $DEPLOY_ENV
📋 Health check: Passed
🧪 Smoke tests: Passed" "success"
}

# Help function
show_help() {
    echo "Faded Skies Deployment Script"
    echo ""
    echo "Usage: $0 [environment]"
    echo ""
    echo "Environments:"
    echo "  production    Deploy to production server (default)"
    echo "  staging       Deploy to staging server"
    echo "  docker        Deploy using Docker Compose"
    echo "  serverless    Deploy using Serverless Framework"
    echo ""
    echo "Environment Variables:"
    echo "  SERVER_HOST            Target server IP/hostname"
    echo "  SERVER_USER            SSH username (default: ubuntu)"
    echo "  APP_DIR                Application directory (default: /var/www/faded-skies-backend)"
    echo "  BACKUP_BEFORE_DEPLOY   Create backup before deploy (default: true)"
    echo "  HEALTH_CHECK_URL       Health check endpoint"
    echo "  SLACK_WEBHOOK_URL      Slack webhook for notifications"
    echo ""
    echo "Examples:"
    echo "  $0 production"
    echo "  SERVER_HOST=1.2.3.4 $0 production"
    echo "  $0 docker"
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main "$@"

# ========================================
# USAGE EXAMPLES:
# 
# Deploy to production:
# SERVER_HOST=your-server-ip ./scripts/deploy.sh production
# 
# Deploy to staging:
# ./scripts/deploy.sh staging
# 
# Deploy with Docker:
# ./scripts/deploy.sh docker
# 
# Deploy serverless:
# ./scripts/deploy.sh serverless
# 
# With Slack notifications:
# SLACK_WEBHOOK_URL=https://hooks.slack.com/... ./scripts/deploy.sh production
# ========================================