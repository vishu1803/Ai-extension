/**
 * Centralized Logger for AI Context Tracker
 *
 * Production Logging Policy:
 * - Default runtime logs ONLY important lifecycle/error events.
 * - Verbose diagnostic output is behind `DEBUG_TRACKER = false`.
 */

export const DEBUG_TRACKER = false;

export const logger = {
  /**
   * Log high-level production tracker lifecycle events.
   * Format: [Tracker] event_name param1=val1 param2=val2
   */
  tracker(event: string, details?: Record<string, unknown> | string | number) {
    if (typeof details === 'object' && details !== null) {
      const lines = Object.entries(details)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${v}`);
      if (lines.length > 0) {
        console.log(`[Tracker] ${event}\n${lines.join('\n')}`);
      } else {
        console.log(`[Tracker] ${event}`);
      }
    } else if (details !== undefined && details !== null) {
      console.log(`[Tracker] ${event}\n${details}`);
    } else {
      console.log(`[Tracker] ${event}`);
    }
  },

  /**
   * Debug diagnostics — active ONLY when DEBUG_TRACKER is enabled.
   */
  debug(...args: unknown[]) {
    if (DEBUG_TRACKER) {
      console.log(...args);
    }
  },

  /**
   * Informational logs — active ONLY when DEBUG_TRACKER is enabled.
   */
  info(...args: unknown[]) {
    if (DEBUG_TRACKER) {
      console.log(...args);
    }
  },

  /**
   * Production warnings.
   */
  warn(message: string, ...args: unknown[]) {
    console.warn(`[Tracker] warning: ${message}`, ...args);
  },

  /**
   * Production error logging.
   */
  error(message: string, error?: unknown) {
    if (error instanceof Error) {
      console.error(`[Tracker] error: ${message} - ${error.message}`);
      if (DEBUG_TRACKER && error.stack) {
        console.error(error.stack);
      }
    } else if (error !== undefined) {
      console.error(`[Tracker] error: ${message}`, error);
    } else {
      console.error(`[Tracker] error: ${message}`);
    }
  },

  /**
   * Performance measurement — active ONLY when DEBUG_TRACKER is enabled.
   * Uses [PERF:EXTENSION] format for easy grep/filtering.
   */
  perf(label: string, durationMs: number) {
    if (DEBUG_TRACKER) {
      console.log(`[PERF:EXTENSION] operation=${label} durationMs=${durationMs.toFixed(1)}`);
    }
  },
};
