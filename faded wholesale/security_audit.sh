#!/bin/bash

# ========================================
# FADED SKIES SECURITY AUDIT SCRIPT
# ========================================

set -e  # Exit on any error

# Configuration
API_URL="${API_URL:-https://api.fadedskies.com}"
REPORT_FILE="${REPORT_FILE:-security-audit-$(date +%Y%m%d-%H%M%S).txt}"
SKIP_NETWORK_TESTS="${SKIP_NETWORK_TESTS:-false}"
CHECK_SSL="${CHECK_SSL:-true}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[INFO] $1" >> "$REPORT_FILE"
}

pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    echo "[PASS] $1" >> "$REPORT_FILE"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    echo "[FAIL] $1" >> "$REPORT_FILE"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "[WARN] $1" >> "$REPORT_FILE"
    ((WARNING_CHECKS++))
    ((TOTAL_CHECKS++))
}

header() {
    echo ""
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
    echo ""
    echo "========================================"  >> "$REPORT_FILE"
    echo "$1" >> "$REPORT_FILE"
    echo "========================================"  >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
}

# Function to check file permissions
check_file_permissions() {
    header "FILE PERMISSIONS AUDIT"
    
    # Check .env files
    if [ -f ".env" ]; then
        local perm=$(stat -c "%a" .env 2>/dev/null || stat -f "%A" .env 2>/dev/null)
        if [ "$perm" = "600" ] || [ "$perm" = "400" ]; then
            pass ".env file has secure permissions ($perm)"
        else
            fail ".env file has insecure permissions ($perm) - should be 600 or 400"
        fi
    else
        warn ".env file not found"
    fi
    
    # Check SSL certificates
    if [ -d "ssl" ]; then
        for cert_file in ssl/*.pem ssl/*.key; do
            if [ -f "$cert_file" ]; then
                local perm=$(stat -c "%a" "$cert_file" 2>/dev/null || stat -f "%A" "$cert_file" 2>/dev/null)
                if [ "$perm" = "600" ] || [ "$perm" = "400" ]; then
                    pass "SSL file $(basename $cert_file) has secure permissions ($perm)"
                else
                    fail "SSL file $(basename $cert_file) has insecure permissions ($perm)"
                fi
            fi
        done
    else
        warn "SSL directory not found"
    fi
    
    # Check database file permissions
    if [ -f "fadedskies.db" ]; then
        local perm=$(stat -c "%a" fadedskies.db 2>/dev/null || stat -f "%A" fadedskies.db 2>/dev/null)
        if [ "$perm" = "600" ] || [ "$perm" = "400" ]; then
            pass "Database file has secure permissions ($perm)"
        else
            fail "Database file has insecure permissions ($perm)"
        fi
    fi
    
    # Check log directory permissions
    if [ -d "logs" ]; then
        local perm=$(stat -c "%a" logs 2>/dev/null || stat -f "%A" logs 2>/dev/null)
        if [ "$perm" = "750" ] || [ "$perm" = "700" ]; then
            pass "Logs directory has secure permissions ($perm)"
        else
            warn "Logs directory permissions ($perm) - consider 750 or 700"
        fi
    fi
}

# Function to check environment variables
check_environment_variables() {
    header "ENVIRONMENT VARIABLES AUDIT"
    
    # Check for required variables
    required_vars=("NODE_ENV" "JWT_SECRET" "DATABASE_URL")
    for var in "${required_vars[@]}"; do
        if [ -n "${!var}" ]; then
            pass "$var is set"
        else
            fail "$var is not set"
        fi
    done
    
    # Check JWT secret strength
    if [ -n "$JWT_SECRET" ]; then
        local jwt_length=${#JWT_SECRET}
        if [ "$jwt_length" -ge 32 ]; then
            pass "JWT_SECRET has adequate length ($jwt_length characters)"
        else
            fail "JWT_SECRET is too short ($jwt_length characters) - should be at least 32"
        fi
        
        # Check for common weak secrets
        case "$JWT_SECRET" in
            "secret"|"password"|"your-secret"|"changeme"|"default")
                fail "JWT_SECRET appears to be a default/weak value"
                ;;
            *)
                pass "JWT_SECRET does not appear to be a default value"
                ;;
        esac
    fi
    
    # Check NODE_ENV
    if [ "$NODE_ENV" = "production" ]; then
        pass "NODE_ENV is set to production"
    else
        warn "NODE_ENV is not set to production (current: ${NODE_ENV:-not set})"
    fi
}

# Function to check dependencies
check_dependencies() {
    header "DEPENDENCY SECURITY AUDIT"
    
    # Check for npm audit
    if command -v npm &> /dev/null && [ -f "package.json" ]; then
        log "Running npm audit..."
        if npm audit --audit-level=high --json > /tmp/npm-audit.json 2>/dev/null; then
            local vulnerabilities=$(cat /tmp/npm-audit.json | grep -o '"vulnerabilities":[0-9]*' | cut -d':' -f2 || echo "0")
            if [ "$vulnerabilities" = "0" ]; then
                pass "No high-severity npm vulnerabilities found"
            else
                fail "$vulnerabilities high-severity npm vulnerabilities found"
            fi
        else
            warn "npm audit failed or returned vulnerabilities"
        fi
        rm -f /tmp/npm-audit.json
    else
        warn "npm or package.json not found, skipping dependency check"
    fi
    
    # Check for outdated packages
    if command -v npm &> /dev/null && [ -f "package.json" ]; then
        log "Checking for outdated packages..."
        local outdated=$(npm outdated --json 2>/dev/null | wc -l)
        if [ "$outdated" -eq 1 ]; then  # Empty JSON object
            pass "All packages are up to date"
        else
            warn "Some packages may be outdated"
        fi
    fi
}

# Function to check network security
check_network_security() {
    if [ "$SKIP_NETWORK_TESTS" = "true" ]; then
        log "Skipping network security tests"
        return 0
    fi
    
    header "NETWORK SECURITY AUDIT"
    
    # Check HTTPS enforcement
    if command -v curl &> /dev/null; then
        log "Testing HTTPS enforcement..."
        
        local http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$(echo $API_URL | sed 's|https://||')/health" 2>/dev/null || echo "000")
        if [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
            pass "HTTP requests are redirected to HTTPS"
        elif [ "$http_response" = "200" ]; then
            fail "HTTP requests are not redirected to HTTPS"
        else
            warn "Unable to test HTTP to HTTPS redirect (response: $http_response)"
        fi
        
        # Test HTTPS connection
        local https_response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
        if [ "$https_response" = "200" ]; then
            pass "HTTPS endpoint is accessible"
        else
            fail "HTTPS endpoint is not accessible (response: $https_response)"
        fi
    fi
    
    # Check security headers
    if command -v curl &> /dev/null; then
        log "Checking security headers..."
        
        local headers=$(curl -s -I "$API_URL/health" 2>/dev/null || echo "")
        
        # Check specific headers
        if echo "$headers" | grep -qi "strict-transport-security"; then
            pass "HSTS header is present"
        else
            fail "HSTS header is missing"
        fi
        
        if echo "$headers" | grep -qi "x-frame-options"; then
            pass "X-Frame-Options header is present"
        else
            warn "X-Frame-Options header is missing"
        fi
        
        if echo "$headers" | grep -qi "x-content-type-options"; then
            pass "X-Content-Type-Options header is present"
        else
            warn "X-Content-Type-Options header is missing"
        fi
        
        if echo "$headers" | grep -qi "x-xss-protection"; then
            pass "X-XSS-Protection header is present"
        else
            warn "X-XSS-Protection header is missing"
        fi
    fi
}

# Function to check SSL/TLS configuration
check_ssl_configuration() {
    if [ "$CHECK_SSL" = "false" ]; then
        log "Skipping SSL configuration check"
        return 0
    fi
    
    header "SSL/TLS CONFIGURATION AUDIT"
    
    local domain=$(echo "$API_URL" | sed 's|https://||' | sed 's|/.*||')
    
    if command -v openssl &> /dev/null; then
        log "Checking SSL certificate for $domain..."
        
        # Check certificate validity
        local cert_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
        if [ $? -eq 0 ]; then
            pass "SSL certificate is valid"
            
            # Check expiration
            local not_after=$(echo "$cert_info" | grep "notAfter" | cut -d'=' -f2)
            local exp_date=$(date -d "$not_after" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$not_after" +%s 2>/dev/null)
            local current_date=$(date +%s)
            local days_until_exp=$(( ($exp_date - $current_date) / 86400 ))
            
            if [ "$days_until_exp" -gt 30 ]; then
                pass "SSL certificate expires in $days_until_exp days"
            elif [ "$days_until_exp" -gt 7 ]; then
                warn "SSL certificate expires in $days_until_exp days"
            else
                fail "SSL certificate expires in $days_until_exp days"
            fi
        else
            fail "SSL certificate validation failed"
        fi
        
        # Check SSL protocols
        log "Checking SSL/TLS protocols..."
        
        # Test TLS 1.3
        if echo | openssl s_client -tls1_3 -connect "$domain:443" >/dev/null 2>&1; then
            pass "TLS 1.3 is supported"
        else
            warn "TLS 1.3 is not supported"
        fi
        
        # Test TLS 1.2
        if echo | openssl s_client -tls1_2 -connect "$domain:443" >/dev/null 2>&1; then
            pass "TLS 1.2 is supported"
        else
            fail "TLS 1.2 is not supported"
        fi
        
        # Test deprecated protocols
        if echo | openssl s_client -ssl3 -connect "$domain:443" >/dev/null 2>&1; then
            fail "SSL 3.0 is supported (deprecated)"
        else
            pass "SSL 3.0 is not supported"
        fi
        
        if echo | openssl s_client -tls1 -connect "$domain:443" >/dev/null 2>&1; then
            fail "TLS 1.0 is supported (deprecated)"
        else
            pass "TLS 1.0 is not supported"
        fi
        
        if echo | openssl s_client -tls1_1 -connect "$domain:443" >/dev/null 2>&1; then
            warn "TLS 1.1 is supported (consider disabling)"
        else
            pass "TLS 1.1 is not supported"
        fi
    else
        warn "OpenSSL not available, skipping SSL checks"
    fi
}

# Function to check authentication security
check_authentication_security() {
    header "AUTHENTICATION SECURITY AUDIT"
    
    if command -v curl &> /dev/null; then
        # Test rate limiting on auth endpoints
        log "Testing authentication rate limiting..."
        
        local failed_attempts=0
        for i in {1..6}; do
            local response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/auth/login" \
                -H "Content-Type: application/json" \
                -d '{"email":"test@test.com","password":"wrong","role":"partner"}' 2>/dev/null || echo "000")
            
            if [ "$response" = "429" ]; then
                pass "Rate limiting is active after $i attempts"
                break
            elif [ "$i" = "6" ]; then
                warn "Rate limiting may not be configured properly"
            fi
        done
        
        # Test for information disclosure
        log "Testing for information disclosure..."
        
        local response=$(curl -s "$API_URL/api/auth/login" -X POST \
            -H "Content-Type: application/json" \
            -d '{"email":"nonexistent@test.com","password":"test","role":"partner"}' 2>/dev/null)
        
        if echo "$response" | grep -qi "user not found\|email not found\|invalid email"; then
            warn "Authentication endpoint may reveal user existence"
        else
            pass "Authentication endpoint does not reveal user existence"
        fi
        
        # Test for default credentials
        log "Testing for default credentials..."
        
        local admin_test=$(curl -s "$API_URL/api/auth/login" -X POST \
            -H "Content-Type: application/json" \
            -d '{"email":"admin@fadedskies.com","password":"admin123","role":"admin"}' 2>/dev/null)
        
        if echo "$admin_test" | grep -qi "token"; then
            fail "Default admin credentials are still active"
        else
            pass "Default admin credentials are not active"
        fi
    fi
}

# Function to check API security
check_api_security() {
    header "API SECURITY AUDIT"
    
    if command -v curl &> /dev/null; then
        # Test CORS configuration
        log "Testing CORS configuration..."
        
        local cors_response=$(curl -s -H "Origin: https://evil.com" -H "Access-Control-Request-Method: POST" \
            -H "Access-Control-Request-Headers: X-Requested-With" -X OPTIONS "$API_URL/api/products" 2>/dev/null)
        
        if echo "$cors_response" | grep -qi "access-control-allow-origin: \*"; then
            warn "CORS allows all origins (*)"
        else
            pass "CORS is properly configured"
        fi
        
        # Test for SQL injection protection
        log "Testing SQL injection protection..."
        
        local sql_test=$(curl -s "$API_URL/api/products?id=1';DROP TABLE users;--" 2>/dev/null)
        if echo "$sql_test" | grep -qi "error\|exception\|sql"; then
            warn "Potential SQL injection vulnerability detected"
        else
            pass "No obvious SQL injection vulnerabilities"
        fi
        
        # Test for unauthorized access
        log "Testing unauthorized access protection..."
        
        local unauth_response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/orders" 2>/dev/null || echo "000")
        if [ "$unauth_response" = "401" ]; then
            pass "Protected endpoints require authentication"
        else
            fail "Protected endpoints may not require authentication (response: $unauth_response)"
        fi
        
        # Test error handling
        log "Testing error handling..."
        
        local error_response=$(curl -s "$API_URL/api/nonexistent" 2>/dev/null)
        if echo "$error_response" | grep -qi "stack trace\|debug\|internal error"; then
            fail "API may be exposing sensitive error information"
        else
            pass "API error handling appears secure"
        fi
    fi
}

# Function to check system security
check_system_security() {
    header "SYSTEM SECURITY AUDIT"
    
    # Check for running services
    if command -v systemctl &> /dev/null; then
        log "Checking for unnecessary services..."
        
        # Check for common unnecessary services
        unnecessary_services=("telnet" "ftp" "rsh" "rlogin")
        for service in "${unnecessary_services[@]}"; do
            if systemctl is-active --quiet "$service" 2>/dev/null; then
                warn "Unnecessary service '$service' is running"
            else
                pass "Service '$service' is not running"
            fi
        done
    fi
    
    # Check firewall status
    if command -v ufw &> /dev/null; then
        if ufw status | grep -q "Status: active"; then
            pass "UFW firewall is active"
        else
            warn "UFW firewall is not active"
        fi
    elif command -v firewall-cmd &> /dev/null; then
        if firewall-cmd --state 2>/dev/null | grep -q "running"; then
            pass "Firewalld is running"
        else
            warn "Firewalld is not running"
        fi
    else
        warn "No supported firewall found"
    fi
    
    # Check for automatic updates
    if [ -f "/etc/apt/apt.conf.d/20auto-upgrades" ]; then
        if grep -q "APT::Periodic::Unattended-Upgrade \"1\"" "/etc/apt/apt.conf.d/20auto-upgrades"; then
            pass "Automatic security updates are enabled"
        else
            warn "Automatic security updates are not enabled"
        fi
    else
        warn "Automatic update configuration not found"
    fi
}

# Function to check logging and monitoring
check_logging_monitoring() {
    header "LOGGING AND MONITORING AUDIT"
    
    # Check log files
    if [ -d "logs" ]; then
        if [ -f "logs/error.log" ]; then
            pass "Error logging is configured"
        else
            warn "Error log file not found"
        fi
        
        if [ -f "logs/access.log" ] || [ -f "logs/combined.log" ]; then
            pass "Access logging is configured"
        else
            warn "Access log file not found"
        fi
    else
        warn "Logs directory not found"
    fi
    
    # Check log rotation
    if [ -f "/etc/logrotate.d/faded-skies" ]; then
        pass "Log rotation is configured"
    else
        warn "Log rotation is not configured"
    fi
    
    # Check for monitoring
    if command -v pm2 &> /dev/null; then
        if pm2 list | grep -q "faded-skies"; then
            pass "Process monitoring (PM2) is active"
        else
            warn "Process monitoring is not active"
        fi
    else
        warn "PM2 process manager not found"
    fi
}

# Function to generate recommendations
generate_recommendations() {
    header "SECURITY RECOMMENDATIONS"
    
    local recommendations=(
        "Regularly update dependencies with 'npm audit fix'"
        "Implement proper backup strategy for database and configurations"
        "Set up monitoring and alerting for security events"
        "Regularly review and rotate JWT secrets"
        "Implement proper session management"
        "Set up automated security scanning in CI/CD pipeline"
        "Configure log aggregation and analysis"
        "Implement intrusion detection system"
        "Regular security training for development team"
        "Conduct periodic penetration testing"
        "Implement Web Application Firewall (WAF)"
        "Set up database encryption at rest"
        "Configure proper backup encryption"
        "Implement multi-factor authentication for admin accounts"
        "Regular security code reviews"
    )
    
    for recommendation in "${recommendations[@]}"; do
        echo "• $recommendation" | tee -a "$REPORT_FILE"
    done
}

# Function to generate summary
generate_summary() {
    header "AUDIT SUMMARY"
    
    local score=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
    
    echo "📊 Security Audit Results:" | tee -a "$REPORT_FILE"
    echo "   ✅ Passed: $PASSED_CHECKS" | tee -a "$REPORT_FILE"
    echo "   ❌ Failed: $FAILED_CHECKS" | tee -a "$REPORT_FILE"
    echo "   ⚠️  Warnings: $WARNING_CHECKS" | tee -a "$REPORT_FILE"
    echo "   📈 Score: $score%" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    if [ "$score" -ge 90 ]; then
        echo -e "${GREEN}🎉 Excellent security posture!${NC}" | tee -a "$REPORT_FILE"
    elif [ "$score" -ge 75 ]; then
        echo -e "${YELLOW}⚠️  Good security, but some improvements needed${NC}" | tee -a "$REPORT_FILE"
    else
        echo -e "${RED}🚨 Security improvements required${NC}" | tee -a "$REPORT_FILE"
    fi
    
    echo "" | tee -a "$REPORT_FILE"
    echo "📄 Full report saved to: $REPORT_FILE" | tee -a "$REPORT_FILE"
}

# Help function
show_help() {
    echo "Faded Skies Security Audit Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --api-url <url>     API URL to test (default: https://api.fadedskies.com)"
    echo "  --report <file>     Report file name"
    echo "  --skip-network      Skip network-based tests"
    echo "  --no-ssl            Skip SSL/TLS tests"
    echo ""
    echo "Environment Variables:"
    echo "  API_URL             API URL to test"
    echo "  REPORT_FILE         Output report file"
    echo "  SKIP_NETWORK_TESTS  Skip network tests (true/false)"
    echo "  CHECK_SSL           Check SSL configuration (true/false)"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 --api-url https://staging.fadedskies.com"
    echo "  $0 --skip-network --no-ssl"
}

# Main function
main() {
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --api-url)
                API_URL="$2"
                shift 2
                ;;
            --report)
                REPORT_FILE="$2"
                shift 2
                ;;
            --skip-network)
                SKIP_NETWORK_TESTS=true
                shift
                ;;
            --no-ssl)
                CHECK_SSL=false
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
    
    # Initialize report
    echo "Faded Skies Security Audit Report" > "$REPORT_FILE"
    echo "Generated: $(date)" >> "$REPORT_FILE"
    echo "API URL: $API_URL" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    log "Starting security audit for $API_URL"
    log "Report will be saved to: $REPORT_FILE"
    
    # Run security checks
    check_file_permissions
    check_environment_variables
    check_dependencies
    check_network_security
    check_ssl_configuration
    check_authentication_security
    check_api_security
    check_system_security
    check_logging_monitoring
    
    # Generate recommendations and summary
    generate_recommendations
    generate_summary
}

# Run main function
main "$@"

# ========================================
# USAGE EXAMPLES:
# 
# Basic security audit:
# ./scripts/security-audit.sh
# 
# Audit specific API:
# ./scripts/security-audit.sh --api-url https://staging.fadedskies.com
# 
# Skip network tests:
# ./scripts/security-audit.sh --skip-network
# 
# Custom report file:
# ./scripts/security-audit.sh --report security-check.txt
# ========================================