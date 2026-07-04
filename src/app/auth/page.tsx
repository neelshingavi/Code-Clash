"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [leetcodeId, setLeetcodeId] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isRegistering) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            leetcode_id: leetcodeId,
          }
        }
      });
      if (error) setError(error.message);
      else alert("Check your email for the confirmation link!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(error.message);
      else window.location.href = "/";
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: "400px", margin: "4rem auto" }} className="animate-fade-in">
      <div className="card glass">
        <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>{isRegistering ? "Join the Arena" : "Enter the Arena"}</h2>
        
        {error && (
          <div style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", borderRadius: "8px", marginBottom: "1.5rem", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          {isRegistering && (
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input type="text" className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">LeetCode ID (Handle)</label>
                <input type="text" className="form-input" value={leetcodeId} onChange={(e) => setLeetcodeId(e.target.value)} required />
              </div>
            </>
          )}
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "2rem" }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Loading..." : (isRegistering ? "Register Account" : "Login")}
            </button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="btn btn-secondary" disabled={loading}>
              {isRegistering ? "Already have an account? Login" : "Need an account? Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
