import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  RefreshCw,
  AlertCircle,
  Clock,
  User,
  Activity,
  X,
  Code,
} from 'lucide-react';
import { api } from '../api/client';
import { formatDateTime, formatDate } from '../utils/formatters';
import { SkeletonTable } from '../components/Skeleton';

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Details inspection modal
  const [selectedLog, setSelectedLog] = useState(null);

  // Query: Get Audit Log Records (FR-AUD-2)
  const {
    data: auditResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['audit-log', page, perPage, actionFilter, entityFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity', entityFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await api.get(`/audit-log?${params.toString()}`);
      return res;
    },
  });

  const logs = auditResponse?.data || [];
  const meta = auditResponse?.meta || {};
  const pagination = meta.pagination || { page: 1, per_page: 25, total_records: 0, total_pages: 1 };

  const getActionBadgeClass = (action) => {
    if (action.includes('CREATE')) return 'badge-income';
    if (action.includes('DELETE') || action.includes('FAILED') || action.includes('BLOCKED'))
      return 'badge-expense';
    if (action.includes('UPDATE') || action.includes('RESET')) return 'badge-neutral';
    return 'badge-neutral';
  };

  const clearFilters = () => {
    setActionFilter('');
    setEntityFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = Boolean(actionFilter || entityFilter || dateFrom || dateTo);

  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem' }}>Security & Activity Audit Trail</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Read-only chronological record of logins, transactions, and system modifications (FR-AUD-1, FR-AUD-2)
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary text-sm"
          onClick={() => refetch()}
          title="Reload audit records"
        >
          <RefreshCw size={14} />
          <span>Reload</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          backgroundColor: 'var(--bg-surface)',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
        }}
      >
        {/* Action Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Action:</label>
          <select
            className="form-control"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
          >
            <option value="">All Actions</option>
            <option value="LOGIN_SUCCESS">Login Success</option>
            <option value="LOGIN_FAILED">Login Failed</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="CREATE_USER">Create User</option>
            <option value="RESET_PASSWORD">Reset Password</option>
            <option value="TOGGLE_ACTIVE">Toggle Active</option>
          </select>
        </div>

        {/* Entity Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Entity:</label>
          <select
            className="form-control"
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
          >
            <option value="">All Entities</option>
            <option value="TRANSACTION">Transaction</option>
            <option value="CATEGORY">Category</option>
            <option value="USER">User</option>
            <option value="AUTH">Auth / Session</option>
          </select>
        </div>

        {/* Date From */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>From:</label>
          <input
            type="date"
            className="form-control"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
          />
        </div>

        {/* Date To */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>To:</label>
          <input
            type="date"
            className="form-control"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={clearFilters}
            style={{ color: 'var(--expense-accent)' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Audit Table */}
      {isLoading ? (
        <SkeletonTable rows={10} cols={6} />
      ) : isError ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <AlertCircle size={32} color="var(--expense-accent)" style={{ marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Failed to load audit records.</p>
          <button className="btn btn-secondary text-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <ShieldAlert size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
          <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>No audit records found</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {hasFilters ? 'No events match the selected criteria.' : 'Audit events will appear as actions occur.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-responsive table-stacked">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor / User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>IP Address</th>
                  <th className="text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td data-label="Timestamp" style={{ fontSize: '0.8125rem' }}>
                      <div style={{ fontWeight: 600 }}>{formatDateTime(log.created_at)}</div>
                    </td>
                    <td data-label="Actor / User">
                      {log.user_name ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{log.user_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.user_email}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Anonymous / System</span>
                      )}
                    </td>
                    <td data-label="Action">
                      <span className={getActionBadgeClass(log.action)}>{log.action}</span>
                    </td>
                    <td data-label="Entity">
                      <span className="badge-neutral">
                        {log.entity} {log.entity_id ? `#${log.entity_id}` : ''}
                      </span>
                    </td>
                    <td data-label="IP Address" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {log.ip_address || '—'}
                    </td>
                    <td data-label="Details" className="text-right">
                      {log.details ? (
                        <button
                          type="button"
                          className="btn btn-secondary text-sm"
                          onClick={() => setSelectedLog(log)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          title="Inspect JSON state diff"
                        >
                          <Eye size={12} /> Inspect
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderTop: 'none',
              borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            }}
          >
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Showing Page {page} of {pagination.total_pages || 1} ({pagination.total_records} total events)
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                disabled={page >= pagination.total_pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Details Inspector Modal */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.125rem' }}>Audit Event Details #{selectedLog.id}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {selectedLog.action} on {selectedLog.entity} at {formatDateTime(selectedLog.created_at)}
                </p>
              </div>
              <button className="btn-icon" onClick={() => setSelectedLog(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
                <strong>User Agent:</strong>{' '}
                <span style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {selectedLog.user_agent || 'Unknown'}
                </span>
              </div>

              <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                State Payload / Diff:
              </div>
              <pre
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                  maxHeight: '300px',
                  overflow: 'auto',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                }}
              >
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '0.75rem 1.25rem',
                backgroundColor: 'var(--bg-subtle)',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => setSelectedLog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
