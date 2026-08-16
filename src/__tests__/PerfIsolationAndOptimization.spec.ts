import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      id: 'test-id',
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));

vi.mock('wxt/storage', () => {
  const store: Record<string, any> = {};
  return {
    storage: {
      defineItem: (key: string, opts: { fallback: any }) => {
        return {
          getValue: async () => (key in store ? store[key] : opts.fallback),
          setValue: async (val: any) => {
            store[key] = val;
          },
          watch: () => () => {},
        };
      },
    },
  };
});

import {
  getTrackerPerfMode,
  setTrackerPerfMode,
  resetPerfMetrics,
  generatePerfReport,
  perfMetrics,
} from '../shared/perfMode';
import { RobustDOMEngine } from '../adapters/engine';
import { PlatformAdapter } from '../adapters/types';
import { VisibleDOMStrategy } from '../core/acquisition/strategies/VisibleDOMStrategy';

describe('Performance Isolation & Optimization Suite', () => {
  beforeEach(() => {
    resetPerfMetrics();
    setTrackerPerfMode('FULL');
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should switch TRACKER_PERF_MODE and reflect in telemetry report', () => {
    expect(getTrackerPerfMode()).toBe('FULL');

    setTrackerPerfMode('NETWORK_ONLY');
    expect(getTrackerPerfMode()).toBe('NETWORK_ONLY');

    setTrackerPerfMode('DISABLED');
    expect(getTrackerPerfMode()).toBe('DISABLED');

    perfMetrics.domQueries = 12;
    perfMetrics.mutationCallbacks = 4;
    perfMetrics.idbWrites = 2;
    perfMetrics.tokenJobs = 1;
    perfMetrics.navigationMs.push(14.5);

    const report = generatePerfReport();
    expect(report).toContain('[PERF_REPORT]');
    expect(report).toContain('mode=DISABLED');
    expect(report).toContain('domQueries=12');
    expect(report).toContain('mutationCallbacks=4');
    expect(report).toContain('idbWrites=2');
    expect(report).toContain('tokenJobs=1');
    expect(report).toContain('navigationMs=14.5');
  });

  it('should verify RobustDOMEngine operates without scroll listener or forced reflow overhead', () => {
    const scrollAddSpy = vi.spyOn(window, 'addEventListener');

    const dummyAdapter: PlatformAdapter = {
      id: 'chatgpt',
      name: 'ChatGPT',
      matches: () => true,
      extractMessages: () => [],
      domSelectors: ['article'],
      getThreadId: () => 'thread-123',
    };

    const engine = new RobustDOMEngine(dummyAdapter, () => {});
    engine.start();

    // Verify 'scroll' event listener is NOT attached
    const scrollCalls = scrollAddSpy.mock.calls.filter((call) => call[0] === 'scroll');
    expect(scrollCalls.length).toBe(0);

    engine.dispose();
  });

  it('should scope DOM query extraction to main container when available', async () => {
    document.body.innerHTML = `
      <div id="sidebar"><article data-message-author-role="user"><p>Sidebar noise</p></article></div>
      <main id="main-content">
        <article data-message-id="msg-1" data-message-author-role="user"><div class="whitespace-pre-wrap">Hello AI!</div></article>
        <article data-message-id="msg-2" data-message-author-role="assistant"><div class="prose">Hello Human!</div></article>
      </main>
    `;

    const dummyAdapter: PlatformAdapter = {
      id: 'chatgpt',
      name: 'ChatGPT',
      matches: () => true,
      extractMessages: () => [],
      domSelectors: ['article'],
      getThreadId: () => 'thread-123',
    };

    const strategy = new VisibleDOMStrategy(dummyAdapter);
    const result = await strategy.execute('thread-123');

    expect(result.success).toBe(true);
    expect(result.messages.length).toBe(2);
    expect(result.messages[0].text).toContain('Hello AI!');
    expect(result.messages[1].text).toContain('Hello Human!');
    expect(perfMetrics.domQueries).toBeGreaterThan(0);
  });
});
