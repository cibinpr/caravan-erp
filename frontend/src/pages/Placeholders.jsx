import React from 'react';
import { ArrowLeftRight, BookOpen, BarChart3, Tags, Users, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TransactionsPage() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem' }}>Transactions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Filterable, paginated Income and Expense records (Phase 2 Core)
          </p>
        </div>
      </div>
      <div style={{ padding: '3rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <ArrowLeftRight size={40} color="var(--brand-primary)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Phase 2: Transactions & Receipts</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto' }}>
          Transaction lists, server-side pagination, bill uploads with preview modal, and unified add/edit forms will be delivered in Phase 2.
        </p>
      </div>
    </div>
  );
}

export function LedgerPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Account Ledger</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Date-ordered ledger with debits, credits, and running balance (Phase 3 Insight)
        </p>
      </div>
      <div style={{ padding: '3rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <BookOpen size={40} color="var(--brand-primary)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Phase 3: Ledger & Running Balance</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto' }}>
          Opening balance, running balance, debit/credit columns, and CSV/PDF ledger export will be delivered in Phase 3.
        </p>
      </div>
    </div>
  );
}

export function ReportsPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Reports & Statements</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Monthly reports, category breakdowns, and PDF/CSV exports (Phase 3 Insight)
        </p>
      </div>
      <div style={{ padding: '3rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <BarChart3 size={40} color="var(--brand-primary)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Phase 3: Reports & Exports</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto' }}>
          Monthly summaries, custom range reports, category percentage shares, and branded PDF generation will be delivered in Phase 3.
        </p>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Category Management</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Income and Expense categories (Admin only - Phase 2 Core)
        </p>
      </div>
      <div style={{ padding: '3rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <Tags size={40} color="var(--brand-primary)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Phase 2: Categories</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto' }}>
          Adding, renaming, and deactivating categories without affecting historical records will be delivered in Phase 2.
        </p>
      </div>
    </div>
  );
}

export function UsersPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>User Management</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Manage user accounts, roles, and password resets (Admin only - Phase 4)
        </p>
      </div>
      <div style={{ padding: '3rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <Users size={40} color="var(--brand-primary)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Phase 4: User Administration & RBAC</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto' }}>
          Creation, deactivation, and password reset of Admin and Viewer user accounts will be delivered in Phase 4.
        </p>
      </div>
    </div>
  );
}

export function AuditLogPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Audit Trail</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Read-only log of logins, modifications, and system events (Admin only - Phase 4)
        </p>
      </div>
      <div style={{ padding: '3rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <ShieldAlert size={40} color="var(--brand-primary)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Phase 4: Audit Log Viewer</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto' }}>
          Filterable audit log with timestamp, user, action, entity, and JSON before/after state diffs will be delivered in Phase 4.
        </p>
      </div>
    </div>
  );
}

export function AccessDeniedPage() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
      <ShieldAlert size={48} color="var(--expense-accent)" style={{ marginBottom: '1rem' }} />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Access Denied</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '1.5rem' }}>
        You do not have the required permissions to view this administration page.
      </p>
      <Link to="/" className="btn btn-primary">
        <ArrowLeft size={16} /> Return to Dashboard
      </Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--brand-primary)', marginBottom: '0.5rem' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '1.5rem' }}>
        The page you requested does not exist or may have been moved.
      </p>
      <Link to="/" className="btn btn-primary">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>
    </div>
  );
}
