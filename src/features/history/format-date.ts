/**
 * Display helpers for stored UTC ISO-8601 timestamps. They format in the DEVICE's
 * local time zone and language, as CLAUDE.md requires ("displayed in device-local time").
 */

/** e.g. "Thu, 12 Nov 2026" (exact format follows the device's language). */
export function formatWorkoutDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** e.g. "18:30" or "6:30 PM", depending on the device's settings. */
export function formatWorkoutTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
