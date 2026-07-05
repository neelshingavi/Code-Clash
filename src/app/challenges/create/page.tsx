'use client';

import { useActionState, useState } from 'react';
import { createChallengeAction } from '@/actions/challenges';
import { Swords, Zap, AlertTriangle, Shield, RotateCcw, Flame, MinusCircle, ChevronDown, ArrowBigDown } from 'lucide-react';

const penaltyOptions = [
  { value: 'none', label: 'No Penalty', description: 'Chill mode — no consequences', icon: Shield, color: 'var(--success)' },
  { value: 'minus_points', label: 'Subtract Points', description: 'Lose points for missed days', icon: MinusCircle, color: 'var(--danger)' },
  { value: 'double_quota_next_day', label: 'Double Quota', description: 'Tomorrow\'s target is multiplied', icon: Zap, color: 'var(--warning)' },
  { value: 'rank_reduction', label: 'Demote Rank', description: 'Your rank drops on failure', icon: ArrowBigDown, color: 'var(--info)' },
  { value: 'streak_reset', label: 'Reset Streak', description: 'Lose your entire streak', icon: RotateCcw, color: 'var(--accent)' },
];

export default function CreateChallenge() {
  const [state, action, pending] = useActionState(createChallengeAction, undefined);
  const [selectedPenalty, setSelectedPenalty] = useState('minus_points');

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }} className="animate-fade-in">
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "var(--radius-xl)",
          background: "var(--accent-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1rem",
        }}>
          <Swords size={32} color="var(--accent)" />
        </div>
        <h1 style={{ margin: 0, marginBottom: "0.5rem" }}>
          <span className="text-gradient">Forge a New Challenge</span>
        </h1>
        <p style={{ margin: 0, color: "var(--foreground-muted)", fontSize: "0.9375rem" }}>
          Set the rules, invite your rivals, and compete daily
        </p>
      </div>

      <div className="card glass card-glow" style={{ padding: "2rem" }}>
        <form action={action}>
          {/* Section 1: Basics */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            marginBottom: "1.25rem",
          }}>
            <span style={{
              width: "24px",
              height: "24px",
              borderRadius: "var(--radius-full)",
              background: "var(--gradient-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "white",
              flexShrink: 0,
            }}>1</span>
            <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Challenge Details</span>
          </div>

          <div className="form-group">
            <label className="form-label">Challenge Name</label>
            <input
              type="text"
              name="name"
              className="form-input"
              required
              placeholder="e.g. Summer Algorithm Sprint"
            />
            {(state?.error as any)?.name && (
              <p className="form-error">{(state?.error as any)?.name[0]}</p>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" name="startDate" className="form-input" required />
              {(state?.error as any)?.startDate && (
                <p className="form-error">{(state?.error as any)?.startDate[0]}</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" name="endDate" className="form-input" required />
              {(state?.error as any)?.endDate && (
                <p className="form-error">{(state?.error as any)?.endDate[0]}</p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Daily Target (Points)</label>
            <input type="number" name="dailyTarget" className="form-input" defaultValue={5} required min={1} />
          </div>

          {/* Divider */}
          <div className="divider" />

          {/* Section 2: Points */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            marginBottom: "1.25rem",
          }}>
            <span style={{
              width: "24px",
              height: "24px",
              borderRadius: "var(--radius-full)",
              background: "var(--gradient-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "white",
              flexShrink: 0,
            }}>2</span>
            <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Point Configuration</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
            {[
              { name: "easyPoints", label: "Easy", value: 1, color: "var(--success)", bg: "var(--success-muted)" },
              { name: "mediumPoints", label: "Medium", value: 2, color: "var(--warning)", bg: "var(--warning-muted)" },
              { name: "hardPoints", label: "Hard", value: 3, color: "var(--danger)", bg: "var(--danger-muted)" },
            ].map((diff) => (
              <div key={diff.name} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: diff.bg,
                borderRadius: "var(--radius-md)",
                padding: "1rem 1.5rem",
                border: `1px solid ${diff.color}20`,
              }}>
                <div style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: diff.color,
                }}>
                  {diff.label}
                </div>
                <input
                  type="number"
                  name={diff.name}
                  className="form-input"
                  defaultValue={diff.value}
                  required
                  min={0}
                  style={{
                    width: "80px",
                    textAlign: "center",
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    padding: "0.5rem",
                    background: "rgba(0,0,0,0.2)",
                    border: "none",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="divider" />

          {/* Section 3: Penalties */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            marginBottom: "1.25rem",
          }}>
            <span style={{
              width: "24px",
              height: "24px",
              borderRadius: "var(--radius-full)",
              background: "var(--gradient-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "white",
              flexShrink: 0,
            }}>3</span>
            <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Penalty Mode</span>
          </div>

          <input type="hidden" name="penaltyMode" value={selectedPenalty} />

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.625rem",
            marginBottom: "1.25rem",
          }}>
            {penaltyOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedPenalty === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedPenalty(option.value)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "0.875rem",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${isSelected ? option.color : 'var(--surface-border)'}`,
                    background: isSelected ? `${option.color}12` : 'var(--surface-0)',
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <Icon size={16} color={isSelected ? option.color : 'var(--foreground-subtle)'} />
                    <span style={{
                      fontWeight: 700,
                      fontSize: "0.8125rem",
                      color: isSelected ? "var(--foreground)" : "var(--foreground-muted)",
                    }}>
                      {option.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: "0.6875rem",
                    color: "var(--foreground-subtle)",
                    lineHeight: 1.4,
                  }}>
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="form-group">
            <label className="form-label">Penalty Amount (Multiplier or Points)</label>
            <input type="number" name="penaltyAmount" className="form-input" defaultValue={5} required min={1} />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: "1rem" }}
            disabled={pending}
          >
            {pending ? "Forging..." : "⚔️ Create Challenge & Join"}
          </button>
          
          {(state?.error as any)?._form && (
            <p className="form-error" style={{ marginTop: "1rem", textAlign: "center" }}>
              {(state?.error as any)?._form[0]}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
