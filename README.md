<div align="center">

# 🏢 Caravan ERP

### Income & Expense Management System

[![PHP](https://img.shields.io/badge/PHP-8.2-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://php.net)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://mysql.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

A modern, full-stack accounting system for small businesses to manage income, expenses, and financial reporting with bill attachments and role-based access control.

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [API Docs](#-api-documentation) • [Deployment](#-deployment)

</div>

---

## ✨ Features

| Category | Features |
|---|---|
| 💰 **Financial Management** | Income & expense tracking, category-based organization, payment mode support (Cash, Bank, UPI, Cheque, Card) |
| 📊 **Dashboard & Analytics** | Real-time summary cards, income vs expense charts, category-wise breakdown, period selectors |
| 📋 **Ledger & Reports** | Running balance ledger, monthly/yearly reports, custom date ranges, CSV & PDF export |
| 📎 **Bill Management** | Secure bill upload (JPG, PNG, PDF), private storage with authenticated access, thumbnail previews |
| 🔐 **Security** | Role-based access control (Admin/Viewer), bcrypt password hashing, CSRF protection, input sanitization |
| 👥 **User Management** | Multi-user support, role assignment, account activation/deactivation |
| 📝 **Audit Trail** | Complete audit log of all CRUD operations with before/after snapshots |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)             │
│         Static Assets + API Routing (/api/v1)        │
├──────────────────────┬──────────────────────────────┤
│    React SPA (Vite)  │      PHP 8.2 REST API        │
│  ┌────────────────┐  │  ┌────────────────────────┐  │
│  │ Dashboard      │  │  │ Authentication         │  │
│  │ Transactions   │  │  │ Transaction Controller │  │
│  │ Ledger         │  │  │ Category Controller    │  │
│  │ Reports        │  │  │ Report Service         │  │
│  │ User Mgmt      │  │  │ Audit Middleware       │  │
│  └────────────────┘  │  └────────────┬───────────┘  │
│                      │               │              │
│                      │    ┌──────────▼───────────┐  │
│                      │    │   MySQL / MariaDB    │  │
│                      │    │   (DECIMAL 12,2)     │  │
│                      │    └──────────────────────┘  │
└──────────────────────┴──────────────────────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TanStack Query, Lucide Icons, Bootstrap 5 |
| **Backend** | PHP 8.2, Custom MVC Framework, PDO (Prepared Statements) |
| **Database** | MySQL 8.0 / MariaDB 10.6+ |
| **Server** | Nginx, PHP-FPM |
| **DevOps** | Docker, Docker Compose, Shell Scripts |
| **Security** | Bcrypt, CSRF Tokens, RBAC, OWASP-aligned |

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/cibinpr/caravan-erp.git
cd caravan-erp

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# API:      http://localhost:8080/api/v1
```

### Manual Setup

```bash
# Clone the repository
git clone https://github.com/cibinpr/caravan-erp.git
cd caravan-erp

# Backend setup
cd api
composer install  # if using composer
cp .env.example .env
# Edit .env with your database credentials

# Frontend setup
cd ../frontend
npm install
cp .env.example .env
npm run dev

# Database setup
mysql -u root -p < sql/schema.sql
mysql -u root -p caravan_erp < sql/seed.sql
```

## 📚 API Documentation

### Base URL: `/api/v1`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/login` | User login | ❌ |
| `POST` | `/auth/logout` | User logout | ✅ |
| `GET` | `/dashboard/summary` | Dashboard metrics | ✅ |
| `GET` | `/transactions` | List transactions (paginated) | ✅ |
| `POST` | `/transactions` | Create transaction | 🔒 Admin |
| `PUT` | `/transactions/:id` | Update transaction | 🔒 Admin |
| `DELETE` | `/transactions/:id` | Delete transaction | 🔒 Admin |
| `GET` | `/categories` | List categories | ✅ |
| `POST` | `/categories` | Create category | 🔒 Admin |
| `GET` | `/ledger` | View ledger with running balance | ✅ |
| `GET` | `/reports/monthly` | Monthly report | ✅ |
| `GET` | `/reports/export` | Export to CSV/PDF | ✅ |
| `GET` | `/audit-log` | View audit trail | 🔒 Admin |

### Response Format

```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 25,
    "total": 150
  },
  "error": null
}
```

## 🐳 Docker

```bash
# Build images
docker-compose build

# Run in production mode
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📁 Project Structure

```
caravan-erp/
├── api/                    # PHP REST API
│   ├── app/
│   │   ├── Controllers/    # Request handlers
│   │   ├── Core/           # Framework core
│   │   ├── Middleware/      # Auth, CORS, CSRF
│   │   └── Services/       # Business logic
│   ├── config/             # Database & app config
│   ├── routes/             # API route definitions
│   └── public/             # Entry point (index.php)
├── frontend/               # React SPA
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API client layer
│   │   └── hooks/          # Custom React hooks
│   └── dist/               # Production build
├── sql/                    # Database migrations
│   ├── schema.sql
│   └── seed.sql
├── deployment/             # Server setup & scripts
├── docker/                 # Docker configuration
│   ├── Dockerfile.api
│   └── Dockerfile.frontend
├── docker-compose.yml
└── README.md
```

## 🔒 Security Features

- **Authentication:** Session-based with bcrypt password hashing
- **Authorization:** Role-based access control (Admin / Viewer)
- **Input Validation:** Server-side validation on all endpoints
- **SQL Injection:** PDO prepared statements throughout
- **XSS Protection:** React auto-escaping + server-side sanitization
- **CSRF Protection:** Token-based CSRF protection
- **File Security:** Bills stored outside web root with authenticated access
- **Error Handling:** No stack traces or sensitive data in production responses

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/cibinpr">Cibin</a></sub>
</div>
