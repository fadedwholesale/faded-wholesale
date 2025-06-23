#!/bin/bash

# ========================================
# FADED SKIES PERFORMANCE TESTING SCRIPT
# ========================================

set -e  # Exit on any error

# Configuration
API_URL="${API_URL:-https://api.fadedskies.com}"
CONCURRENT_USERS="${CONCURRENT_USERS:-10}"
TEST_DURATION="${TEST_DURATION:-60}"
RAMP_UP_TIME="${RAMP_UP_TIME:-10}"
REPORT_FILE="${REPORT_FILE:-performance-test-$(date +%Y%m%d-%H%M%S).html}"
JSON_REPORT="${JSON_REPORT:-performance-test-$(date +%Y%m%d-%H%M%S).json}"

# Test credentials
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@fadedskies.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
PARTNER_EMAIL="${PARTNER_EMAIL:-partner@store.com}"
PARTNER_PASSWORD="${PARTNER_PASSWORD:-partner123}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

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

header() {
    echo ""
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        error "curl is required but not installed"
        exit 1
    fi
    
    # Check if artillery is available for load testing
    if ! command -v artillery &> /dev/null; then
        warning "Artillery not found. Installing..."
        if command -v npm &> /dev/null; then
            npm install -g artillery
        else
            error "npm is required to install artillery"
            exit 1
        fi
    fi
    
    # Check if jq is available for JSON processing
    if ! command -v jq &> /dev/null; then
        warning "jq not found. Some features may be limited."
    fi
    
    success "Prerequisites check completed"
}

# Function to test API connectivity
test_connectivity() {
    header "API CONNECTIVITY TEST"
    
    log "Testing API connectivity to $API_URL"
    
    local start_time=$(date +%s%N)
    local response=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" "$API_URL/health" 2>/dev/null || echo "000:0")
    local end_time=$(date +%s%N)
    
    local http_code=$(echo "$response" | cut -d':' -f1)
    local response_time=$(echo "$response" | cut -d':' -f2)
    
    if [ "$http_code" = "200" ]; then
        success "API is accessible (${response_time}s response time)"
    else
        error "API is not accessible (HTTP $http_code)"
        exit 1
    fi
}

# Function to get authentication token
get_auth_token() {
    local email="$1"
    local password="$2"
    local role="$3"
    
    log "Getting authentication token for $role..."
    
    local response=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\",\"role\":\"$role\"}" 2>/dev/null)
    
    if command -v jq &> /dev/null; then
        echo "$response" | jq -r '.token // empty'
    else
        echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
    fi
}

