import React, { useState } from 'react';
import { formatCurrency, formatCompactCurrency } from '../utils/formatters';

/**
 * Accessible SVG Grouped Bar Chart for Monthly Income vs Expense (FR-DSH-4, UI-D5)
 */
export function MonthlyBarChart({ data = [], height = 280 }) {
  const [hoveredMonth, setHoveredMonth] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        No monthly data available
      </div>
    );
  }

  // Find max value for scaling
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.income || 0, d.expense || 0)),
    10000 // default minimum ceiling
  );

  const chartPaddingTop = 30;
  const chartPaddingBottom = 35;
  const chartPaddingLeft = 55;
  const chartPaddingRight = 20;

  const totalWidth = 720;
  const plotWidth = totalWidth - chartPaddingLeft - chartPaddingRight;
  const plotHeight = height - chartPaddingTop - chartPaddingBottom;

  const groupWidth = plotWidth / data.length;
  const barWidth = Math.max(8, groupWidth * 0.32);

  // Y-axis grid increments (4 lines)
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Chart Legend (UI-D5) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1.25rem',
          marginBottom: '0.75rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: 'var(--income-accent)',
              borderRadius: '2px',
            }}
          />
          <span>Income (+IN)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: 'var(--expense-accent)',
              borderRadius: '2px',
            }}
          />
          <span>Expense (-OUT)</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        role="img"
        aria-label="Monthly Income versus Expense grouped bar chart"
      >
        {/* Y-Axis Horizontal Gridlines */}
        {yTicks.map((tick, i) => {
          const y = chartPaddingTop + plotHeight - (tick / maxVal) * plotHeight;
          return (
            <g key={i}>
              <line
                x1={chartPaddingLeft}
                y1={y}
                x2={totalWidth - chartPaddingRight}
                y2={y}
                stroke="var(--border-color)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={chartPaddingLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-muted)"
              >
                {formatCompactCurrency(tick)}
              </text>
            </g>
          );
        })}

        {/* Grouped Bars */}
        {data.map((item, index) => {
          const groupX = chartPaddingLeft + index * groupWidth;
          const incomeHeight = Math.max(2, (item.income / maxVal) * plotHeight);
          const expenseHeight = Math.max(2, (item.expense / maxVal) * plotHeight);

          const incomeY = chartPaddingTop + plotHeight - incomeHeight;
          const expenseY = chartPaddingTop + plotHeight - expenseHeight;

          const isHovered = hoveredMonth === index;

          return (
            <g
              key={item.month}
              onMouseEnter={() => setHoveredMonth(index)}
              onMouseLeave={() => setHoveredMonth(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Subtle hover column background */}
              {isHovered && (
                <rect
                  x={groupX + 2}
                  y={chartPaddingTop}
                  width={groupWidth - 4}
                  height={plotHeight}
                  fill="var(--bg-hover)"
                  opacity="0.4"
                  rx="4"
                />
              )}

              {/* Income Bar (Green) */}
              <rect
                x={groupX + groupWidth * 0.15}
                y={incomeY}
                width={barWidth}
                height={incomeHeight}
                fill="var(--income-accent)"
                rx="3"
                opacity={isHovered ? 1 : 0.9}
              />

              {/* Expense Bar (Red) */}
              <rect
                x={groupX + groupWidth * 0.15 + barWidth + 3}
                y={expenseY}
                width={barWidth}
                height={expenseHeight}
                fill="var(--expense-accent)"
                rx="3"
                opacity={isHovered ? 1 : 0.9}
              />

              {/* X-Axis Month Label */}
              <text
                x={groupX + groupWidth / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="12"
                fontWeight={isHovered ? '700' : '500'}
                fill={isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
              >
                {item.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip Overlay (UI-D5) */}
      {hoveredMonth !== null && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: `${chartPaddingLeft + hoveredMonth * groupWidth}px`,
            transform: 'translateX(-30%)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.75rem',
            fontSize: '0.75rem',
            pointerEvents: 'none',
            zIndex: 20,
            minWidth: '150px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
            {data[hoveredMonth].name}
          </div>
          <div style={{ color: 'var(--income-accent)', fontWeight: 600 }}>
            Income: {formatCurrency(data[hoveredMonth].income)}
          </div>
          <div style={{ color: 'var(--expense-accent)', fontWeight: 600 }}>
            Expense: {formatCurrency(data[hoveredMonth].expense)}
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.25rem', paddingTop: '0.25rem', fontWeight: 700 }}>
            Net: {formatCurrency(data[hoveredMonth].net)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Accessible Category Share Breakdown (FR-DSH-5 & UI-D6)
 */
export function CategoryBreakdown({ categories = [], grandTotal = 0 }) {
  if (!categories || categories.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
        No category expenses recorded for this period
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {categories.map((cat, idx) => (
        <div key={cat.id || idx}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            <span style={{ fontWeight: 600 }}>{cat.name}</span>
            <span style={{ fontWeight: 700 }}>
              {formatCurrency(cat.amount)}{' '}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                ({cat.percentage}%)
              </span>
            </span>
          </div>

          {/* Accessible Percentage Bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(2, cat.percentage))}%`,
                height: '100%',
                backgroundColor: idx === 0 ? 'var(--expense-accent)' : idx === 1 ? '#f97316' : idx === 2 ? '#eab308' : 'var(--brand-primary)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
