import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  BookOpen,
  BarChart3,
  Tags,
  Users,
  ShieldCheck,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    { to: '/ledger', label: 'Ledger', icon: BookOpen },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    ...(isAdmin
      ? [
          { to: '/categories', label: 'Categories', icon: Tags },
          { to: '/users', label: 'Users', icon: Users },
          { to: '/audit-log', label: 'Audit Log', icon: ShieldCheck },
        ]
      : []),
  ];

  return (
    <div className="app-container">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={closeMobileMenu}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 35,
          }}
        />
      )}

      {/* Sidebar (Desktop + Mobile) */}
      <aside className={`app-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-logo">
            <Building2 size={24} color="var(--brand-primary)" />
            <span>Caravan</span>
          </div>
          <button
            className="btn-icon d-mobile-only"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Navigation"
            style={{ display: mobileMenuOpen ? 'block' : 'none' }}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <Icon className="nav-item-icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer User Info */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', truncate: true }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {user?.email}
              </div>
            </div>
            <span
              className={isAdmin ? 'badge-income' : 'badge-neutral'}
              style={{ textTransform: 'capitalize' }}
            >
              {user?.role || 'Viewer'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Sticky Header */}
        <header className="app-header">
          <div className="header-left">
            <button
              className="btn-icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Caravan Accounting ERP
            </span>
          </div>

          <div className="header-right">
            {/* Theme Toggle (UI-5) */}
            <button
              className="btn-icon"
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle color theme"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Logout Button (FR-AUTH-6) */}
            <button
              className="btn btn-secondary text-sm"
              onClick={handleLogout}
              title="Log out of application"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
