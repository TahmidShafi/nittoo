import React from 'react';
import { Link } from 'react-router-dom';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Route-level error boundary placed inside Layout so a single page crash
 * renders a calm recovery card while header and navigation stay functional.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Route ErrorBoundary caught an error:', error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-8 shadow-xs max-w-lg mx-auto my-8 text-center space-y-4"
        >
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-neutral-900 tracking-tight">
              Something went wrong on this page
            </h1>
            <p className="text-sm text-neutral-600 leading-relaxed">
              An unexpected error interrupted this view. Your data is safe — you can retry loading this page or return to your dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="btn-press px-5 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#24563F] text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer"
            >
              Retry
            </button>
            <Link
              to="/dashboard"
              className="btn-press px-5 py-2.5 rounded-xl bg-white border border-neutral-200/80 hover:bg-neutral-50 text-neutral-700 text-xs sm:text-sm font-semibold transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
