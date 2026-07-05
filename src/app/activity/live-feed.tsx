'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

function getAvatarGradient(name: string) {
  const gradients = [
    'linear-gradient(135deg, #818cf8, #c084fc)',
    'linear-gradient(135deg, #f472b6, #fb923c)',
    'linear-gradient(135deg, #34d399, #2dd4bf)',
    'linear-gradient(135deg, #60a5fa, #818cf8)',
    'linear-gradient(135deg, #fbbf24, #f59e0b)',
    'linear-gradient(135deg, #f87171, #fb923c)',
  ];
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

function getTimeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDifficultyGlow(difficulty: string) {
  if (difficulty === 'easy') return { color: 'var(--success)', bg: 'var(--success-muted)' };
  if (difficulty === 'medium') return { color: 'var(--warning)', bg: 'var(--warning-muted)' };
  if (difficulty === 'hard') return { color: 'var(--danger)', bg: 'var(--danger-muted)' };
  return { color: 'var(--foreground-muted)', bg: 'var(--surface-1)' };
}

export function LiveFeed({ initialSubmissions }: { initialSubmissions: any[] }) {
  const [submissions, setSubmissions] = useState(initialSubmissions);

  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('public:submissions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions' },
        async (payload) => {
          const { data: profile } = await supabase
            .from('public_profiles')
            .select('username, avatar_url, leetcode_id')
            .eq('id', payload.new.user_id)
            .single();

          const enriched = { ...payload.new, public_profiles: profile };
          setSubmissions((current) => [enriched, ...current].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (submissions.length === 0) {
    return (
      <div className="card glass">
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          <div className="empty-state-title">No Activity Yet</div>
          <p className="empty-state-description">
            Submissions will appear here in real-time as challengers solve problems.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Timeline line */}
      <div style={{
        position: 'absolute',
        left: '19px',
        top: '24px',
        bottom: '24px',
        width: '2px',
        background: 'linear-gradient(to bottom, var(--surface-border), transparent)',
        zIndex: 0,
      }} />

      <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', position: 'relative' }}>
        {submissions.map((sub: any) => {
          const username = sub.public_profiles?.username || 'Unknown';
          const diffStyle = getDifficultyGlow(sub.difficulty);
          
          return (
            <div key={sub.id} style={{
              display: 'flex',
              gap: '1rem',
              padding: '0.875rem 0',
              position: 'relative',
            }}>
              {/* Timeline dot + Avatar */}
              <div style={{ flexShrink: 0, zIndex: 1 }}>
                <div className="avatar-sm" style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-full)',
                  background: getAvatarGradient(username),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: 'white',
                  border: '3px solid var(--background)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  {username.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Content */}
              <div className="card glass" style={{
                flex: 1,
                padding: '1rem 1.25rem',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    marginBottom: '0.25rem',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{username}</span>
                    <span style={{ color: 'var(--foreground-subtle)', fontSize: '0.8125rem' }}>solved</span>
                    <a
                      href={sub.problem_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: 'var(--primary)',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        textDecoration: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '200px',
                      }}
                    >
                      {sub.problem_name}
                    </a>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.75rem',
                  }}>
                    <span
                      style={{ color: 'var(--foreground-subtle)' }}
                      title={new Date(sub.created_at).toLocaleString()}
                    >
                      {getTimeAgo(sub.created_at)}
                    </span>
                    {sub.verified ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
                        <ShieldCheck size={13} />
                        Verified
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--warning)' }}>
                        <AlertCircle size={13} />
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: badge + points */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  <span className={`badge badge-${sub.difficulty}`}>{sub.difficulty}</span>
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: 800,
                    color: diffStyle.color,
                    minWidth: '32px',
                    textAlign: 'right',
                  }}>
                    +{sub.points_earned}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
