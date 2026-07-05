import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const verifySession = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && !error.message?.includes('Auth session missing')) {
    console.error('DAL Error - verifySession:', error.message);
  }
  if (!user) redirect('/auth');
  return user;
});

export const getChallengeWithLeaderboard = cache(async (challengeId: string) => {
  const user = await verifySession();
  const supabase = await createClient();

  const [challengeResult, participantsResult] = await Promise.all([
    supabase.from('challenges').select('*').eq('id', challengeId).single(),
    supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('score', { ascending: false })
      .limit(50),
  ]);

  if (challengeResult.error && challengeResult.error.code !== 'PGRST116') {
    console.error('DAL Error - fetch challenge:', challengeResult.error.message);
  }
  if (participantsResult.error) {
    console.error('DAL Error - fetch participants:', participantsResult.error.message);
  }

  const challenge = challengeResult.data;
  const participants = participantsResult.data;

  if (!challenge) {
    return { user, challenge: null, participants: [] };
  }

  // Enrich with public profiles
  let enrichedParts = participants || [];
  if (participants && participants.length > 0) {
    const userIds = participants.map((p: any) => p.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("public_profiles")
      .select("id, username, leetcode_id, avatar_url")
      .in("id", userIds);
      
    if (profilesError) {
      console.error('DAL Error - fetch profiles:', profilesError.message);
    }
    
    enrichedParts = participants.map((p: any) => ({
      ...p,
      users: profiles?.find((prof: any) => prof.id === p.user_id) || null
    }));
  }

  return { user, challenge, participants: enrichedParts };
});

export const getUserStats = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data: userData, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    console.error('DAL Error - getUserStats:', error.message);
  }
  return userData || { total_score: 0, current_streak: 0 };
});

export const getMyActiveChallenges = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data: myChallenges, error } = await supabase
    .from('challenge_participants')
    .select('*, challenges(*)')
    .eq('user_id', userId)
    .limit(50);
    
  if (error) {
    console.error('DAL Error - getMyActiveChallenges:', error.message);
  }
  return myChallenges || [];
});
