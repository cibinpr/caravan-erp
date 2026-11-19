#!/usr/bin/env bash
# ==============================================================================
# Caravan Accounting - One-Time Ubuntu VPS Setup Script
# Target OS: Ubuntu 22.04 / 24.04 / 26.04 LTS
# Usage: sudo bash setup_server.sh
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

if [ "$EUID" -ne 0 ]; then
  log_error "Please run as root: sudo bash setup_server.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

log_info "Starting Caravan Accounting VPS Provisioning..."

# ── 1. Update & base packages ──────────────────────────────────────────────────
log_info "1. Updating system packages..."
apt-get update -y
apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
apt-get install -y curl wget git unzip ufw fail2ban logrotate ca-certificates \
  software-properties-common apt-transport-https gnupg lsb-release

# ── 2. Firewall ────────────────────────────────────────────────────────────────
log_info "2. Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
log_success "Firewall enabled (22, 80, 443)."

# ── 3. Nginx + MariaDB ─────────────────────────────────────────────────────────
log_info "3. Installing Nginx and MariaDB..."
apt-get install -y nginx mariadb-server certbot python3-certbot-nginx
systemctl enable nginx mariadb
systemctl start  nginx mariadb
log_success "Nginx and MariaDB installed and running."

# ── 4. PHP — detect best available version ────────────────────────────────────
log_info "4. Installing PHP-FPM..."

# Ubuntu 26.04 (resolute) ships PHP 8.5 natively — no PPA needed.
# For older Ubuntu (22.04 / 24.04) try sury.org if needed.
detect_php_ver() {
  for v in 8.5 8.4 8.3 8.2 8.1; do
    if apt-cache show "php${v}-fpm" &>/dev/null 2>&1; then
      echo "$v"; return 0
    fi
  done
  # Fallback: generic php-fpm
  if apt-cache show php-fpm &>/dev/null 2>&1; then
    echo ""; return 0
  fi
  echo "NONE"
}

PHP_VER=$(detect_php_ver)

if [ "$PHP_VER" = "NONE" ]; then
  log_info "PHP not in default repos — adding sury.org repository..."
  curl -sSLo /tmp/php.gpg https://packages.sury.org/php/apt.gpg
  install -D -o root -g root -m 644 /tmp/php.gpg /etc/apt/keyrings/sury-php.gpg
  echo "deb [signed-by=/etc/apt/keyrings/sury-php.gpg] https://packages.sury.org/php/ $(lsb_release -sc) main" \
    > /etc/apt/sources.list.d/sury-php.list
  apt-get update -y
  PHP_VER=$(detect_php_ver)
fi

if [ -n "$PHP_VER" ]; then
  PKG_PREFIX="php${PHP_VER}-"
  log_info "Using PHP ${PHP_VER}"
  apt-get install -y \
    "php${PHP_VER}-fpm" \
    "php${PHP_VER}-cli" \
    "php${PHP_VER}-mysql" \
    "php${PHP_VER}-mbstring" \
    "php${PHP_VER}-xml" \
    "php${PHP_VER}-curl" \
    "php${PHP_VER}-zip" \
    "php${PHP_VER}-opcache" \
    "php${PHP_VER}-fileinfo" || \
  apt-get install -y \
    "php${PHP_VER}-fpm" \
    "php${PHP_VER}-cli" \
    "php${PHP_VER}-mysql" \
    "php${PHP_VER}-mbstring" \
    "php${PHP_VER}-xml" \
    "php${PHP_VER}-curl" \
    "php${PHP_VER}-zip" \
    "php${PHP_VER}-opcache"
  FPM_SERVICE="php${PHP_VER}-fpm"
else
  log_warn "No versioned PHP found — installing generic php-fpm"
  apt-get install -y php-fpm php-cli php-mysql php-mbstring php-xml php-curl php-zip php-opcache
  FPM_SERVICE="php-fpm"
  PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
fi