# Function to create artillery configuration
create_artillery_config() {
    local config_file="artillery-config.yml"
    
    log "Creating artillery load test configuration..."
    
    # Get authentication tokens
    local admin_token=$(get_auth_token "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "admin")
    local partner_token=$(get_auth_token "$PARTNER_EMAIL" "$PARTNER_PASSWORD" "partner")
    
    if [ -z "$admin_token" ] || [ -z "$partner_token" ]; then
        warning "Could not obtain authentication tokens. Running tests without auth."
        admin_token="invalid-token"
        partner_token="invalid-token"
    fi
    
    cat > "$config_file" << EOF
config:
  target: '$API_URL'
  phases:
    - duration: $RAMP_UP_TIME
      arrivalRate: 1
      rampTo: $CONCURRENT_USERS
      name: "Ramp up"
    - duration: $TEST_DURATION
      arrivalRate: $CONCURRENT_USERS
      name: "Sustained load"
    - duration: $RAMP_UP_TIME
      arrivalRate: $CONCURRENT_USERS
      rampTo: 1
      name: "Ramp down"
  defaults:
    headers:
      Content-Type: 'application/json'
  variables:
    adminToken: '$admin_token'
    partnerToken: '$partner_token'

scenarios:
  - name: "Health Check"
    weight: 20
    flow:
      - get:
          url: "/health"
          expect:
            - statusCode: 200

  - name: "Public Product Listing"
    weight: 30
    flow:
      - get:
          url: "/api/products"
          expect:
            - statusCode: 200
            - contentType: json

  - name: "Partner Authentication"
    weight: 15
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "$PARTNER_EMAIL"
            password: "$PARTNER_PASSWORD"
            role: "partner"
          expect:
            - statusCode: [200, 401, 429]

  - name: "Authenticated Requests"
    weight: 25
    flow:
      - get:
          url: "/api/orders"
          headers:
            Authorization: "Bearer {{ partnerToken }}"
          expect:
            - statusCode: [200, 401, 403]

  - name: "Admin Operations"
    weight: 10
    flow:
      - get:
          url: "/api/users"
          headers:
            Authorization: "Bearer {{ adminToken }}"
          expect:
            - statusCode: [200, 401, 403]
      - get:
          url: "/api/orders"
          headers:
            Authorization: "Bearer {{ adminToken }}"
          expect:
            - statusCode: [200, 401, 403]

  - name: "Invalid Requests"
    weight: 5
    flow:
      - get:
          url: "/api/nonexistent"
          expect:
            - statusCode: 404
      - post:
          url: "/api/auth/login"
          json:
            email: "invalid@test.com"
            password: "wrongpassword"
            role: "partner"
          expect:
            - statusCode: [400, 401, 429]
EOF
    
    echo "$config_file"
}

# Function to run basic performance test
run_basic_test() {
    header "BASIC PERFORMANCE TEST"
    
    log "Running basic response time tests..."
    
    # Test various endpoints
    endpoints=(
        "/health"
        "/api/products"
        "/api/auth/login"
    )
    
    for endpoint in "${endpoints[@]}"; do
        log "Testing $endpoint..."
        
        local total_time=0
        local successful_requests=0
        local failed_requests=0
        
        for i in {1..10}; do
            local start_time=$(date +%s%N)
            
            if [ "$endpoint" = "/api/auth/login" ]; then
                local response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL$endpoint" \
                    -H "Content-Type: application/json" \
                    -d '{"email":"test@test.com","password":"test","role":"partner"}' 2>/dev/null || echo "000")
            else
                local response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint" 2>/dev/null || echo "000")
            fi
            
            local end_time=$(date +%s%N)
            local request_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
            
            if [ "$response" != "000" ]; then
                total_time=$((total_time + request_time))
                ((successful_requests++))
            else
                ((failed_requests++))
            fi
        done
        
        if [ "$successful_requests" -gt 0 ]; then
            local avg_time=$((total_time / successful_requests))
            echo "  ✓ $endpoint: ${avg_time}ms average (${successful_requests}/10 successful)"
        else
            echo "  ✗ $endpoint: All requests failed"
        fi
    done
}

# Function to run load test
run_load_test() {
    header "LOAD TESTING WITH ARTILLERY"
    
    local config_file=$(create_artillery_config)
    
    log "Starting load test with $CONCURRENT_USERS concurrent users for ${TEST_DURATION}s..."
    log "Report will be saved to $REPORT_FILE"
    
    # Run artillery test
    if artillery run "$config_file" --output "$JSON_REPORT" > /tmp/artillery.log 2>&1; then
        success "Load test completed successfully"
        
        # Generate HTML report if possible
        if artillery report "$JSON_REPORT" --output "$REPORT_FILE" > /dev/null 2>&1; then
            success "HTML report generated: $REPORT_FILE"
        else
            warning "Could not generate HTML report"
        fi
        
        # Display summary
        display_test_summary
    else
        error "Load test failed"
        cat /tmp/artillery.log
        exit 1
    fi
    
    # Cleanup
    rm -f "$config_file" /tmp/artillery.log
}

# Function to display test summary
display_test_summary() {
    log "Test Summary:"
    
    if [ -f "$JSON_REPORT" ] && command -v jq &> /dev/null; then
        local summary=$(cat "$JSON_REPORT" | jq '.aggregate')
        
        echo "📊 Performance Metrics:"
        echo "   🎯 Total Requests: $(echo "$summary" | jq -r '.counters."http.requests" // "N/A"')"
        echo "   ✅ Successful: $(echo "$summary" | jq -r '.counters."http.responses" // "N/A"')"
        echo "   ❌ Failed: $(echo "$summary" | jq -r '.counters."http.request_errors" // "0"')"
        echo "   📈 Requests/sec: $(echo "$summary" | jq -r '.rates."http.request_rate" // "N/A"')"
        echo ""
        echo "⏱️  Response Times:"
        echo "   Average: $(echo "$summary" | jq -r '.latency.mean // "N/A"')ms"
        echo "   Median: $(echo "$summary" | jq -r '.latency.median // "N/A"')ms"
        echo "   95th percentile: $(echo "$summary" | jq -r '.latency.p95 // "N/A"')ms"
        echo "   99th percentile: $(echo "$summary" | jq -r '.latency.p99 // "N/A"')ms"
        echo "   Maximum: $(echo "$summary" | jq -r '.latency.max // "N/A"')ms"
        echo ""
    else
        echo "   Summary data not available (install jq for detailed metrics)"
    fi
    
    if [ -f "$REPORT_FILE" ]; then
        echo "📄 Detailed HTML report: $REPORT_FILE"
    fi
    echo "📄 Raw JSON data: $JSON_REPORT"
}

# Function to run stress test
run_stress_test() {
    header "STRESS TESTING"
    
    log "Running stress test to find breaking point..."
    
    local users=1
    local max_users=100
    local step=5
    local test_duration=30
    
    while [ "$users" -le "$max_users" ]; do
        log "Testing with $users concurrent users..."
        
        # Create temporary config for stress test
        local stress_config="stress-test-$users.yml"
        cat > "$stress_config" << EOF
config:
  target: '$API_URL'
  phases:
    - duration: $test_duration
      arrivalRate: $users
scenarios:
  - flow:
      - get:
          url: "/health"
EOF
        
        # Run test and capture metrics
        local output=$(artillery run "$stress_config" 2>&1)
        local success_rate=$(echo "$output" | grep -o "http.request_rate.*" | head -1 || echo "")
        local error_rate=$(echo "$output" | grep -o "errors.*" | head -1 || echo "")
        
        echo "  Users: $users | Success Rate: $success_rate | Errors: $error_rate"
        
        # Check if we're seeing significant errors
        if echo "$output" | grep -q "ECONNREFUSED\|timeout\|socket hang up"; then
            warning "Breaking point reached at $users concurrent users"
            break
        fi
        
        users=$((users + step))
        rm -f "$stress_config"
        
        # Small delay between tests
        sleep 2
    done
}

# Function to run database performance test
run_database_test() {
    header "DATABASE PERFORMANCE TEST"
    
    log "Testing database-intensive operations..."
    
    # Get auth token for database operations
    local token=$(get_auth_token "$PARTNER_EMAIL" "$PARTNER_PASSWORD" "partner")
    
    if [ -n "$token" ]; then
        # Test order creation (write operations)
        log "Testing order creation performance..."
        
        local total_time=0
        local successful_orders=0
        
        for i in {1..5}; do
            local start_time=$(date +%s%N)
            
            local response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/orders" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d '{
                    "items": "Test Order",
                    "itemsDetailed": [{"productId": 1, "strain": "Test", "quantity": 1, "price": 100}],
                    "total": 100,
                    "notes": "Performance test order"
                }' 2>/dev/null || echo "000")
            
            local end_time=$(date +%s%N)
            local request_time=$(( (end_time - start_time) / 1000000 ))
            
            if [ "$response" = "201" ]; then
                total_time=$((total_time + request_time))
                ((successful_orders++))
            fi
        done
        
        if [ "$successful_orders" -gt 0 ]; then
            local avg_time=$((total_time / successful_orders))
            echo "  ✓ Order creation: ${avg_time}ms average"
        else
            echo "  ✗ Order creation: All requests failed"
        fi
        
        # Test order listing (read operations)
        log "Testing order listing performance..."
        
        total_time=0
        local successful_reads=0
        
        for i in {1..10}; do
            local start_time=$(date +%s%N)
            
            local response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/orders" \
                -H "Authorization: Bearer $token" 2>/dev/null || echo "000")
            
            local end_time=$(date +%s%N)
            local request_time=$(( (end_time - start_time) / 1000000 ))
            
            if [ "$response" = "200" ]; then
                total_time=$((total_time + request_time))
                ((successful_reads++))
            fi
        done
        
        if [ "$successful_reads" -gt 0 ]; then
            local avg_time=$((total_time / successful_reads))
            echo "  ✓ Order listing: ${avg_time}ms average"
        else
            echo "  ✗ Order listing: All requests failed"
        fi
    else
        warning "Could not authenticate, skipping database tests"
    fi
}

