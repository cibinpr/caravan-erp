import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  RefreshCw,
  X,
  Calendar,
  AlertCircle,
  Receipt,
  Eye,
} from 'lucide-react';
import { api } from '../api/client';
import { formatCurrency, formatDate } from '../utils/formatters';
import { SkeletonTable } from '../components/Skeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TransactionFormModal } from '../components/TransactionFormModal';
import { BillPreviewModal } from '../components/BillPreviewModal';
import { useAuth } from '../context/AuthContext';

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read State from URL search parameters (FR-LST-6)
  const activeTab = searchParams.get('tab') || 'all'; // all, income, expense
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || '25', 10);
  const sort = searchParams.get('sort') || 'txn_date';
  const order = searchParams.get('order') || 'desc';
  const categoryId = searchParams.get('category_id') || '';
  const paymentMode = searchParams.get('payment_mode') || '';
  const dateFrom = searchParams.get('date_from') || '';
  const dateTo = searchParams.get('date_to') || '';
  const hasBill = searchParams.get('has_bill') || '';
  const searchQuery = searchParams.get('q') || '';

  // Filter drawer toggle
  const [showFilters, setShowFilters] = useState(false);

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formModalType, setFormModalType] = useState('expense');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [previewTransaction, setPreviewTransaction] = useState(null);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  // Local search query input buffer for debounce
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync searchInput if URL changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Helper to update URL params cleanly
  const updateParams = (updates) => {
    const current = Object.fromEntries(searchParams.entries());
    const next = { ...current, ...updates };

    // Clean up empty params
    Object.keys(next).forEach((key) => {
      if (next[key] === '' || next[key] === null || next[key] === undefined) {
        delete next[key];
      }
    });

    setSearchParams(next);
  };

  // Query: Categories for filters and form
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data || [];
    },
  });

  // Query: Paginated Transactions & Totals (FR-LST-1 to FR-LST-7)
  const {
    data: txnResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'transactions',
      activeTab,
      page,
      perPage,
      sort,
      order,
      categoryId,
      paymentMode,
      dateFrom,
      dateTo,
      hasBill,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('type', activeTab);
      params.set('page', String(page));
      params.set('per_page', String(perPage));
      params.set('sort', sort);
      params.set('order', order);
      if (categoryId) params.set('category_id', categoryId);
      if (paymentMode) params.set('payment_mode', paymentMode);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (hasBill) params.set('has_bill', hasBill);
      if (searchQuery) params.set('q', searchQuery);

      const res = await api.get(`/transactions?${params.toString()}`);
      return res;
    },
  });

  // Mutation: Delete Transaction (FR-TXN-4)
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-recent'] });
      setTransactionToDelete(null);
    },
    onError: (err) => {
      alert(err.message || 'Failed to delete transaction.');
    },
  });

  const transactions = txnResponse?.data || [];
  const meta = txnResponse?.meta || {};
  const pagination = meta.pagination || { page: 1, per_page: 25, total_records: 0, total_pages: 1 };
  const totals = meta.totals || { income: 0, expense: 0, net: 0 };

  const handleTabChange = (tab) => {
    updateParams({ tab, page: 1 });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateParams({ q: searchInput.trim(), page: 1 });
  };

  const handleSort = (column) => {
    if (sort === column) {
      updateParams({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ sort: column, order: 'desc' });
    }
  };

  const clearAllFilters = () => {
    setSearchParams({ tab: activeTab });
    setSearchInput('');
  };

  const hasActiveFilters = Boolean(
    categoryId || paymentMode || dateFrom || dateTo || hasBill || searchQuery
  );

  return (
    <div>
      {/* Top Header & New Transaction Actions */}
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
          <h1 style={{ fontSize: '1.5rem' }}>Transaction Ledger</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Searchable, filterable records of Income and Expenses with bill receipts
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-primary text-sm"
              onClick={() => {
                setEditingTransaction(null);
                setFormModalType('income');
                setFormModalOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Record Income (+)</span>
            </button>
            <button
              className="btn btn-danger text-sm"
              onClick={() => {
                setEditingTransaction(null);
                setFormModalType('expense');
                setFormModalOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Record Expense (-)</span>
            </button>
          </div>
        )}
      </div>

      {/* Filtered Totals Summary Bar (FR-LST-7) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Filtered Income
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--income-accent)' }}>
            + {formatCurrency(totals.income)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Filtered Expense
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--expense-accent)' }}>
            - {formatCurrency(totals.expense)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Net Period Balance
          </div>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: totals.net >= 0 ? 'var(--income-accent)' : 'var(--expense-accent)',
            }}
          >
            {totals.net >= 0 ? '+ ' : '- '}
            {formatCurrency(Math.abs(totals.net))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Record Count
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {pagination.total_records} record{pagination.total_records === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* View Tabs & Quick Search Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          backgroundColor: 'var(--bg-surface)',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          marginBottom: '1rem',
        }}
      >
        {/* Navigation Tabs: All / Income / Expense (FR-LST-1) */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { value: 'all', label: 'All Transactions' },
            { value: 'income', label: 'Income Only' },
            { value: 'expense', label: 'Expense Only' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              className="btn text-sm"
              onClick={() => handleTabChange(tab.value)}
              style={{
                backgroundColor: activeTab === tab.value ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                color: activeTab === tab.value ? '#ffffff' : 'var(--text-secondary)',
                padding: '0.375rem 0.75rem',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Filter Drawer Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search description, category…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ paddingLeft: '2.25rem', width: '260px' }}
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
          </form>

          <button
            type="button"
            className={`btn text-sm ${showFilters || hasActiveFilters ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle advanced filters"
          >
            <Filter size={16} />
            <span>Filters {hasActiveFilters ? '•' : ''}</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Drawer (FR-LST-3) */}
      {showFilters && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Advanced Filters</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--expense-accent)',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Clear all filters
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Category Filter */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Category</label>
              <select
                className="form-control"
                value={categoryId}
                onChange={(e) => updateParams({ category_id: e.target.value, page: 1 })}
              >
                <option value="">All Categories</option>
                {categories
                  .filter((c) => activeTab === 'all' || c.type === activeTab)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </select>
            </div>

            {/* Payment Mode */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Payment Mode</label>
              <select
                className="form-control"
                value={paymentMode}
                onChange={(e) => updateParams({ payment_mode: e.target.value, page: 1 })}
              >
                <option value="">All Modes</option>
                {['Cash', 'Bank', 'UPI', 'Cheque', 'Card'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="form-control"
                value={dateFrom}
                onChange={(e) => updateParams({ date_from: e.target.value, page: 1 })}
              />
            </div>

            {/* Date To */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="form-control"
                value={dateTo}
                onChange={(e) => updateParams({ date_to: e.target.value, page: 1 })}
              />
            </div>

            {/* Has Bill */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Receipt / Bill</label>
              <select
                className="form-control"
                value={hasBill}
                onChange={(e) => updateParams({ has_bill: e.target.value, page: 1 })}
              >
                <option value="">All Entries</option>
                <option value="1">With Receipt Only</option>
                <option value="0">Without Receipt</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      {isLoading ? (
        <SkeletonTable rows={10} cols={7} />
      ) : isError ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <AlertCircle size={32} color="var(--expense-accent)" style={{ marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Failed to load transactions.
          </p>
          <button className="btn btn-secondary text-sm" onClick={() => refetch()}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : transactions.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <Receipt size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
          <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>
            No transactions found
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {hasActiveFilters
              ? 'No records match the current filters. Try resetting the filters.'
              : 'Start by clicking "Record Income" or "Record Expense" above.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-responsive table-stacked">
            <table className="app-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Date <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th>Type</th>
                  <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Category <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th>Payment Mode</th>
                  <th>Description</th>
                  <th
                    className="text-right"
                    onClick={() => handleSort('amount')}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      Amount <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th>Bill</th>
                  {isAdmin && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const isIncome = txn.type === 'income';
                  return (
                    <tr key={txn.id}>
                      <td data-label="Date">{formatDate(txn.txn_date)}</td>
                      <td data-label="Type">
                        <span className={isIncome ? 'badge-income' : 'badge-expense'}>
                          {isIncome ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {isIncome ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td data-label="Category" style={{ fontWeight: 600 }}>
                        {txn.category_name}
                      </td>
                      <td data-label="Mode">
                        <span className="badge-neutral">{txn.payment_mode}</span>
                      </td>
                      <td data-label="Description" style={{ maxWidth: '280px' }}>
                        <span style={{ fontSize: '0.875rem' }}>{txn.description || '—'}</span>
                      </td>
                      <td
                        data-label="Amount"
                        className="text-right"
                        style={{
                          fontWeight: 700,
                          fontSize: '0.9375rem',
                          color: isIncome ? 'var(--income-accent)' : 'var(--expense-accent)',
                        }}
                      >
                        {isIncome ? '+ ' : '- '}
                        {formatCurrency(txn.amount)}
                      </td>
                      <td data-label="Bill">
                        {txn.bill_file ? (
                          <button
                            type="button"
                            className="btn btn-secondary text-sm"
                            onClick={() => setPreviewTransaction(txn)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            title="View attached receipt"
                          >
                            <Eye size={12} /> View
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td data-label="Actions" className="text-right">
                          <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => {
                                setEditingTransaction(txn);
                                setFormModalOpen(true);
                              }}
                              title="Edit Transaction"
                              aria-label="Edit Transaction"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => setTransactionToDelete(txn)}
                              title="Delete Transaction"
                              aria-label="Delete Transaction"
                              style={{ color: 'var(--expense-accent)' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls (FR-LST-2) */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rows per page:</span>
              <select
                value={perPage}
                onChange={(e) => updateParams({ per_page: e.target.value, page: 1 })}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {[10, 25, 50, 100].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
              <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                Showing {(page - 1) * perPage + 1} to{' '}
                {Math.min(page * perPage, pagination.total_records)} of {pagination.total_records}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: page - 1 })}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, padding: '0 0.5rem' }}>
                Page {page} of {pagination.total_pages || 1}
              </span>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                disabled={page >= pagination.total_pages}
                onClick={() => updateParams({ page: page + 1 })}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Transaction Form Modal (Create & Edit - FR-TXN-1, FR-TXN-3, FR-TXN-7) */}
      <TransactionFormModal
        isOpen={formModalOpen}
        initialType={formModalType}
        transaction={editingTransaction}
        categories={categories}
        onClose={() => {
          setFormModalOpen(false);
          setEditingTransaction(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-recent'] });
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        }}
      />

      {/* Bill Preview Modal (FR-BILL-4, FR-BILL-5) */}
      <BillPreviewModal
        isOpen={Boolean(previewTransaction)}
        transaction={previewTransaction}
        onClose={() => setPreviewTransaction(null)}
      />

      {/* Delete Confirmation Dialog (FR-TXN-4, UI-7) */}
      <ConfirmDialog
        isOpen={Boolean(transactionToDelete)}
        title="Confirm Transaction Deletion"
        message={
          transactionToDelete && (
            <div>
              <p style={{ marginBottom: '0.5rem' }}>
                Are you sure you want to delete this {transactionToDelete.type} entry of{' '}
                <strong>₹ {Number(transactionToDelete.amount).toFixed(2)}</strong> (
                {transactionToDelete.category_name}) on {transactionToDelete.txn_date}?
              </p>
              {transactionToDelete.bill_file && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--expense-accent)' }}>
                  ⚠️ The attached receipt file will also be permanently deleted from private storage.
                </p>
              )}
            </div>
          )
        }
        confirmLabel="Delete Transaction"
        isLoading={deleteMutation.isPending}
        isDestructive={true}
        onCancel={() => setTransactionToDelete(null)}
        onConfirm={() => {
          if (transactionToDelete) {
            deleteMutation.mutate(transactionToDelete.id);
          }
        }}
      />
    </div>
  );
}