systemctl enable "$FPM_SERVICE"
systemctl start  "$FPM_SERVICE"
log_success "PHP ${PHP_VER} FPM installed and running."

# ── 5. Node.js (for frontend build) ───────────────────────────────────────────
log_info "5. Installing Node.js..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
log_success "Node.js $(node -v) installed."

# ── 6. Deploy user ─────────────────────────────────────────────────────────────
log_info "6. Creating deploy user..."
if ! id -u deploy &>/dev/null; then
  useradd -m -s /bin/bash deploy
  usermod -aG www-data deploy
  log_success "User 'deploy' created."
else
  log_warn "User 'deploy' already exists — skipping."
fi

# ── 7. App directory structure ─────────────────────────────────────────────────
log_info "7. Setting up app directory structure..."
APP_ROOT="/var/www/caravan-accounting"
mkdir -p "${APP_ROOT}/releases" "${APP_ROOT}/shared/storage/bills" \
         "${APP_ROOT}/shared/storage/logs" "${APP_ROOT}/shared/backups"
chown -R deploy:www-data "${APP_ROOT}"
chmod -R 775 "${APP_ROOT}/shared/storage"
log_success "Directory structure created at ${APP_ROOT}."

# ── 8. MariaDB — create DB and user ───────────────────────────────────────────
log_info "8. Setting up MariaDB database..."
DB_NAME="caravan_accounting"
DB_USER="caravan_user"
DB_PASS="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)"
ROOT_PASS="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)"

# Secure MariaDB and create app database
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${ROOT_PASS}';" 2>/dev/null || true
mysql -u root -p"${ROOT_PASS}" -e "
  CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
  GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
  DELETE FROM mysql.user WHERE User='';
  DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost','127.0.0.1','::1');
  DROP DATABASE IF EXISTS test;
  FLUSH PRIVILEGES;
" 2>/dev/null || mysql -e "
  CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
  GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
  DELETE FROM mysql.user WHERE User='';
  DROP DATABASE IF EXISTS test;
  FLUSH PRIVILEGES;
"
log_success "Database '${DB_NAME}' and user '${DB_USER}' created."

# ── 9. Write .env file ─────────────────────────────────────────────────────────
log_info "9. Writing shared .env file..."
PUBLIC_IP=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')
APP_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

cat > "${APP_ROOT}/shared/.env" <<EOF
# Caravan Accounting — Production Environment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# DO NOT commit this file to version control.

APP_ENV=production
APP_DEBUG=false
APP_URL=http://${PUBLIC_IP}
APP_SECRET=${APP_SECRET}

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_CHARSET=utf8mb4

SESSION_NAME=caravan_session
SESSION_SECRET=${SESSION_SECRET}
SESSION_LIFETIME=1800
SESSION_SECURE=false
SESSION_SAMESITE=Lax

STORAGE_PATH=${APP_ROOT}/shared/storage
LOG_PATH=${APP_ROOT}/shared/storage/logs
LOG_LEVEL=warning

UPLOAD_MAX_SIZE_MB=10
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,application/pdf
EOF

chmod 640 "${APP_ROOT}/shared/.env"
chown deploy:www-data "${APP_ROOT}/shared/.env"
log_success ".env written to ${APP_ROOT}/shared/.env"

# ── 10. PHP hardening ini ──────────────────────────────────────────────────────
log_info "10. Applying PHP production settings..."
PHP_CONF_DIR="/etc/php/${PHP_VER}/fpm/conf.d"
mkdir -p "$PHP_CONF_DIR"
cat > "${PHP_CONF_DIR}/99-caravan-security.ini" <<'PHPINI'
expose_php = Off
display_errors = Off
log_errors = On
error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
max_execution_time = 60
max_input_time = 60
memory_limit = 256M
post_max_size = 12M
upload_max_filesize = 10M
max_file_uploads = 5
allow_url_fopen = Off
allow_url_include = Off
session.cookie_httponly = 1
session.use_strict_mode = 1
session.cookie_samesite = Lax
opcache.enable = 1
opcache.memory_consumption = 128
opcache.interned_strings_buffer = 8
opcache.max_accelerated_files = 4000
opcache.validate_timestamps = 0
opcache.revalidate_freq = 0
PHPINI
systemctl reload "$FPM_SERVICE" || true
log_success "PHP hardening applied."

