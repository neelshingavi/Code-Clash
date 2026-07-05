"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION = 4000;

const toastConfig = {
  success: {
    icon: CheckCircle2,
    accentColor: 'var(--success)',
    bgAccent: 'rgba(52, 211, 153, 0.08)',
  },
  error: {
    icon: XCircle,
    accentColor: 'var(--danger)',
    bgAccent: 'rgba(248, 113, 113, 0.08)',
  },
  info: {
    icon: Info,
    accentColor: 'var(--info)',
    bgAccent: 'rgba(96, 165, 250, 0.08)',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div 
        role="status" 
        aria-live="polite" 
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          zIndex: 9999,
          maxWidth: '420px',
          width: '100%',
          pointerEvents: 'none',
        }}>
        {toasts.map((toast) => {
          const config = toastConfig[toast.type];
          const Icon = config.icon;

          return (
            <div key={toast.id} style={{
              display: 'flex',
              alignItems: 'stretch',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-1)',
              border: '1px solid var(--surface-border)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: 'auto',
              position: 'relative',
            }}>
              {/* Accent bar */}
              <div style={{
                width: '4px',
                background: config.accentColor,
                flexShrink: 0,
              }} />

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                flex: 1,
                minWidth: 0,
              }}>
                <Icon size={18} color={config.accentColor} style={{ flexShrink: 0 }} />
                <span style={{
                  flex: 1,
                  fontSize: '0.875rem',
                  color: 'var(--foreground)',
                  lineHeight: 1.4,
                }}>
                  {toast.message}
                </span>
                <button
                  onClick={() => removeToast(toast.id)}
                  style={{
                    color: 'var(--foreground-subtle)',
                    padding: '0.25rem',
                    borderRadius: 'var(--radius-sm)',
                    flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Auto-dismiss progress bar */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: '4px',
                right: 0,
                height: '2px',
                background: config.accentColor,
                opacity: 0.4,
                animation: `progress-shrink ${TOAST_DURATION}ms linear forwards`,
              }} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
