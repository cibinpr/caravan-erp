#!/usr/bin/env bash
# ==============================================================================
# Caravan Accounting - Scheduled Backup Script (SRS Section 8.9)
# Runs via cron daily at 02:00:
# 0 2 * * * /var/www/caravan/current/deployment/backup.sh >> /var/log/caravan_backup.log 2>&1
# ==============================================================================

set -euo pipefail

APP_ROOT="/var/www/caravan"
SHARED_DIR="${APP_ROOT}/shared"
BACKUPS_DIR="${APP_ROOT}/backups"
DATE_TAG=$(date +"%Y%m%d_%H%M%S")

mkdir -p "${BACKUPS_DIR}/db"
mkdir -p "${BACKUPS_DIR}/bills"

echo "[$(date -u)] Starting daily backup..."

# 1. Read DB Credentials
DB_NAME=$(grep -E '^DB_DATABASE=' "${SHARED_DIR}/.env" | cut -d '=' -f 2 | tr -d '"' | tr -d "'" || echo "caravan_accounting")
DB_USER=$(grep -E '^DB_USERNAME=' "${SHARED_DIR}/.env" | cut -d '=' -f 2 | tr -d '"' | tr -d "'" || echo "caravan_user")
DB_PASS=$(grep -E '^DB_PASSWORD=' "${SHARED_DIR}/.env" | cut -d '=' -f 2 | tr -d '"' | tr -d "'")

# 2. Database Dump
DB_BACKUP_FILE="${BACKUPS_DIR}/db/${DB_NAME}_${DATE_TAG}.sql.gz"
mysqldump -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 --single-transaction --quick "${DB_NAME}" | gzip > "${DB_BACKUP_FILE}"
echo "Database backed up to ${DB_BACKUP_FILE} (Size: $(du -h "${DB_BACKUP_FILE}" | cut -f 1))"

# 3. Archive Bills Directory
BILLS_BACKUP_FILE="${BACKUPS_DIR}/bills/bills_${DATE_TAG}.tar.gz"
tar -czf "${BILLS_BACKUP_FILE}" -C "${SHARED_DIR}/storage" bills
echo "Bills archived to ${BILLS_BACKUP_FILE} (Size: $(du -h "${BILLS_BACKUP_FILE}" | cut -f 1))"

# 4. Rotate Local Backups (Keep 30 daily copies)
find "${BACKUPS_DIR}/db" -type f -name "*.sql.gz" -mtime +30 -delete
find "${BACKUPS_DIR}/bills" -type f -name "*.tar.gz" -mtime +30 -delete

# 5. Optional Off-Server Sync (rclone / S3 / R2) (SRS Section 8.9)
if command -v rclone &> /dev/null; then
  echo "Syncing backups to off-server remote storage..."
  rclone sync "${BACKUPS_DIR}" "remote:caravan-backups" --quiet || echo "Warning: Off-server rclone sync failed."
fi

echo "[$(date -u)] Daily backup completed successfully."
