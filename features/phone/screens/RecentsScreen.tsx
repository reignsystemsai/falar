import React from 'react';
import { EmptyState } from '../components/EmptyState';

export function RecentsScreen() {
  return (
    <EmptyState
      title="No recent calls"
      message="Recent Speak calls will appear here after you place your first call."
    />
  );
}
