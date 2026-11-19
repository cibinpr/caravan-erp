# Software Requirements Specification
## Project: Caravan Accounting: Income & Expense Management System (rebuild)
**Version:** 1.0 (Draft for approval)  
**Date:** 16 November 2026  
**Stack:** React.js (frontend), PHP 8 REST API (backend), MySQL/MariaDB (database)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for rebuilding the existing "Caravan Accounting ERP" (a PHP page-per-script income and expense tracker) as a modern, secure application with a React.js frontend and a PHP + MySQL backend exposed as a REST API. It is the reference for design, development, testing and acceptance.

### 1.2 Scope
The system lets a small business record income and expenses with attached bills, manage categories, view a dashboard with totals and charts, browse a ledger, generate period reports and export them. It replaces the current application, fixes its known defects (see Section 2.4) and migrates its existing data.

**Out of scope for version 1.0:** GST/tax filing, vendor and customer management, multi-currency, bank reconciliation, budgets, recurring entries, mobile native apps.

### 1.3 Definitions and Abbreviations
| Term | Meaning |
|---|---|
| SRS | Software Requirements Specification |
| SPA | Single-page application (the React frontend) |
| API | Application Programming Interface (REST, JSON) |
| CRUD | Create, Read, Update, Delete |
| CSRF | Cross-site request forgery |
| XSS | Cross-site scripting |
| RBAC | Role-based access control |
| Bill | An uploaded receipt or proof (JPG, PNG or PDF) attached to a transaction |
| Transaction | An income or expense entry |

### 1.4 References
- Existing application source (`incexp_digit.zip`) and its database schema (`database.sql`)
- Approved build plan (previous conversation)
- OWASP Top 10 and OWASP ASVS (security baseline)
- WCAG 2.1 Level AA (accessibility and readability baseline)

---

## 2. Overall Description

### 2.1 Product Perspective
The current system is a monolithic PHP application with server-rendered pages. The new system separates concerns:
- **Frontend:** React.js SPA built with Vite, served as static files.
- **Backend:** PHP 8 REST API (no heavy framework), using PDO prepared statements, session or token authentication, and JSON responses.
- **Database:** MySQL/MariaDB.
- **File storage:** bills stored outside the public web root and served only through an authenticated API endpoint.
- **Deployment:** Self-managed Ubuntu VPS (Nginx, PHP-FPM 8 and MariaDB). Nginx serves the built React files as static assets and exposes the API under the `/api` path of the same domain.

### 2.2 Product Functions (Summary)
- Authentication and user management
- Income and expense recording with bill upload
- Category management
- Searchable, filterable, paginated transaction lists
- Dashboard with totals, profit/loss and charts
- Ledger with running balance
- Reports by month, year or custom range, with CSV and PDF export
- Audit log of changes
- One-time migration of data from the old system

### 2.3 User Classes and Characteristics
| User class | Description | Permissions |
|---|---|---|
| **Admin** | Business owner or accountant | Full access: transactions, categories, reports, users, audit log |
| **Viewer** | Read-only staff or auditor | View dashboard, lists, ledger and reports; no create, edit or delete |

Users are assumed to be non-technical, to use desktop or mobile browsers, and to work mainly in English with the Indian Rupee (₹).

### 2.4 Known Defects in the Existing System (to be eliminated)
| # | Defect in current system | Required resolution |
|---|---|---|
| **D1** | Delete scripts have no login check and use GET links | All endpoints require authentication; deletes use authenticated DELETE/POST with CSRF protection |
| **D2** | Credentials hard-coded in source; users table unused | Credentials in environment file outside web root; login via hashed passwords in users |
| **D3** | error_log and display_errors exposed inside the web root | Errors logged outside web root; display off in production |
| **D4** | Bills publicly guessable (timestamp filenames) | Random filenames, stored outside web root, served only to logged-in users |
| **D5** | Output not escaped (XSS risk) | React escapes by default; API validates and sanitizes input |
| **D6** | income_edit.php calls undefined functions and crashes | Single shared, tested create/edit logic for both transaction types |
| **D7** | "Edit Income" navigation link has no record ID | Navigation goes to the list; editing opens a specific record |
| **D8** | Hard-coded category list in income edit | All category lists read from the database |
| **D9** | Categories stored as free text | Transactions reference categories by ID |
| **D10** | No filters, pagination, sorting, running balance or period selection | Provided (see Section 3) |

### 2.5 Operating Environment
- **Client:** Latest two versions of Chrome, Edge, Firefox, Safari; Android and iOS mobile browsers; screen widths from 360 px upward.
- **Server:** Ubuntu 22.04 or 24.04 LTS VPS with Nginx, PHP-FPM 8.1+, MySQL 5.7+ / MariaDB 10.6+, HTTPS enabled.
- **Build tooling:** Node.js LTS, Vite, npm.

