#!/bin/bash

# ========================================
# FADED SKIES DATABASE SEEDING SCRIPT
# ========================================

set -e  # Exit on any error

# Configuration
DATABASE_URL="${DATABASE_URL:-postgresql://fadedskies:password@localhost:5432/fadedskies}"
SEED_ENVIRONMENT="${SEED_ENVIRONMENT:-development}"
FORCE_SEED="${FORCE_SEED:-false}"

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

# Function to detect database type
detect_db_type() {
    if [[ "$DATABASE_URL" == *"postgres"* ]]; then
        echo "postgresql"
    elif [[ "$DATABASE_URL" == *"sqlite"* ]] || [[ -f "$DATABASE_URL" ]]; then
        echo "sqlite"
    else
        echo "unknown"
    fi
}

# Function to execute SQL
execute_sql() {
    local sql="$1"
    local db_type=$(detect_db_type)
    
    if [ "$db_type" = "postgresql" ]; then
        psql "$DATABASE_URL" -c "$sql"
    elif [ "$db_type" = "sqlite" ]; then
        sqlite3 "$DATABASE_URL" "$sql"
    else
        error "Unsupported database type: $db_type"
        exit 1
    fi
}

# Function to check if database is empty
is_database_empty() {
    local db_type=$(detect_db_type)
    local count=0
    
    if [ "$db_type" = "postgresql" ]; then
        count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs || echo "0")
    elif [ "$db_type" = "sqlite" ]; then
        count=$(sqlite3 "$DATABASE_URL" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    fi
    
    [ "$count" -eq 0 ]
}

# Function to hash password
hash_password() {
    local password="$1"
    node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('$password', 10));"
}

