export type PhoneTabKey = 'favorites' | 'recents' | 'contacts' | 'keypad';

export interface Contact {
  id: string;
  name: string;
  number: string;
  isFavorite?: boolean;
}

export type RecentCallResult = 'completed' | 'failed' | 'canceled';

export interface RecentCall {
  id: string;
  number: string;
  contactName?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  result: RecentCallResult;
}
