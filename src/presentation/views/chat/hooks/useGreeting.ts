import { useAuthStore } from '@/presentation/store/authStore';

/** Time-of-day greeting bucket boundaries (local clock). */
const MORNING_END = 12;
const AFTERNOON_END = 18;

function timeOfDayPhrase(hour: number): string {
  if (hour < MORNING_END) return 'Good morning';
  if (hour < AFTERNOON_END) return 'Good afternoon';
  return 'Good evening';
}

/**
 * A personalised time-of-day greeting, e.g. "Good morning, Suman".
 *
 * Sourced from the local clock + the user's first name (from the auth store).
 * Falls back to the bare time-of-day phrase when no name is set.
 */
export function useGreeting(): string {
  const user = useAuthStore((s) => s.user);
  const phrase = timeOfDayPhrase(new Date().getHours());
  const firstName = user?.name?.trim().split(/\s+/)[0];
  return firstName ? `${phrase}, ${firstName}` : phrase;
}