### 2.6 Design and Implementation Constraints
- Frontend must be React.js (function components and hooks).
- Backend must remain PHP and MySQL deployed on a self-managed VPS.
- No server-side Node.js process required in production.
- All money values use fixed-precision decimals (`DECIMAL(12,2)`).
- Timezone: Asia/Kolkata; date display format DD-MM-YYYY, storage ISO 8601.

### 2.7 Assumptions and Dependencies
- VPS provides sudo access, PHP 8.1+ with PDO MySQL, fileinfo, mbstring, and upload size >= 5 MB.
- Existing income and expense tables and ~540 bill files can be provided for migration.
- Chart and PDF libraries are open-source and bundled at build time.

---

## 3. Functional Requirements
*(Priority: M = Must have, S = Should have, C = Could have)*

### 3.1 Authentication and Session Management
| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-1 | The system shall authenticate users with email and password. | M |
| FR-AUTH-2 | Passwords shall be stored using password_hash (bcrypt or Argon2) and verified with password_verify. | M |
| FR-AUTH-3 | The session identifier shall be regenerated on login; cookies shall be HttpOnly, Secure and SameSite=Lax or stricter. | M |
| FR-AUTH-4 | Every API endpoint except login shall reject unauthenticated requests with HTTP 401. | M |
| FR-AUTH-5 | The system shall lock login attempts for 15 minutes after 5 consecutive failures from the same account or IP. | S |
| FR-AUTH-6 | Users shall be able to log out, which invalidates the session server-side. | M |
| FR-AUTH-7 | Sessions shall expire after 30 minutes of inactivity; the frontend shall redirect to login with a clear message. | S |
| FR-AUTH-8 | Users shall be able to change their own password. | S |

### 3.2 User Management (Admin only)
| ID | Requirement | Priority |
|---|---|---|
| FR-USR-1 | Admins shall create, edit, deactivate and delete users (name, email, role). | M |
| FR-USR-2 | Admins shall reset a user's password. | M |
| FR-USR-3 | The system shall prevent deactivating or demoting the last remaining admin. | M |
| FR-USR-4 | Email addresses shall be unique. | M |

### 3.3 Authorization (RBAC)
| ID | Requirement | Priority |
|---|---|---|
| FR-RBAC-1 | The API shall enforce roles on every request, not only in the UI. | M |
| FR-RBAC-2 | Viewers shall have read-only access; write requests shall return HTTP 403. | M |
| FR-RBAC-3 | The frontend shall hide or disable actions the current role cannot perform. | M |

### 3.4 Category Management
| ID | Requirement | Priority |
|---|---|---|
| FR-CAT-1 | Admins shall add categories with a name and type (income or expense). | M |
| FR-CAT-2 | Admins shall rename categories; the new name applies to all existing transactions automatically. | M |
| FR-CAT-3 | Admins shall deactivate a category; inactive categories do not appear in entry forms but remain on historical records. | M |
| FR-CAT-4 | A category in use shall not be hard-deleted. | M |
| FR-CAT-5 | Names shall be unique within a type. | M |
| FR-CAT-6 | The entry form shall allow creating a new category inline (replacing the old "Other" free-text option). | S |

### 3.5 Transactions (Income and Expense)
| ID | Requirement | Priority |
|---|---|---|
| FR-TXN-1 | Admins shall create income and expense transactions with: type, category, amount (> 0, 2 decimals), payment mode (Cash, Bank, UPI, Cheque, Card), description, date, and optional bill. | M |
| FR-TXN-2 | Description shall be optional for income and required for expense; configurable in one place. | S |
| FR-TXN-3 | Admins shall edit any field of a transaction, including replacing or removing the bill. | M |
| FR-TXN-4 | Admins shall delete a transaction after a confirmation dialog; attached bill removed from storage. | M |
| FR-TXN-5 | Future-dated entries shall show a warning but be allowed. | C |
| FR-TXN-6 | System shall record who created and last modified each transaction and when. | M |
| FR-TXN-7 | Income and expense share one form component and one validation module. | M |

### 3.6 Bill / Attachment Handling
| ID | Requirement | Priority |
|---|---|---|
| FR-BILL-1 | Allowed types: JPG, PNG, PDF. Validation checks MIME type from file content, not only extension. | M |
| FR-BILL-2 | Maximum file size: 5 MB (configurable). | M |
| FR-BILL-3 | Files stored outside public web root with random, unguessable filenames. | M |
| FR-BILL-4 | Files delivered only through an authenticated API endpoint. | M |
| FR-BILL-5 | UI shows thumbnail or PDF icon, with a "View" action opening the file in viewer or new tab. | M |
| FR-BILL-6 | Image uploads optionally compressed/resized client-side before upload. | C |

