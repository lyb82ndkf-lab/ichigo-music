import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'var(--text-active)', background: 'var(--bg-gradient-start)', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2>发生了一些错误 🍓</h2>
          <p style={{ color: '#ff3366', marginTop: 10 }}>{this.state.error && this.state.error.toString()}</p>
          <button 
            style={{ marginTop: 20, padding: '8px 16px', background: 'var(--text-active)', color: 'var(--bg-gradient-start)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
