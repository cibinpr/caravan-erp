import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  PieChart,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../api/client';
import { formatCurrency, formatDate } from '../utils/formatters';
import { SkeletonTable, SkeletonCard } from '../components/Skeleton';

export function ReportsPage() {
  const [reportType, setReportType] = useState('monthly'); // 'monthly', 'range', 'yearly'
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // Query: Monthly Report (FR-RPT-1)
  const {
    data: monthlyReport,
    isLoading: monthlyLoading,
    isError: monthlyError,
    refetch: refetchMonthly,
  } = useQuery({
    queryKey: ['report-monthly', selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await api.get(`/reports/monthly?year=${selectedYear}&month=${selectedMonth}`);
      return res.data;
    },
    enabled: reportType === 'monthly',
  });

  // Query: Range Report (FR-RPT-2)
  const {
    data: rangeReport,
    isLoading: rangeLoading,
    isError: rangeError,
    refetch: refetchRange,
  } = useQuery({
    queryKey: ['report-range', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get(`/reports/range?date_from=${dateFrom}&date_to=${dateTo}`);
      return res.data;
    },
    enabled: reportType === 'range',
  });

  // Query: Yearly Summary (FR-RPT-4)
  const {
    data: yearlyReport,
    isLoading: yearlyLoading,
    isError: yearlyError,
    refetch: refetchYearly,
  } = useQuery({
    queryKey: ['report-yearly', selectedYear],
    queryFn: async () => {
      const res = await api.get(`/reports/yearly?year=${selectedYear}`);
      return res.data;
    },
    enabled: reportType === 'yearly',
  });

  const months = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' },
  ];

  const years = [2024, 2025, 2026, 2027];

  const handleExportCsv = () => {
    let url = '';
    if (reportType === 'monthly') {
      url = `/api/v1/reports/monthly?year=${selectedYear}&month=${selectedMonth}&format=csv`;
    } else if (reportType === 'range') {
      url = `/api/v1/reports/range?date_from=${dateFrom}&date_to=${dateTo}&format=csv`;
    } else {
      url = `/api/v1/reports/yearly?year=${selectedYear}&format=csv`;
    }
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const activeReport =
    reportType === 'monthly' ? monthlyReport : reportType === 'range' ? rangeReport : null;
  const isPeriodLoading = reportType === 'monthly' ? monthlyLoading : rangeLoading;
  const isPeriodError = reportType === 'monthly' ? monthlyError : rangeError;

  return (
    <div>
      {/* Top Header & Export Buttons */}
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
          <h1 style={{ fontSize: '1.5rem' }}>Financial Reports & Statements</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Periodic statements, category analysis, and exports (FR-RPT-1 to FR-RPT-6)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={handleExportCsv}
            title="Download CSV export"
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

      {/* Printable Branding Header (FR-RPT-5) */}
      <div
        className="print-only"
        style={{
          display: 'none',
          paddingBottom: '1rem',
          marginBottom: '1.5rem',
          borderBottom: '2px solid #000',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Caravan Accounting</h1>
            <p style={{ fontSize: '0.875rem', color: '#555', marginTop: '2px' }}>
              Financial & Audit Statement
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: '#555' }}>
            <div>Generated: {new Date().toLocaleDateString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}</div>
            <div>Currency: Indian Rupee (INR ₹)</div>
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
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
          marginBottom: '1.5rem',
        }}
        className="no-print"
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { value: 'monthly', label: 'Monthly Report' },
            { value: 'range', label: 'Custom Date Range' },
            { value: 'yearly', label: 'Yearly Trend (12 Months)' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              className="btn text-sm"
              onClick={() => setReportType(tab.value)}
              style={{
                backgroundColor: reportType === tab.value ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                color: reportType === tab.value ? '#ffffff' : 'var(--text-secondary)',
                padding: '0.375rem 0.75rem',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Selectors for Active Tab */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {reportType === 'monthly' && (
            <>
              <select
                className="form-control"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                className="form-control"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </>
          )}

          {reportType === 'range' && (
            <>
              <input
                type="date"
                className="form-control"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
              />
              <span style={{ fontSize: '0.875rem' }}>to</span>
              <input
                type="date"
                className="form-control"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
              />
            </>
          )}

          {reportType === 'yearly' && (
            <select
              className="form-control"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Monthly & Range Report Views */}
      {(reportType === 'monthly' || reportType === 'range') && (
        <div>
          {isPeriodLoading ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
              <SkeletonTable rows={6} cols={4} />
            </div>
          ) : isPeriodError ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <AlertCircle size={32} color="var(--expense-accent)" style={{ marginBottom: '0.5rem' }} />
              <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Failed to generate report.</p>
              <button
                className="btn btn-secondary text-sm"
                onClick={() => (reportType === 'monthly' ? refetchMonthly() : refetchRange())}
              >
                Retry
              </button>
            </div>
          ) : activeReport ? (
            <>
              {/* Financial Summary KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div className="metric-card">
                  <div className="metric-header">
                    <span>Total Income</span>
                    <span className="badge-income">+ Inflow</span>
                  </div>
                  <div className="metric-value" style={{ color: 'var(--income-accent)' }}>
                    + {formatCurrency(activeReport.summary?.total_income || 0)}
                  </div>
                  <div className="metric-subtext">Total period revenue</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Total Expenses</span>
                    <span className="badge-expense">- Outflow</span>
                  </div>
                  <div className="metric-value" style={{ color: 'var(--expense-accent)' }}>
                    - {formatCurrency(activeReport.summary?.total_expense || 0)}
                  </div>
                  <div className="metric-subtext">Total period expenditure</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Net Result</span>
                    <span className={activeReport.summary?.net_result >= 0 ? 'badge-income' : 'badge-expense'}>
                      {activeReport.summary?.net_result >= 0 ? 'Profit' : 'Loss'}
                    </span>
                  </div>
                  <div
                    className="metric-value"
                    style={{
                      color:
                        activeReport.summary?.net_result >= 0
                          ? 'var(--income-accent)'
                          : 'var(--expense-accent)',
                    }}
                  >
                    {activeReport.summary?.net_result >= 0 ? '+ ' : '- '}
                    {formatCurrency(Math.abs(activeReport.summary?.net_result || 0))}
                  </div>
                  <div className="metric-subtext">Net savings balance</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Entries Recorded</span>
                    <span className="badge-neutral">Audit</span>
                  </div>
                  <div className="metric-value">{activeReport.summary?.total_transactions || 0}</div>
                  <div className="metric-subtext">Total transactions</div>
                </div>
              </div>

              {/* Category-Wise Breakdown Tables (FR-RPT-3) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '2rem',
                }}
              >
                {/* Expense Categories */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingDown size={18} color="var(--expense-accent)" />
                    <span>Expense Breakdown by Category</span>
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Expenditure distribution and percentage shares (FR-RPT-3)
                  </p>

                  {activeReport.expense_categories?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No expenses recorded in this period.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="app-table">
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th className="text-right">Amount</th>
                            <th className="text-right">Share (%)</th>
                            <th className="text-right">Entries</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeReport.expense_categories?.map((cat) => (
                            <tr key={cat.id}>
                              <td style={{ fontWeight: 600 }}>{cat.name}</td>
                              <td className="text-right" style={{ color: 'var(--expense-accent)', fontWeight: 600 }}>
                                {formatCurrency(cat.amount)}
                              </td>
                              <td className="text-right">
                                <span className="badge-neutral">{cat.percentage}%</span>
                              </td>
                              <td className="text-right" style={{ color: 'var(--text-muted)' }}>
                                {cat.count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Income Categories */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} color="var(--income-accent)" />
                    <span>Income Breakdown by Category</span>
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Revenue distribution and percentage shares (FR-RPT-3)
                  </p>

                  {activeReport.income_categories?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No income recorded in this period.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="app-table">
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th className="text-right">Amount</th>
                            <th className="text-right">Share (%)</th>
                            <th className="text-right">Entries</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeReport.income_categories?.map((cat) => (
                            <tr key={cat.id}>
                              <td style={{ fontWeight: 600 }}>{cat.name}</td>
                              <td className="text-right" style={{ color: 'var(--income-accent)', fontWeight: 600 }}>
                                {formatCurrency(cat.amount)}
                              </td>
                              <td className="text-right">
                                <span className="badge-neutral">{cat.percentage}%</span>
                              </td>
                              <td className="text-right" style={{ color: 'var(--text-muted)' }}>
                                {cat.count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Yearly Month-by-Month Statement (FR-RPT-4) */}
      {reportType === 'yearly' && (
        <div>
          {yearlyLoading ? (
            <SkeletonTable rows={12} cols={5} />
          ) : yearlyError ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <AlertCircle size={32} color="var(--expense-accent)" style={{ marginBottom: '0.5rem' }} />
              <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Failed to load yearly report.</p>
              <button className="btn btn-secondary text-sm" onClick={() => refetchYearly()}>
                Retry
              </button>
            </div>
          ) : yearlyReport ? (
            <>
              {/* Year Summary KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div className="metric-card">
                  <div className="metric-header">
                    <span>Year {yearlyReport.year} Income</span>
                    <span className="badge-income">Annual</span>
                  </div>
                  <div className="metric-value" style={{ color: 'var(--income-accent)' }}>
                    + {formatCurrency(yearlyReport.total_income || 0)}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Year {yearlyReport.year} Expense</span>
                    <span className="badge-expense">Annual</span>
                  </div>
                  <div className="metric-value" style={{ color: 'var(--expense-accent)' }}>
                    - {formatCurrency(yearlyReport.total_expense || 0)}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Year Net Savings</span>
                    <span className={yearlyReport.net_savings >= 0 ? 'badge-income' : 'badge-expense'}>
                      {yearlyReport.net_savings >= 0 ? 'Surplus' : 'Deficit'}
                    </span>
                  </div>
                  <div
                    className="metric-value"
                    style={{
                      color:
                        yearlyReport.net_savings >= 0 ? 'var(--income-accent)' : 'var(--expense-accent)',
                    }}
                  >
                    {yearlyReport.net_savings >= 0 ? '+ ' : '- '}
                    {formatCurrency(Math.abs(yearlyReport.net_savings || 0))}
                  </div>
                </div>
              </div>

              {/* 12-Month Table */}
              <div className="table-responsive">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-right">Income (Credit)</th>
                      <th className="text-right">Expense (Debit)</th>
                      <th className="text-right">Net Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyReport.months?.map((m) => {
                      const isProfit = m.net >= 0;
                      return (
                        <tr key={m.month}>
                          <td style={{ fontWeight: 600 }}>{m.name}</td>
                          <td className="text-right" style={{ color: 'var(--income-accent)', fontWeight: 600 }}>
                            {m.income > 0 ? `+ ${formatCurrency(m.income)}` : '—'}
                          </td>
                          <td className="text-right" style={{ color: 'var(--expense-accent)', fontWeight: 600 }}>
                            {m.expense > 0 ? `- ${formatCurrency(m.expense)}` : '—'}
                          </td>
                          <td
                            className="text-right"
                            style={{
                              fontWeight: 700,
                              color: isProfit ? 'var(--income-accent)' : 'var(--expense-accent)',
                            }}
                          >
                            {isProfit ? '+ ' : '- '}
                            {formatCurrency(Math.abs(m.net))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', fontWeight: 700 }}>
                      <td>Annual Total</td>
                      <td className="text-right" style={{ color: 'var(--income-accent)' }}>
                        + {formatCurrency(yearlyReport.total_income)}
                      </td>
                      <td className="text-right" style={{ color: 'var(--expense-accent)' }}>
                        - {formatCurrency(yearlyReport.total_expense)}
                      </td>
                      <td
                        className="text-right"
                        style={{
                          color:
                            yearlyReport.net_savings >= 0
                              ? 'var(--income-accent)'
                              : 'var(--expense-accent)',
                          fontSize: '1rem',
                        }}
                      >
                        {yearlyReport.net_savings >= 0 ? '+ ' : '- '}
                        {formatCurrency(Math.abs(yearlyReport.net_savings))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