### 3.7 Transaction Lists
| ID | Requirement | Priority |
|---|---|---|
| FR-LST-1 | Separate Income and Expense list views, plus "All transactions" view. | M |
| FR-LST-2 | Server-side pagination (default 25 per page; options 10, 25, 50, 100). | M |
| FR-LST-3 | Filters: date range, category, payment mode, amount range, has-bill. | M |
| FR-LST-4 | Free-text search across description and category. | M |
| FR-LST-5 | Sorting by date, amount and category. | M |
| FR-LST-6 | Filter and page state kept in URL for bookmarking and refresh survival. | S |
| FR-LST-7 | Totals for filtered result set displayed above the table. | M |

### 3.8 Dashboard
| ID | Requirement | Priority |
|---|---|---|
| FR-DSH-1 | Summary cards: today's income/expense, this month's income/expense, all-time income/expense. | M |
| FR-DSH-2 | Net profit/loss for the selected period, coloured and labelled (not by colour alone). | M |
| FR-DSH-3 | Period selector (Today, This week, This month, This year, Custom) controlling cards and charts. | M |
| FR-DSH-4 | Chart: income vs expense by month for selected year (grouped bar or line). | M |
| FR-DSH-5 | Chart: expense breakdown by category for selected period (donut or horizontal bar). | M |
| FR-DSH-6 | "Recent transactions" list of latest 10 entries across both types, sorted by date then time. | M |
| FR-DSH-7 | Each card and chart supports loading, empty and error states. | M |
| FR-DSH-8 | Clicking card/chart segment opens matching filtered list. | C |

### 3.9 Ledger
| ID | Requirement | Priority |
|---|---|---|
| FR-LED-1 | All transactions in date order: date, type, category, description, debit (expense), credit (income), running balance. | M |
| FR-LED-2 | Support date-range, category, mode filters and pagination. | M |
| FR-LED-3 | Opening balance, total credits, total debits, closing balance for selected range. | M |
| FR-LED-4 | Export filtered ledger to CSV and PDF. | S |

### 3.10 Reports
| ID | Requirement | Priority |
|---|---|---|
| FR-RPT-1 | Monthly report with selectable month and year. | M |
| FR-RPT-2 | Custom date-range report. | M |
| FR-RPT-3 | Category-wise summary for income and expense with totals and percentage share. | M |
| FR-RPT-4 | Month-by-month summary for a selected year. | S |
| FR-RPT-5 | Export every report to CSV and PDF; PDF includes company name, period, generation date, page numbers. | M |
| FR-RPT-6 | Print-friendly layout. | C |

### 3.11 Audit Log (Admin only)
| ID | Requirement | Priority |
|---|---|---|
| FR-AUD-1 | Log create, update, delete, login, failed login, role change, password reset with user, timestamp, entity, before/after summary. | M |
| FR-AUD-2 | View and filter audit log by user, action, date. Read-only in UI. | S |

### 3.12 Data Migration
| ID | Requirement | Priority |
|---|---|---|
| FR-MIG-1 | One-time script importing all rows from old income and expense tables into transactions. | M |
| FR-MIG-2 | Free-text categories mapped to category records, creating any that do not exist. | M |
| FR-MIG-3 | Existing bill files copied to private storage under new random names, reference updated. | M |
| FR-MIG-4 | Missing or zero-byte bills reported, not causing failure. | M |
| FR-MIG-5 | Script re-runnable safely (no duplicates) with reconciliation report (row counts, totals). | M |
| FR-MIG-6 | Legacy admin account replaced by proper user created at setup. | M |

---

## 4. UI & Architecture Requirements
- Responsive layout: collapsible sidebar (desktop), bottom/hamburger nav (mobile), stacked cards below 768 px.
- Design system: Bootstrap 5 (or modern equivalent), light & dark modes.
- Visual hierarchy: WCAG 2.1 AA (contrast >= 4.5:1), base text >= 16px, summary numbers >= 24px bold.
- Number formatting: Indian style (`₹ 1,25,000.00`).
- Dashboard widgets load independently with skeletons and retry buttons.
- REST API Base: `/api/v1` with JSON envelope `{ "data": ..., "meta": {...}, "error": null }`.

---

## 5. Delivery Plan
1. **Phase 1: Foundation:** DB schema, API skeleton, authentication, React app shell and theme.
2. **Phase 2: Core:** Categories, transactions, bills, lists with filters and pagination.
3. **Phase 3: Insight:** Dashboard, charts, ledger, reports and exports.
4. **Phase 4: Administration:** Users, audit log, role enforcement.
5. **Phase 5: Migration and hardening:** Migration script, tests, security review, performance check.
6. **Phase 6: Release:** Pipeline setup, VPS provisioning, staging and production deployment.
