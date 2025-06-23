#!/bin/bash

# ========================================
# FADED SKIES DATABASE MIGRATION SCRIPT
# ========================================

set -e  # Exit on any error

# Configuration
DATABASE_URL="${DATABASE_URL:-postgresql://fadedskies:password@localhost:5432/fadedskies}"
MIGRATIONS_DIR="./database/migrations"
BACKUP_BEFORE_MIGRATE="${BACKUP_BEFORE_MIGRATE:-true}"
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

# Create migrations directory if it doesn't exist
mkdir -p "$MIGRATIONS_DIR"

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

# Function to execute SQL for PostgreSQL
execute_pg_sql() {
    local sql="$1"
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would execute: $sql"
        return 0
    fi
    
    psql "$DATABASE_URL" -c "$sql"
}

# Function to execute SQL for SQLite
execute_sqlite_sql() {
    local sql="$1"
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would execute: $sql"
        return 0
    fi
    
    sqlite3 "$DATABASE_URL" "$sql"
}

# Function to create migrations table
create_migrations_table() {
    local db_type=$(detect_db_type)
    
    log "Creating migrations tracking table..."
    
    if [ "$db_type" = "postgresql" ]; then
        execute_pg_sql "
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            version VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            checksum VARCHAR(255)
        );"
    elif [ "$db_type" = "sqlite" ]; then
        execute_sqlite_sql "
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            checksum TEXT
        );"
    else
        error "Unsupported database type: $db_type"
        exit 1
    fi
    
    success "Migrations table ready"
}

# Function to get applied migrations
get_applied_migrations() {
    local db_type=$(detect_db_type)
    
    if [ "$db_type" = "postgresql" ]; then
        psql "$DATABASE_URL" -t -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null | xargs || echo ""
    elif [ "$db_type" = "sqlite" ]; then
        sqlite3 "$DATABASE_URL" "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null | xargs || echo ""
    fi
}

# Function to calculate file checksum
calculate_checksum() {
    local file="$1"
    if command -v sha256sum &> /dev/null; then
        sha256sum "$file" | cut -d' ' -f1
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$file" | cut -d' ' -f1
    else
        # Fallback: use file size and modification time
        stat "$file" | md5sum | cut -d' ' -f1
    fi
}

# Function to record migration
record_migration() {
    local version="$1"
    local checksum="$2"
    local db_type=$(detect_db_type)
    
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would record migration: $version"
        return 0
    fi
    
    if [ "$db_type" = "postgresql" ]; then
        execute_pg_sql "INSERT INTO schema_migrations (version, checksum) VALUES ('$version', '$checksum');"
    elif [ "$db_type" = "sqlite" ]; then
        execute_sqlite_sql "INSERT INTO schema_migrations (version, checksum) VALUES ('$version', '$checksum');"
    fi
}

# Function to execute migration file
execute_migration() {
    local file="$1"
    local version="$2"
    local db_type=$(detect_db_type)
    
    log "Executing migration: $version"
    
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would execute migration file: $file"
        return 0
    fi
    
    if [ "$db_type" = "postgresql" ]; then
        psql "$DATABASE_URL" -f "$file"
    elif [ "$db_type" = "sqlite" ]; then
        sqlite3 "$DATABASE_URL" < "$file"
    fi
    
    if [ $? -eq 0 ]; then
        local checksum=$(calculate_checksum "$file")
        record_migration "$version" "$checksum"
        success "Migration $version completed successfully"
    else
        error "Migration $version failed"
        exit 1
    fi
}

