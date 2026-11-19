import React from 'react';
import { X, Download, FileText, ExternalLink } from 'lucide-react';

/**
 * Authenticated Bill Receipt Preview Modal (SRS Section 3.6 FR-BILL-4 & FR-BILL-5)
 */
export function BillPreviewModal({ isOpen, transaction, onClose }) {
  if (!isOpen || !transaction) return null;

  const billUrl = `/api/v1/transactions/${transaction.id}/bill`;
  const downloadUrl = `${billUrl}?download=1`;
  const isPdf =
    transaction.bill_original_name?.toLowerCase().endsWith('.pdf') ||
    transaction.bill_file?.toLowerCase().endsWith('.pdf');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 50,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bill-preview-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          height: '85vh',
          maxHeight: '850px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <FileText size={20} color="var(--brand-primary)" />
            <div style={{ minWidth: 0 }}>
              <h3 id="bill-preview-title" style={{ fontSize: '1.125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {transaction.bill_original_name || 'Bill Receipt'}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {transaction.category_name} • ₹ {Number(transaction.amount).toFixed(2)} • {transaction.txn_date}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a
              href={downloadUrl}
              className="btn btn-secondary text-sm"
              download={transaction.bill_original_name || 'receipt'}
              title="Download file"
            >
              <Download size={14} />
              <span>Download</span>
            </a>
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Close bill preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            padding: '1rem',
          }}
        >
          {isPdf ? (
            <iframe
              src={billUrl}
              title="PDF Bill Viewer"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#ffffff',
              }}
            />
          ) : (
            <img
              src={billUrl}
              alt={transaction.bill_original_name || 'Bill receipt'}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentNode.innerHTML = `
                  <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    <p style="font-weight: 600; margin-bottom: 0.5rem;">Preview unavailable</p>
                    <p style="font-size: 0.875rem; margin-bottom: 1rem;">Click below to download the file directly.</p>
                    <a href="${downloadUrl}" class="btn btn-primary text-sm">Download File</a>
                  </div>
                `;
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
