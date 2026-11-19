#!/usr/bin/env bash
# ==============================================================================
# Caravan Accounting - Instant Rollback Script (SRS Section 8.7)
# Target: Completes in under 5 minutes
# Usage: ./rollback.sh
# ==============================================================================

set -euo pipefail

APP_ROOT="/var/www/caravan"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_LINK="${APP_ROOT}/current"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "Initiating Emergency Rollback..."

if [ ! -L "${CURRENT_LINK}" ]; then
  log_error "Current symlink ${CURRENT_LINK} does not exist or is not a symlink."
  exit 1
fi

CURRENT_TARGET=$(readlink -f "${CURRENT_LINK}")
log_info "Active release before rollback: ${CURRENT_TARGET}"

# Find previous release folder
cd "${RELEASES_DIR}"
PREVIOUS_RELEASE=$(ls -dt */ | sed 's#/##' | grep -v "$(basename "${CURRENT_TARGET}")" | head -n 1 || true)

if [ -z "${PREVIOUS_RELEASE}" ]; then
  log_error "No previous release found in ${RELEASES_DIR} to roll back to!"
  exit 1
fi

PREVIOUS_TARGET="${RELEASES_DIR}/${PREVIOUS_RELEASE}"
log_info "Rolling back to previous release: ${PREVIOUS_TARGET}"

# 1. Switch Symlink Atomically (DEP-5)
ln -sfn "${PREVIOUS_TARGET}" "${CURRENT_LINK}"

# 2. Reload PHP-FPM
PHP_FPM_SVC=$(systemctl list-units --type=service --state=running | grep -oE 'php[0-9.]+-fpm' | head -1 || echo "php8.3-fpm")
if command -v systemctl &> /dev/null; then
  sudo systemctl reload "${PHP_FPM_SVC}" || true
fi

# 3. Verify Health Check
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/api/v1/health" || echo "000")

log_success "Rollback completed!"
echo "Active release is now: $(readlink "${CURRENT_LINK}")"
echo "Health check status: ${HEALTH_STATUS}"

# Log Incident Notice (Section 8.7)
INCIDENT_LOG="${APP_ROOT}/shared/storage/logs/rollback_incident.log"
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Rollback executed from ${CURRENT_TARGET} to ${PREVIOUS_TARGET}. Health: ${HEALTH_STATUS}" >> "${INCIDENT_LOG}"
log_info "Incident noted in ${INCIDENT_LOG}"
