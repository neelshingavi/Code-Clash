import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function NotFound() {
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
      {/* Large 404 */}
      <div style={{
        fontSize: 'clamp(5rem, 15vw, 8rem)',
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: '-0.05em',
        marginBottom: '0.5rem',
        background: 'var(--gradient-primary)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        opacity: 0.8,
      }}>
        404
      </div>

      <h2 style={{
        margin: 0,
        marginBottom: '0.75rem',
        fontSize: '1.5rem',
      }}>
        Arena Not Found
      </h2>

      <p style={{
        color: 'var(--foreground-muted)',
        marginBottom: '2rem',
        maxWidth: '380px',
        fontSize: '0.9375rem',
      }}>
        This arena doesn&apos;t exist... yet. Maybe it was disbanded, or you followed a broken link.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Link href="/" className="btn btn-primary">
          <Home size={16} />
          Go Home
        </Link>
        <Link href="/challenges" className="btn btn-secondary">
          <Compass size={16} />
          Browse Arenas
        </Link>
      </div>
    </div>
  );
}
