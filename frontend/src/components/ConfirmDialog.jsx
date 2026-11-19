import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Accessible Confirmation Modal for Destructive Actions (SRS Section 4.1.1 UI-7)
 */
export function ConfirmDialog({
  isOpen,
  title = 'Confirm Deletion',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 50,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
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
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isDestructive && <AlertTriangle size={20} color="var(--expense-accent)" />}
            <h3 id="confirm-dialog-title" style={{ fontSize: '1.125rem' }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          {message}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            backgroundColor: 'var(--bg-subtle)',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn text-sm ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
