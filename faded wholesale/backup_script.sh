#!/bin/bash

# ========================================
# FADED SKIES DATABASE BACKUP SCRIPT
# ========================================

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/backups"
DATABASE_URL="${DATABASE_URL:-postgresql://fadedskies:password@postgres:5432/fadedskies}"
AWS_S3_BUCKET="${AWS_S3_BUCKET:-faded-skies-backups}"
RETENTION_DAYS=${RETENTION_DAYS:-30}
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="fadedskies_backup_${TIMESTAMP}.sql"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

echo "🗄️ Starting database backup..."
echo "📅 Timestamp: $TIMESTAMP"
echo "📁 Backup file: $BACKUP_FILE"

# Function to send Slack notification
send_slack_notification() {
    local message="$1"
    local status="$2"
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        local emoji="✅"
        
        if [ "$status" = "error" ]; then
            color="danger"
            emoji="❌"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$emoji Faded Skies Database Backup\",
                    \"text\": \"$message\",
                    \"footer\": \"Faded Skies Backup System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL" || echo "Failed to send Slack notification"
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "fadedskies_backup_*.sql*" -mtime +$RETENTION_DAYS -delete || echo "No old local backups to clean"
    
    # S3 cleanup (if AWS CLI is available and configured)
    if command -v aws &> /dev/null && [ -n "$AWS_S3_BUCKET" ]; then
        echo "🗑️ Cleaning up old S3 backups..."
        CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
        aws s3api list-objects-v2 --bucket "$AWS_S3_BUCKET" --prefix "fadedskies_backup_" --query "Contents[?LastModified<='$CUTOFF_DATE'].Key" --output text | xargs -I {} aws s3 rm "s3://$AWS_S3_BUCKET/{}" || echo "No old S3 backups to clean"
    fi
}

# Function to upload to S3
upload_to_s3() {
    if command -v aws &> /dev/null && [ -n "$AWS_S3_BUCKET" ]; then
        echo "☁️ Uploading backup to S3..."
        aws s3 cp "$BACKUP_PATH.gz" "s3://$AWS_S3_BUCKET/" --storage-class STANDARD_IA
        echo "✅ Backup uploaded to S3: s3://$AWS_S3_BUCKET/$(basename "$BACKUP_PATH.gz")"
    else
        echo "⚠️ AWS CLI not configured or S3 bucket not specified. Skipping S3 upload."
    fi
}

# Trap errors and send notification
trap 'send_slack_notification "❌ Database backup failed at step: $BASH_COMMAND" "error"; exit 1' ERR

# Perform the backup
echo "💾 Creating database dump..."

if [[ "$DATABASE_URL" == *"postgres"* ]]; then
    # PostgreSQL backup
    pg_dump "$DATABASE_URL" --no-password --verbose --clean --no-acl --no-owner > "$BACKUP_PATH"
elif [[ "$DATABASE_URL" == *"sqlite"* || -f "$DATABASE_URL" ]]; then
    # SQLite backup
    sqlite3 "${DATABASE_URL}" ".backup '$BACKUP_PATH.sqlite'"
    BACKUP_PATH="$BACKUP_PATH.sqlite"
else
    echo "❌ Unsupported database type in DATABASE_URL: $DATABASE_URL"
    exit 1
fi

# Verify backup was created
if [ ! -f "$BACKUP_PATH" ]; then
    echo "❌ Backup file was not created!"
    exit 1
fi

# Get backup file size
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "📊 Backup size: $BACKUP_SIZE"

# Compress the backup
echo "🗜️ Compressing backup..."
gzip -9 "$BACKUP_PATH"
COMPRESSED_SIZE=$(du -h "$BACKUP_PATH.gz" | cut -f1)
echo "📊 Compressed size: $COMPRESSED_SIZE"

# Upload to S3 if configured
upload_to_s3

# Cleanup old backups
cleanup_old_backups

# Calculate backup time
END_TIME=$(date)
echo "✅ Backup completed successfully!"
echo "🕒 Finished at: $END_TIME"

# Send success notification
send_slack_notification "✅ Database backup completed successfully
📁 File: $BACKUP_FILE.gz
📊 Size: $COMPRESSED_SIZE
🕒 Time: $END_TIME" "success"

# Display backup info
echo ""
echo "========================================="
echo "📋 BACKUP SUMMARY"
echo "========================================="
echo "✅ Status: SUCCESS"
echo "📁 File: $BACKUP_FILE.gz"
echo "📊 Original size: $BACKUP_SIZE"
echo "📊 Compressed size: $COMPRESSED_SIZE"
echo "📍 Location: $BACKUP_DIR"
if [ -n "$AWS_S3_BUCKET" ]; then
    echo "☁️ S3 Location: s3://$AWS_S3_BUCKET/"
fi
echo "🕒 Completed: $END_TIME"
echo "========================================="

exit 0

# ========================================
# USAGE EXAMPLES:
# 
# Manual backup:
# ./scripts/backup.sh
# 
# Backup with custom retention:
# RETENTION_DAYS=60 ./scripts/backup.sh
# 
# Backup with S3 upload:
# AWS_S3_BUCKET=my-backup-bucket ./scripts/backup.sh
# 
# Docker backup:
# docker-compose --profile backup run backup
# 
# Cron job (daily at 2 AM):
# 0 2 * * * /path/to/backup.sh
# ========================================