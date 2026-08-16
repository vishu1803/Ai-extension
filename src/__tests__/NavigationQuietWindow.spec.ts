import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { storageLayer } from '../storage';
import { SessionGeneration } from '../core/sessionGeneration';
import { RobustDOMEngine } from '../adapters/engine';
import { PlatformAdapter } from '../adapters/types';
import { ConversationReadyDetector } from '../adapters/ConversationReadyDetector';
import { resetPerfMetrics } from '../shared/perfMode';
import { publishBaselineState, JobContext } from '../core/tokenPublisher';

describe('Navigation Quiet Window & Zero-Freeze Incident Tests', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    resetPerfMetrics();
    SessionGeneration.reset();
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
    document.body.innerHTML = '<main><div id="prompt-textarea"></div></main>';
  });

  const mockAdapter: PlatformAdapter = {
    id: 'chatgpt',
    name: 'ChatGPT',
    matches: () => true,
    getThreadId: () => 'thread-A',
    domSelectors: ['[data-message-author-role]'],
    extractMessages: () => [],
    isStreaming: () => false,
  };

  it('should immediately enter Quiet Mode during navigation and suppress mutation work', () => {
    const observations: any[] = [];
    const engine = new RobustDOMEngine(mockAdapter, (obs) => {
      observations.push(obs);
    });

    engine.start();

    // Trigger location change (A -> B)
    mockAdapter.getThreadId = () => 'thread-B';
    window.dispatchEvent(new Event('locationchange'));

    // Verify engine is in Quiet Mode and navigating
    expect((engine as any).quietMode).toBe(true);
    expect((engine as any).isNavigating).toBe(true);

    // Simulate burst of 50 mutations while in Quiet Mode
    for (let i = 0; i < 50; i++) {
      (engine as any).handleMutationBatch();
    }

    // Must have marked dirty without scheduling timers or executing DOM queries
    expect((engine as any).mutationPending).toBe(true);
    expect((engine as any).mutationBatchTimer).toBeNull();
    expect(observations.length).toBe(0);

    // Fast-forward 150ms stabilization window
    vi.advanceTimersByTime(150);

    // Verify Quiet Mode has exited and transaction committed
    expect((engine as any).quietMode).toBe(false);
    expect((engine as any).isNavigating).toBe(false);
    expect((engine as any).activeConversationId).toBe('chatgpt:thread-B');

    engine.dispose();
  });

  it('should verify ConversationReadyDetector does not use interval polling', () => {
    let readyCalled = false;
    const detector = new ConversationReadyDetector(mockAdapter, () => {
      readyCalled = true;
    });

    detector.start();

    // Check that no recurring poll timer exists
    expect((detector as any).pollTimer).toBeUndefined();

    // Advance timers by 50ms (ready debounced check)
    vi.advanceTimersByTime(50);
    expect(readyCalled).toBe(true);

    detector.stop();
  });

  it('should discard out-of-order and stale token jobs when navigation generation changes', async () => {
    // 1. Initial conversation A
    const genA = SessionGeneration.switchConversation('chatgpt:thread-A');

    const staleJobContext: JobContext = {
      jobId: 'job-stale-A',
      conversationId: 'chatgpt:thread-A',
      conversationVersion: 1,
      inputHash: 'hash-A',
      inputMessageCount: 100,
      generation: genA,
    };

    // 2. User rapidly switches to conversation B before A finishes tokenizing
    SessionGeneration.switchConversation('chatgpt:thread-B');

    // 3. Stale job for A completes
    const result = await publishBaselineState(staleJobContext, {
      tokenCount: 150000,
      inputTokens: 75000,
      outputTokens: 75000,
      confidence: 1,
      isStreaming: false,
      source: 'network_history',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 50,
      avgTokensPerTurn: 1500,
      healthMetrics: {},
      tabId: 1,
    });

    // Verify rejection: stale job was rejected and did NOT corrupt active state
    expect(result).toBe(false);
    const appState = await storageLayer.appState.getValue(1);
    expect(appState.activeConversationId).toBe('chatgpt:thread-B');
    expect(appState.tokenEstimate.count).toBe(0); // B was untouched by A
  });
});
