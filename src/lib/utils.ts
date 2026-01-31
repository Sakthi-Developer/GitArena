/** General utility functions */

/**
 * Generate a short pseudo-random hex ID.
 * O(1) time and space.
 */
export function shortId(length = 7): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Clamp a number between min and max.
 * O(1)
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce a function call.
 * O(1) per invocation.
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Throttle using requestAnimationFrame.
 * Ensures at most one call per animation frame — O(1) per call.
 */
export function rafThrottle<T extends (...args: never[]) => void>(
  fn: T,
): (...args: Parameters<T>) => void {
  let queued = false;
  let lastArgs: Parameters<T> | null = null;
  return (...args: Parameters<T>) => {
    lastArgs = args;
    if (!queued) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (lastArgs) fn(...lastArgs);
      });
    }
  };
}

/**
 * Truncate an OID to short form for display.
 */
export function shortOid(oid: string): string {
  return oid.slice(0, 7);
}

/**
 * Simple deep equality for plain objects/arrays.
 * O(n) where n is total number of leaf values.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const keysA = Object.keys(aObj);
  const keysB = Object.keys(bObj);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}

/**
 * Format a timestamp for display.
 */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Noop function */
export const noop = (): void => {};