# ── 11. Nginx config ───────────────────────────────────────────────────────────
log_info "11. Writing Nginx site config..."
# Determine PHP-FPM socket path
FPM_SOCK="/run/php/php${PHP_VER}-fpm.sock"
[ -S "$FPM_SOCK" ] || FPM_SOCK="/run/php/php-fpm.sock"

cat > /etc/nginx/sites-available/caravan-accounting <<NGINXCONF
server {
    listen 80;
    listen [::]:80;
    server_name ${PUBLIC_IP} _;

    root ${APP_ROOT}/current/frontend/dist;
    index index.html;

    # Security headers
    add_header X-Frame-Options           "SAMEORIGIN"              always;
    add_header X-Content-Type-Options    "nosniff"                 always;
    add_header X-XSS-Protection          "1; mode=block"           always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/m;

    # Block direct access to sensitive files
    location ~* \.(env|sql|log|sh|pem|key|htaccess|htpasswd)$ {
        deny all; return 404;
    }

    # PHP API
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        root ${APP_ROOT}/current;
        fastcgi_pass unix:${FPM_SOCK};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME ${APP_ROOT}/current/api/public/index.php;
        include fastcgi_params;
        fastcgi_param PATH_INFO \$fastcgi_path_info;
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Static assets — long cache
    location ~* \.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|ico|gif|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    client_max_body_size 12M;
    access_log /var/log/nginx/caravan-access.log;
    error_log  /var/log/nginx/caravan-error.log;
}
NGINXCONF

ln -sf /etc/nginx/sites-available/caravan-accounting /etc/nginx/sites-enabled/caravan-accounting
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
log_success "Nginx configured and reloaded."

# ── 12. Store credentials summary ─────────────────────────────────────────────
CREDS_FILE="/root/caravan-credentials.txt"
cat > "$CREDS_FILE" <<EOF
=== Caravan Accounting — Server Credentials ===
Generated: $(date)

MariaDB root password : ${ROOT_PASS}
MariaDB DB name       : ${DB_NAME}
MariaDB user          : ${DB_USER}
MariaDB user password : ${DB_PASS}

App URL               : http://${PUBLIC_IP}
App .env location     : ${APP_ROOT}/shared/.env

Next steps:
  1. Deploy code: cd ${APP_ROOT} && git clone https://github.com/cibinpr/caravan-accounting.git releases/v1 && ln -sfn releases/v1 current
  2. Import schema: mysql -u ${DB_USER} -p'${DB_PASS}' ${DB_NAME} < current/sql/schema.sql
  3. Import seed:   mysql -u ${DB_USER} -p'${DB_PASS}' ${DB_NAME} < current/sql/seed.sql
  4. Build frontend: cd current/frontend && npm ci && npm run build
  5. Create admin:   php current/api/bin/create_admin.php
EOF
chmod 600 "$CREDS_FILE"

log_success "Credentials saved to ${CREDS_FILE} (root-only readable)."

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Caravan Accounting — Server Provisioning COMPLETE   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo -e "  PHP Version  : ${GREEN}${PHP_VER}${NC}"
echo -e "  Nginx        : ${GREEN}running${NC}"
echo -e "  MariaDB      : ${GREEN}running${NC}"
echo -e "  App Root     : ${GREEN}${APP_ROOT}${NC}"
echo -e "  Public IP    : ${GREEN}http://${PUBLIC_IP}${NC}"
echo -e "  Credentials  : ${GREEN}${CREDS_FILE}${NC}"
echo ""
echo -e "${YELLOW}  Run the deploy steps in /root/caravan-credentials.txt${NC}"
