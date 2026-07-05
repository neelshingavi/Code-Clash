import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { verifySession } from './challenges';

export type CalendarDayRecord = {
  date: string;
  count: number;
  points: number;
  problems: {
    name: string;
    url: string;
    difficulty: string;
    points: number;
  }[];
};

export const getUserSubmissionsHistory = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('problem_name, problem_url, difficulty, points_earned, solved_date')
    .eq('user_id', userId)
    .order('solved_date', { ascending: false });

  if (error) {
    console.error('Failed to fetch user submissions history:', error.message);
    return [];
  }

  // Group by date
  const grouped: Record<string, CalendarDayRecord> = {};

  for (const sub of submissions || []) {
    const dateStr = sub.solved_date; // It's already 'YYYY-MM-DD' from Supabase DATE type
    
    if (!grouped[dateStr]) {
      grouped[dateStr] = {
        date: dateStr,
        count: 0,
        points: 0,
        problems: []
      };
    }
    
    // De-duplicate if the same problem was synced for multiple active challenges
    // Since we just want unique problems for the calendar view
    const isDuplicate = grouped[dateStr].problems.some(p => p.url === sub.problem_url);
    if (!isDuplicate) {
      grouped[dateStr].count += 1;
      // We only sum points for unique problems solved on that day
      grouped[dateStr].points += sub.points_earned;
      grouped[dateStr].problems.push({
        name: sub.problem_name,
        url: sub.problem_url,
        difficulty: sub.difficulty,
        points: sub.points_earned
      });
    }
  }

  // Convert to array and sort by date descending
  return Object.values(grouped).sort((a, b) => (a.date < b.date ? 1 : -1));
});
