/**
 * Performance Mode Isolation and Telemetry Counters
 *
 * Modes:
 * 1. DISABLED: Complete isolation, no interceptors, no observers, no tokenization.
 * 2. NETWORK_ONLY: Only MAIN-world network interception.
 * 3. NETWORK_CANONICAL: Network interception + normalization + canonical IndexedDB.
 * 4. OBSERVER_ONLY: Lightweight DOM observer only (no tokens/IDB/UI).
 * 5. FULL: Full production extension pipeline (default).
 */

export type TrackerPerfMode =
  'DISABLED' | 'NETWORK_ONLY' | 'NETWORK_CANONICAL' | 'OBSERVER_ONLY' | 'FULL';

export interface PerfMetrics {
  mode: TrackerPerfMode;
  navigationMs: number[];
  scrollMaxMs: number;
  mutationCallbacks: number;
  recordsObserved: number;
  domQueries: number;
  idbWrites: number;
  storageWrites: number;
  runtimeMessages: number;
  tokenJobs: number;
  summaryJobs: number;
}

let currentPerfMode: TrackerPerfMode = 'FULL';

export const perfMetrics: PerfMetrics = {
  mode: 'FULL',
  navigationMs: [],
  scrollMaxMs: 0,
  mutationCallbacks: 0,
  recordsObserved: 0,
  domQueries: 0,
  idbWrites: 0,
  storageWrites: 0,
  runtimeMessages: 0,
  tokenJobs: 0,
  summaryJobs: 0,
};

export function getTrackerPerfMode(): TrackerPerfMode {
  if (typeof window !== 'undefined' && (window as any).__TRACKER_PERF_MODE__) {
    return (window as any).__TRACKER_PERF_MODE__;
  }
  return currentPerfMode;
}

export function setTrackerPerfMode(mode: TrackerPerfMode): void {
  currentPerfMode = mode;
  perfMetrics.mode = mode;
  if (typeof window !== 'undefined') {
    (window as any).__TRACKER_PERF_MODE__ = mode;
  }
}

export function resetPerfMetrics(): void {
  perfMetrics.navigationMs = [];
  perfMetrics.scrollMaxMs = 0;
  perfMetrics.mutationCallbacks = 0;
  perfMetrics.recordsObserved = 0;
  perfMetrics.domQueries = 0;
  perfMetrics.idbWrites = 0;
  perfMetrics.storageWrites = 0;
  perfMetrics.runtimeMessages = 0;
  perfMetrics.tokenJobs = 0;
  perfMetrics.summaryJobs = 0;
}

export function generatePerfReport(): string {
  const navMedian =
    perfMetrics.navigationMs.length > 0
      ? (
          perfMetrics.navigationMs.reduce((a, b) => a + b, 0) / perfMetrics.navigationMs.length
        ).toFixed(1)
      : '0.0';

  return (
    `[PERF_REPORT]\n` +
    `mode=${getTrackerPerfMode()}\n` +
    `navigationMs=${navMedian}\n` +
    `scrollMaxMs=${perfMetrics.scrollMaxMs.toFixed(1)}\n` +
    `mutationCallbacks=${perfMetrics.mutationCallbacks}\n` +
    `domQueries=${perfMetrics.domQueries}\n` +
    `idbWrites=${perfMetrics.idbWrites}\n` +
    `storageWrites=${perfMetrics.storageWrites}\n` +
    `runtimeMessages=${perfMetrics.runtimeMessages}\n` +
    `tokenJobs=${perfMetrics.tokenJobs}\n` +
    `summaryJobs=${perfMetrics.summaryJobs}`
  );
}

export function startMeasure(markName: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    try {
      performance.mark(`${markName}:start`);
    } catch {}
  }
}

export function endMeasure(markName: string): number {
  if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
    try {
      performance.mark(`${markName}:end`);
      performance.measure(markName, `${markName}:start`, `${markName}:end`);
      const entries = performance.getEntriesByName(markName);
      if (entries.length > 0) {
        const duration = entries[entries.length - 1].duration;
        return duration;
      }
    } catch {}
  }
  return 0;
}

export function logPerfReport(): void {
  console.log(generatePerfReport());
}
