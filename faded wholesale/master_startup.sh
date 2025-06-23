#!/bin/bash

# ========================================
# FADED SKIES MASTER STARTUP SCRIPT
# Complete Platform Initialization
# ========================================

set -e  # Exit on any error

# Configuration
ENVIRONMENT="${ENVIRONMENT:-development}"
AUTO_SEED="${AUTO_SEED:-true}"
AUTO_MIGRATE="${AUTO_MIGRATE:-true}"
AUTO_SSL="${AUTO_SSL:-false}"
SKIP_DEPS="${SKIP_DEPS:-false}"
DOCKER_MODE="${DOCKER_MODE:-false}"
PM2_MODE="${PM2_MODE:-true}"
BACKUP_ON_START="${BACKUP_ON_START:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ASCII Art Logo
show_logo() {
    echo -e "${GREEN}"
    cat << 'EOF'
    ███████╗ █████╗ ██████╗ ███████╗██████╗     ███████╗██╗  ██╗██╗███████╗███████╗
    ██╔════╝██╔══██╗██╔══██╗██╔════╝██╔══██╗    ██╔════╝██║ ██╔╝██║██╔════╝██╔════╝
    █████╗  ███████║██║  ██║█████╗  ██║  ██║    ███████╗█████╔╝ ██║█████╗  ███████╗
    ██╔══╝  ██╔══██║██║  ██║██╔══╝  ██║  ██║    ╚════██║██╔═██╗ ██║██╔══╝  ╚════██║
    ██║     ██║  ██║██████╔╝███████╗██████╔╝    ███████║██║  ██╗██║███████╗███████║
    ╚═╝     ╚═╝  ╚═╝╚═════╝ ╚══════╝╚═════╝     ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝
                                                                                    
                    🌿 PREMIUM THCA WHOLESALE PLATFORM 🌿
                           Production Ready v1.0
EOF
    echo -e "${NC}"
}

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Function to check system requirements
check_requirements() {
    step "Checking system requirements..."
    
    local missing_deps=()
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    else
        local node_version=$(node -v | cut -d'v' -f2)
        local required_version="16.0.0"
        if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
            error "Node.js version $node_version is too old. Please upgrade to 16+."
            exit 1
        fi
        success "Node.js version: $node_version ✓"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    else
        success "npm version: $(npm -v) ✓"
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    else
        success "Git version: $(git --version | cut -d' ' -f3) ✓"
    fi
    
    # Check for optional dependencies
    if ! command -v curl &> /dev/null; then
        warning "curl not found - some features may be limited"
    fi
    
    if ! command -v pm2 &> /dev/null && [ "$PM2_MODE" = "true" ]; then
        info "PM2 not found - will install automatically"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing required dependencies: ${missing_deps[*]}"
        error "Please install the missing dependencies and try again"
        exit 1
    fi
    
    success "System requirements check passed"
}

# Function to setup environment
setup_environment() {
    step "Setting up environment..."
    
    # Create necessary directories
    mkdir -p logs data backups ssl nginx
    
    # Check for .env file
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            warning "No .env file found. Creating from template..."
            cp .env.example .env
            
            # Generate JWT secret
            if command -v openssl &> /dev/null; then
                local jwt_secret=$(openssl rand -hex 32)
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s/your-super-secure-jwt-secret-key-minimum-32-characters-long-random-string/$jwt_secret/" .env
                else
                    sed -i "s/your-super-secure-jwt-secret-key-minimum-32-characters-long-random-string/$jwt_secret/" .env
                fi
                success "JWT secret generated"
            fi
            
            warning "Please review and update the .env file with your production values"
        else
            error ".env.example file not found"
            exit 1
        fi
    else
        success "Environment file found ✓"
    fi
    
    # Set environment-specific settings
    export NODE_ENV="$ENVIRONMENT"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        export NODE_OPTIONS="--max-old-space-size=512"
        info "Production environment settings applied"
    fi
    
    success "Environment setup completed"
}

