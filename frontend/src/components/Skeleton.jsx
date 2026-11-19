import React from 'react';

export function SkeletonLine({ width = '100%', height = '1rem', style = {} }) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius: 'var(--radius-sm)',
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="metric-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <SkeletonLine width="45%" height="0.875rem" />
        <SkeletonLine width="1.25rem" height="1.25rem" />
      </div>
      <SkeletonLine width="75%" height="1.75rem" style={{ marginBottom: '0.5rem' }} />
      <SkeletonLine width="30%" height="0.75rem" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="table-responsive">
      <table className="app-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <SkeletonLine width="70%" height="0.875rem" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <SkeletonLine width={c === 0 ? '40%' : '80%'} height="1rem" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
