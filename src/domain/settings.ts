/**
 * App preferences. Pure TypeScript — no React, no SQL.
 */

/** Yes/no preferences, stored by key. */
export type FlagSetting = 'confirmCancelWorkout' | 'confirmCancelRest';

/** What each flag is when the user hasn't chosen: always ask before cancelling. */
export const FLAG_DEFAULTS: Record<FlagSetting, boolean> = {
  confirmCancelWorkout: true,
  confirmCancelRest: true,
};

export type Flags = Record<FlagSetting, boolean>;
