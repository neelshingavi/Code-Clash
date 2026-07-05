'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type ContributionGraphProps = {
  data: Record<string, number>;
  onSelectDate: (dateStr: string) => void;
  selectedDate: string | null;
};

const getLocalYYYYMMDD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function ContributionGraph({ data, onSelectDate, selectedDate }: ContributionGraphProps) {
  // Generate the last 365 days
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    // Start from exactly 364 days ago to get 365 days (52 weeks + 1 day)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    
    // Adjust start date to the nearest Sunday to keep the grid aligned
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeksArray: { dateStr: string; count: number; date: Date }[][] = [];
    let currentWeek: { dateStr: string; count: number; date: Date }[] = [];
    
    let currentDate = new Date(startDate);
    const mLabels: { label: string; index: number }[] = [];
    let lastMonth = -1;

    let weekIndex = 0;
    while (currentDate <= today) {
      const dateStr = getLocalYYYYMMDD(currentDate);
      
      // Track month changes for labels (kept for backwards compatibility if needed, but no longer used in render)
      if (currentDate.getDate() === 1 || (lastMonth === -1 && currentDate.getDate() < 7)) {
        if (currentDate.getMonth() !== lastMonth) {
          mLabels.push({
            label: currentDate.toLocaleString('default', { month: 'short' }),
            index: weekIndex
          });
          lastMonth = currentDate.getMonth();
        }
      }

      currentWeek.push({
        dateStr,
        count: data[dateStr] || 0,
        date: new Date(currentDate)
      });
      
      currentDate.setDate(currentDate.getDate() + 1);

      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek);
        currentWeek = [];
        weekIndex++;
      }
    }
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ dateStr: '', count: 0, date: new Date(0) });
      }
      weeksArray.push(currentWeek);
    }

    return { weeks: weeksArray, monthLabels: mLabels };
  }, [data]);

  const getColor = (count: number) => {
    if (count === 0) return 'var(--surface-3)';
    if (count <= 2) return 'rgba(34, 197, 94, 0.4)'; // Light green
    if (count <= 5) return 'rgba(34, 197, 94, 0.7)'; // Medium green
    return 'rgba(34, 197, 94, 1)'; // Solid green
  };

  return (
    <div className="card glass" style={{ padding: '1.5rem', overflowX: 'auto' }}>
      <div style={{ minWidth: '800px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Day Labels (Mon, Wed, Fri) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '32px', fontSize: '0.6875rem', color: 'var(--foreground-muted)', fontWeight: 600 }}>
            {/* 20px spacer to match the month labels */}
            <div style={{ height: '20px' }} />
            {/* 7 rows to match the grid. We only show Mon, Wed, Fri on index 1, 3, 5 */}
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                {i === 1 ? 'Mon' : i === 3 ? 'Wed' : i === 5 ? 'Fri' : ''}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
            {weeks.map((week, wIndex) => {
              const firstDateInWeek = week.find(d => d.dateStr)?.date;
              const prevWeekFirstDate = wIndex > 0 ? weeks[wIndex - 1].find(d => d.dateStr)?.date : null;
              
              const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const currentMonth = firstDateInWeek ? firstDateInWeek.getMonth() : -1;
              const prevMonth = prevWeekFirstDate ? prevWeekFirstDate.getMonth() : currentMonth;
              
              const isNewMonth = currentMonth !== prevMonth && currentMonth !== -1;
              const monthName = firstDateInWeek ? MONTH_NAMES[firstDateInWeek.getMonth()] : null;
              const isFirstWeek = wIndex === 0;
              const showLabel = isNewMonth || isFirstWeek;

              return (
                <div key={wIndex} style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '4px', 
                  flex: 1,
                  marginLeft: isNewMonth ? '12px' : '0' 
                }}>
                  {/* Month Label Header */}
                  <div style={{ height: '20px', position: 'relative' }}>
                    {showLabel && (
                      <span style={{
                        position: 'absolute',
                        left: 0,
                        bottom: '4px',
                        fontSize: '0.75rem',
                        color: 'var(--foreground-muted)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {monthName}
                      </span>
                    )}
                  </div>

                  {/* 7 Days */}
                  {week.map((day, dIndex) => {
                  if (!day.dateStr) {
                    return <div key={dIndex} style={{ flex: 1, aspectRatio: '1/1', background: 'transparent' }} />;
                  }

                  const isSelected = selectedDate === day.dateStr;
                  const isToday = getLocalYYYYMMDD(new Date()) === day.dateStr;

                  return (
                    <button
                      key={dIndex}
                      onClick={() => onSelectDate(day.dateStr)}
                      title={`${day.count} problems on ${day.date.toDateString()}`}
                      style={{
                        flex: 1,
                        aspectRatio: '1/1',
                        backgroundColor: getColor(day.count),
                        borderRadius: '3px',
                        border: isSelected ? '2px solid var(--primary)' : isToday ? '1px solid var(--foreground-subtle)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease, border-color 0.2s ease',
                        padding: 0,
                        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        zIndex: isSelected ? 10 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.transform = 'scale(1.15)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
        <a href="https://leetcode.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
          Powered by LeetCode API
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Less</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--surface-3)' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(34, 197, 94, 0.4)' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(34, 197, 94, 0.7)' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(34, 197, 94, 1)' }} />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
