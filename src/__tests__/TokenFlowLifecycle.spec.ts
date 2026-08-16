import { describe, it, expect, beforeEach, vi } from 'vitest';

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
import { publishTokenState, JobContext } from '../core/tokenPublisher';
import { conversationManager } from '../core/ConversationManager';

describe('Token Flow Lifecycle & Instant Cache Restoration', () => {
  beforeEach(async () => {
    SessionGeneration.reset();
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
  });

  it('should restore cached derived tokens immediately upon switching to a known conversation', async () => {
    // 1. Initial visit to conversation B with 11,451 tokens
    const genB = SessionGeneration.switchConversation('chatgpt:conv-B');
    const jobB: JobContext = {
      jobId: 'job-B-1',
      conversationId: 'chatgpt:conv-B',
      conversationVersion: 1,
      inputHash: 'hash-B-1',
      inputMessageCount: 14,
      generation: genB,
    };

    await publishTokenState(jobB, {
      tokenCount: 11451,
      inputTokens: 5000,
      outputTokens: 6451,
      confidence: 1,
      isStreaming: false,
      source: 'network_history',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 7,
      avgTokensPerTurn: 1635,
      healthMetrics: {},
      tabId: 1,
    });

    const stateB = await storageLayer.appState.getValue(1);
    expect(stateB.activeConversationId).toBe('chatgpt:conv-B');
    expect(stateB.tokenEstimate.count).toBe(11451);

    // 2. Switch from B to A (A has 180,000 tokens)
    const genA = SessionGeneration.switchConversation('chatgpt:conv-A');
    const jobA: JobContext = {
      jobId: 'job-A-1',
      conversationId: 'chatgpt:conv-A',
      conversationVersion: 1,
      inputHash: 'hash-A-1',
      inputMessageCount: 193,
      generation: genA,
    };

    await publishTokenState(jobA, {
      tokenCount: 180000,
      inputTokens: 90000,
      outputTokens: 90000,
      confidence: 1,
      isStreaming: false,
      source: 'network_history',
      platform: 'chatgpt',
      status: 'warning',
      currentSummary: null,
      turns: 96,
      avgTokensPerTurn: 1875,
      healthMetrics: {},
      tabId: 1,
    });

    const stateA = await storageLayer.appState.getValue(1);
    expect(stateA.activeConversationId).toBe('chatgpt:conv-A');
    expect(stateA.tokenEstimate.count).toBe(180000);

    // 3. Switch back to B (A -> B)
    // Background simulates SET_ACTIVE_CONVERSATION for B:
    const newGenB = SessionGeneration.switchConversation('chatgpt:conv-B');
    const rawRuntime = await storageLayer.runtimeState.getValue();
    const cachedB = rawRuntime[1]?.derivedState?.['chatgpt:conv-B'];
    expect(cachedB).toBeDefined();
    expect(cachedB.tokenEstimate.count).toBe(11451);

    // Immediate cache restoration
    SessionGeneration.setReady('chatgpt:conv-B', newGenB, cachedB.version ?? 1);
    await storageLayer.updateAppState(
      {
        activeConversationId: 'chatgpt:conv-B',
        conversationId: 'chatgpt:conv-B',
        generation: newGenB,
        version: cachedB.version ?? 1,
        tokenEstimate: cachedB.tokenEstimate,
        status: cachedB.status || 'healthy',
        stats: cachedB.stats,
      } as any,
      1
    );

    // Assert UI displays B's 11,451 tokens immediately without remaining in 0/LOADING
    const immediateB = await storageLayer.appState.getValue(1);
    expect(immediateB.activeConversationId).toBe('chatgpt:conv-B');
    expect(immediateB.tokenEstimate.count).toBe(11451);
  });

  it('should reject stale async token publication from previous conversation across multi-hop switch (A -> B -> C -> A)', async () => {
    // Start on A
    const genA1 = SessionGeneration.switchConversation('chatgpt:A');
    const staleJobA: JobContext = {
      jobId: 'slow-job-A',
      conversationId: 'chatgpt:A',
      conversationVersion: 1,
      inputHash: 'hash-A',
      inputMessageCount: 100,
      generation: genA1,
    };

    // User navigates A -> B -> C
    SessionGeneration.switchConversation('chatgpt:B');
    const genC = SessionGeneration.switchConversation('chatgpt:C');

    // Stale Job A completes now while active conversation is C
    const published = await publishTokenState(staleJobA, {
      tokenCount: 99999,
      inputTokens: 50000,
      outputTokens: 49999,
      confidence: 1,
      isStreaming: false,
      source: 'live_dom',
      platform: 'chatgpt',
      status: 'critical',
      currentSummary: null,
      turns: 50,
      avgTokensPerTurn: 2000,
      healthMetrics: {},
      tabId: 1,
    });

    // Publication MUST be rejected
    expect(published).toBe(false);

    // Active state on C must not have been contaminated by A's 99,999 tokens
    const stateC = await storageLayer.appState.getValue(1);
    expect(stateC.activeConversationId).toBe('chatgpt:C');
    expect(stateC.tokenEstimate.count).toBe(0);
  });
});