# Function to create initial migration
create_initial_migration() {
    local migration_file="$MIGRATIONS_DIR/001_initial_schema.sql"
    
    if [ -f "$migration_file" ]; then
        log "Initial migration already exists"
        return 0
    fi
    
    log "Creating initial migration..."
    
    cat > "$migration_file" << 'EOF'
-- ========================================
-- INITIAL SCHEMA MIGRATION
-- Version: 001
-- Description: Create initial tables
-- ========================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'partner',
    business_name VARCHAR(255),
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    business_type VARCHAR(100),
    license VARCHAR(100),
    expected_volume VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    strain VARCHAR(255) NOT NULL,
    grade VARCHAR(100) NOT NULL,
    type VARCHAR(100) NOT NULL,
    thca DECIMAL(5,2) DEFAULT 0,
    price DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'AVAILABLE',
    stock INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    items TEXT NOT NULL,
    items_detailed TEXT,
    total DECIMAL(10,2) NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_grade ON products(grade);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Insert default admin user
INSERT INTO users (email, password, role, business_name, status) 
VALUES ('admin@fadedskies.com', '$2a$10$defaulthashedpassword', 'admin', 'Faded Skies Admin', 'active')
ON CONFLICT (email) DO NOTHING;
EOF

    success "Initial migration created: $migration_file"
}

