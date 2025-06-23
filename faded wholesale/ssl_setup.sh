#!/bin/bash

# ========================================
# FADED SKIES SSL CERTIFICATE SETUP
# ========================================

set -e  # Exit on any error

# Configuration
DOMAIN="${DOMAIN:-api.fadedskies.com}"
EMAIL="${EMAIL:-info@fadedskies.com}"
WEBROOT_PATH="${WEBROOT_PATH:-/var/www/certbot}"
SSL_DIR="${SSL_DIR:-./ssl}"
NGINX_CONFIG_DIR="${NGINX_CONFIG_DIR:-/etc/nginx/sites-available}"
DRY_RUN="${DRY_RUN:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root. Consider using sudo for specific commands only."
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if domain is provided
    if [ -z "$DOMAIN" ]; then
        error "Domain is required. Set DOMAIN environment variable."
        exit 1
    fi
    
    # Check if email is provided
    if [ -z "$EMAIL" ]; then
        error "Email is required. Set EMAIL environment variable."
        exit 1
    fi
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        error "Certbot is not installed. Installing..."
        install_certbot
    fi
    
    # Check if nginx is installed
    if ! command -v nginx &> /dev/null; then
        error "Nginx is not installed. Please install nginx first."
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Function to install certbot
install_certbot() {
    log "Installing certbot..."
    
    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        sudo yum install -y certbot python3-certbot-nginx
    elif command -v dnf &> /dev/null; then
        # Fedora
        sudo dnf install -y certbot python3-certbot-nginx
    else
        error "Package manager not supported. Please install certbot manually."
        exit 1
    fi
    
    success "Certbot installed successfully"
}

# Function to create initial nginx configuration
create_initial_nginx_config() {
    log "Creating initial nginx configuration..."
    
    local config_file="$NGINX_CONFIG_DIR/fadedskies"
    
    # Create initial HTTP-only configuration
    sudo tee "$config_file" > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Let's Encrypt ACME Challenge
    location /.well-known/acme-challenge/ {
        root $WEBROOT_PATH;
    }
    
    # Temporary redirect to HTTPS (will be updated after SSL)
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    
    # Enable the site
    if [ ! -L "/etc/nginx/sites-enabled/fadedskies" ]; then
        sudo ln -s "$config_file" /etc/nginx/sites-enabled/
    fi
    
    # Test nginx configuration
    sudo nginx -t
    
    # Reload nginx
    sudo systemctl reload nginx
    
    success "Initial nginx configuration created"
}

# Function to create webroot directory
create_webroot() {
    log "Creating webroot directory..."
    
    sudo mkdir -p "$WEBROOT_PATH"
    sudo chown -R www-data:www-data "$WEBROOT_PATH" 2>/dev/null || sudo chown -R nginx:nginx "$WEBROOT_PATH" 2>/dev/null || true
    
    success "Webroot directory created: $WEBROOT_PATH"
}

# Function to obtain SSL certificate
obtain_certificate() {
    log "Obtaining SSL certificate for $DOMAIN..."
    
    local certbot_cmd="certbot certonly --webroot"
    certbot_cmd+=" -w $WEBROOT_PATH"
    certbot_cmd+=" -d $DOMAIN"
    certbot_cmd+=" --email $EMAIL"
    certbot_cmd+=" --agree-tos"
    certbot_cmd+=" --non-interactive"
    
    if [ "$DRY_RUN" = "true" ]; then
        certbot_cmd+=" --dry-run"
        log "DRY RUN: $certbot_cmd"
    fi
    
    sudo $certbot_cmd
    
    if [ "$DRY_RUN" = "true" ]; then
        success "SSL certificate dry run completed successfully"
    else
        success "SSL certificate obtained successfully"
    fi
}

