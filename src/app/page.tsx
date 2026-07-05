import { Trophy, Flame, Plus, Swords, Target, ArrowUpRight, PenLine } from "lucide-react";
import Link from "next/link";
import { verifySession, getUserStats, getMyActiveChallenges } from "@/data/challenges";
import { LogoutButton } from "@/components/LogoutButton";
import { AutoSyncButton } from "@/components/AutoSyncButton";

function getRankMedal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default async function Dashboard() {
  const user = await verifySession();
  const [stats, challenges] = await Promise.all([
    getUserStats(user.id),
    getMyActiveChallenges(user.id)
  ]);

  const username = stats?.username || user.user_metadata?.username || "Challenger";

  return (
    <div className="animate-fade-in">
      {/* Hero Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "2.5rem",
        gap: "1rem",
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.375rem",
          }}>
            <span style={{ fontSize: "1.5rem" }} className="animate-wiggle">👋</span>
            <span style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--foreground-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>
              Welcome back
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}>
            <span className="text-gradient">{username}</span>
          </h1>
        </div>
        <LogoutButton />
      </div>

      {/* Stat Cards */}
      <div className="dashboard-grid stagger-children" style={{ marginBottom: "3rem" }}>
        <div className="stat-card stat-card-primary">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{
              width: "52px",
              height: "52px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, rgba(129, 140, 248, 0.15) 0%, rgba(192, 132, 252, 0.15) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <Trophy size={26} color="var(--primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <p className="stat-label" style={{ margin: 0, marginBottom: "0.25rem" }}>Total Score</p>
              <div className="stat-value" style={{
                background: "var(--gradient-score)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {stats?.total_score || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-streak">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{
              width: "52px",
              height: "52px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, rgba(251, 146, 60, 0.15) 0%, rgba(248, 113, 113, 0.15) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <Flame size={26} color="var(--danger)" />
            </div>
            <div style={{ flex: 1 }}>
              <p className="stat-label" style={{ margin: 0, marginBottom: "0.25rem" }}>Current Streak</p>
              <div className="stat-value" style={{
                background: "var(--gradient-streak)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {stats?.current_streak || 0}
                <span style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  WebkitTextFillColor: "var(--foreground-muted)",
                  marginLeft: "0.375rem",
                }}>days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        display: "flex",
        gap: "0.75rem",
        marginBottom: "2.5rem",
        flexWrap: "wrap",
      }}>
        <AutoSyncButton />
        <Link href="/challenges" className="btn btn-secondary btn-sm" style={{ gap: "0.375rem" }}>
          <Target size={14} />
          Browse Challenges
        </Link>
      </div>

      {/* Active Challenges Section */}
      <div>
        <div className="section-header">
          <div className="section-title">
            <Swords size={22} color="var(--accent)" />
            <h2 style={{ margin: 0 }}>Active Challenges</h2>
          </div>
          <Link href="/challenges/create" className="btn btn-primary btn-sm">
            <Plus size={16} />
            New Challenge
          </Link>
        </div>

        <div className="dashboard-grid stagger-children">
          {challenges.length === 0 ? (
            <div
              className="card glass"
              style={{ gridColumn: "1 / -1", textAlign: "center" }}
            >
              <div className="empty-state">
                <div className="empty-state-icon">⚔️</div>
                <div className="empty-state-title">No Active Challenges</div>
                <p className="empty-state-description">
                  Create your first challenge and invite a friend to start competing!
                </p>
                <Link href="/challenges/create" className="btn btn-primary">
                  <Plus size={16} />
                  Create Challenge
                </Link>
              </div>
            </div>
          ) : (
            challenges.map((c: any) => (
              <Link key={c.challenge_id} href={`/challenges/${c.challenge_id}`} style={{ textDecoration: "none" }}>
                <div className="card glass card-interactive card-glow" style={{ height: "100%" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1rem",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--accent-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        <Swords size={20} color="var(--accent)" />
                      </div>
                      <h4 style={{ margin: 0, fontSize: "1.0625rem" }}>{c.challenges.name}</h4>
                    </div>
                    <ArrowUpRight size={16} color="var(--foreground-subtle)" />
                  </div>

                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem",
                    background: "var(--surface-0)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.875rem",
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.125rem" }}>
                      <span style={{ color: "var(--foreground-muted)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Score</span>
                      <span style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--primary)" }}>{c.score}</span>
                    </div>
                    <div style={{ width: "1px", height: "32px", background: "var(--surface-border)" }} />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.125rem" }}>
                      <span style={{ color: "var(--foreground-muted)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rank</span>
                      <span style={{ fontWeight: 800, fontSize: "1.25rem" }}>{getRankMedal(c.rank)}</span>
                    </div>
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
