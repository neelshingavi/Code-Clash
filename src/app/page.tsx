"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Trophy, Flame, Target, LogOut, Swords, Plus } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [challenges, setChallenges] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/auth";
        return;
      }
      setUser(session.user);

      // Fetch user stats
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      setStats(userData || { total_score: 0, current_streak: 0 });

      // Fetch active challenges
      const { data: myChallenges } = await supabase
        .from('challenge_participants')
        .select('*, challenges(*)')
        .eq('user_id', session.user.id);
        
      setChallenges(myChallenges || []);
      setLoading(false);
    };

    fetchUserAndData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem" }}>Loading Arena...</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h2>Global Dashboard</h2>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: "0.5rem 1rem" }}>
          <LogOut size={18} /> Logout
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="card glass">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ padding: "1rem", backgroundColor: "rgba(99, 102, 241, 0.1)", borderRadius: "12px", color: "var(--primary)" }}>
              <Trophy size={32} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.875rem" }}>Global Rank</p>
              <h3 style={{ margin: 0, fontSize: "2rem" }}>{stats?.global_rank || "Bronze"}</h3>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3>My Active Challenges</h3>
          <Link href="/challenges/create" className="btn btn-primary" style={{ padding: "0.5rem 1rem" }}>
            <Plus size={18} /> New Challenge
          </Link>
        </div>

        <div className="dashboard-grid">
          {challenges.length === 0 ? (
            <div className="card glass" style={{ textAlign: "center", color: "#a1a1aa", gridColumn: "1 / -1" }}>
              You are not in any challenges. Create one and invite your friend!
            </div>
          ) : (
            challenges.map((c) => (
              <Link key={c.challenge_id} href={`/challenges/${c.challenge_id}`}>
                <div className="card glass" style={{ cursor: "pointer", transition: "transform 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                    <Swords size={24} color="var(--accent)" />
                    <h4 style={{ margin: 0 }}>{c.challenges.name}</h4>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#a1a1aa" }}>
                    <span>Your Score: <strong style={{ color: "var(--foreground)" }}>{c.score}</strong></span>
                    <span>Rank: <strong style={{ color: "var(--warning)" }}>{c.rank}</strong></span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
