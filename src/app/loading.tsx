export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '1.5rem',
    }}>
      {/* Animated logo */}
      <div style={{
        fontSize: '2.5rem',
        animation: 'float 2s ease-in-out infinite',
      }}>
        ⚔️
      </div>

      {/* Spinner */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '3px solid var(--surface-2)',
        borderTopColor: 'var(--primary)',
        animation: 'spin 0.8s linear infinite',
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        color: 'var(--foreground-muted)',
        fontSize: '0.9375rem',
        fontWeight: 500,
      }}>
        <span>Loading Arena</span>
        <span style={{ 
          display: 'inline-flex',
          gap: '2px',
        }}>
          <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0s' }}>.</span>
          <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0.2s' }}>.</span>
          <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0.4s' }}>.</span>
        </span>
      </div>

      {/* Skeleton preview */}
      <div style={{
        width: '100%',
        maxWidth: '600px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginTop: '1rem',
        opacity: 0.4,
      }}>
        <div className="skeleton skeleton-title" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  );
}