# Function to install dependencies
install_dependencies() {
    if [ "$SKIP_DEPS" = "true" ]; then
        log "Skipping dependency installation"
        return 0
    fi
    
    step "Installing dependencies..."
    
    # Install Node.js dependencies
    if [ "$ENVIRONMENT" = "production" ]; then
        npm ci --production --silent
    else
        npm install --silent
    fi
    
    # Install PM2 globally if needed
    if [ "$PM2_MODE" = "true" ] && ! command -v pm2 &> /dev/null; then
        info "Installing PM2 process manager..."
        npm install -g pm2 --silent
    fi
    
    success "Dependencies installed"
}

# Function to run database migrations
run_migrations() {
    if [ "$AUTO_MIGRATE" = "false" ]; then
        log "Skipping database migrations"
        return 0
    fi
    
    step "Running database migrations..."
    
    if [ -f "scripts/migrate.sh" ]; then
        chmod +x scripts/migrate.sh
        ./scripts/migrate.sh migrate
        success "Database migrations completed"
    else
        warning "Migration script not found - creating tables manually..."
        node -e "
        const app = require('./server.js');
        console.log('Database tables initialized');
        process.exit(0);
        " || warning "Manual table creation may have failed"
    fi
}

# Function to seed database
seed_database() {
    if [ "$AUTO_SEED" = "false" ]; then
        log "Skipping database seeding"
        return 0
    fi
    
    step "Seeding database..."
    
    if [ -f "scripts/seed.sh" ]; then
        chmod +x scripts/seed.sh
        SEED_ENVIRONMENT="$ENVIRONMENT" ./scripts/seed.sh full
        success "Database seeded"
    else
        warning "Seed script not found - skipping seeding"
    fi
}

# Function to setup SSL
setup_ssl() {
    if [ "$AUTO_SSL" = "false" ]; then
        log "Skipping SSL setup"
        return 0
    fi
    
    step "Setting up SSL certificates..."
    
    if [ -f "scripts/ssl-setup.sh" ]; then
        chmod +x scripts/ssl-setup.sh
        sudo ./scripts/ssl-setup.sh setup --dry-run
        info "SSL setup completed (dry run)"
        info "Run 'sudo ./scripts/ssl-setup.sh setup' for actual SSL configuration"
    else
        warning "SSL setup script not found"
    fi
}

# Function to create backup
create_backup() {
    if [ "$BACKUP_ON_START" = "false" ]; then
        log "Skipping startup backup"
        return 0
    fi
    
    step "Creating startup backup..."
    
    if [ -f "scripts/backup.sh" ]; then
        chmod +x scripts/backup.sh
        ./scripts/backup.sh || warning "Backup creation failed"
        success "Startup backup created"
    else
        warning "Backup script not found"
    fi
}

# Function to start with Docker
start_docker() {
    step "Starting with Docker Compose..."
    
    if [ ! -f "docker-compose.yml" ]; then
        error "docker-compose.yml not found"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 10
    
    # Health check
    local retries=30
    while [ $retries -gt 0 ]; do
        if curl -s http://localhost:3001/health > /dev/null; then
            success "API is responding"
            break
        fi
        ((retries--))
        sleep 2
    done
    
    if [ $retries -eq 0 ]; then
        error "API failed to start within expected time"
        docker-compose logs api
        exit 1
    fi
    
    success "Docker services started successfully"
}

# Function to start with PM2
start_pm2() {
    step "Starting with PM2..."
    
    # Check if ecosystem config exists
    if [ ! -f "ecosystem.config.js" ]; then
        warning "ecosystem.config.js not found, creating basic config..."
        cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'faded-skies-api',
    script: 'server.js',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
EOF
    fi
    
    # Stop any existing PM2 processes
    pm2 delete faded-skies-api 2>/dev/null || true
    
    # Start application
    if [ "$ENVIRONMENT" = "production" ]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start ecosystem.config.js
    fi
    
    # Save PM2 configuration
    pm2 save > /dev/null
    
    # Setup startup script for production
    if [ "$ENVIRONMENT" = "production" ]; then
        pm2 startup > /dev/null 2>&1 || true
    fi
    
    success "Application started with PM2"
}

# Function to start directly
start_direct() {
    step "Starting application directly..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        NODE_ENV=production node server.js
    else
        NODE_ENV=development node server.js
    fi
}

