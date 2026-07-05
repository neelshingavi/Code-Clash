'use client';

import { useState } from 'react';
import { ContributionGraph } from '@/components/ContributionGraph';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import type { CalendarDayRecord } from '@/data/calendar';

type CalendarClientProps = {
  history: CalendarDayRecord[];
  leetcodeCalendar?: Record<string, number>;
};

export function CalendarClient({ history, leetcodeCalendar = {} }: CalendarClientProps) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${day}`;
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Convert history array to a map for the ContributionGraph
  const activityMap: Record<string, number> = {};
  let totalProblems = 0;
  
  // First, populate with true historical counts from LeetCode
  Object.entries(leetcodeCalendar).forEach(([timestamp, count]) => {
    // LeetCode timestamp is in seconds
    const date = new Date(Number(timestamp) * 1000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    activityMap[dateStr] = count;
    totalProblems += count;
  });

  // Then override/augment with our DB history (which has details)
  history.forEach(day => {
    if (!activityMap[day.date]) {
       activityMap[day.date] = day.count;
       totalProblems += day.count;
    } else {
       // If Leetcode already said 5 problems, but our DB only has 2 logged, 
       // keep the true count (5), but our DB has the rich details for 2.
       // The heatmap color is based on the max count
       activityMap[day.date] = Math.max(activityMap[day.date], day.count);
    }
  });

  const selectedData = history.find(d => d.date === selectedDate);
  
  // Format date nicely
  const [yStr, mStr, dStr] = selectedDate.split('-');
  const dObj = new Date(parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr));
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const formattedDate = `${DAYS[dObj.getDay()]}, ${MONTHS[dObj.getMonth()]} ${dObj.getDate()}, ${dObj.getFullYear()}`;

  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'easy': return 'var(--success)';
      case 'medium': return 'var(--warning)';
      case 'hard': return 'var(--danger)';
      default: return 'var(--foreground-muted)';
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, marginBottom: "0.5rem", fontSize: "2rem" }}>
          <span className="text-gradient">Activity Calendar</span>
        </h1>
        <p style={{ margin: 0, color: "var(--foreground-muted)" }}>
          {totalProblems} problems solved in the last year
        </p>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <ContributionGraph 
          data={activityMap} 
          selectedDate={selectedDate} 
          onSelectDate={setSelectedDate} 
        />
      </div>

      <div className="section-header" style={{ marginTop: "3rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{formattedDate}</h2>
        {selectedData && (
          <span className="badge" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>
            {selectedData.count} Problems Solved
          </span>
        )}
      </div>

      {!selectedData || selectedData.count === 0 ? (
        <div className="card glass" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          {activityMap[selectedDate] ? (
            <>
              <div style={{ fontSize: "2rem", marginBottom: "1rem", opacity: 0.5 }}>☁️</div>
              <h3 style={{ margin: 0, marginBottom: "0.5rem" }}>{activityMap[selectedDate]} Problems Unsynced</h3>
              <p style={{ margin: 0, color: "var(--foreground-muted)", fontSize: "0.875rem", maxWidth: "400px", marginInline: "auto" }}>
                You solved problems on LeetCode on this date, but they were not synced to Code Clash. 
                Only problems logged in the database will display detailed information here.
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: "2rem", marginBottom: "1rem", opacity: 0.5 }}>📭</div>
              <h3 style={{ margin: 0, marginBottom: "0.5rem" }}>No Activity</h3>
              <p style={{ margin: 0, color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                No problems were solved on this day.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="dashboard-grid stagger-children">
          {selectedData.problems.map((prob, i) => (
            <div key={i} className="card glass card-glow" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <h3 style={{ margin: 0, marginBottom: "0.375rem", fontSize: "1.0625rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <CheckCircle2 size={16} color="var(--success)" />
                    {prob.name}
                  </h3>
                  <span style={{ 
                    fontSize: "0.75rem", 
                    fontWeight: 700, 
                    textTransform: "uppercase", 
                    letterSpacing: "0.05em",
                    color: getDifficultyColor(prob.difficulty)
                  }}>
                    {prob.difficulty}
                  </span>
                </div>
                
                <a 
                  href={prob.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: "0.5rem" }}
                  title="View on LeetCode"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
              
              <div style={{ 
                paddingTop: "1rem", 
                borderTop: "1px solid var(--surface-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--foreground-muted)" }}>Points Earned</span>
                <span style={{ 
                  fontWeight: 800, 
                  color: "var(--primary)",
                  background: "var(--primary-muted)",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "var(--radius-full)"
                }}>
                  +{prob.points}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
