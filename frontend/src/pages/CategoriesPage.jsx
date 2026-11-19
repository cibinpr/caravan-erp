import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tags,
  Plus,
  Edit2,
  Trash2,
  Power,
  Search,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { SkeletonTable } from '../components/Skeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  // Form state
  const [nameInput, setNameInput] = useState('');
  const [typeInput, setTypeInput] = useState('expense');
  const [formError, setFormError] = useState('');

  // Query: Get all categories with usage count
  const {
    data: categories = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data || [];
    },
  });

  // Mutation: Create Category (FR-CAT-1, FR-CAT-5)
  const createMutation = useMutation({
    mutationFn: async ({ name, type }) => {
      const res = await api.post('/categories', { name, type });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowAddModal(false);
      setNameInput('');
      setFormError('');
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to create category.');
    },
  });

  // Mutation: Rename Category (FR-CAT-2)
  const updateMutation = useMutation({
    mutationFn: async ({ id, name }) => {
      const res = await api.put(`/categories/${id}`, { name });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingCategory(null);
      setNameInput('');
      setFormError('');
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to rename category.');
    },
  });

  // Mutation: Toggle Active State (FR-CAT-3)
  const toggleActiveMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/categories/${id}/active`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  // Mutation: Delete Category (FR-CAT-4)
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/categories/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCategoryToDelete(null);
    },
    onError: (err) => {
      alert(err.message || 'Failed to delete category.');
      setCategoryToDelete(null);
    },
  });

  const handleOpenAdd = () => {
    setNameInput('');
    setTypeInput(filterType === 'income' ? 'income' : 'expense');
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setNameInput(cat.name);
    setFormError('');
  };

  const handleSaveAdd = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setFormError('Category name cannot be empty.');
      return;
    }
    createMutation.mutate({ name: nameInput.trim(), type: typeInput });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setFormError('Category name cannot be empty.');
      return;
    }
    updateMutation.mutate({ id: editingCategory.id, name: nameInput.trim() });
  };

  // Filter categories
  const filteredCategories = categories.filter((c) => {
    const matchesType = filterType === 'all' || c.type === filterType;
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

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
          <h1 style={{ fontSize: '1.5rem' }}>Category Management</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Manage Income and Expense categories and historical classifications
          </p>
        </div>

        <button className="btn btn-primary text-sm" onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>New Category</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
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
      >
        {/* Type Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { value: 'all', label: 'All Categories' },
            { value: 'income', label: 'Income Only' },
            { value: 'expense', label: 'Expense Only' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              className="btn text-sm"
              onClick={() => setFilterType(tab.value)}
              style={{
                backgroundColor: filterType === tab.value ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                color: filterType === tab.value ? '#ffffff' : 'var(--text-secondary)',
                padding: '0.375rem 0.75rem',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search category name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.25rem', width: '100%' }}
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
        </div>
      </div>

      {/* Categories Table */}
      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : isError ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={28} color="var(--expense-accent)" style={{ marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Failed to load categories.</p>
          <button className="btn btn-secondary text-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <Tags size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No categories found</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {searchTerm ? 'Try a different search term.' : 'Click "New Category" above to create one.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive table-stacked">
          <table className="app-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Usage Count</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((cat) => {
                const isIncome = cat.type === 'income';
                return (
                  <tr key={cat.id}>
                    <td data-label="Category Name" style={{ fontWeight: 600 }}>
                      {cat.name}
                    </td>
                    <td data-label="Type">
                      <span className={isIncome ? 'badge-income' : 'badge-expense'}>
                        {isIncome ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isIncome ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={cat.is_active ? 'badge-income' : 'badge-neutral'}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-label="Usage Count">
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {cat.usage_count} transaction{cat.usage_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td data-label="Actions" className="text-right">
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        {/* Rename */}
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleOpenEdit(cat)}
                          title="Rename Category"
                          aria-label={`Rename ${cat.name}`}
                        >
                          <Edit2 size={16} />
                        </button>

                        {/* Toggle Active (FR-CAT-3) */}
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => toggleActiveMutation.mutate(cat.id)}
                          title={cat.is_active ? 'Deactivate Category' : 'Activate Category'}
                          aria-label={cat.is_active ? `Deactivate ${cat.name}` : `Activate ${cat.name}`}
                        >
                          <Power size={16} color={cat.is_active ? 'var(--income-accent)' : 'var(--text-muted)'} />
                        </button>

                        {/* Delete (FR-CAT-4) */}
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setCategoryToDelete(cat)}
                          title="Delete Category"
                          aria-label={`Delete ${cat.name}`}
                          style={{ color: 'var(--expense-accent)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
              maxWidth: '440px',
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
              <h3 style={{ fontSize: '1.125rem' }}>Add New Category</h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} style={{ padding: '1.25rem' }}>
              {formError && (
                <div
                  style={{
                    padding: '0.625rem 0.75rem',
                    backgroundColor: 'var(--expense-bg)',
                    color: 'var(--expense-text)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    marginBottom: '1rem',
                  }}
                >
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Category Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn text-sm"
                    onClick={() => setTypeInput('income')}
                    style={{
                      backgroundColor: typeInput === 'income' ? 'var(--income-accent)' : 'var(--bg-subtle)',
                      color: typeInput === 'income' ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    + Income
                  </button>
                  <button
                    type="button"
                    className="btn text-sm"
                    onClick={() => setTypeInput('expense')}
                    style={{
                      backgroundColor: typeInput === 'expense' ? 'var(--expense-accent)' : 'var(--bg-subtle)',
                      color: typeInput === 'expense' ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    - Expense
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-cat-name">
                  Category Name *
                </label>
                <input
                  id="new-cat-name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Server Hosting, Office Rent"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-sm"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Saving…' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Category Modal (FR-CAT-2) */}
      {editingCategory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
              maxWidth: '440px',
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
              <h3 style={{ fontSize: '1.125rem' }}>Rename Category</h3>
              <button className="btn-icon" onClick={() => setEditingCategory(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '1.25rem' }}>
              {formError && (
                <div
                  style={{
                    padding: '0.625rem 0.75rem',
                    backgroundColor: 'var(--expense-bg)',
                    color: 'var(--expense-text)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    marginBottom: '1rem',
                  }}
                >
                  {formError}
                </div>
              )}

              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Renaming this category will automatically update all existing historical transactions
                linked to it (FR-CAT-2).
              </p>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-cat-name">
                  Category Name *
                </label>
                <input
                  id="edit-cat-name"
                  type="text"
                  className="form-control"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => setEditingCategory(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-sm"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Updating…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog (FR-CAT-4) */}
      <ConfirmDialog
        isOpen={Boolean(categoryToDelete)}
        title="Delete Category"
        message={
          categoryToDelete?.usage_count > 0
            ? `Category '${categoryToDelete?.name}' cannot be deleted because it is assigned to ${categoryToDelete?.usage_count} transaction(s). Please deactivate it instead so it remains on historical records.`
            : `Are you sure you want to delete '${categoryToDelete?.name}'? This action cannot be undone.`
        }
        confirmLabel={categoryToDelete?.usage_count > 0 ? 'Cannot Delete' : 'Delete Category'}
        isLoading={deleteMutation.isPending}
        isDestructive={true}
        onCancel={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (categoryToDelete?.usage_count > 0) {
            setCategoryToDelete(null);
          } else {
            deleteMutation.mutate(categoryToDelete.id);
          }
        }}
      />
    </div>
  );
}
