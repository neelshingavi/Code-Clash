"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    easy_points: 1,
    medium_points: 2,
    hard_points: 3,
    daily_target: 5
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // In a real app we might check roles, here we just let any logged in user update

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/auth";
        return;
      }
      setIsAdmin(true);

      const { data } = await supabase.from("point_settings").select("*").eq("id", 1).single();
      if (data) setSettings(data);
      setLoading(false);
    };
    init();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    const { error } = await supabase
      .from("point_settings")
      .update({
        easy_points: settings.easy_points,
        medium_points: settings.medium_points,
        hard_points: settings.hard_points,
        daily_target: settings.daily_target,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

    if (error) {
      alert("Error saving settings");
      console.error(error);
    } else {
      setSuccess(true);
    }
    setSaving(false);
  };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem" }}>Loading Settings...</div>;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }} className="animate-fade-in">
      <div className="card glass">
        <h2 style={{ marginBottom: "2rem" }}>Dynamic Rules Engine</h2>
        
        {success && (
          <div style={{ padding: "1rem", backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--success)", borderRadius: "8px", marginBottom: "1.5rem", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
            Settings updated successfully! These rules apply globally to all future submissions.
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="dashboard-grid" style={{ marginBottom: "2rem" }}>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--success)" }}>Easy Points</label>
              <input 
                type="number" 
                className="form-input" 
                value={settings.easy_points}
                onChange={(e) => setSettings({...settings, easy_points: parseInt(e.target.value) || 0})}
                required
                min="0"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--warning)" }}>Medium Points</label>
              <input 
                type="number" 
                className="form-input" 
                value={settings.medium_points}
                onChange={(e) => setSettings({...settings, medium_points: parseInt(e.target.value) || 0})}
                required
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: "var(--danger)" }}>Hard Points</label>
              <input 
                type="number" 
                className="form-input" 
                value={settings.hard_points}
                onChange={(e) => setSettings({...settings, hard_points: parseInt(e.target.value) || 0})}
                required
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: "var(--primary)" }}>Daily Target (Compulsory)</label>
              <input 
                type="number" 
                className="form-input" 
                value={settings.daily_target}
                onChange={(e) => setSettings({...settings, daily_target: parseInt(e.target.value) || 0})}
                required
                min="1"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={saving || !isAdmin}>
            {saving ? "Saving Changes..." : "Update Global Rules"}
          </button>
        </form>
      </div>
    </div>
  );
}
