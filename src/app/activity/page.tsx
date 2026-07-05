import { createClient } from '@/lib/supabase/server';
import { verifySession } from '@/data/challenges';
import { LiveFeed } from './live-feed';
import { Radio } from 'lucide-react';

export default async function ActivityPage() {
  await verifySession();
  const supabase = await createClient();

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*, public_profiles(username, avatar_url, leetcode_id)')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="animate-fade-in" style={{ maxWidth: "720px", margin: "0 auto" }}>
      <div className="section-header" style={{ marginBottom: "2rem" }}>
        <div className="section-title">
          <Radio size={22} color="var(--primary)" />
          <h1 style={{ margin: 0 }}>Activity Feed</h1>
          <div className="pulse-dot" style={{ marginLeft: "0.25rem" }} />
        </div>
        <span className="chip" style={{ color: "var(--success)" }}>
          <span className="pulse-dot" style={{ width: "6px", height: "6px" }} />
          Live
        </span>
      </div>
      <LiveFeed initialSubmissions={submissions || []} />
    </div>
  );
}
