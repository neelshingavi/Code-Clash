"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Code2, Braces, Terminal } from "lucide-react";

function PasswordStrength({ password }: { password: string }) {
  const strength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return Math.min(score, 4);
  }, [password]);

  if (!password) return null;

  const colors = ["var(--danger)", "var(--danger)", "var(--warning)", "var(--success)", "var(--success)"];
  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <div style={{
        display: "flex",
        gap: "4px",
        marginBottom: "0.25rem",
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1,
            height: "3px",
            borderRadius: "var(--radius-full)",
            background: i <= strength - 1 ? colors[strength] : "var(--surface-3)",
            transition: "background 0.3s ease",
          }} />
        ))}
      </div>
      <span style={{ fontSize: "0.6875rem", color: colors[strength], fontWeight: 600 }}>
        {labels[strength]}
      </span>
    </div>
  );
}

const floatingSymbols = [
  { symbol: "⟨/⟩", top: "10%", left: "8%", delay: "0s", size: "2rem" },
  { symbol: "{}", top: "25%", left: "85%", delay: "0.5s", size: "1.5rem" },
  { symbol: "[]", top: "60%", left: "12%", delay: "1s", size: "1.75rem" },
  { symbol: "()", top: "75%", left: "80%", delay: "1.5s", size: "1.25rem" },
  { symbol: "=>", top: "40%", left: "5%", delay: "2s", size: "1.5rem" },
  { symbol: "&&", top: "85%", left: "50%", delay: "0.75s", size: "1.25rem" },
];

export default function AuthClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [leetcodeId, setLeetcodeId] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    
    // Sanitize inputs
    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    const cleanLeetcodeId = leetcodeId.trim();

    if (isRegistering) {
      if (password.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        setLoading(false);
        return;
      }

      const { data: existingUser } = await supabase
        .from('public_profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        showToast("That username is already taken.", "error");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { username: cleanUsername, leetcode_id: cleanLeetcodeId }
        }
      });
      if (error) {
        showToast(error.message, "error");
      } else {
        showToast("Registration successful! Welcome to the Arena.", "success");
        router.refresh();
        router.push("/");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        showToast("Invalid email or password.", "error");
      } else {
        showToast("Welcome back, challenger.", "success");
        router.refresh();
        router.push("/");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "calc(100vh - 200px)",
      padding: "2rem 0",
      position: "relative",
    }}>
      {/* Floating code symbols */}
      {floatingSymbols.map((s, i) => (
        <span key={i} className="animate-float" style={{
          position: "absolute",
          top: s.top,
          left: s.left,
          fontSize: s.size,
          color: "var(--primary)",
          opacity: 0.08,
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          animationDelay: s.delay,
          pointerEvents: "none",
          userSelect: "none",
        }}>
          {s.symbol}
        </span>
      ))}

      <div style={{ width: "100%", maxWidth: "440px" }} className="animate-fade-in">
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>⚔️</div>
          <h1 style={{ margin: 0, marginBottom: "0.5rem" }}>
            <span className="text-gradient">Code Clash</span>
          </h1>
          <p style={{ margin: 0, color: "var(--foreground-muted)", fontSize: "0.9375rem" }}>
            {isRegistering ? "Create your account and join the arena" : "Sign in to continue competing"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "flex",
          background: "var(--surface-0)",
          borderRadius: "var(--radius-lg)",
          padding: "4px",
          marginBottom: "1.75rem",
          border: "1px solid var(--surface-border)",
        }}>
          <button
            type="button"
            onClick={() => setIsRegistering(false)}
            style={{
              flex: 1,
              padding: "0.625rem",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              fontSize: "0.875rem",
              background: !isRegistering ? "var(--primary-muted)" : "transparent",
              color: !isRegistering ? "var(--primary)" : "var(--foreground-muted)",
              transition: "all 0.2s ease",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsRegistering(true)}
            style={{
              flex: 1,
              padding: "0.625rem",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              fontSize: "0.875rem",
              background: isRegistering ? "var(--primary-muted)" : "transparent",
              color: isRegistering ? "var(--primary)" : "var(--foreground-muted)",
              transition: "all 0.2s ease",
            }}
          >
            Register
          </button>
        </div>

        {/* Form Card */}
        <div className="card glass card-glow" style={{ padding: "2rem" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            {isRegistering && (
              <>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    name="username"
                    className="form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    pattern="^[a-zA-Z0-9_]{3,20}$"
                    title="3-20 characters, alphanumeric and underscores only."
                    placeholder="your_username"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">LeetCode ID</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      name="leetcodeId"
                      className="form-input"
                      style={{ paddingLeft: "2.5rem", width: "100%" }}
                      value={leetcodeId}
                      onChange={(e) => setLeetcodeId(e.target.value)}
                      required
                      placeholder="leetcode_handle"
                    />
                    <Code2
                      size={16}
                      style={{
                        position: "absolute",
                        left: "0.875rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--foreground-subtle)",
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-group" style={{ marginBottom: isRegistering ? "0.5rem" : "1.25rem" }}>
              <label className="form-label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="form-input"
                  style={{ paddingRight: "2.75rem", width: "100%" }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--foreground-subtle)",
                    padding: "0.25rem",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {isRegistering && <PasswordStrength password={password} />}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "0.75rem",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  {isRegistering ? "Creating Account..." : "Signing In..."}
                </>
              ) : (
                isRegistering ? "Create Account" : "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
