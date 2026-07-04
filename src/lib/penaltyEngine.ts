import { supabase } from "./supabase";

export const evaluatePenalties = async (userId: string, challengeId: string) => {
  // 1. Fetch participant and challenge data
  const { data: participant } = await supabase
    .from("challenge_participants")
    .select("*, challenges(*)")
    .eq("user_id", userId)
    .eq("challenge_id", challengeId)
    .single();

  if (!participant || !participant.challenges) return;

  const challenge = participant.challenges;
  
  // If challenge hasn't started or is over, skip
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  if (todayStr < challenge.start_date || todayStr > challenge.end_date) return;

  const lastEval = new Date(participant.last_evaluated_date);
  const today = new Date(todayStr);
  
  // Calculate difference in days (ignoring time)
  const diffTime = Math.abs(today.getTime() - lastEval.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return; // Already evaluated today

  let newScore = participant.score;
  let newQuota = participant.temporary_quota;
  let newRank = participant.rank;

  // We need to check submissions for the missed days
  for (let i = 1; i <= diffDays; i++) {
    const checkDate = new Date(lastEval);
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = checkDate.toISOString().split("T")[0];

    if (dateStr === todayStr) continue; // Don't penalize today yet

    // Fetch total points for that specific past day
    const { data: submissions } = await supabase
      .from("submissions")
      .select("points_earned")
      .eq("user_id", userId)
      .eq("challenge_id", challengeId)
      .eq("solved_date", dateStr);

    const totalPoints = submissions?.reduce((acc, sub) => acc + sub.points_earned, 0) || 0;
    const target = newQuota || challenge.daily_target;

    if (totalPoints < target) {
      // Penalty applied!
      switch (challenge.penalty_mode) {
        case "minus_points":
          newScore -= challenge.penalty_amount;
          break;
        case "double_quota_next_day":
          newQuota = challenge.daily_target * challenge.penalty_amount; // penalty_amount acts as multiplier here
          break;
        case "rank_reduction":
          if (newRank === 'Diamond') newRank = 'Platinum';
          else if (newRank === 'Platinum') newRank = 'Gold';
          else if (newRank === 'Gold') newRank = 'Silver';
          else if (newRank === 'Silver') newRank = 'Bronze';
          break;
      }
    } else {
      // Met target, clear temporary quota if it was set
      if (newQuota) newQuota = null;
    }
  }

  // Update participant record
  await supabase
    .from("challenge_participants")
    .update({
      score: newScore,
      temporary_quota: newQuota,
      rank: newRank,
      last_evaluated_date: todayStr
    })
    .eq("id", participant.id);
};
