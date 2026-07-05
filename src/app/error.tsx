'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '2rem',
    }} className="animate-fade-in">
      {/* Icon */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--danger-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-glow-danger)',
      }}>
        <AlertTriangle size={40} color="var(--danger)" />
      </div>

      <h1 style={{
        margin: 0,
        marginBottom: '0.75rem',
        fontSize: '2rem',
      }}>
        <span style={{
          animation: 'glitch 2s ease-in-out infinite',
          display: 'inline-block',
        }}>
          Something went wrong
        </span>
      </h1>

      <p style={{
        color: 'var(--foreground-muted)',
        marginBottom: '2rem',
        maxWidth: '420px',
        fontSize: '0.9375rem',
      }}>
        We hit an unexpected error while processing your request. Don&apos;t worry — the issue has been logged.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={() => reset()} className="btn btn-primary">
          <RotateCcw size={16} />
          Try Again
        </button>
        <Link href="/" className="btn btn-secondary">
          <Home size={16} />
          Go Home
        </Link>
      </div>
    </div>
  );
}