# Function to create SSL nginx configuration
create_ssl_nginx_config() {
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would create SSL nginx configuration"
        return 0
    fi
    
    log "Creating SSL nginx configuration..."
    
    local config_file="$NGINX_CONFIG_DIR/fadedskies"
    local cert_path="/etc/letsencrypt/live/$DOMAIN"
    
    # Create SSL-enabled configuration
    sudo tee "$config_file" > /dev/null << EOF
# HTTP server (redirect to HTTPS)
server {
    listen 80;
    server_name $DOMAIN;
    
    # Let's Encrypt ACME Challenge
    location /.well-known/acme-challenge/ {
        root $WEBROOT_PATH;
    }
    
    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration
    ssl_certificate $cert_path/fullchain.pem;
    ssl_certificate_key $cert_path/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security Headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # API Routes
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check (no auth required)
    location /health {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        access_log off;
    }
}
EOF
    
    # Test nginx configuration
    sudo nginx -t
    
    # Reload nginx
    sudo systemctl reload nginx
    
    success "SSL nginx configuration created and applied"
}

# Function to copy certificates to application directory
copy_certificates() {
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would copy certificates to $SSL_DIR"
        return 0
    fi
    
    log "Copying certificates to application directory..."
    
    local cert_path="/etc/letsencrypt/live/$DOMAIN"
    
    # Create SSL directory
    mkdir -p "$SSL_DIR"
    
    # Copy certificates
    sudo cp "$cert_path/fullchain.pem" "$SSL_DIR/"
    sudo cp "$cert_path/privkey.pem" "$SSL_DIR/"
    sudo cp "$cert_path/chain.pem" "$SSL_DIR/"
    sudo cp "$cert_path/cert.pem" "$SSL_DIR/"
    
    # Set appropriate permissions
    sudo chown $(whoami):$(whoami) "$SSL_DIR"/*
    chmod 600 "$SSL_DIR"/*.pem
    
    success "Certificates copied to $SSL_DIR"
}

# Function to setup certificate auto-renewal
setup_auto_renewal() {
    log "Setting up certificate auto-renewal..."
    
    # Create renewal script
    local renewal_script="/usr/local/bin/renew-fadedskies-cert.sh"
    
    sudo tee "$renewal_script" > /dev/null << EOF
#!/bin/bash
# Faded Skies SSL Certificate Renewal Script

# Attempt to renew certificate
/usr/bin/certbot renew --quiet

# If renewal was successful, reload nginx
if [ \$? -eq 0 ]; then
    /bin/systemctl reload nginx
    
    # Copy updated certificates to application directory
    if [ -d "$SSL_DIR" ]; then
        cp /etc/letsencrypt/live/$DOMAIN/*.pem $SSL_DIR/
        chown $(whoami):$(whoami) $SSL_DIR/*
        chmod 600 $SSL_DIR/*.pem
    fi
    
    echo "\$(date): SSL certificate renewed successfully for $DOMAIN" >> /var/log/ssl-renewal.log
else
    echo "\$(date): SSL certificate renewal failed for $DOMAIN" >> /var/log/ssl-renewal.log
fi
EOF
    
    sudo chmod +x "$renewal_script"
    
    # Add to crontab (run twice daily)
    local cron_job="0 2,14 * * * $renewal_script"
    
    # Check if cron job already exists
    if ! sudo crontab -l 2>/dev/null | grep -q "$renewal_script"; then
        (sudo crontab -l 2>/dev/null; echo "$cron_job") | sudo crontab -
        success "Auto-renewal cron job added"
    else
        success "Auto-renewal cron job already exists"
    fi
    
    success "Certificate auto-renewal configured"
}

# Function to test SSL configuration
test_ssl_config() {
    log "Testing SSL configuration..."
    
    # Test HTTP redirect
    log "Testing HTTP to HTTPS redirect..."
    local http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/health" || echo "000")
    
    if [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
        success "HTTP to HTTPS redirect working"
    else
        warning "HTTP to HTTPS redirect may not be working (response: $http_response)"
    fi
    
    # Test HTTPS
    log "Testing HTTPS connection..."
    local https_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" || echo "000")
    
    if [ "$https_response" = "200" ]; then
        success "HTTPS connection working"
    else
        warning "HTTPS connection may not be working (response: $https_response)"
    fi
    
    # Test SSL certificate
    log "Testing SSL certificate..."
    if command -v openssl &> /dev/null; then
        local cert_info=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            success "SSL certificate is valid"
            echo "$cert_info"
        else
            warning "SSL certificate validation failed"
        fi
    fi
}

# Function to create firewall rules
setup_firewall() {
    log "Setting up firewall rules..."
    
    if command -v ufw &> /dev/null; then
        # Ubuntu/Debian UFW
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        sudo ufw allow 22/tcp  # SSH
        success "UFW firewall rules added"
    elif command -v firewall-cmd &> /dev/null; then
        # CentOS/RHEL firewalld
        sudo firewall-cmd --permanent --add-service=http
        sudo firewall-cmd --permanent --add-service=https
        sudo firewall-cmd --permanent --add-service=ssh
        sudo firewall-cmd --reload
        success "Firewalld rules added"
    else
        warning "No supported firewall found. Please manually open ports 80 and 443"
    fi
}

# Function to show certificate information
show_certificate_info() {
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would show certificate information"
        return 0
    fi
    
    log "Certificate Information:"
    echo ""
    
    local cert_path="/etc/letsencrypt/live/$DOMAIN"
    
    if [ -f "$cert_path/cert.pem" ]; then
        echo "📋 Certificate Details:"
        openssl x509 -in "$cert_path/cert.pem" -text -noout | grep -E "(Subject:|Issuer:|Not Before|Not After|DNS:)"
        echo ""
        
        echo "📅 Certificate Validity:"
        openssl x509 -in "$cert_path/cert.pem" -noout -dates
        echo ""
        
        echo "🔗 Certificate Chain:"
        openssl x509 -in "$cert_path/fullchain.pem" -noout -subject | head -2
    else
        warning "Certificate not found at $cert_path"
    fi
}

# Help function
show_help() {
    echo "Faded Skies SSL Certificate Setup Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  setup               Complete SSL setup (default)"
    echo "  renew               Renew existing certificate"
    echo "  test                Test SSL configuration"
    echo "  info                Show certificate information"
    echo ""
    echo "Options:"
    echo "  --dry-run           Test the setup without making changes"
    echo "  --domain <domain>   Set domain name (default: api.fadedskies.com)"
    echo "  --email <email>     Set email for Let's Encrypt (default: info@fadedskies.com)"
    echo ""
    echo "Environment Variables:"
    echo "  DOMAIN              Domain name for SSL certificate"
    echo "  EMAIL               Email for Let's Encrypt notifications"
    echo "  WEBROOT_PATH        Path for Let's Encrypt webroot"
    echo "  SSL_DIR             Directory to copy certificates"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 setup --domain api.example.com --email admin@example.com"
    echo "  $0 renew"
    echo "  $0 test"
    echo "  $0 setup --dry-run"
}

# Main function
main() {
    local command="${1:-setup}"
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done
    
    log "SSL Certificate Setup for $DOMAIN"
    log "Email: $EMAIL"
    if [ "$DRY_RUN" = "true" ]; then
        warning "DRY RUN MODE - No changes will be made"
    fi
    echo ""
    
    case "$command" in
        "setup")
            check_root
            check_prerequisites
            create_webroot
            create_initial_nginx_config
            setup_firewall
            obtain_certificate
            create_ssl_nginx_config
            copy_certificates
            setup_auto_renewal
            test_ssl_config
            show_certificate_info
            success "SSL setup completed successfully!"
            ;;
        "renew")
            sudo certbot renew
            sudo systemctl reload nginx
            copy_certificates
            success "Certificate renewal completed"
            ;;
        "test")
            test_ssl_config
            ;;
        "info")
            show_certificate_info
            ;;
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"

# ========================================
# USAGE EXAMPLES:
# 
# Complete SSL setup:
# sudo ./scripts/ssl-setup.sh setup
# 
# Setup with custom domain:
# sudo ./scripts/ssl-setup.sh setup --domain api.example.com --email admin@example.com
# 
# Test SSL configuration:
# ./scripts/ssl-setup.sh test
# 
# Renew certificate:
# sudo ./scripts/ssl-setup.sh renew
# 
# Dry run (test without changes):
# sudo ./scripts/ssl-setup.sh setup --dry-run
# ========================================