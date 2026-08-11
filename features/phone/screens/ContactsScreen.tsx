import React from 'react';
import { EmptyState } from '../components/EmptyState';

export function ContactsScreen() {
  return (
    <EmptyState
      title="No contacts"
      message="Save Speak call codes as contacts for one-tap dialing."
    />
  );
}
