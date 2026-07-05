'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { verifySession, getUserStats } from '@/data/challenges';
import { CreateChallengeSchema } from '@/lib/schemas';
import { fetchRecentSubmissions, fetchQuestionDifficulty } from './leetcode';
import { ratelimit } from '@/lib/ratelimit';

export async function createChallengeAction(prevState: any, formData: FormData) {
  const user = await verifySession();

  const parsed = CreateChallengeSchema.safeParse({
    name: formData.get('name'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    dailyTarget: Number(formData.get('dailyTarget')),
    easyPoints: Number(formData.get('easyPoints')),
    mediumPoints: Number(formData.get('mediumPoints')),
    hardPoints: Number(formData.get('hardPoints')),
    penaltyMode: formData.get('penaltyMode'),
    penaltyAmount: Number(formData.get('penaltyAmount')),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: challenge, error } = await supabase
    .from('challenges')
    .insert({
      name: parsed.data.name,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      daily_target: parsed.data.dailyTarget,
      easy_points: parsed.data.easyPoints,
      medium_points: parsed.data.mediumPoints,
      hard_points: parsed.data.hardPoints,
      penalty_mode: parsed.data.penaltyMode,
      penalty_amount: parsed.data.penaltyAmount,
      created_by: user.id
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  // The challenge creator automatically joins
  const { error: joinError } = await supabase
    .from('challenge_participants')
    .insert({
      challenge_id: challenge.id,
      user_id: user.id
    });

  if (joinError) {
    return { error: { _form: [joinError.message] } };
  }

  revalidatePath('/');
  redirect(`/challenges/${challenge.id}`);
}

export async function joinChallengeAction(challengeId: string) {
  const user = await verifySession();
  const supabase = await createClient();

  const { error } = await supabase
    .from('challenge_participants')
    .insert({
      challenge_id: challengeId,
      user_id: user.id
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/challenges/${challengeId}`);
  return { success: true };
}

export async function syncLeetcodeAction(challengeId: string, solvesToday: number, todayStr: string) {
  const user = await verifySession();
  const supabase = await createClient();

  const { error } = await supabase.rpc('sync_leetcode_solution', {
    p_challenge_id: challengeId,
    p_solves_today: solvesToday,
    p_today_str: todayStr
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/challenges/${challengeId}`);
  return { success: true };
}

export async function autoSyncSubmissionsAction() {
  const user = await verifySession();
  const supabase = await createClient();

  // Rate Limiting Check
  const { success } = await ratelimit.limit(user.id);
  if (!success) {
    return { error: 'Rate limit exceeded. Please try again later.' };
  }

  // 1. Get user stats (leetcode_id)
  const stats = await getUserStats(user.id);
  if (!stats?.leetcode_id) {
    return { error: 'No LeetCode ID linked to your profile.' };
  }

  // Safely extract username in case they entered a full URL
  let leetcodeUsername = stats.leetcode_id.trim();
  if (leetcodeUsername.includes('leetcode.com')) {
    const parts = leetcodeUsername.split('/').filter(Boolean);
    leetcodeUsername = parts[parts.length - 1];
    // If URL was exactly leetcode.com/u/username
    if (parts[parts.length - 2] === 'u') {
       leetcodeUsername = parts[parts.length - 1];
    }
  }
  leetcodeUsername = leetcodeUsername.replace('@', '').trim();

  // 2. Fetch recent submissions from LeetCode
  const recentSubs = await fetchRecentSubmissions(leetcodeUsername, 15);
  if (!recentSubs || recentSubs.length === 0) {
    return { success: true, count: 0, message: `No recent submissions found on LeetCode for ${leetcodeUsername}.` };
  }

  // 3. Find active challenges for the user
  const { data: activeParticipants } = await supabase
    .from('challenge_participants')
    .select('challenge_id, challenges!inner(end_date)')
    .eq('user_id', user.id)
    .gte('challenges.end_date', new Date().toISOString().split('T')[0]);

  // 4. Fetch user's existing submissions to prevent duplicates - REMOVED.
  // We now rely on the database's ON CONFLICT DO NOTHING constraint to handle deduplication seamlessly.
  
  let newSyncCount = 0;

  for (const sub of recentSubs) {
    const url = `https://leetcode.com/problems/${sub.titleSlug}/`;
    
    // Deterministic UTC parsing. The LeetCode epoch timestamp is converted into 
    // a YYYY-MM-DD string exactly as it exists in UTC.
    // The calendar component is also updated to parse this epoch in UTC, guaranteeing a perfect match.
    const solvedDate = new Date(Number(sub.timestamp) * 1000).toISOString().split('T')[0];
      
    const difficulty = await fetchQuestionDifficulty(sub.titleSlug);
    let inserted = false;

    if (activeParticipants && activeParticipants.length > 0) {
      for (const participant of activeParticipants) {
        const { data: wasInserted, error } = await supabase.rpc('submit_solution', {
          p_challenge_id: participant.challenge_id,
          p_problem_name: sub.title,
          p_problem_url: url,
          p_difficulty: difficulty,
          p_verified: true,
          p_solved_date: solvedDate
        });
        if (error) {
           console.error('Failed to sync to challenge:', error.message);
        } else if (wasInserted) {
           inserted = true;
           
           // PRODUCTION-GRADE CHECK:
           const { data: verifyData } = await supabase.from('submissions')
             .select('solved_date')
             .eq('user_id', user.id)
             .eq('problem_url', url)
             .eq('challenge_id', participant.challenge_id)
             .single();
             
           if (verifyData && verifyData.solved_date !== solvedDate) {
             throw new Error("DATABASE_MIGRATION_REQUIRED: The database ignored the historical solved_date because the submit_solution RPC is outdated. Please run the SQL migration provided earlier in the Supabase Dashboard to update the RPC signature.");
           }
        }
      }
    } else {
      // No active challenges, just log it personally
      // We still rely on ON CONFLICT DO NOTHING via supabase insert modifiers if it already exists
      const { data, error } = await supabase.from('submissions').insert({
        user_id: user.id,
        problem_name: sub.title,
        problem_url: url,
        difficulty: difficulty,
        points_earned: 1,
        verified: true,
        solved_date: solvedDate
      })
      .select('id')
      .maybeSingle();

      if (error && error.code !== '23505') { // 23505 is unique violation code
         console.error('Failed to personal log:', error.message);
      } else if (data) {
         inserted = true;
      }
    }
    
    if (inserted) {
      newSyncCount++;
    }
    
    // Slight delay to prevent hitting LeetCode's rate limits when fetching difficulty
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  revalidatePath('/');
  revalidatePath('/activity');
  if (activeParticipants) {
    for (const participant of activeParticipants) {
      revalidatePath(`/challenges/${participant.challenge_id}`);
    }
  }
  
  return { success: true, count: newSyncCount, message: `Synced ${newSyncCount} new problems!` };
}
