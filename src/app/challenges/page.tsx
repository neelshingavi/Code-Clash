import { createClient } from '@/lib/supabase/server';
import { verifySession } from '@/data/challenges';
import Link from 'next/link';
import { Plus, Calendar, Target, AlertTriangle, Users, ChevronLeft, ChevronRight, Compass } from 'lucide-react';

function getChallengeStatus(start: string, end: string) {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (now < startDate) return { label: 'Upcoming', color: 'var(--info)', bg: 'var(--info-muted)', borderColor: 'rgba(96, 165, 250, 0.3)' };
  if (now > endDate) return { label: 'Ended', color: 'var(--foreground-subtle)', bg: 'rgba(107, 114, 128, 0.1)', borderColor: 'rgba(107, 114, 128, 0.2)' };
  return { label: 'Active', color: 'var(--success)', bg: 'var(--success-muted)', borderColor: 'rgba(52, 211, 153, 0.3)' };
}

export default async function ChallengesDiscoveryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await verifySession();
  const supabase = await createClient();
  
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const pageSize = 10;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data: challenges, count } = await supabase
    .from('challenges')
    .select('id, name, start_date, end_date, penalty_mode, daily_target, users(username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(start, end);

  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <div className="section-title">
          <Compass size={24} color="var(--primary)" />
          <h1 style={{ margin: 0 }}>Discover Challenges</h1>
        </div>
        <Link href="/challenges/create" className="btn btn-primary">
          <Plus size={16} />
          Create New
        </Link>
      </div>

      <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {challenges?.length === 0 ? (
          <div className="card glass">
            <div className="empty-state">
              <div className="empty-state-icon">🏟️</div>
              <div className="empty-state-title">No Challenges Yet</div>
              <p className="empty-state-description">Be the first to create a challenge and start competing!</p>
              <Link href="/challenges/create" className="btn btn-primary">
                <Plus size={16} />
                Create Challenge
              </Link>
            </div>
          </div>
        ) : (
          challenges?.map((c: any) => {
            const status = getChallengeStatus(c.start_date, c.end_date);
            return (
              <div key={c.id} className="card glass card-interactive card-glow" style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: '1.25rem',
                borderLeft: `3px solid ${status.borderColor}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    marginBottom: '0.625rem',
                    flexWrap: 'wrap',
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.0625rem' }}>{c.name}</h3>
                    <span className="badge" style={{
                      background: status.bg,
                      color: status.color,
                      border: `1px solid ${status.borderColor}`,
                    }}>
                      {status.label}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    fontSize: '0.8125rem',
                    color: 'var(--foreground-muted)',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Users size={13} style={{ opacity: 0.6 }} />
                      {c.users?.username || 'Unknown'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Calendar size={13} style={{ opacity: 0.6 }} />
                      {new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginTop: '0.625rem',
                    flexWrap: 'wrap',
                  }}>
                    <span className="chip">
                      <Target size={12} />
                      {c.daily_target} pts/day
                    </span>
                    <span className="chip">
                      <AlertTriangle size={12} />
                      {c.penalty_mode.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <Link href={`/challenges/${c.id}`} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                  Enter Arena
                </Link>
              </div>
            );
          })
        )}
      </div>

      {/* Premium Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '2.5rem',
        }}>
          {page > 1 && (
            <Link href={`/challenges?page=${page - 1}`} className="btn btn-ghost btn-sm btn-icon">
              <ChevronLeft size={18} />
            </Link>
          )}
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/challenges?page=${p}`}
              className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                minWidth: '36px',
                padding: '0.375rem',
              }}
            >
              {p}
            </Link>
          ))}

          {page < totalPages && (
            <Link href={`/challenges?page=${page + 1}`} className="btn btn-ghost btn-sm btn-icon">
              <ChevronRight size={18} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
