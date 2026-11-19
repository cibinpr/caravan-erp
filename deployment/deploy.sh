#!/usr/bin/env bash
# ==============================================================================
# Caravan Accounting - Atomic Zero-Downtime Deployment Script (SRS Section 8.6)
# Usage: ./deploy.sh [environment]
# Default environment: production
# ==============================================================================

set -euo pipefail

ENV="${1:-production}"
APP_ROOT="/var/www/caravan"
RELEASES_DIR="${APP_ROOT}/releases"
SHARED_DIR="${APP_ROOT}/shared"
BACKUPS_DIR="${APP_ROOT}/backups"
CURRENT_LINK="${APP_ROOT}/current"

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
TARGET_RELEASE="${RELEASES_DIR}/${TIMESTAMP}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "Initiating deployment for environment: ${ENV} [Release: ${TIMESTAMP}]"

# 1. Verify Directories and Shared Config (DEP-6, DEP-7)
if [ ! -f "${SHARED_DIR}/.env" ]; then
  log_error "Missing shared environment configuration at ${SHARED_DIR}/.env"
  exit 1
fi

mkdir -p "${TARGET_RELEASE}"
mkdir -p "${BACKUPS_DIR}"

# 2. Build Frontend SPA if running on builder or deploy runner
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
  log_info "Building frontend React SPA assets..."
  npm --prefix frontend ci --prefer-offline || npm --prefix frontend install
  npm --prefix frontend run build
fi

# 3. Assemble Release Files
log_info "Copying release files into ${TARGET_RELEASE}..."
mkdir -p "${TARGET_RELEASE}/frontend"
cp -r frontend/dist "${TARGET_RELEASE}/frontend/dist"
cp -r api "${TARGET_RELEASE}/api"
cp -r sql "${TARGET_RELEASE}/sql"

# 4. Link Shared Secrets and Persistent Storage (Section 8.3 & DEP-6, DEP-7)
log_info "Linking shared .env and persistent private storage folders..."
ln -sfn "${SHARED_DIR}/.env" "${TARGET_RELEASE}/.env"
ln -sfn "${SHARED_DIR}/storage" "${TARGET_RELEASE}/storage"

# Set release file permissions
chmod -R 755 "${TARGET_RELEASE}"
chown -R deploy:www-data "${TARGET_RELEASE}" || true

# 5. Pre-Release Automated Database Backup (Section 8.7 & 8.9)
log_info "Creating pre-deployment database backup..."
DB_NAME=$(grep -E '^DB_DATABASE=' "${SHARED_DIR}/.env" | cut -d '=' -f 2 | tr -d '"' | tr -d "'" || echo "caravan_accounting")
DB_USER=$(grep -E '^DB_USERNAME=' "${SHARED_DIR}/.env" | cut -d '=' -f 2 | tr -d '"' | tr -d "'" || echo "caravan_user")
DB_PASS=$(grep -E '^DB_PASSWORD=' "${SHARED_DIR}/.env" | cut -d '=' -f 2 | tr -d '"' | tr -d "'")

BACKUP_FILE="${BACKUPS_DIR}/db_pre_${TIMESTAMP}.sql.gz"
if command -v mysqldump &> /dev/null && [ -n "${DB_PASS}" ]; then
  mysqldump -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 "${DB_NAME}" | gzip > "${BACKUP_FILE}"
  log_success "Database snapshot saved to ${BACKUP_FILE}"
fi

# 6. Apply Database Migrations (Section 8.7)
log_info "Checking and applying forward-only database migrations..."
if [ -f "${TARGET_RELEASE}/sql/schema.sql" ]; then
  mariadb -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 "${DB_NAME}" < "${TARGET_RELEASE}/sql/schema.sql" || true
fi

# 7. Atomically Switch Current Symlink (Section 8.6 DEP-5)
log_info "Switching ${CURRENT_LINK} symlink atomically to release ${TIMESTAMP}..."
ln -sfn "${TARGET_RELEASE}" "${CURRENT_LINK}"

# 8. Reload PHP-FPM Service (Clears OPcache)
log_info "Reloading PHP-FPM to load new OPcache..."
PHP_FPM_SVC=$(systemctl list-units --type=service --state=running | grep -oE 'php[0-9.]+-fpm' | head -1 || echo "php8.3-fpm")
if command -v systemctl &> /dev/null; then
  sudo systemctl reload "${PHP_FPM_SVC}" || true
fi

# 9. Verify Post-Deploy Health Check (DEP-9)
log_info "Verifying application health check endpoint..."
HEALTH_CHECK_URL="http://127.0.0.1/api/v1/health"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_CHECK_URL}" || echo "000")

if [ "${HTTP_STATUS}" -eq 200 ]; then
  log_success "Health check passed (HTTP 200 OK)."
else
  log_warn "Health check endpoint returned status ${HTTP_STATUS}. Please inspect logs."
fi

# 10. Clean Up Old Releases (Keep 5 most recent, delete older - Section 8.6)
log_info "Pruning old releases (keeping latest 5)..."
cd "${RELEASES_DIR}"
ls -dt */ | tail -n +6 | xargs -r rm -rf

log_success "Deployment of release ${TIMESTAMP} completed successfully!"
echo "Current release pointer: $(readlink "${CURRENT_LINK}")"