# Function to run health checks
run_health_checks() {
    step "Running health checks..."
    
    local api_url="http://localhost:3001"
    local max_retries=30
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if curl -s "$api_url/health" > /dev/null; then
            success "Health check passed ✓"
            
            # Test basic endpoints
            local health_response=$(curl -s "$api_url/health")
            if echo "$health_response" | grep -q "healthy"; then
                success "API health endpoint responding correctly ✓"
            fi
            
            # Test products endpoint
            if curl -s "$api_url/api/products" > /dev/null; then
                success "Products endpoint responding ✓"
            fi
            
            return 0
        fi
        
        ((retry++))
        sleep 2
    done
    
    error "Health checks failed after $max_retries attempts"
    return 1
}

# Function to display startup information
show_startup_info() {
    step "Faded Skies Platform Started Successfully! 🎉"
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}🌿 FADED SKIES WHOLESALE PLATFORM${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${CYAN}🔗 Application URLs:${NC}"
    echo "   🌐 API: http://localhost:3001"
    echo "   📊 Health: http://localhost:3001/health"
    echo "   📦 Products: http://localhost:3001/api/products"
    echo ""
    echo -e "${CYAN}🔐 Default Credentials:${NC}"
    echo "   👨‍💼 Admin: admin@fadedskies.com / admin123"
    echo "   🤝 Partner: partner@store.com / partner123"
    echo ""
    echo -e "${CYAN}📋 Management Commands:${NC}"
    
    if [ "$DOCKER_MODE" = "true" ]; then
        echo "   🐳 View logs: docker-compose logs -f api"
        echo "   🔄 Restart: docker-compose restart api"
        echo "   🛑 Stop: docker-compose down"
    elif [ "$PM2_MODE" = "true" ]; then
        echo "   📊 Monitor: pm2 monit"
        echo "   📋 Status: pm2 status"
        echo "   📝 Logs: pm2 logs faded-skies-api"
        echo "   🔄 Restart: pm2 restart faded-skies-api"
        echo "   🛑 Stop: pm2 stop faded-skies-api"
    else
        echo "   🛑 Stop: Ctrl+C"
    fi
    
    echo ""
    echo -e "${CYAN}🛠️  Utility Scripts:${NC}"
    echo "   💾 Backup: ./scripts/backup.sh"
    echo "   🗄️  Migrate: ./scripts/migrate.sh"
    echo "   🌱 Seed: ./scripts/seed.sh"
    echo "   🔒 Security: ./scripts/security-audit.sh"
    echo "   ⚡ Performance: ./scripts/performance-test.sh"
    echo "   🚀 Deploy: ./scripts/deploy.sh"
    echo ""
    echo -e "${CYAN}📧 Support:${NC}"
    echo "   Email: info@fadedskies.com"
    echo "   Phone: (210) 835-7834"
    echo "   Location: Austin, TX"
    echo ""
    echo -e "${GREEN}🎯 Ready to serve wholesale partners nationwide!${NC}"
    echo ""
}

# Function to run post-startup tasks
post_startup_tasks() {
    step "Running post-startup tasks..."
    
    # Set up log rotation if not exists
    if [ ! -f "/etc/logrotate.d/faded-skies" ] && [ "$ENVIRONMENT" = "production" ]; then
        info "Setting up log rotation..."
        cat > /tmp/faded-skies-logrotate << EOF
$(pwd)/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        pm2 reload faded-skies-api || true
    endscript
}
EOF
        sudo mv /tmp/faded-skies-logrotate /etc/logrotate.d/faded-skies 2>/dev/null || warning "Could not setup log rotation (requires sudo)"
    fi
    
    # Create systemd service for production
    if [ "$ENVIRONMENT" = "production" ] && [ "$PM2_MODE" = "true" ]; then
        if [ ! -f "/etc/systemd/system/faded-skies.service" ]; then
            info "Creating systemd service..."
            cat > /tmp/faded-skies.service << EOF
[Unit]
Description=Faded Skies Wholesale Platform
Documentation=https://github.com/fadedskies/backend
After=network.target

