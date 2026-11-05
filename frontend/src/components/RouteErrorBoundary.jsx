import { Component } from 'react';
import * as Sentry from '@sentry/react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCw } from 'lucide-react';
import Button from './ui/Button';

class RouteErrorBoundary extends Component {
  state = { hasError: false, requestId: '' };

  componentDidMount() {
    window.addEventListener('nova:request-error', this.handleRequestError);
  }

  componentWillUnmount() {
    window.removeEventListener('nova:request-error', this.handleRequestError);
  }

  handleRequestError = (event) => {
    this.setState({ requestId: event.detail?.requestId || '' });
  };

  componentDidCatch(error, info) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="app-page">
        <section className="page-container">
          <div className="empty-state" role="alert">
            <span className="empty-state-icon"><AlertTriangle size={22} aria-hidden="true" /></span>
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-1 max-w-sm text-sm text-muted">The page hit an unexpected error. Try again or return to your workspace.</p>
            {this.state.requestId && (
              <p className="mt-2 text-xs text-muted">Reference: <code>{this.state.requestId}</code></p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={() => this.setState({ hasError: false })}>
                <RotateCw size={16} aria-hidden="true" />
                Try again
              </Button>
              <Link to="/dashboard" className="ui-button button-secondary">Go to dashboard</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }
}

export default RouteErrorBoundary;
