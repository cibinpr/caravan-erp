import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Caravan UI ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <AlertCircle size={48} color="#e11d48" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', marginBottom: '1.5rem' }}>
            An unexpected error occurred while rendering this view. Your data is safe.
          </p>
          <button className="btn btn-primary" onClick={this.handleReload}>
            <RefreshCw size={16} /> Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