# Function to seed admin users
seed_admin_users() {
    log "Seeding admin users..."
    
    local admin_password=$(hash_password "admin123")
    
    execute_sql "
    INSERT INTO users (email, password, role, business_name, contact_name, status, created_at, updated_at) 
    VALUES 
        ('admin@fadedskies.com', '$admin_password', 'admin', 'Faded Skies Admin', 'Admin User', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO UPDATE SET 
        password = EXCLUDED.password,
        business_name = EXCLUDED.business_name,
        updated_at = CURRENT_TIMESTAMP;
    "
    
    success "Admin users seeded"
}

# Function to seed partner users
seed_partner_users() {
    log "Seeding partner users..."
    
    local partner_password=$(hash_password "partner123")
    local demo_password=$(hash_password "demo123")
    
    execute_sql "
    INSERT INTO users (email, password, role, business_name, contact_name, phone, business_type, license, expected_volume, status, created_at, updated_at) 
    VALUES 
        ('partner@store.com', '$partner_password', 'partner', 'Demo Partner Store', 'Demo User', '(555) 123-4567', 'dispensary', 'DEMO-LICENSE-001', '10.5k-35k', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('dispensary@example.com', '$demo_password', 'partner', 'Example Dispensary', 'John Smith', '(555) 234-5678', 'dispensary', 'DISP-LICENSE-001', '35k-70k', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('smokeshop@example.com', '$demo_password', 'partner', 'Smoke Shop Plus', 'Jane Doe', '(555) 345-6789', 'smoke-shop', 'SMOKE-LICENSE-001', '3.5k-10.5k', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('cbdstore@example.com', '$demo_password', 'partner', 'CBD Store Direct', 'Mike Johnson', '(555) 456-7890', 'cbd-store', 'CBD-LICENSE-001', '10.5k-35k', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO UPDATE SET 
        password = EXCLUDED.password,
        business_name = EXCLUDED.business_name,
        updated_at = CURRENT_TIMESTAMP;
    "
    
    success "Partner users seeded"
}

# Function to seed products
seed_products() {
    log "Seeding products..."
    
    # Clear existing products if force seeding
    if [ "$FORCE_SEED" = "true" ]; then
        execute_sql "DELETE FROM products;"
    fi
    
    execute_sql "
    INSERT INTO products (strain, grade, type, thca, price, status, stock, description, created_at, updated_at) 
    VALUES 
        -- Grade A Flower
        ('Gelato #33', 'GRADE A', 'Indoor', 28.5, 625, 'AVAILABLE', 45, 'Premium indoor strain with exceptional terpene profile and heavy resin production', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Wedding Cake', 'GRADE A', 'Indoor', 31.2, 675, 'AVAILABLE', 23, 'Top-shelf indoor with dense nugs and sweet vanilla aroma', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('White Widow', 'GRADE A', 'Indoor', 29.7, 650, 'AVAILABLE', 34, 'Classic strain with balanced effects and frosty appearance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Blue Dream', 'GRADE A', 'Indoor', 27.8, 600, 'AVAILABLE', 56, 'Popular sativa-dominant hybrid with sweet berry flavors', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('OG Kush', 'GRADE A', 'Indoor', 30.1, 675, 'COMING SOON', 0, 'Legendary West Coast strain with earthy pine notes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        
        -- Grade B Flower  
        ('Purple Punch', 'GRADE B', 'Greenhouse', 24.8, 425, 'AVAILABLE', 67, 'Quality greenhouse with great value and purple hues', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Green Crack', 'GRADE B', 'Outdoor', 22.3, 350, 'AVAILABLE', 89, 'Energizing sativa with citrus flavors, outdoor grown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Zkittlez', 'GRADE B', 'Greenhouse', 25.1, 450, 'AVAILABLE', 43, 'Fruity indica with rainbow of colors', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Granddaddy Purple', 'GRADE B', 'Outdoor', 21.7, 375, 'AVAILABLE', 78, 'Classic purple strain with grape flavors', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        
        -- Concentrates
        ('Blue Dream Live', 'ROSIN', 'Live Rosin', 0, 22, 'AVAILABLE', 156, 'Premium live rosin with full terpene preservation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Wedding Cake Live', 'ROSIN', 'Live Rosin', 0, 28, 'AVAILABLE', 92, 'High-end live rosin from premium indoor flower', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Gelato Sauce', 'ROSIN', 'Live Sauce', 0, 18, 'AVAILABLE', 134, 'Terpene-rich live sauce with incredible flavor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('OG Kush Badder', 'ROSIN', 'Badder', 0, 20, 'COMING SOON', 0, 'Whipped consistency badder with classic OG taste', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        
        -- Vape Products
        ('Strawberry Cough', 'VAPE', '0.5g Cart', 0, 12, 'AVAILABLE', 89, 'Live resin vape cartridge with sweet strawberry flavor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Pineapple Express', 'VAPE', '1g Cart', 0, 18, 'AVAILABLE', 156, 'Full gram live resin cart with tropical flavors', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Jack Herer', 'VAPE', '0.5g Cart', 0, 14, 'AVAILABLE', 67, 'Uplifting sativa cart perfect for daytime use', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Bubba Kush', 'VAPE', '1g Cart', 0, 20, 'AVAILABLE', 45, 'Relaxing indica cart with earthy flavors', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        
        -- Bulk Products
        ('Mixed Light A', 'BULK', 'Mixed Indoor/Greenhouse', 26.5, 2500, 'AVAILABLE', 5, '5lb minimum - Mixed premium strains', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Outdoor Mix B', 'BULK', 'Outdoor Blend', 20.8, 1500, 'AVAILABLE', 8, '10lb minimum - Quality outdoor blend', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        
        -- Pre-Rolls
        ('Premium Pre-Roll Mix', 'PREROLL', '1g Pre-Rolls', 0, 3, 'AVAILABLE', 500, 'Mixed strain 1g pre-rolls, minimum 100 units', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Infused Pre-Rolls', 'PREROLL', '1g Infused', 0, 8, 'AVAILABLE', 200, 'Pre-rolls infused with live resin, premium option', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT DO NOTHING;
    "
    
    success "Products seeded"
}

# Function to seed sample orders
seed_sample_orders() {
    if [ "$SEED_ENVIRONMENT" = "production" ]; then
        log "Skipping sample orders for production environment"
        return 0
    fi
    
    log "Seeding sample orders..."
    
    # Get user IDs
    local db_type=$(detect_db_type)
    local partner_id admin_id
    
    if [ "$db_type" = "postgresql" ]; then
        partner_id=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users WHERE email = 'partner@store.com';" | xargs)
        admin_id=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users WHERE email = 'admin@fadedskies.com';" | xargs)
    elif [ "$db_type" = "sqlite" ]; then
        partner_id=$(sqlite3 "$DATABASE_URL" "SELECT id FROM users WHERE email = 'partner@store.com';")
        admin_id=$(sqlite3 "$DATABASE_URL" "SELECT id FROM users WHERE email = 'admin@fadedskies.com';")
    fi
    
    if [ -n "$partner_id" ]; then
        execute_sql "
        INSERT INTO orders (user_id, items, items_detailed, total, notes, status, created_at, updated_at) 
        VALUES 
            ($partner_id, 'Gelato #33 (x2), Blue Dream Live (x1)', '[{\"productId\": 1, \"strain\": \"Gelato #33\", \"quantity\": 2, \"price\": 625}, {\"productId\": 10, \"strain\": \"Blue Dream Live\", \"quantity\": 1, \"price\": 22}]', 1272.00, 'First order from demo partner', 'pending', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
            ($partner_id, 'Wedding Cake (x1), Strawberry Cough Vape (x5)', '[{\"productId\": 2, \"strain\": \"Wedding Cake\", \"quantity\": 1, \"price\": 675}, {\"productId\": 14, \"strain\": \"Strawberry Cough\", \"quantity\": 5, \"price\": 12}]', 735.00, 'Regular weekly order', 'processing', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP),
            ($partner_id, 'Purple Punch (x3)', '[{\"productId\": 6, \"strain\": \"Purple Punch\", \"quantity\": 3, \"price\": 425}]', 1275.00, 'Bulk order for weekend sales', 'shipped', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;
        "
    fi
    
    success "Sample orders seeded"
}

# Function to create database indexes
create_indexes() {
    log "Creating database indexes..."
    
    execute_sql "
    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_users_email_role ON users(email, role);
    CREATE INDEX IF NOT EXISTS idx_users_status_created ON users(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_products_status_grade ON products(status, grade);
    CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock, status);
    CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_status ON orders(created_at, status);
    CREATE INDEX IF NOT EXISTS idx_orders_total ON orders(total);
    
    -- Search indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_products_strain_lower ON products(LOWER(strain));
    CREATE INDEX IF NOT EXISTS idx_users_business_name_lower ON users(LOWER(business_name));
    "
    
    success "Database indexes created"
}

# Function to update database statistics
update_statistics() {
    log "Updating database statistics..."
    
    local db_type=$(detect_db_type)
    
    if [ "$db_type" = "postgresql" ]; then
        execute_sql "ANALYZE;"
    elif [ "$db_type" = "sqlite" ]; then
        execute_sql "ANALYZE;"
    fi
    
    success "Database statistics updated"
}

# Function to verify seeded data
verify_data() {
    log "Verifying seeded data..."
    
    local db_type=$(detect_db_type)
    local user_count product_count order_count
    
    if [ "$db_type" = "postgresql" ]; then
        user_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users;" | xargs)
        product_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM products;" | xargs)
        order_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM orders;" | xargs)
    elif [ "$db_type" = "sqlite" ]; then
        user_count=$(sqlite3 "$DATABASE_URL" "SELECT COUNT(*) FROM users;")
        product_count=$(sqlite3 "$DATABASE_URL" "SELECT COUNT(*) FROM products;")
        order_count=$(sqlite3 "$DATABASE_URL" "SELECT COUNT(*) FROM orders;")
    fi
    
    echo ""
    echo "📊 Database Summary:"
    echo "   👥 Users: $user_count"
    echo "   📦 Products: $product_count"
    echo "   🛒 Orders: $order_count"
    echo ""
    
    if [ "$user_count" -gt 0 ] && [ "$product_count" -gt 0 ]; then
        success "Data verification passed"
    else
        error "Data verification failed"
        exit 1
    fi
}

# Function to show seeded credentials
show_credentials() {
    echo ""
    echo "🔐 Seeded User Credentials:"
    echo ""
    echo "👨‍💼 Admin Account:"
    echo "   Email: admin@fadedskies.com"
    echo "   Password: admin123"
    echo "   Role: admin"
    echo ""
    echo "🤝 Partner Accounts:"
    echo "   Email: partner@store.com"
    echo "   Password: partner123"
    echo "   Role: partner"
    echo ""
    echo "   Email: dispensary@example.com"
    echo "   Password: demo123"
    echo "   Role: partner"
    echo ""
    echo "⚠️  IMPORTANT: Change these passwords in production!"
    echo ""
}

# Help function
show_help() {
    echo "Faded Skies Database Seeding Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  full                Seed all data (default)"
    echo "  users               Seed only users"
    echo "  products            Seed only products"
    echo "  orders              Seed only sample orders"
    echo "  verify              Verify seeded data"
    echo ""
    echo "Options:"
    echo "  --force             Force re-seed (overwrite existing data)"
    echo "  --env <env>         Set environment (development/staging/production)"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL        Database connection string"
    echo "  SEED_ENVIRONMENT    Environment to seed for (default: development)"
    echo "  FORCE_SEED          Force overwrite existing data (default: false)"
    echo ""
    echo "Examples:"
    echo "  $0 full"
    echo "  $0 products --force"
    echo "  $0 full --env staging"
    echo "  DATABASE_URL=postgresql://... $0 full"
}

# Main function
main() {
    local command="${1:-full}"
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE_SEED=true
                shift
                ;;
            --env)
                SEED_ENVIRONMENT="$2"
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
    
    log "Database Seeding Tool"
    log "Database: $(detect_db_type)"
    log "Environment: $SEED_ENVIRONMENT"
    log "Force seed: $FORCE_SEED"
    echo ""
    
    # Safety check for production
    if [ "$SEED_ENVIRONMENT" = "production" ] && [ "$FORCE_SEED" = "true" ]; then
        warning "Force seeding in production environment!"
        read -p "Are you sure you want to continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            log "Seeding cancelled"
            exit 0
        fi
    fi
    
    # Check if database is empty (unless force seeding)
    if [ "$FORCE_SEED" = "false" ] && ! is_database_empty; then
        warning "Database contains data. Use --force to overwrite."
        exit 1
    fi
    
    case "$command" in
        "full")
            seed_admin_users
            seed_partner_users
            seed_products
            seed_sample_orders
            create_indexes
            update_statistics
            verify_data
            show_credentials
            success "Full database seeding completed!"
            ;;
        "users")
            seed_admin_users
            seed_partner_users
            verify_data
            show_credentials
            success "User seeding completed!"
            ;;
        "products")
            seed_products
            create_indexes
            update_statistics
            verify_data
            success "Product seeding completed!"
            ;;
        "orders")
            seed_sample_orders
            verify_data
            success "Order seeding completed!"
            ;;
        "verify")
            verify_data
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
# Seed full database:
# ./scripts/seed.sh full
# 
# Seed only products:
# ./scripts/seed.sh products
# 
# Force re-seed for staging:
# ./scripts/seed.sh full --env staging --force
# 
# Seed with custom database:
# DATABASE_URL=postgresql://... ./scripts/seed.sh full
# ========================================