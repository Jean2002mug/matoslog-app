/**
 * A typed success-or-failure value. Services return this instead of throwing,
 * so screens are forced to handle the error case.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = <T = never>(error: string): Result<T> => ({ ok: false, error });
