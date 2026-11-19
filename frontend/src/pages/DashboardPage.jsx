import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  FileText,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { api } from '../api/client';
import { formatCurrency, formatDate } from '../utils/formatters';
import { SkeletonCard, SkeletonTable, SkeletonLine } from '../components/Skeleton';
import { MonthlyBarChart, CategoryBreakdown } from '../components/Charts';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const [period, setPeriod] = useState('this_month');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const { isAdmin } = useAuth();

  // 1. Query: Dashboard Summary Cards (FR-DSH-1, FR-DSH-2)
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['dashboard-summary', period],
    queryFn: async () => {
      const res = await api.get(`/dashboard/summary?period=${period}`);
      return res.data;
    },
    staleTime: 60000,
  });

  // 2. Query: Monthly Trend Bar Chart (FR-DSH-4)
  const {
    data: monthlyData,
    isLoading: monthlyLoading,
    isError: monthlyError,
    refetch: refetchMonthly,
  } = useQuery({
    queryKey: ['dashboard-monthly', selectedYear],
    queryFn: async () => {
      const res = await api.get(`/dashboard/monthly?year=${selectedYear}`);
      return res.data || [];
    },
    staleTime: 60000,
  });

  // 3. Query: Category Expense Breakdown (FR-DSH-5)
  const {
    data: categoryData,
    isLoading: categoryLoading,
    isError: categoryError,
    refetch: refetchCategory,
  } = useQuery({
    queryKey: ['dashboard-by-category', period],
    queryFn: async () => {
      const res = await api.get(`/dashboard/by-category?type=expense&period=${period}`);
      return res.data || [];
    },
    staleTime: 60000,
  });

  // 4. Query: Recent Transactions (FR-DSH-6)
  const {
    data: recentData,
    isLoading: recentLoading,
    isError: recentError,
    refetch: refetchRecent,
  } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: async () => {
      const res = await api.get('/dashboard/recent?limit=10');
      return res.data || [];
    },
    staleTime: 30000,
  });

  const periodOptions = [
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'this_year', label: 'This Year' },
  ];

  const periodSummary = summaryData?.period || { income: 0, expense: 0, net: 0 };
  const isNetProfit = (periodSummary.net || 0) >= 0;

  const handleRefreshAll = () => {
    refetchSummary();
    refetchMonthly();
    refetchCategory();
    refetchRecent();
  };

  return (
    <div>
      {/* Top Header & Period Selector (FR-DSH-3) */}
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
          <h1 style={{ fontSize: '1.5rem' }}>Financial Dashboard</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Overview of cash flow, category distributions, and recent ledger entries
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.25rem',
            }}
          >
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="btn text-sm"
                onClick={() => setPeriod(opt.value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: period === opt.value ? 'var(--brand-primary)' : 'transparent',
                  color: period === opt.value ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: period === opt.value ? 600 : 500,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={handleRefreshAll}
            title="Refresh all dashboard metrics (UI-D13)"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Net Profit / Loss Banner (FR-DSH-2, UI-D1, UI-D4) */}
      <div className="pnl-card">
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Net Result for {periodOptions.find((p) => p.value === period)?.label || 'Selected Period'}
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: isNetProfit ? 'var(--income-accent)' : 'var(--expense-accent)',
            }}
          >
            {isNetProfit ? (
              <ArrowUpRight size={28} aria-hidden="true" />
            ) : (
              <ArrowDownRight size={28} aria-hidden="true" />
            )}
            <span>
              {isNetProfit ? '+ ' : '- '}
              {formatCurrency(Math.abs(periodSummary.net || 0))}
            </span>
          </div>
        </div>

        <div>
          <span
            className={isNetProfit ? 'badge-income' : 'badge-expense'}
            style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
          >
            {isNetProfit ? 'Net Profit' : 'Net Loss'}
          </span>
        </div>
      </div>

      {/* Summary Cards Grid (FR-DSH-1, UI-D1, UI-D2, UI-D8) */}
      <div className="dashboard-grid">
        {summaryLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : summaryError ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '1.5rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--expense-border)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={24} color="var(--expense-accent)" style={{ marginBottom: '0.5rem' }} />
            <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Failed to load summary metrics.
            </p>
            <button className="btn btn-secondary text-sm" onClick={() => refetchSummary()}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : (
          <>
            {/* Today's Income */}
            <div className="metric-card">
              <div className="metric-header">
                <span>Today's Income</span>
                <span className="badge-income">
                  <TrendingUp size={12} /> +IN
                </span>
              </div>
              <div className="metric-value">
                {formatCurrency(summaryData?.today?.income || 0)}
              </div>
              <div className="metric-subtext">Received today</div>
            </div>

            {/* Today's Expense */}
            <div className="metric-card">
              <div className="metric-header">
                <span>Today's Expense</span>
                <span className="badge-expense">
                  <TrendingDown size={12} /> -OUT
                </span>
              </div>
              <div className="metric-value">
                {formatCurrency(summaryData?.today?.expense || 0)}
              </div>
              <div className="metric-subtext">Spent today</div>
            </div>

            {/* Period Income */}
            <div className="metric-card">
              <div className="metric-header">
                <span>{periodOptions.find((p) => p.value === period)?.label} Income</span>
                <span className="badge-income">
                  <TrendingUp size={12} /> Total
                </span>
              </div>
              <div className="metric-value">
                {formatCurrency(periodSummary.income || 0)}
              </div>
              <div className="metric-subtext">Total period credits</div>
            </div>

            {/* Period Expense */}
            <div className="metric-card">
              <div className="metric-header">
                <span>{periodOptions.find((p) => p.value === period)?.label} Expense</span>
                <span className="badge-expense">
                  <TrendingDown size={12} /> Total
                </span>
              </div>
              <div className="metric-value">
                {formatCurrency(periodSummary.expense || 0)}
              </div>
              <div className="metric-subtext">Total period debits</div>
            </div>
          </>
        )}
      </div>

      {/* Visual Charts Section (FR-DSH-4, FR-DSH-5, UI-D5, UI-D6) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        {/* Income vs Expense Monthly Trend (FR-DSH-4) */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.0625rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} color="var(--brand-primary)" />
                <span>Monthly Cash Flow</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Income vs Expense for Year {selectedYear} (FR-DSH-4)
              </div>
            </div>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                borderColor: 'var(--border-color)',
                fontSize: '0.8125rem',
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minHeight: '260px' }}>
            {monthlyLoading ? (
              <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SkeletonLine height="140px" />
                <SkeletonLine height="1.5rem" />
              </div>
            ) : monthlyError ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--expense-accent)' }}>Failed to load chart data.</p>
                <button className="btn btn-secondary text-sm" onClick={() => refetchMonthly()} style={{ marginTop: '0.5rem' }}>
                  Retry
                </button>
              </div>
            ) : (
              <MonthlyBarChart data={monthlyData} height={250} />
            )}
          </div>
        </div>

        {/* Expense by Category (FR-DSH-5 & UI-D6) */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1.0625rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PieChart size={18} color="var(--expense-accent)" />
              <span>Expense by Category</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Top categories for {periodOptions.find((p) => p.value === period)?.label} (FR-DSH-5)
            </div>
          </div>

          <div style={{ flex: 1 }}>
            {categoryLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                <SkeletonLine height="2rem" />
                <SkeletonLine height="2rem" />
                <SkeletonLine height="2rem" />
                <SkeletonLine height="2rem" />
              </div>
            ) : categoryError ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--expense-accent)' }}>Failed to load category breakdown.</p>
                <button className="btn btn-secondary text-sm" onClick={() => refetchCategory()} style={{ marginTop: '0.5rem' }}>
                  Retry
                </button>
              </div>
            ) : (
              <CategoryBreakdown categories={categoryData} />
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions List (FR-DSH-6, UI-D7) */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.125rem' }}>Recent Transactions</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Latest 10 entries across Income and Expense (FR-DSH-6)
            </p>
          </div>
        </div>

        {recentLoading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : recentError ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <AlertCircle size={24} color="var(--expense-accent)" style={{ marginBottom: '0.5rem' }} />
            <p style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Failed to load recent transactions.
            </p>
            <button className="btn btn-secondary text-sm" onClick={() => refetchRecent()}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : !recentData || recentData.length === 0 ? (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Receipt size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              No transactions recorded yet
            </div>
            <p style={{ fontSize: '0.875rem' }}>
              Transactions recorded will automatically appear in this activity feed.
            </p>
          </div>
        ) : (
          <div className="table-responsive table-stacked">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Payment Mode</th>
                  <th className="text-right">Amount</th>
                  <th>Bill</th>
                </tr>
              </thead>
              <tbody>
                {recentData.map((txn) => {
                  const isIncome = txn.type === 'income';
                  return (
                    <tr key={txn.id}>
                      <td data-label="Date">{formatDate(txn.txn_date)}</td>
                      <td data-label="Type">
                        <span className={isIncome ? 'badge-income' : 'badge-expense'}>
                          {isIncome ? '+ Income' : '- Expense'}
                        </span>
                      </td>
                      <td data-label="Category">{txn.category_name || 'General'}</td>
                      <td data-label="Mode">
                        <span className="badge-neutral">{txn.payment_mode}</span>
                      </td>
                      <td
                        data-label="Amount"
                        className="text-right"
                        style={{
                          fontWeight: 700,
                          color: isIncome ? 'var(--income-accent)' : 'var(--expense-accent)',
                        }}
                      >
                        {isIncome ? '+ ' : '- '}
                        {formatCurrency(txn.amount)}
                      </td>
                      <td data-label="Bill">
                        {txn.bill_file ? (
                          <span
                            className="badge-neutral"
                            title="Receipt attached"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <FileText size={12} /> Attached
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            None
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
