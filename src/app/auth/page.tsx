"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

export default function AuthPage() {
  // Common
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // Registration only
  const [email, setEmail] = useState("");
  const [leetcodeId, setLeetcodeId] = useState("");
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isRegistering) {
      if (password.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, leetcode_id: leetcodeId }
        }
      });
      if (error) {
        showToast(error.message, "error");
      } else {
        showToast("Registration successful! Welcome to the Arena.", "success");
        window.location.href = "/";
      }
    } else {
      // 1. Fetch email by username via our custom RPC
      const { data: userEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
        p_username: username
      });

      if (rpcError || !userEmail) {
        showToast("Invalid username or password.", "error");
        setLoading(false);
        return;
      }

      // 2. Login with the fetched email
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (error) {
        showToast("Invalid username or password.", "error");
      } else {
        showToast("Welcome back, challenger.", "success");
        window.location.href = "/";
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: "400px", margin: "4rem auto" }} className="animate-fade-in">
      <div className="card glass">
        <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>{isRegistering ? "Join the Arena" : "Enter the Arena"}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>

          {isRegistering && (
            <>
              <div className="form-group">
                <label className="form-label">Email (For account recovery)</label>
                <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">LeetCode ID (Handle)</label>
                <input type="text" className="form-input" value={leetcodeId} onChange={(e) => setLeetcodeId(e.target.value)} required />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          
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
