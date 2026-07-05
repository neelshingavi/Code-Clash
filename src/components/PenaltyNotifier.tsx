'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

export function PenaltyNotifier({ userId }: { userId: string }) {
  const { showToast } = useToast();

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel('penalty-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'penalty_events', filter: `user_id=eq.${userId}` },
        (payload) => {
          showToast(
            `You received a ${payload.new.penalty_amount}pt penalty (${payload.new.penalty_type}) for missing your daily target.`,
            'error'
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, showToast]);

  return null;
}
