#!/usr/bin/env bash
# ==============================================================================
# Caravan Accounting - Deployment Acceptance Verification (SRS Section 8.12)
# Usage: ./verify.sh [TARGET_URL]
# Example: ./verify.sh https://accounts.example.com
# ==============================================================================

set -uo pipefail

TARGET_URL="${1:-http://127.0.0.1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass_count=0
fail_count=0

test_check() {
  local desc="$1"
  local expected="$2"
  local actual="$3"

  if [ "${actual}" == "${expected}" ]; then
    echo -e "  [${GREEN}PASS${NC}] ${desc}"
    ((pass_count++))
  else
    echo -e "  [${RED}FAIL${NC}] ${desc} (Expected: ${expected}, Got: ${actual})"
    ((fail_count++))
  fi
}

echo "=============================================================================="
echo -e "${BLUE}Running Deployment Acceptance Verification on: ${TARGET_URL}${NC}"
echo "=============================================================================="

# 1. Health Endpoint Test (DEP-9)
HEALTH_JSON=$(curl -s -k "${TARGET_URL}/api/v1/health" || echo "")
HEALTH_STATUS=$(echo "${HEALTH_JSON}" | grep -o '"status":"healthy"' || echo "")
test_check "Health Check (/api/v1/health returns healthy)" '"status":"healthy"' "${HEALTH_STATUS}"

# 2. Block .env File (NFR-SEC-6, Section 8.5)
ENV_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -k "${TARGET_URL}/.env" || echo "000")
if [ "${ENV_HTTP}" -eq 403 ] || [ "${ENV_HTTP}" -eq 404 ]; then
  test_check "Block direct web access to .env" "BLOCKED" "BLOCKED"
else
  test_check "Block direct web access to .env" "403 or 404" "${ENV_HTTP}"
fi

# 3. Block storage/ Directory Access (NFR-SEC-8)
STORAGE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -k "${TARGET_URL}/storage/bills/" || echo "000")
if [ "${STORAGE_HTTP}" -eq 403 ] || [ "${STORAGE_HTTP}" -eq 404 ]; then
  test_check "Block direct web access to /storage/" "BLOCKED" "BLOCKED"
else
  test_check "Block direct web access to /storage/" "403 or 404" "${STORAGE_HTTP}"
fi

# 4. Block SQL Files
SQL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -k "${TARGET_URL}/schema.sql" || echo "000")
if [ "${SQL_HTTP}" -eq 403 ] || [ "${SQL_HTTP}" -eq 404 ]; then
  test_check "Block direct web access to .sql files" "BLOCKED" "BLOCKED"
else
  test_check "Block direct web access to .sql files" "403 or 404" "${SQL_HTTP}"
fi

# 5. Security Headers Check (NFR-SEC-5)
HEADERS=$(curl -s -I -k "${TARGET_URL}/" || echo "")

HAS_NOSNIFF=$(echo "${HEADERS}" | grep -qi "X-Content-Type-Options: nosniff" && echo "YES" || echo "NO")
test_check "Security Header: X-Content-Type-Options: nosniff" "YES" "${HAS_NOSNIFF}"

HAS_DENY=$(echo "${HEADERS}" | grep -qi "X-Frame-Options: DENY" && echo "YES" || echo "NO")
test_check "Security Header: X-Frame-Options: DENY" "YES" "${HAS_DENY}"

# 6. React SPA HTML Entrypoint
SPA_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -k "${TARGET_URL}/transactions" || echo "000")
test_check "React SPA Route Fallback (/transactions returns 200)" "200" "${SPA_HTTP}"

echo "=============================================================================="
if [ "${fail_count}" -eq 0 ]; then
  echo -e "${GREEN}All ${pass_count} verification checks PASSED successfully!${NC}"
  exit 0
else
  echo -e "${RED}${fail_count} checks FAILED out of $((pass_count + fail_count)).${NC}"
  exit 1
fi
