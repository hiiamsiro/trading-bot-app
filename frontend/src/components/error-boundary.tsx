'use client';

/**
 * Global React Error Boundary.
 *
 * Catches any unhandled error thrown during rendering in the component tree
 * below this boundary.  The error is:
 *   1. Logged to the structured error logger (sent to backend / console)
 *   2. Displayed as a minimal user-safe fallback UI
 *
 * Usage:
 *   Place <ErrorBoundary> inside <Providers> in layout.tsx so it wraps
 *   every page.  You can also drop it inside individual route segments for
 *   granular recovery (e.g. keep the sidebar alive when the chart crashes).
 *
 * Next.js App Router also automatically picks up app/error.tsx files at each
 * route level as an additional fallback layer.
 */

import { Component, ReactNode } from 'react';
import { errorLogger, ErrorLogContext } from '@/lib/error-logger';

interface Props {
  children: ReactNode;
  /** Optional fallback UI to render after the error is caught. */
  fallback?: ReactNode;
  /** Callback invoked with the error before rendering the fallback. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const ctx: ErrorLogContext = {
      category: 'frontend',
      componentStack: info.componentStack,
      // Fall back to the error boundary's location — usePathname is unavailable here
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    errorLogger.error(error.message, ctx);
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <DefaultErrorFallback
            message={this.state.error?.message ?? 'An unexpected error occurred'}
          />
        )
      );
    }

    return this.props.children;
  }
}

/** Minimal, non-interactive fallback UI that is always safe to render. */
function DefaultErrorFallback({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '12px',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        color: '#e11d48',
        background: '#fff7f7',
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#e11d48"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Something went wrong</p>
      <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, maxWidth: '400px', textAlign: 'center' }}>
        {message}
      </p>
      <button
        onClick={() => (window.location.href = '/')}
        style={{
          marginTop: '8px',
          padding: '8px 16px',
          background: '#e11d48',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
