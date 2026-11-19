import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  Download,
  Printer,
  Filter,
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { api } from '../api/client';
import { formatCurrency, formatDate } from '../utils/formatters';
import { SkeletonTable } from '../components/Skeleton';

export function LedgerPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [categoryId, setCategoryId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // Query: Categories for filter dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data || [];
    },
  });

  // Query: Ledger entries with Running Balance (FR-LED-1, FR-LED-2, FR-LED-3)
  const {
    data: ledgerResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['ledger', dateFrom, dateTo, categoryId, paymentMode, page, perPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        page: String(page),
        per_page: String(perPage),
      });
      if (categoryId) params.set('category_id', categoryId);
      if (paymentMode) params.set('payment_mode', paymentMode);

      const res = await api.get(`/ledger?${params.toString()}`);
      return res;
    },
  });

  const entries = ledgerResponse?.data || [];
  const meta = ledgerResponse?.meta || {};
  const summary = meta.summary || {
    opening_balance: 0,
    total_credits: 0,
    total_debits: 0,
    closing_balance: 0,
  };
  const pagination = meta.pagination || { page: 1, per_page: 50, total_records: 0, total_pages: 1 };

  const handleExportCsv = () => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      format: 'csv',
    });
    if (categoryId) params.set('category_id', categoryId);
    if (paymentMode) params.set('payment_mode', paymentMode);

    window.open(`/api/v1/ledger?${params.toString()}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Top Header & Export Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
        className="no-print"
      >
        <div>
          <h1 style={{ fontSize: '1.5rem' }}>General Account Ledger</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Date-ordered chronological ledger with running balance (FR-LED-1 to FR-LED-4)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={handleExportCsv}
            title="Export Ledger to CSV spreadsheet"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={handlePrint}
            title="Print or Save as PDF"
          >
            <Printer size={15} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Company Header (visible only on print) */}
      <div className="print-only" style={{ display: 'none', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Caravan Accounting</h2>
        <div style={{ fontSize: '1rem', fontWeight: 600 }}>General Account Ledger Statement</div>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          Period: {formatDate(dateFrom)} to {formatDate(dateTo)} • Generated on {new Date().toLocaleDateString('en-IN')}
        </div>
      </div>

      {/* Summary KPI Cards (FR-LED-3) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Opening Balance */}
        <div className="metric-card">
          <div className="metric-header">
            <span>Opening Balance</span>
            <span className="badge-neutral">Prior</span>
          </div>
          <div
            className="metric-value"
            style={{
              color: summary.opening_balance >= 0 ? 'var(--text-primary)' : 'var(--expense-accent)',
            }}
          >
            {formatCurrency(summary.opening_balance)}
          </div>
          <div className="metric-subtext">Before {formatDate(dateFrom)}</div>
        </div>

        {/* Total Credits */}
        <div className="metric-card">
          <div className="metric-header">
            <span>Total Credits</span>
            <span className="badge-income">
              <TrendingUp size={12} /> +IN
            </span>
          </div>
          <div className="metric-value" style={{ color: 'var(--income-accent)' }}>
            + {formatCurrency(summary.total_credits)}
          </div>
          <div className="metric-subtext">Inflow within period</div>
        </div>

        {/* Total Debits */}
        <div className="metric-card">
          <div className="metric-header">
            <span>Total Debits</span>
            <span className="badge-expense">
              <TrendingDown size={12} /> -OUT
            </span>
          </div>
          <div className="metric-value" style={{ color: 'var(--expense-accent)' }}>
            - {formatCurrency(summary.total_debits)}
          </div>
          <div className="metric-subtext">Outflow within period</div>
        </div>

        {/* Closing Balance */}
        <div className="metric-card">
          <div className="metric-header">
            <span>Closing Balance</span>
            <span className={summary.closing_balance >= 0 ? 'badge-income' : 'badge-expense'}>
              End of Period
            </span>
          </div>
          <div
            className="metric-value"
            style={{
              color: summary.closing_balance >= 0 ? 'var(--income-accent)' : 'var(--expense-accent)',
            }}
          >
            {formatCurrency(summary.closing_balance)}
          </div>
          <div className="metric-subtext">On {formatDate(dateTo)}</div>
        </div>
      </div>

      {/* Date & Filter Controls (FR-LED-2) */}
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
        className="no-print"
      >
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Category:</label>
          <select
            className="form-control"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Mode:</label>
          <select
            className="form-control"
            value={paymentMode}
            onChange={(e) => {
              setPaymentMode(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
          >
            <option value="">All Modes</option>
            {['Cash', 'Bank', 'UPI', 'Cheque', 'Card'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-secondary text-sm"
          onClick={() => refetch()}
          title="Reload ledger"
        >
          <RefreshCw size={14} />
          <span>Reload</span>
        </button>
      </div>

      {/* Chronological Ledger Table (FR-LED-1) */}
      {isLoading ? (
        <SkeletonTable rows={12} cols={7} />
      ) : isError ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <AlertCircle size={32} color="var(--expense-accent)" style={{ marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Failed to load ledger data.</p>
          <button className="btn btn-secondary text-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <BookOpen size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
          <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>
            No transactions in this period
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Try expanding the date range filter above.
          </p>
        </div>
      ) : (
        <>
          <div className="table-responsive table-stacked">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Mode</th>
                  <th className="text-right">Debit (Expense)</th>
                  <th className="text-right">Credit (Income)</th>
                  <th className="text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr style={{ backgroundColor: 'var(--bg-subtle)', fontStyle: 'italic' }}>
                  <td data-label="Date">{formatDate(dateFrom)}</td>
                  <td data-label="Type">—</td>
                  <td data-label="Category" style={{ fontWeight: 600 }}>Opening Balance B/F</td>
                  <td data-label="Description">Balance brought forward from prior entries</td>
                  <td data-label="Mode">—</td>
                  <td data-label="Debit" className="text-right">—</td>
                  <td data-label="Credit" className="text-right">—</td>
                  <td data-label="Running Balance" className="text-right" style={{ fontWeight: 700 }}>
                    {formatCurrency(summary.opening_balance)}
                  </td>
                </tr>

                {/* Ledger Entries */}
                {entries.map((entry) => {
                  const isCredit = entry.credit > 0;
                  return (
                    <tr key={entry.id}>
                      <td data-label="Date">{formatDate(entry.txn_date)}</td>
                      <td data-label="Type">
                        <span className={isCredit ? 'badge-income' : 'badge-expense'}>
                          {isCredit ? '+ Income' : '- Expense'}
                        </span>
                      </td>
                      <td data-label="Category" style={{ fontWeight: 600 }}>
                        {entry.category_name}
                      </td>
                      <td data-label="Description" style={{ maxWidth: '280px' }}>
                        <span style={{ fontSize: '0.875rem' }}>{entry.description || '—'}</span>
                      </td>
                      <td data-label="Mode">
                        <span className="badge-neutral">{entry.payment_mode}</span>
                      </td>
                      <td
                        data-label="Debit (Expense)"
                        className="text-right"
                        style={{
                          color: entry.debit > 0 ? 'var(--expense-accent)' : 'inherit',
                          fontWeight: entry.debit > 0 ? 600 : 400,
                        }}
                      >
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>
                      <td
                        data-label="Credit (Income)"
                        className="text-right"
                        style={{
                          color: entry.credit > 0 ? 'var(--income-accent)' : 'inherit',
                          fontWeight: entry.credit > 0 ? 600 : 400,
                        }}
                      >
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </td>
                      <td
                        data-label="Running Balance"
                        className="text-right"
                        style={{
                          fontWeight: 700,
                          color: entry.running_balance >= 0 ? 'var(--text-primary)' : 'var(--expense-accent)',
                        }}
                      >
                        {formatCurrency(entry.running_balance)}
                      </td>
                    </tr>
                  );
                })}

                {/* Closing Balance Row */}
                <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: 700 }}>
                  <td data-label="Date">{formatDate(dateTo)}</td>
                  <td data-label="Type">—</td>
                  <td data-label="Category">Closing Balance C/F</td>
                  <td data-label="Description">Final balance at close of selected period</td>
                  <td data-label="Mode">—</td>
                  <td data-label="Debit" className="text-right" style={{ color: 'var(--expense-accent)' }}>
                    - {formatCurrency(summary.total_debits)}
                  </td>
                  <td data-label="Credit" className="text-right" style={{ color: 'var(--income-accent)' }}>
                    + {formatCurrency(summary.total_credits)}
                  </td>
                  <td data-label="Running Balance" className="text-right" style={{ color: summary.closing_balance >= 0 ? 'var(--income-accent)' : 'var(--expense-accent)', fontSize: '1rem' }}>
                    {formatCurrency(summary.closing_balance)}
                  </td>
                </tr>
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
            className="no-print"
          >
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Showing {entries.length} records on Page {page} of {pagination.total_pages || 1} ({pagination.total_records} total)
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
    </div>
  );
}