# Function to analyze results
analyze_results() {
    header "PERFORMANCE ANALYSIS"
    
    if [ -f "$JSON_REPORT" ] && command -v jq &> /dev/null; then
        local summary=$(cat "$JSON_REPORT" | jq '.aggregate')
        local avg_response=$(echo "$summary" | jq -r '.latency.mean // 0')
        local p95_response=$(echo "$summary" | jq -r '.latency.p95 // 0')
        local error_rate=$(echo "$summary" | jq -r '.counters."http.request_errors" // 0')
        local total_requests=$(echo "$summary" | jq -r '.counters."http.requests" // 0')
        
        echo "🎯 Performance Grade:"
        
        # Analyze response time
        if (( $(echo "$avg_response < 200" | bc -l 2>/dev/null || echo "0") )); then
            echo "   ✅ Response Time: Excellent (${avg_response}ms avg)"
        elif (( $(echo "$avg_response < 500" | bc -l 2>/dev/null || echo "0") )); then
            echo "   ⚠️  Response Time: Good (${avg_response}ms avg)"
        else
            echo "   ❌ Response Time: Poor (${avg_response}ms avg)"
        fi
        
        # Analyze error rate
        local error_percentage=0
        if [ "$total_requests" -gt 0 ]; then
            error_percentage=$(echo "scale=2; $error_rate * 100 / $total_requests" | bc 2>/dev/null || echo "0")
        fi
        
        if (( $(echo "$error_percentage < 1" | bc -l 2>/dev/null || echo "1") )); then
            echo "   ✅ Error Rate: Excellent (${error_percentage}%)"
        elif (( $(echo "$error_percentage < 5" | bc -l 2>/dev/null || echo "1") )); then
            echo "   ⚠️  Error Rate: Acceptable (${error_percentage}%)"
        else
            echo "   ❌ Error Rate: High (${error_percentage}%)"
        fi
        
        # Recommendations
        echo ""
        echo "💡 Recommendations:"
        
        if (( $(echo "$avg_response > 500" | bc -l 2>/dev/null || echo "0") )); then
            echo "   • Consider database query optimization"
            echo "   • Review application caching strategy"
            echo "   • Monitor server resource usage"
        fi
        
        if (( $(echo "$p95_response > 1000" | bc -l 2>/dev/null || echo "0") )); then
            echo "   • Investigate slow queries causing high latency"
            echo "   • Consider connection pooling optimization"
        fi
        
        if (( $(echo "$error_percentage > 1" | bc -l 2>/dev/null || echo "0") )); then
            echo "   • Review error logs for failure patterns"
            echo "   • Increase rate limiting thresholds if needed"
            echo "   • Monitor database connection pool"
        fi
    else
        echo "   Analysis requires jq to be installed"
    fi
}

