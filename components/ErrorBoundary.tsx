import React from 'react';

// ✅ FIX #9 HIGH: Add Error Boundary to prevent complete app crashes
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f5',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <h1 style={{ color: '#dc2626', marginBottom: '16px' }}>⚠️ Application Error</h1>
            <p style={{ color: '#666', marginBottom: '16px' }}>
              Something went wrong. Please try refreshing the page.
            </p>
            <details style={{ textAlign: 'left', marginBottom: '24px' }}>
              <summary style={{ cursor: 'pointer', color: '#0066cc' }}>Error Details</summary>
              <pre style={{
                background: '#f0f0f0',
                padding: '12px',
                borderRadius: '4px',
                overflow: 'auto',
                marginTop: '12px',
                fontSize: '12px'
              }}>
                {this.state.error?.toString()}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#0066cc',
                color: 'white',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
