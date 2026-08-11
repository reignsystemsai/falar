import React from 'react';
import { EmptyState } from '../components/EmptyState';

export function FavoritesScreen() {
  return (
    <EmptyState
      title="No favorites yet"
      message="Add contacts and mark them as favorites for quick calls."
    />
  );
}
