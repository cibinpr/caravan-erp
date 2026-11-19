import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setCsrfToken } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      if (res.data.csrf_token) {
        setCsrfToken(res.data.csrf_token);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('caravan:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('caravan:unauthorized', handleUnauthorized);
  }, [checkAuth]);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      setUser(res.data.user);
      if (res.data.csrf_token) {
        setCsrfToken(res.data.csrf_token);
      }
      return res.data.user;
    } catch (err) {
      setError(err.message || 'Login failed.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  };

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'admin',
    isViewer: user?.role === 'viewer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