# Function to run migrations
run_migrations() {
    log "Starting database migrations..."
    
    # Create migrations table
    create_migrations_table
    
    # Create initial migration if needed
    create_initial_migration
    
    # Get applied migrations
    applied_migrations=$(get_applied_migrations)
    log "Applied migrations: $applied_migrations"
    
    # Find migration files
    migration_files=($(find "$MIGRATIONS_DIR" -name "*.sql" | sort))
    
    if [ ${#migration_files[@]} -eq 0 ]; then
        warning "No migration files found in $MIGRATIONS_DIR"
        return 0
    fi
    
    local migrations_applied=0
    
    for file in "${migration_files[@]}"; do
        local filename=$(basename "$file")
        local version="${filename%%.sql}"
        
        # Check if migration was already applied
        if echo "$applied_migrations" | grep -q "$version"; then
            log "Migration $version already applied, skipping..."
            continue
        fi
        
        # Execute migration
        execute_migration "$file" "$version"
        ((migrations_applied++))
    done
    
    if [ $migrations_applied -eq 0 ]; then
        success "Database is up to date (no new migrations)"
    else
        success "$migrations_applied migration(s) applied successfully"
    fi
}

# Function to rollback migration
rollback_migration() {
    local version="$1"
    local db_type=$(detect_db_type)
    
    if [ -z "$version" ]; then
        error "Version required for rollback"
        exit 1
    fi
    
    warning "Rolling back migration: $version"
    
    # Look for rollback file
    local rollback_file="$MIGRATIONS_DIR/${version}_rollback.sql"
    
    if [ ! -f "$rollback_file" ]; then
        error "Rollback file not found: $rollback_file"
        exit 1
    fi
    
    # Execute rollback
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would execute rollback: $rollback_file"
    else
        if [ "$db_type" = "postgresql" ]; then
            psql "$DATABASE_URL" -f "$rollback_file"
        elif [ "$db_type" = "sqlite" ]; then
            sqlite3 "$DATABASE_URL" < "$rollback_file"
        fi
        
        # Remove migration record
        if [ "$db_type" = "postgresql" ]; then
            execute_pg_sql "DELETE FROM schema_migrations WHERE version = '$version';"
        elif [ "$db_type" = "sqlite" ]; then
            execute_sqlite_sql "DELETE FROM schema_migrations WHERE version = '$version';"
        fi
    fi
    
    success "Migration $version rolled back successfully"
}

# Function to show migration status
show_status() {
    log "Migration Status:"
    echo ""
    
    # Get applied migrations
    applied_migrations=$(get_applied_migrations)
    
    # Find all migration files
    migration_files=($(find "$MIGRATIONS_DIR" -name "*.sql" | grep -v "_rollback" | sort))
    
    echo "Applied Migrations:"
    if [ -n "$applied_migrations" ]; then
        for migration in $applied_migrations; do
            echo "  ✅ $migration"
        done
    else
        echo "  (none)"
    fi
    
    echo ""
    echo "Pending Migrations:"
    local pending_found=false
    for file in "${migration_files[@]}"; do
        local filename=$(basename "$file")
        local version="${filename%%.sql}"
        
        if ! echo "$applied_migrations" | grep -q "$version"; then
            echo "  ⏳ $version"
            pending_found=true
        fi
    done
    
    if [ "$pending_found" = false ]; then
        echo "  (none)"
    fi
    
    echo ""
}

# Function to create new migration
create_migration() {
    local name="$1"
    
    if [ -z "$name" ]; then
        error "Migration name required"
        echo "Usage: $0 create migration_name"
        exit 1
    fi
    
    # Generate version number
    local timestamp=$(date +"%Y%m%d%H%M%S")
    local version="${timestamp}_${name}"
    local migration_file="$MIGRATIONS_DIR/${version}.sql"
    local rollback_file="$MIGRATIONS_DIR/${version}_rollback.sql"
    
    # Create migration file
    cat > "$migration_file" << EOF
-- ========================================
-- MIGRATION: $name
-- Version: $version
-- Created: $(date)
-- ========================================

-- Add your migration SQL here
-- Example:
-- ALTER TABLE users ADD COLUMN new_field VARCHAR(255);

EOF

    # Create rollback file
    cat > "$rollback_file" << EOF
-- ========================================
-- ROLLBACK: $name
-- Version: $version
-- Created: $(date)
-- ========================================

-- Add your rollback SQL here
-- Example:
-- ALTER TABLE users DROP COLUMN new_field;

EOF

    success "Migration files created:"
    echo "  📄 $migration_file"
    echo "  📄 $rollback_file"
}

# Function to backup database before migration
backup_database() {
    if [ "$BACKUP_BEFORE_MIGRATE" = "true" ]; then
        log "Creating backup before migration..."
        
        if [ -f "./scripts/backup.sh" ]; then
            ./scripts/backup.sh
        else
            warning "Backup script not found, skipping backup"
        fi
    fi
}

# Help function
show_help() {
    echo "Faded Skies Database Migration Tool"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  migrate              Run pending migrations (default)"
    echo "  status               Show migration status"
    echo "  create <name>        Create new migration"
    echo "  rollback <version>   Rollback specific migration"
    echo ""
    echo "Options:"
    echo "  --dry-run           Show what would be executed without making changes"
    echo "  --no-backup         Skip backup before migration"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL        Database connection string"
    echo "  BACKUP_BEFORE_MIGRATE  Create backup before migration (default: true)"
    echo ""
    echo "Examples:"
    echo "  $0 migrate"
    echo "  $0 status"
    echo "  $0 create add_user_preferences"
    echo "  $0 rollback 20231201_add_user_preferences"
    echo "  DATABASE_URL=postgresql://... $0 migrate"
    echo "  $0 migrate --dry-run"
}

# Main function
main() {
    local command="${1:-migrate}"
    
    # Parse flags
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --no-backup)
                BACKUP_BEFORE_MIGRATE=false
                shift
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
    
    # Show configuration
    log "Database Migration Tool"
    log "Database: $(detect_db_type)"
    log "URL: ${DATABASE_URL:0:30}..."
    log "Migrations: $MIGRATIONS_DIR"
    if [ "$DRY_RUN" = "true" ]; then
        warning "DRY RUN MODE - No changes will be made"
    fi
    echo ""
    
    case "$command" in
        "migrate")
            backup_database
            run_migrations
            ;;
        "status")
            show_status
            ;;
        "create")
            create_migration "$2"
            ;;
        "rollback")
            rollback_migration "$2"
            ;;
        *)
            echo "Unknown command: $command"
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
# Run migrations:
# ./scripts/migrate.sh migrate
# 
# Check status:
# ./scripts/migrate.sh status
# 
# Create new migration:
# ./scripts/migrate.sh create add_product_categories
# 
# Rollback migration:
# ./scripts/migrate.sh rollback 20231201_add_product_categories
# 
# Dry run:
# ./scripts/migrate.sh migrate --dry-run
# ========================================