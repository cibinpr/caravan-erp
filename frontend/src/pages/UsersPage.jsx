import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  Power,
  Shield,
  UserCheck,
  AlertCircle,
  X,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { api } from '../api/client';
import { formatDate, formatDateTime } from '../utils/formatters';
import { SkeletonTable } from '../components/Skeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);

  // Form states
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState('viewer');
  const [passwordInput, setPasswordInput] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  // Query: Get Users List (FR-USR-1)
  const {
    data: users = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data || [];
    },
  });

  // Mutation: Create User (FR-USR-1, FR-USR-4)
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/users', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      setShowAddModal(false);
      resetForm();
    },
    onError: (err) => {
      if (err.fields) setFormErrors(err.fields);
      setGeneralError(err.message || 'Failed to create user.');
    },
  });

  // Mutation: Update User (FR-USR-1, FR-USR-3)
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/users/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      setEditingUser(null);
      resetForm();
    },
    onError: (err) => {
      if (err.fields) setFormErrors(err.fields);
      setGeneralError(err.message || 'Failed to update user.');
    },
  });

  // Mutation: Toggle Active (FR-USR-1, FR-USR-3)
  const toggleActiveMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/users/${id}/active`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
    onError: (err) => {
      alert(err.message || 'Failed to toggle user status.');
    },
  });

  // Mutation: Reset Password (FR-USR-2)
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }) => {
      const res = await api.post(`/users/${id}/reset-password`, { password });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      setResettingUser(null);
      setPasswordInput('');
      alert('Password reset successfully.');
    },
    onError: (err) => {
      alert(err.message || 'Failed to reset password.');
    },
  });

  // Mutation: Delete User
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      setUserToDelete(null);
    },
    onError: (err) => {
      alert(err.message || 'Failed to delete user.');
      setUserToDelete(null);
    },
  });

  const resetForm = () => {
    setNameInput('');
    setEmailInput('');
    setRoleInput('viewer');
    setPasswordInput('');
    setFormErrors({});
    setGeneralError('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (u) => {
    resetForm();
    setEditingUser(u);
    setNameInput(u.name);
    setEmailInput(u.email);
    setRoleInput(u.role);
  };

  const handleOpenReset = (u) => {
    setResettingUser(u);
    setPasswordInput('');
  };

  const handleSaveAdd = (e) => {
    e.preventDefault();
    setFormErrors({});
    setGeneralError('');
    createMutation.mutate({
      name: nameInput.trim(),
      email: emailInput.trim(),
      role: roleInput,
      password: passwordInput,
    });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setFormErrors({});
    setGeneralError('');
    updateMutation.mutate({
      id: editingUser.id,
      payload: {
        name: nameInput.trim(),
        email: emailInput.trim(),
        role: roleInput,
      },
    });
  };

  const handleSaveReset = (e) => {
    e.preventDefault();
    if (passwordInput.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    resetPasswordMutation.mutate({
      id: resettingUser.id,
      password: passwordInput,
    });
  };

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
          <h1 style={{ fontSize: '1.5rem' }}>User & Access Management</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Admin and Viewer accounts, permissions, and security controls (FR-USR-1 to FR-USR-4)
          </p>
        </div>

        <button className="btn btn-primary text-sm" onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>New User</span>
        </button>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : isError ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <AlertCircle size={32} color="var(--expense-accent)" style={{ marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Failed to load users.</p>
          <button className="btn btn-secondary text-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="table-responsive table-stacked">
          <table className="app-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === 'admin';
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id}>
                    <td data-label="User">
                      <div style={{ fontWeight: 600 }}>
                        {u.name} {isSelf && <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)' }}>(You)</span>}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td data-label="Role">
                      <span className={isAdmin ? 'badge-income' : 'badge-neutral'} style={{ textTransform: 'capitalize' }}>
                        {isAdmin ? <Shield size={12} /> : <UserCheck size={12} />}
                        {u.role}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={u.is_active ? 'badge-income' : 'badge-neutral'}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td data-label="Last Login" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}
                    </td>
                    <td data-label="Created" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {formatDate(u.created_at)}
                    </td>
                    <td data-label="Actions" className="text-right">
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        {/* Edit User */}
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleOpenEdit(u)}
                          title="Edit User"
                          aria-label={`Edit ${u.name}`}
                        >
                          <Edit2 size={16} />
                        </button>

                        {/* Reset Password */}
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleOpenReset(u)}
                          title="Reset Password"
                          aria-label={`Reset password for ${u.name}`}
                        >
                          <KeyRound size={16} />
                        </button>

                        {/* Toggle Active / Inactive */}
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => toggleActiveMutation.mutate(u.id)}
                          title={u.is_active ? 'Deactivate User' : 'Activate User'}
                          aria-label={u.is_active ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                          disabled={isSelf}
                        >
                          <Power size={16} color={u.is_active ? 'var(--income-accent)' : 'var(--text-muted)'} />
                        </button>

                        {/* Delete User */}
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setUserToDelete(u)}
                          title="Delete User"
                          aria-label={`Delete ${u.name}`}
                          style={{ color: 'var(--expense-accent)' }}
                          disabled={isSelf}
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

      {/* Add User Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
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
                padding: '1.25rem',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ fontSize: '1.125rem' }}>Create User Account</h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} style={{ padding: '1.25rem' }}>
              {generalError && (
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
                  {generalError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="user-name">Full Name *</label>
                <input
                  id="user-name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ramesh Patel"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                />
                {formErrors.name && <span className="form-error">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="user-email">Email Address *</label>
                <input
                  id="user-email"
                  type="email"
                  className="form-control"
                  placeholder="ramesh@caravan.local"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
                {formErrors.email && <span className="form-error">{formErrors.email}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">System Role *</label>
                <select
                  className="form-control"
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="user-password">Initial Password * (min 8 chars)</label>
                <input
                  id="user-password"
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
                {formErrors.password && <span className="form-error">{formErrors.password}</span>}
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
                  {createMutation.isPending ? 'Saving…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
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
                padding: '1.25rem',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ fontSize: '1.125rem' }}>Edit User Profile</h3>
              <button className="btn-icon" onClick={() => setEditingUser(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '1.25rem' }}>
              {generalError && (
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
                  {generalError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                />
                {formErrors.name && <span className="form-error">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-control"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
                {formErrors.email && <span className="form-error">{formErrors.email}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">System Role *</label>
                <select
                  className="form-control"
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => setEditingUser(null)}
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

      {/* Reset Password Modal */}
      {resettingUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
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
              maxWidth: '420px',
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
              <h3 style={{ fontSize: '1.125rem' }}>Reset Password</h3>
              <button className="btn-icon" onClick={() => setResettingUser(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveReset} style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Set a new password for <strong>{resettingUser.name}</strong> ({resettingUser.email}).
              </p>

              <div className="form-group">
                <label className="form-label">New Password * (min 8 chars)</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => setResettingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-sm"
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? 'Saving…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(userToDelete)}
        title="Delete User"
        message={
          userToDelete && (
            <div>
              <p style={{ marginBottom: '0.5rem' }}>
                Are you sure you want to delete the user account for <strong>{userToDelete.name}</strong> ({userToDelete.email})?
              </p>
              {userToDelete.transactions_count > 0 && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--expense-accent)' }}>
                  ⚠️ This user has created {userToDelete.transactions_count} transaction record(s). Deleting them directly is blocked to protect historical audit integrity. Deactivate the user instead.
                </p>
              )}
            </div>
          )
        }
        confirmLabel="Delete User"
        isLoading={deleteMutation.isPending}
        isDestructive={true}
        onCancel={() => setUserToDelete(null)}
        onConfirm={() => {
          if (userToDelete) {
            deleteMutation.mutate(userToDelete.id);
          }
        }}
      />
    </div>
  );
}
