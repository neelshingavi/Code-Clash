"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

export default function SubmitProblem() {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { showToast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = "/auth";
      else setUser(session.user);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // 1. Get points for difficulty
      const { data: settings } = await supabase.from("point_settings").select("*").eq("id", 1).single();
      const points = settings ? settings[`${difficulty}_points`] : (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3);

      // 2. Log submission
      const { error: submitError } = await supabase.from("submissions").insert({
        user_id: user.id,
        problem_name: name,
        problem_url: url,
        difficulty,
        points_earned: points,
      });

      if (submitError) throw submitError;

      // 3. Update user total score
      const { data: userData } = await supabase.from("users").select("total_score").eq("id", user.id).single();
      const currentScore = userData?.total_score || 0;
      await supabase.from("users").update({ total_score: currentScore + points }).eq("id", user.id);

      showToast(`Problem logged! Earned ${points} points.`, "success");
      setUrl("");
      setName("");
      setDifficulty("easy");
    } catch (error) {
      console.error("Submission failed:", error);
      showToast("Failed to submit problem.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }} className="animate-fade-in">
      <div className="card glass">
        <h2 style={{ marginBottom: "2rem" }}>Log a Problem</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Problem URL</label>
            <input 
              type="url" 
              className="form-input" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://leetcode.com/problems/..."
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Problem Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Two Sum"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Difficulty</label>
            <select 
              className="form-select"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }} disabled={loading}>
            {loading ? "Logging..." : "Submit Problem"}
          </button>
        </form>
      </div>
    </div>
  );
}
