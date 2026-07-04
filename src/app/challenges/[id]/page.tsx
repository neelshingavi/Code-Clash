"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { evaluatePenalties } from "@/lib/penaltyEngine";
import { ShieldAlert, Trophy, TrendingUp, Skull, CalendarDays, CheckCircle2, XCircle } from "lucide-react";

export default function LiveArena() {
  const { id } = useParams();
  const [challenge, setChallenge] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [joining, setJoining] = useState(false);
  
  // Calendar states
  const [calendarDays, setCalendarDays] = useState<any[]>([]);

  useEffect(() => {
    let subscription: any;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/auth";
        return;
      }
      setCurrentUser(session.user);

      // Fetch challenge details
      const { data: ch } = await supabase.from("challenges").select("*").eq("id", id).single();
      setChallenge(ch);

      const fetchLeaderboard = async () => {
        const { data: parts } = await supabase
          .from("challenge_participants")
          .select("*, users(username, leetcode_id, avatar_url)")
          .eq("challenge_id", id)
          .order("score", { ascending: false });
        
        setParticipants(parts || []);
        
        // Evaluate penalties if user is in this challenge
        const isParticipant = parts?.some(p => p.user_id === session.user.id);
        if (isParticipant) {
          await evaluatePenalties(session.user.id, id as string);
        }
      };

      await fetchLeaderboard();
      
      // Realtime subscription for live leaderboard updates
      subscription = supabase
        .channel(`challenge-${id}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'challenge_participants', filter: `challenge_id=eq.${id}` },
          (payload) => {
            fetchLeaderboard();
          }
        )
        .subscribe();

      // Fetch user's submissions for calendar if they are participating
      const fetchCalendar = async () => {
        const { data: subs } = await supabase
          .from("submissions")
          .select("points_earned, solved_date")
          .eq("user_id", session.user.id)
          .eq("challenge_id", id);
        
        if (!ch) return;
        
        const start = new Date(ch.start_date);
        const end = new Date(ch.end_date);
        const days = [];
        let curr = new Date(start);
        
        while (curr <= end) {
          const dateStr = curr.toISOString().split("T")[0];
          // Sum points for this day
          const dayPoints = subs?.filter(s => s.solved_date === dateStr).reduce((a, b) => a + b.points_earned, 0) || 0;
          days.push({
            date: dateStr,
            passed: dayPoints >= ch.daily_target,
            points: dayPoints
          });
          curr.setDate(curr.getDate() + 1);
        }
        setCalendarDays(days);
        setLoading(false);
      };
      
      await fetchCalendar();
    };

    init();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [id]);

  const handleJoin = async () => {
    setJoining(true);
    await supabase.from("challenge_participants").insert({
      challenge_id: id,
      user_id: currentUser.id,
    });
    window.location.reload();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Invite link copied to clipboard!");
  };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem" }}>Syncing with the Arena...</div>;
  if (!challenge) return <div style={{ textAlign: "center", padding: "4rem" }}>Challenge not found.</div>;

  const myParticipant = participants.find(p => p.user_id === currentUser?.id);
  const isParticipant = !!myParticipant;

  if (!isParticipant) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: "600px", margin: "4rem auto", textAlign: "center" }}>
        <ShieldAlert size={64} color="var(--primary)" style={{ marginBottom: "1.5rem" }} />
        <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{challenge.name}</h1>
        <p style={{ color: "#a1a1aa", fontSize: "1.2rem", marginBottom: "2rem" }}>
          You have been invited to enter the Arena. 
        </p>
        <div className="card glass" style={{ textAlign: "left", marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "var(--danger)" }}>Rules of Engagement</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "var(--foreground)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <li>🎯 Target: <strong>{challenge.daily_target} Points / Day</strong></li>
            <li>💀 Penalty: <strong>{challenge.penalty_mode.replace(/_/g, ' ').toUpperCase()}</strong></li>
            <li>⏳ Duration: <strong>{new Date(challenge.start_date).toLocaleDateString()} to {new Date(challenge.end_date).toLocaleDateString()}</strong></li>
          </ul>
        </div>
        <button onClick={handleJoin} className="btn btn-primary" style={{ fontSize: "1.2rem", padding: "1rem 3rem", width: "100%" }} disabled={joining}>
          {joining ? "Entering Arena..." : "Accept Challenge"}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "3rem", color: "var(--primary)", textShadow: "0 0 20px rgba(99, 102, 241, 0.3)" }}>
          {challenge.name}
        </h1>
        <p style={{ color: "#a1a1aa", fontSize: "1.1rem", marginBottom: "1rem" }}>
          {new Date(challenge.start_date).toLocaleDateString()} — {new Date(challenge.end_date).toLocaleDateString()}
        </p>
        <button onClick={handleCopyLink} className="btn btn-secondary">Copy Invite Link</button>
      </div>

      {myParticipant.temporary_quota && (
        <div style={{ padding: "1.5rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", borderRadius: "12px", marginBottom: "2rem", border: "1px solid rgba(239, 68, 68, 0.3)", display: "flex", alignItems: "center", gap: "1rem" }}>
          <Skull size={32} />
          <div>
            <h3 style={{ margin: 0, color: "var(--danger)" }}>PENALTY ACTIVE</h3>
            <p style={{ margin: 0 }}>You failed to meet your target. Your quota today is doubled to <strong>{myParticipant.temporary_quota} points</strong>.</p>
          </div>
        </div>
      )}

      <div className="dashboard-grid" style={{ marginBottom: "2rem" }}>
        {/* Leaderboard */}
        <div style={{ gridColumn: "span 2" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2>Live Leaderboard</h2>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.875rem", color: "var(--warning)" }}>
              <ShieldAlert size={16} /> 
              <span>Penalty: {challenge.penalty_mode.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="card glass" style={{ padding: 0, overflow: "hidden" }}>
            {participants.map((p, index) => (
              <div key={p.id} style={{
                display: "flex",
                alignItems: "center",
                padding: "1.5rem",
                borderBottom: index < participants.length - 1 ? "1px solid var(--surface-border)" : "none",
                backgroundColor: p.user_id === currentUser?.id ? "rgba(99, 102, 241, 0.05)" : "transparent"
              }}>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: index === 0 ? "var(--warning)" : "var(--surface-border)", width: "60px" }}>
                  #{index + 1}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "1.2rem", color: "var(--foreground)" }}>
                      {p.users?.username || "Unknown"}
                    </span>
                    {p.user_id === currentUser?.id && <span className="badge" style={{ backgroundColor: "var(--primary)", color: "white" }}>You</span>}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#a1a1aa", marginTop: "0.25rem" }}>
                    LeetCode: {p.users?.leetcode_id || "N/A"} • Rank: {p.rank}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary)" }}>
                    <Trophy size={20} />
                    <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>{p.score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consistency Calendar */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <CalendarDays size={24} />
            <h2 style={{ margin: 0 }}>Consistency Grid</h2>
          </div>
          
          <div className="card glass" style={{ padding: "1.5rem" }}>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(7, 1fr)", 
              gap: "0.5rem" 
            }}>
              {calendarDays.map((day, i) => {
                const todayStr = new Date().toISOString().split("T")[0];
                const isPast = day.date < todayStr;
                const isToday = day.date === todayStr;
                
                let bgColor = "var(--surface-border)"; // Default future
                if (isPast || isToday) {
                  bgColor = day.passed ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
                }

                return (
                  <div key={i} title={`${day.date}: ${day.points} pts`} style={{
                    aspectRatio: "1",
                    backgroundColor: bgColor,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: isToday ? "2px solid var(--primary)" : "none",
                    position: "relative"
                  }}>
                    {(isPast || isToday) && day.passed && <CheckCircle2 size={16} color="var(--success)" />}
                    {(isPast || isToday) && !day.passed && <XCircle size={16} color="var(--danger)" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
