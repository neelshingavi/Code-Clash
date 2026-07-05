import { createClient } from '@/lib/supabase/server';
import { PenaltyNotifier } from './PenaltyNotifier';

export async function PenaltyNotifierWrapper() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return <PenaltyNotifier userId={user.id} />;
  } catch {
    return null; // Not authenticated
  }
}
