"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CreateChallenge() {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyTarget, setDailyTarget] = useState(5);
  const [penaltyMode, setPenaltyMode] = useState("minus_points");
  const [penaltyAmount, setPenaltyAmount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/auth";
      return;
    }

    const { data, error } = await supabase.from("challenges").insert({
      name,
      start_date: startDate,
      end_date: endDate,
      daily_target: dailyTarget,
      penalty_mode: penaltyMode,
      penalty_amount: penaltyAmount,
      created_by: session.user.id
    }).select().single();

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Auto-join the creator to the challenge
      await supabase.from("challenge_participants").insert({
        challenge_id: data.id,
        user_id: session.user.id,
      });
      window.location.href = `/challenges/${data.id}`;
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }} className="animate-fade-in">
      <div className="card glass">
        <h2 style={{ marginBottom: "2rem" }}>Forge a New Challenge</h2>
        
        {error && (
          <div style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", borderRadius: "8px", marginBottom: "1.5rem", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Challenge Name</label>
            <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Summer Algorithm Sprint" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Daily Target (Points)</label>
            <input type="number" className="form-input" value={dailyTarget} onChange={(e) => setDailyTarget(parseInt(e.target.value))} required min={1} />
          </div>

          <h3 style={{ marginTop: "2rem", marginBottom: "1rem", fontSize: "1.2rem", color: "var(--danger)" }}>Penalty Configuration</h3>
          
          <div className="form-group">
            <label className="form-label">Failure Penalty Mode</label>
            <select className="form-select" value={penaltyMode} onChange={(e) => setPenaltyMode(e.target.value)}>
              <option value="none">No Penalty</option>
              <option value="minus_points">Subtract Points</option>
              <option value="double_quota_next_day">Multiply Next Day Quota</option>
              <option value="rank_reduction">Demote Rank</option>
              <option value="streak_reset">Reset Streak</option>
            </select>
          </div>

          {['minus_points', 'double_quota_next_day'].includes(penaltyMode) && (
            <div className="form-group">
              <label className="form-label">Penalty Amount (Multiplier or Points)</label>
              <input type="number" className="form-input" value={penaltyAmount} onChange={(e) => setPenaltyAmount(parseInt(e.target.value))} required min={1} />
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }} disabled={loading}>
            {loading ? "Forging..." : "Create Challenge & Join"}
          </button>
        </form>
      </div>
    </div>
  );
}
