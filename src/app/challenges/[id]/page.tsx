"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { evaluatePenalties } from "@/lib/penaltyEngine";
import { ShieldAlert, Trophy, TrendingUp, Skull } from "lucide-react";

export default function LiveArena() {
  const { id } = useParams();
  const [challenge, setChallenge] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    let subscription: any;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/auth";
        return;
      }
      setCurrentUser(session.user);

      // Evaluate penalties for this user before loading data
      await evaluatePenalties(session.user.id, id as string);

      // Fetch challenge details
      const { data: ch } = await supabase.from("challenges").select("*").eq("id", id).single();
      setChallenge(ch);

      // Fetch leaderboard
      const fetchLeaderboard = async () => {
        const { data: parts } = await supabase
          .from("challenge_participants")
          .select("*, users(username, leetcode_id, avatar_url)")
          .eq("challenge_id", id)
          .order("score", { ascending: false });
        setParticipants(parts || []);
      };

      await fetchLeaderboard();
      setLoading(false);

      // Realtime subscription for live leaderboard updates
      subscription = supabase
        .channel(`challenge-${id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'challenge_participants', filter: `challenge_id=eq.${id}` },
          (payload) => {
            console.log('Leaderboard update received!', payload);
            fetchLeaderboard(); // Refetch to get joined user data easily
          }
        )
        .subscribe();
    };

    init();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [id]);

  if (loading) return <div style={{ textAlign: "center", padding: "4rem" }}>Syncing with the Arena...</div>;
  if (!challenge) return <div>Challenge not found.</div>;

  const myParticipant = participants.find(p => p.user_id === currentUser?.id);

  return (
    <div className="animate-fade-in">
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "3rem", color: "var(--primary)", textShadow: "0 0 20px rgba(99, 102, 241, 0.3)" }}>
          {challenge.name}
        </h1>
        <p style={{ color: "#a1a1aa", fontSize: "1.1rem" }}>
          {new Date(challenge.start_date).toLocaleDateString()} — {new Date(challenge.end_date).toLocaleDateString()}
        </p>
      </div>

      {myParticipant && myParticipant.temporary_quota && (
        <div style={{ padding: "1.5rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", borderRadius: "12px", marginBottom: "2rem", border: "1px solid rgba(239, 68, 68, 0.3)", display: "flex", alignItems: "center", gap: "1rem" }}>
          <Skull size={32} />
          <div>
            <h3 style={{ margin: 0, color: "var(--danger)" }}>PENALTY ACTIVE</h3>
            <p style={{ margin: 0 }}>You failed to meet your target. Your quota today is doubled to <strong>{myParticipant.temporary_quota} points</strong>.</p>
          </div>
        </div>
      )}

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
              <div style={{ fontSize: "0.875rem", color: "var(--success)", display: "flex", alignItems: "center", gap: "0.25rem", justifyContent: "flex-end" }}>
                <TrendingUp size={14} /> Active
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
