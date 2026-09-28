import React from 'react';
import { ErrorPage } from '../pages/ErrorPage';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ErrorPage error={this.state.error} onRetry={this.reset} fullScreen={this.props.fullScreen} />;
    }
    return this.props.children;
  }
}