# Help function
show_help() {
    echo "Faded Skies Performance Testing Script"
    echo ""
    echo "Usage: $0 [test-type] [options]"
    echo ""
    echo "Test Types:"
    echo "  basic               Run basic response time tests"
    echo "  load                Run load test with artillery"
    echo "  stress              Run stress test to find limits"
    echo "  database            Test database performance"
    echo "  full                Run all tests (default)"
    echo ""
    echo "Options:"
    echo "  --api-url <url>     API URL to test"
    echo "  --users <num>       Concurrent users for load test"
    echo "  --duration <sec>    Test duration in seconds"
    echo "  --ramp-up <sec>     Ramp up time in seconds"
    echo "  --report <file>     HTML report file name"
    echo ""
    echo "Environment Variables:"
    echo "  API_URL             API URL to test"
    echo "  CONCURRENT_USERS    Number of concurrent users"
    echo "  TEST_DURATION       Test duration in seconds"
    echo "  ADMIN_EMAIL         Admin email for testing"
    echo "  ADMIN_PASSWORD      Admin password for testing"
    echo "  PARTNER_EMAIL       Partner email for testing"
    echo "  PARTNER_PASSWORD    Partner password for testing"
    echo ""
    echo "Examples:"
    echo "  $0 basic"
    echo "  $0 load --users 20 --duration 120"
    echo "  $0 stress --api-url https://staging.fadedskies.com"
    echo "  $0 full --report performance-report.html"
}

# Main function
main() {
    local test_type="${1:-full}"
    
    # Parse options
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --api-url)
                API_URL="$2"
                shift 2
                ;;
            --users)
                CONCURRENT_USERS="$2"
                shift 2
                ;;
            --duration)
                TEST_DURATION="$2"
                shift 2
                ;;
            --ramp-up)
                RAMP_UP_TIME="$2"
                shift 2
                ;;
            --report)
                REPORT_FILE="$2"
                shift 2
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
    
    header "FADED SKIES PERFORMANCE TESTING"
    log "Testing API: $API_URL"
    log "Test type: $test_type"
    log "Concurrent users: $CONCURRENT_USERS"
    log "Duration: ${TEST_DURATION}s"
    
    check_prerequisites
    test_connectivity
    
    case "$test_type" in
        "basic")
            run_basic_test
            ;;
        "load")
            run_load_test
            analyze_results
            ;;
        "stress")
            run_stress_test
            ;;
        "database")
            run_database_test
            ;;
        "full")
            run_basic_test
            run_load_test
            run_database_test
            analyze_results
            ;;
        *)
            error "Unknown test type: $test_type"
            show_help
            exit 1
            ;;
    esac
    
    success "Performance testing completed!"
    echo ""
    echo "📊 Results Summary:"
    echo "   📄 HTML Report: $REPORT_FILE"
    echo "   📄 JSON Data: $JSON_REPORT"
    echo "   🎯 API URL: $API_URL"
}

# Run main function
main "$@"

# ========================================
# USAGE EXAMPLES:
# 
# Basic performance test:
# ./scripts/performance-test.sh basic
# 
# Load test with custom parameters:
# ./scripts/performance-test.sh load --users 50 --duration 300
# 
# Stress test to find limits:
# ./scripts/performance-test.sh stress
# 
# Full performance suite:
# ./scripts/performance-test.sh full --api-url https://api.fadedskies.com
# ========================================