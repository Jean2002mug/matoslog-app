import { useEffect, useState } from 'react';

/**
 * The current time (ms since epoch), refreshed every `intervalMs` while `active` is true.
 * Used to redraw timers; the timers themselves are computed from timestamps (see src/domain/timer.ts),
 * so a paused or late tick never makes them wrong — only briefly stale.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [active, intervalMs]);

  return now;
}
