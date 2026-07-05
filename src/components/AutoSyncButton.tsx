'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { autoSyncSubmissionsAction } from '@/app/actions/challenges';
import { useToast } from '@/components/ui/Toast';

export function AutoSyncButton() {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const handleSync = () => {
    startTransition(async () => {
      const result = await autoSyncSubmissionsAction();
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        if (result.count === 0) {
          showToast(result.message || 'Already up to date!', 'info');
        } else {
          showToast(result.message || `Synced ${result.count} new problems!`, 'success');
        }
      }
    });
  };

  return (
    <button
      onClick={handleSync}
      disabled={isPending}
      className="btn btn-secondary btn-sm"
      style={{ gap: '0.375rem' }}
    >
      <RefreshCw
        size={14}
        className={isPending ? 'spin' : ''}
      />
      {isPending ? 'Syncing...' : 'Auto-Sync LeetCode'}
    </button>
  );
}
