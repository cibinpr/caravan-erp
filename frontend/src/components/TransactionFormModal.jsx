import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  AlertCircle,
  PlusCircle,
  CheckCircle,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api/client';

const PAYMENT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque', 'Card'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Unified Transaction Form Modal (SRS Section 3.5 FR-TXN-1 to FR-TXN-7)
 */
export function TransactionFormModal({
  isOpen,
  initialType = 'expense',
  transaction = null, // null for create, object for edit
  categories = [],
  onClose,
  onSuccess,
}) {
  const isEditing = Boolean(transaction);

  const [type, setType] = useState(initialType);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [description, setDescription] = useState('');
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Bill attachment state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [removeExistingBill, setRemoveExistingBill] = useState(false);

  // Inline Category Creation (FR-CAT-6)
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const [catError, setCatError] = useState('');

  // Form submission and validation state
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize state when modal opens or transaction prop changes
  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setCategoryId(String(transaction.category_id));
      setAmount(String(transaction.amount));
      setPaymentMode(transaction.payment_mode || 'Cash');
      setDescription(transaction.description || '');
      setTxnDate(transaction.txn_date || new Date().toISOString().split('T')[0]);
      setRemoveExistingBill(false);
    } else {
      setType(initialType);
      setCategoryId('');
      setAmount('');
      setPaymentMode('Cash');
      setDescription('');
      setTxnDate(new Date().toISOString().split('T')[0]);
      setRemoveExistingBill(false);
    }
    setSelectedFile(null);
    setFilePreview(null);
    setFieldErrors({});
    setGeneralError('');
    setShowInlineCat(false);
  }, [transaction, initialType, isOpen]);

  if (!isOpen) return null;

  // Filter categories matching current transaction type
  const availableCategories = categories.filter((c) => c.type === type && c.is_active);

  // Future date check for warning banner (FR-TXN-5)
  const todayStr = new Date().toISOString().split('T')[0];
  const isFutureDate = txnDate > todayStr;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (FR-BILL-2: 5 MB)
    if (file.size > MAX_FILE_SIZE) {
      setFieldErrors((prev) => ({
        ...prev,
        bill: `File exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      }));
      return;
    }

    // Validate type (FR-BILL-1: JPG, PNG, PDF)
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        bill: 'Only JPG, PNG, and PDF receipt files are allowed.',
      }));
      return;
    }

    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.bill;
      return copy;
    });

    setSelectedFile(file);
    setRemoveExistingBill(false);

    // Create thumbnail preview if image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleCreateInlineCategory = async (e) => {
    e.preventDefault();
    setCatError('');
    if (!newCatName.trim()) {
      setCatError('Category name is required.');
      return;
    }

    setCreatingCat(true);
    try {
      const res = await api.post('/categories', {
        name: newCatName.trim(),
        type,
      });
      // Select the new category automatically
      setCategoryId(String(res.data.id));
      setShowInlineCat(false);
      setNewCatName('');
      // Trigger parent callback to refresh category lists
      if (onSuccess) onSuccess({ categoryCreated: res.data });
    } catch (err) {
      setCatError(err.message || 'Failed to create category.');
    } finally {
      setCreatingCat(false);
    }
  };

  const validate = () => {
    const errors = {};
    if (!categoryId) {
      errors.category_id = 'Please select a category.';
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errors.amount = 'Please enter a valid amount greater than 0.';
    }

    // FR-TXN-2: Description required for expense, optional for income
    if (type === 'expense' && !description.trim()) {
      errors.description = 'Description is required for expense entries.';
    }

    if (!txnDate) {
      errors.txn_date = 'Transaction date is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('category_id', categoryId);
      formData.append('amount', amount);
      formData.append('payment_mode', paymentMode);
      formData.append('description', description.trim());
      formData.append('txn_date', txnDate);

      if (selectedFile) {
        formData.append('bill', selectedFile);
      }

      if (isEditing) {
        if (removeExistingBill) {
          formData.append('remove_bill', '1');
        }
        await api.upload(`/transactions/${transaction.id}`, formData);
      } else {
        await api.upload('/transactions', formData);
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err.fields) {
        setFieldErrors(err.fields);
      }
      setGeneralError(err.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        zIndex: 50,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div>
            <h2 id="transaction-modal-title" style={{ fontSize: '1.25rem' }}>
              {isEditing ? 'Edit Transaction' : 'Record Transaction'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {type === 'income' ? 'Cash inflow / Credit' : 'Cash outflow / Debit'}
            </p>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {generalError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--expense-bg)',
                border: '1px solid var(--expense-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--expense-text)',
                fontSize: '0.875rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={18} />
              <span>{generalError}</span>
            </div>
          )}

          {/* Future Date Warning Banner (FR-TXN-5) */}
          {isFutureDate && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1rem',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid #f59e0b',
                borderRadius: 'var(--radius-md)',
                color: '#b45309',
                fontSize: '0.8125rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertTriangle size={16} />
              <span>Notice: You are recording an entry with a future date ({txnDate}).</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate id="transaction-form">
            {/* Type Selector Tabs (Income / Expense) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ marginBottom: '0.375rem', display: 'block' }}>
                Transaction Type
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '0.25rem',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setType('income');
                    setCategoryId('');
                  }}
                  style={{
                    backgroundColor: type === 'income' ? 'var(--income-accent)' : 'transparent',
                    color: type === 'income' ? '#ffffff' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                >
                  + Income (Credit)
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setType('expense');
                    setCategoryId('');
                  }}
                  style={{
                    backgroundColor: type === 'expense' ? 'var(--expense-accent)' : 'transparent',
                    color: type === 'expense' ? '#ffffff' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                >
                  - Expense (Debit)
                </button>
              </div>
            </div>

            {/* Category Selector with Inline Creation (FR-CAT-6) */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="txn-category">
                  Category *
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineCat(!showInlineCat)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand-primary)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                  }}
                >
                  <PlusCircle size={14} />
                  <span>{showInlineCat ? 'Cancel New' : '+ Add Category'}</span>
                </button>
              </div>

              {showInlineCat ? (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '0.25rem',
                  }}
                >
                  <input
                    type="text"
                    className="form-control"
                    placeholder={`New ${type} category name`}
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary text-sm"
                    onClick={handleCreateInlineCategory}
                    disabled={creatingCat}
                  >
                    {creatingCat ? 'Adding…' : 'Add'}
                  </button>
                </div>
              ) : (
                <select
                  id="txn-category"
                  className="form-control"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.category_id)}
                >
                  <option value="">-- Select a Category --</option>
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {catError && <span className="form-error">{catError}</span>}
              {fieldErrors.category_id && (
                <span className="form-error">{fieldErrors.category_id}</span>
              )}
            </div>

            {/* Amount and Payment Mode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="txn-amount">
                  Amount (₹) *
                </label>
                <input
                  id="txn-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.amount)}
                />
                {fieldErrors.amount && <span className="form-error">{fieldErrors.amount}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="txn-mode">
                  Payment Mode *
                </label>
                <select
                  id="txn-mode"
                  className="form-control"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transaction Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="txn-date">
                Transaction Date *
              </label>
              <input
                id="txn-date"
                type="date"
                className="form-control"
                value={txnDate}
                onChange={(e) => setTxnDate(e.target.value)}
                aria-invalid={Boolean(fieldErrors.txn_date)}
              />
              {fieldErrors.txn_date && <span className="form-error">{fieldErrors.txn_date}</span>}
            </div>

            {/* Description (FR-TXN-2: required for expense, optional for income) */}
            <div className="form-group">
              <label className="form-label" htmlFor="txn-desc">
                Description {type === 'expense' ? '*' : '(Optional)'}
              </label>
              <textarea
                id="txn-desc"
                rows={3}
                className="form-control"
                placeholder={
                  type === 'expense'
                    ? 'Enter purpose or vendor details…'
                    : 'Invoice reference, notes, etc. (optional)'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={Boolean(fieldErrors.description)}
              />
              {fieldErrors.description && (
                <span className="form-error">{fieldErrors.description}</span>
              )}
            </div>

            {/* Bill Attachment (FR-BILL-1 to FR-BILL-6) */}
            <div className="form-group">
              <label className="form-label">
                Receipt / Bill Attachment (JPG, PNG, PDF up to 5 MB)
              </label>

              {/* Display existing bill if editing */}
              {isEditing && transaction?.bill_file && !removeExistingBill && !selectedFile && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <FileText size={18} color="var(--brand-primary)" />
                    <span style={{ fontSize: '0.875rem', truncate: true }}>
                      {transaction.bill_original_name || 'Existing Attachment'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => setRemoveExistingBill(true)}
                    style={{ padding: '0.25rem 0.5rem', color: 'var(--expense-accent)' }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-subtle)',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                  }}
                />
                {selectedFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={18} color="var(--income-accent)" />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                ) : (
                  <div>
                    <Upload size={24} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem auto' }} />
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      Click or drag receipt file here
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Supports JPG, PNG, and PDF (Max 5 MB)
                    </div>
                  </div>
                )}
              </div>

              {/* Thumbnail Image Preview */}
              {filePreview && (
                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                  <img
                    src={filePreview}
                    alt="Receipt preview"
                    style={{
                      maxHeight: '120px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>
              )}

              {fieldErrors.bill && <span className="form-error">{fieldErrors.bill}</span>}
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-subtle)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="transaction-form"
            className={`btn text-sm ${type === 'income' ? 'btn-primary' : 'btn-danger'}`}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Saving…'
              : isEditing
              ? 'Update Transaction'
              : type === 'income'
              ? 'Save Income (+)'
              : 'Save Expense (-)'}
          </button>
        </div>
      </div>
    </div>
  );
}
