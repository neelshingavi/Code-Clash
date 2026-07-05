"use client";

import { useEffect, useState } from "react";
import { useTransition } from "react";
import { useRouter } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { fetchLeetcodeCalendar } from "@/actions/leetcode";
import { joinChallengeAction, syncLeetcodeAction } from "@/actions/challenges";
import { useToast } from "@/components/ui/Toast";
import { ShieldAlert, Trophy, CalendarDays, CheckCircle2, XCircle, RefreshCw, Skull, Copy, Clock, Target, Zap } from "lucide-react";

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

function getRankDisplay(index: number) {
  if (index === 0) return { medal: "🥇", gradient: "var(--gradient-gold)", glow: "rgba(251, 191, 36, 0.15)" };
  if (index === 1) return { medal: "🥈", gradient: "var(--gradient-silver)", glow: "rgba(209, 213, 219, 0.1)" };
  if (index === 2) return { medal: "🥉", gradient: "var(--gradient-bronze)", glow: "rgba(217, 119, 6, 0.1)" };
  return { medal: `#${index + 1}`, gradient: "none", glow: "transparent" };
}

function getTimeRemaining(endDate: string) {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

export default function LiveArenaClient({
  challengeId,
  initialChallenge,
  initialParticipants,
  currentUser
}: {
  challengeId: string;
  initialChallenge: any;
  initialParticipants: any[];
  currentUser: any;
}) {
  const [challenge] = useState<any>(initialChallenge);
  const [participants, setParticipants] = useState<any[]>(initialParticipants);
  const [syncing, setSyncing] = useState(false);
  const [isPendingJoin, startJoin] = useTransition();
  const [isPendingSync, startSync] = useTransition();
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  const { showToast } = useToast();
  const router = useRouter();

  const fetchLeaderboard = async () => {
    const supabase = createClient();
    const { data: parts } = await supabase
      .from("challenge_participants")
      .select("*")
      .eq("challenge_id", challengeId)
      .order("score", { ascending: false });
    
    if (parts && parts.length > 0) {
      const userIds = parts.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, username, leetcode_id, avatar_url")
        .in("id", userIds);
      
      const enrichedParts = parts.map(p => ({
        ...p,
        users: profiles?.find(prof => prof.id === p.user_id) || null
      }));
      setParticipants(enrichedParts);
    } else {
      setParticipants([]);
    }
  };

  const fetchCalendar = async (userId: string, ch: any) => {
    const supabase = createClient();
    const { data: subs } = await supabase
      .from("submissions")
      .select("points_earned, solved_date")
      .eq("user_id", userId)
      .eq("challenge_id", challengeId);
    
    if (!ch) return;
    
    const start = new Date(ch.start_date);
    const end = new Date(ch.end_date);
    const days = [];
    let curr = new Date(start);
    
    while (curr <= end) {
      const dateStr = curr.toISOString().split("T")[0];
      const dayPoints = subs?.filter(s => s.solved_date === dateStr).reduce((a, b) => a + b.points_earned, 0) || 0;
      days.push({
        date: dateStr,
        passed: dayPoints >= ch.daily_target,
        points: dayPoints
      });
      curr.setDate(curr.getDate() + 1);
    }
    setCalendarDays(days);
  };

  useEffect(() => {
    fetchCalendar(currentUser.id, challenge);

    const supabase = createClient();
    const subscription = supabase
      .channel(`challenge-${challengeId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'challenge_participants', filter: `challenge_id=eq.${challengeId}` },
        (payload) => {
          fetchLeaderboard();
          fetchCalendar(currentUser.id, challenge);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [challengeId, currentUser.id, challenge]);

  const handleJoin = () => {
    startJoin(async () => {
      const result = await joinChallengeAction(challengeId);
      if (result.error) {
        showToast(result.error, "error");
      }
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast("Invite link copied!", "success");
  };

  const handleSync = async () => {
    const myParticipant = participants.find(p => p.user_id === currentUser?.id);
    if (!myParticipant || !myParticipant.users?.leetcode_id) {
      showToast("LeetCode ID not found. Update your profile.", "error");
      return;
    }
    
    setSyncing(true);
    showToast("Syncing with LeetCode API...", "info");

    try {
      const calendar = await fetchLeetcodeCalendar(myParticipant.users.leetcode_id);
      const today = new Date();
      const utcMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const timestampStr = Math.floor(utcMidnight.getTime() / 1000).toString();
      const solvesToday = calendar[timestampStr] || 0;
      
      if (solvesToday === 0) {
        showToast("No new submissions found on LeetCode for today (UTC).", "info");
        setSyncing(false);
        return;
      }

      const todayStr = utcMidnight.toISOString().split("T")[0];

      startSync(async () => {
        const result = await syncLeetcodeAction(challengeId, solvesToday, todayStr);
        if (result.error) {
          showToast(result.error, "error");
        } else {
          showToast(`Sync complete! Your LeetCode calendar has been securely imported.`, "success");
        }
      });
    } catch (error: any) {
      showToast(error.message || "Failed to sync with LeetCode.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const myParticipant = participants.find(p => p.user_id === currentUser?.id);
  const isParticipant = !!myParticipant;

  // --- JOIN VIEW ---
  if (!isParticipant) {
    return (
      <div className="animate-fade-in" style={{
        maxWidth: "560px",
        margin: "3rem auto",
        textAlign: "center",
      }}>
        {/* Animated shield */}
        <div className="animate-float" style={{
          width: "80px",
          height: "80px",
          borderRadius: "var(--radius-xl)",
          background: "var(--primary-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem",
          boxShadow: "var(--shadow-glow-primary)",
        }}>
          <ShieldAlert size={40} color="var(--primary)" />
        </div>

        <h1 style={{ margin: 0, marginBottom: "0.5rem" }}>
          <span className="text-gradient text-glow">{challenge.name}</span>
        </h1>
        <p style={{ color: "var(--foreground-muted)", fontSize: "1.0625rem", marginBottom: "2rem" }}>
          You have been invited to enter the Arena
        </p>

        {/* Rules cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.75rem",
          marginBottom: "2rem",
        }}>
          <div className="card glass" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
            <Target size={22} color="var(--success)" style={{ marginBottom: "0.5rem" }} />
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
              Daily Target
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--foreground)" }}>
              {challenge.daily_target} pts
            </div>
          </div>

          <div className="card glass" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
            <Skull size={22} color="var(--danger)" style={{ marginBottom: "0.5rem" }} />
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
              Penalty
            </div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--foreground)" }}>
              {challenge.penalty_mode.replace(/_/g, ' ')}
            </div>
          </div>

          <div className="card glass" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
            <CalendarDays size={22} color="var(--info)" style={{ marginBottom: "0.5rem" }} />
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
              Duration
            </div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--foreground)" }}>
              {new Date(challenge.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(challenge.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        <button
          onClick={handleJoin}
          className="btn btn-primary btn-lg"
          style={{ width: "100%", fontSize: "1.0625rem" }}
          disabled={isPendingJoin}
        >
          {isPendingJoin ? "Entering Arena..." : "⚔️ Accept Challenge"}
        </button>
      </div>
    );
  }

  // --- ARENA VIEW ---
  return (
    <div className="animate-fade-in">
      {/* Arena Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 style={{
          margin: 0,
          marginBottom: "0.5rem",
          fontSize: "clamp(2rem, 5vw, 3rem)",
        }}>
          <span className="text-gradient text-glow">{challenge.name}</span>
        </h1>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}>
          <span className="chip">
            <CalendarDays size={12} />
            {new Date(challenge.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(challenge.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="chip" style={{ color: "var(--warning)", borderColor: "rgba(251, 191, 36, 0.2)" }}>
            <Clock size={12} />
            {getTimeRemaining(challenge.end_date)}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={handleSync}
            className="btn btn-primary"
            disabled={syncing || isPendingSync}
          >
            <RefreshCw size={16} className={syncing || isPendingSync ? "spin" : ""} />
            {syncing || isPendingSync ? "Syncing..." : "Sync LeetCode"}
          </button>
          <button onClick={handleCopyLink} className="btn btn-secondary">
            <Copy size={16} />
            Copy Invite
          </button>
        </div>
      </div>

      {/* Penalty Alert */}
      {myParticipant.temporary_quota && (
        <div style={{
          padding: "1.25rem 1.5rem",
          background: "var(--danger-muted)",
          borderRadius: "var(--radius-lg)",
          marginBottom: "2rem",
          border: "1px solid rgba(248, 113, 113, 0.2)",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          animation: "glow-pulse 2s ease-in-out infinite",
          boxShadow: "var(--shadow-glow-danger)",
        }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "var(--radius-md)",
            background: "rgba(248, 113, 113, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <Skull size={24} color="var(--danger)" />
          </div>
          <div>
            <div style={{ fontWeight: 800, color: "var(--danger)", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.125rem" }}>
              Penalty Active
            </div>
            <p style={{ margin: 0, color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
              You failed to meet your target. Today&apos;s quota is <strong style={{ color: "var(--foreground)" }}>{myParticipant.temporary_quota} points</strong>.
            </p>
          </div>
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: "1.5rem",
        alignItems: "start",
      }}>
        {/* Leaderboard */}
        <div>
          <div className="section-header" style={{ marginBottom: "1.25rem" }}>
            <div className="section-title">
              <Trophy size={20} color="var(--warning)" />
              <h2 style={{ margin: 0 }}>Leaderboard</h2>
              <div className="pulse-dot" style={{ marginLeft: "0.375rem" }} />
            </div>
            <span className="chip">
              <ShieldAlert size={12} />
              {challenge.penalty_mode.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="card glass" style={{ padding: 0, overflow: "hidden" }}>
            {participants.map((p, index) => {
              const rankInfo = getRankDisplay(index);
              const isMe = p.user_id === currentUser?.id;
              const username = p.users?.username || "Unknown";

              return (
                <div
                  key={p.id}
                  className={`leaderboard-row ${isMe ? 'leaderboard-row-highlight' : ''}`}
                  style={{
                    background: index < 3 ? rankInfo.glow : undefined,
                  }}
                >
                  {/* Rank */}
                  <div className="leaderboard-rank" style={{
                    color: index === 0 ? "var(--warning)" : index < 3 ? "var(--foreground-muted)" : "var(--foreground-subtle)",
                  }}>
                    {index < 3 ? (
                      <span style={{ fontSize: "1.75rem" }}>{rankInfo.medal}</span>
                    ) : (
                      <span>#{index + 1}</span>
                    )}
                  </div>

                  {/* Avatar + Info */}
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                    <div className="avatar" style={{ background: getAvatarGradient(username) }}>
                      {username.charAt(0)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: "0.9375rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {username}
                        </span>
                        {isMe && (
                          <span className="badge" style={{
                            background: "var(--primary-muted)",
                            color: "var(--primary)",
                            border: "1px solid rgba(129, 140, 248, 0.2)",
                            fontSize: "0.5625rem",
                            padding: "0.125rem 0.375rem",
                          }}>
                            YOU
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--foreground-subtle)", marginTop: "0.125rem" }}>
                        {p.users?.leetcode_id || "N/A"} • Rank {p.rank}
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}>
                    <Trophy size={16} color="var(--primary)" style={{ opacity: 0.6 }} />
                    <span style={{
                      fontSize: "1.375rem",
                      fontWeight: 800,
                      background: "var(--gradient-score)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>
                      {p.score}
                    </span>
                  </div>
                </div>
              );
            })}

            {participants.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--foreground-muted)" }}>
                No participants yet. Share the invite link!
              </div>
            )}
          </div>
        </div>

        {/* Consistency Calendar */}
        <div>
          <div className="section-header" style={{ marginBottom: "1.25rem" }}>
            <div className="section-title">
              <CalendarDays size={20} color="var(--primary)" />
              <h2 style={{ margin: 0, fontSize: "1.125rem" }}>Consistency</h2>
            </div>
          </div>
          
          <div className="card glass" style={{ padding: "1.25rem" }}>
            {/* Day labels */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "0.375rem",
              marginBottom: "0.5rem",
            }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{
                  textAlign: "center",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: "var(--foreground-subtle)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  {d}
                </div>
              ))}
            </div>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(7, 1fr)", 
              gap: "0.375rem" 
            }}>
              {calendarDays.map((day, i) => {
                const todayStr = new Date().toISOString().split("T")[0];
                const isPast = day.date < todayStr;
                const isToday = day.date === todayStr;
                
                let bgColor = "var(--surface-2)";
                let borderStyle = "1px solid transparent";

                if (isPast || isToday) {
                  if (day.passed) {
                    // Gradient intensity based on points
                    const intensity = Math.min(day.points / 10, 1);
                    bgColor = `rgba(52, 211, 153, ${0.1 + intensity * 0.2})`;
                  } else {
                    bgColor = "rgba(248, 113, 113, 0.12)";
                  }
                }

                if (isToday) {
                  borderStyle = "2px solid var(--primary)";
                }

                return (
                  <div key={i} title={`${day.date}: ${day.points} pts`} style={{
                    aspectRatio: "1",
                    backgroundColor: bgColor,
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: borderStyle,
                    position: "relative",
                    transition: "transform 0.15s ease",
                    cursor: "default",
                    animation: isToday ? "border-glow 2s ease-in-out infinite" : "none",
                  }}>
                    {(isPast || isToday) && day.passed && <CheckCircle2 size={14} color="var(--success)" />}
                    {(isPast || isToday) && !day.passed && <XCircle size={13} color="var(--danger)" style={{ opacity: 0.7 }} />}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: "1rem",
              marginTop: "1rem",
              fontSize: "0.6875rem",
              color: "var(--foreground-subtle)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "rgba(52, 211, 153, 0.25)" }} />
                Passed
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "rgba(248, 113, 113, 0.15)" }} />
                Missed
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "var(--surface-2)" }} />
                Future
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