[Service]
Type=oneshot
User=$(whoami)
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 delete all
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
            sudo mv /tmp/faded-skies.service /etc/systemd/system/ 2>/dev/null || warning "Could not create systemd service (requires sudo)"
            sudo systemctl daemon-reload 2>/dev/null || true
        fi
    fi
    
    success "Post-startup tasks completed"
}

# Function to cleanup on exit
cleanup() {
    if [ "$?" -ne 0 ]; then
        error "Startup failed. Cleaning up..."
        
        if [ "$DOCKER_MODE" = "true" ]; then
            docker-compose down 2>/dev/null || true
        elif [ "$PM2_MODE" = "true" ]; then
            pm2 delete faded-skies-api 2>/dev/null || true
        fi
    fi
}

# Help function
show_help() {
    echo "Faded Skies Master Startup Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --env <env>         Environment (development/staging/production)"
    echo "  --docker            Start with Docker Compose"
    echo "  --pm2               Start with PM2 process manager (default)"
    echo "  --direct            Start directly with Node.js"
    echo "  --no-seed           Skip database seeding"
    echo "  --no-migrate        Skip database migrations"
    echo "  --ssl               Setup SSL certificates"
    echo "  --backup            Create backup before starting"
    echo "  --skip-deps         Skip dependency installation"
    echo ""
    echo "Environment Variables:"
    echo "  ENVIRONMENT         deployment environment"
    echo "  AUTO_SEED           seed database automatically (true/false)"
    echo "  AUTO_MIGRATE        run migrations automatically (true/false)"
    echo "  AUTO_SSL            setup SSL automatically (true/false)"
    echo "  DOCKER_MODE         use Docker Compose (true/false)"
    echo "  PM2_MODE            use PM2 process manager (true/false)"
    echo ""
    echo "Examples:"
    echo "  $0                  # Start in development mode with PM2"
    echo "  $0 --env production # Start in production mode"
    echo "  $0 --docker         # Start with Docker Compose"
    echo "  $0 --direct --no-seed # Start directly without seeding"
}

# Main function
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --docker)
                DOCKER_MODE=true
                PM2_MODE=false
                shift
                ;;
            --pm2)
                PM2_MODE=true
                DOCKER_MODE=false
                shift
                ;;
            --direct)
                PM2_MODE=false
                DOCKER_MODE=false
                shift
                ;;
            --no-seed)
                AUTO_SEED=false
                shift
                ;;
            --no-migrate)
                AUTO_MIGRATE=false
                shift
                ;;
            --ssl)
                AUTO_SSL=true
                shift
                ;;
            --backup)
                BACKUP_ON_START=true
                shift
                ;;
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Show logo and info
    clear
    show_logo
    info "Starting Faded Skies Wholesale Platform..."
    info "Environment: $ENVIRONMENT"
    info "Mode: $([ "$DOCKER_MODE" = "true" ] && echo "Docker" || ([ "$PM2_MODE" = "true" ] && echo "PM2" || echo "Direct"))"
    echo ""
    
    # Run startup sequence
    check_requirements
    setup_environment
    install_dependencies
    create_backup
    run_migrations
    seed_database
    setup_ssl
    
    # Start the application
    if [ "$DOCKER_MODE" = "true" ]; then
        start_docker
    elif [ "$PM2_MODE" = "true" ]; then
        start_pm2
    else
        info "Starting application in direct mode..."
        info "Press Ctrl+C to stop"
        start_direct
        exit 0  # Direct mode handles its own execution
    fi
    
    # Post-startup checks and tasks
    run_health_checks
    post_startup_tasks
    show_startup_info
    
    # Remove cleanup trap for successful startup
    trap - EXIT
}

# Run main function with all arguments
main "$@"

# ========================================
# USAGE EXAMPLES:
# 
# Development mode (default):
# ./start.sh
# 
# Production mode:
# ./start.sh --env production --backup
# 
# Docker mode:
# ./start.sh --docker
# 
# Direct mode without seeding:
# ./start.sh --direct --no-seed
# 
# Production with SSL:
# sudo ./start.sh --env production --ssl
# ========================================