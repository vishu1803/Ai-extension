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
import { CanonicalDerivedStore } from '../core/tokenStore';
import {
  publishCanonicalTokenResult,
  projectActiveCanonicalTokens,
  JobContext,
} from '../core/tokenPublisher';

describe('Stabilization Reset: Deterministic Canonical Token Pipeline', () => {
  beforeEach(async () => {
    SessionGeneration.reset();
    CanonicalDerivedStore.clear();
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
  });

  it('TEST 1 & 2: should tokenize small and large conversations into CanonicalDerivedStore and active UI', async () => {
    // 1. Small conversation
    const genSmall = SessionGeneration.switchConversation('chatgpt:conv-small');
    const smallJob: JobContext = {
      jobId: 'job-small',
      conversationId: 'chatgpt:conv-small',
      conversationVersion: 1,
      inputHash: 'hash-small',
      inputMessageCount: 4,
      generation: genSmall,
    };

    await publishCanonicalTokenResult(smallJob, {
      tokenCount: 450,
      inputTokens: 200,
      outputTokens: 250,
      confidence: 1,
      isStreaming: false,
      source: 'canonical',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 2,
      avgTokensPerTurn: 225,
      healthMetrics: {},
      tabId: 1,
    });

    const smallDerived = CanonicalDerivedStore.get('chatgpt:conv-small');
    expect(smallDerived).toBeDefined();
    expect(smallDerived?.tokenCount).toBe(450);

    let appState = await storageLayer.appState.getValue(1);
    expect(appState.activeConversationId).toBe('chatgpt:conv-small');
    expect(appState.tokenEstimate.count).toBe(450);

    // 2. Large conversation
    const genLarge = SessionGeneration.switchConversation('chatgpt:conv-large');
    const largeJob: JobContext = {
      jobId: 'job-large',
      conversationId: 'chatgpt:conv-large',
      conversationVersion: 1,
      inputHash: 'hash-large',
      inputMessageCount: 195,
      generation: genLarge,
    };

    await publishCanonicalTokenResult(largeJob, {
      tokenCount: 182400,
      inputTokens: 90000,
      outputTokens: 92400,
      confidence: 1,
      isStreaming: false,
      source: 'canonical',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 97,
      avgTokensPerTurn: 1880,
      healthMetrics: {},
      tabId: 1,
    });

    const largeDerived = CanonicalDerivedStore.get('chatgpt:conv-large');
    expect(largeDerived).toBeDefined();
    expect(largeDerived?.tokenCount).toBe(182400);

    appState = await storageLayer.appState.getValue(1);
    expect(appState.activeConversationId).toBe('chatgpt:conv-large');
    expect(appState.tokenEstimate.count).toBe(182400);
  });

  it('TEST 3 & 4: should switch small -> large -> small and restore each conversation own token count perfectly without leakage', async () => {
    // Populate store for small and large
    CanonicalDerivedStore.set({
      conversationId: 'chatgpt:conv-small',
      canonicalVersion: 1,
      messageCount: 4,
      tokenCount: 450,
      inputTokens: 200,
      outputTokens: 250,
      confidence: 1,
      turns: 2,
      status: 'healthy',
      healthMetrics: {},
      currentSummary: null,
      timestamp: Date.now(),
    });

    CanonicalDerivedStore.set({
      conversationId: 'chatgpt:conv-large',
      canonicalVersion: 1,
      messageCount: 195,
      tokenCount: 182400,
      inputTokens: 90000,
      outputTokens: 92400,
      confidence: 1,
      turns: 97,
      status: 'healthy',
      healthMetrics: {},
      currentSummary: null,
      timestamp: Date.now(),
    });

    // 1. Switch to small
    SessionGeneration.switchConversation('chatgpt:conv-small');
    await projectActiveCanonicalTokens('chatgpt:conv-small', 1);

    let state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe('chatgpt:conv-small');
    expect(state.tokenEstimate.count).toBe(450);

    // 2. Switch to large
    SessionGeneration.switchConversation('chatgpt:conv-large');
    await projectActiveCanonicalTokens('chatgpt:conv-large', 1);

    state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe('chatgpt:conv-large');
    expect(state.tokenEstimate.count).toBe(182400);

    // 3. Switch back to small
    SessionGeneration.switchConversation('chatgpt:conv-small');
    await projectActiveCanonicalTokens('chatgpt:conv-small', 1);

    state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe('chatgpt:conv-small');
    expect(state.tokenEstimate.count).toBe(450);

    // 4. Refresh: restores same conversation
    await projectActiveCanonicalTokens('chatgpt:conv-small', 1);
    state = await storageLayer.appState.getValue(1);
    expect(state.tokenEstimate.count).toBe(450);
  });

  it('TEST 5 & 6: should execute canonical tokenization after turn commits with zero intermediate streaming oscillations', async () => {
    const convId = 'chatgpt:conv-1';
    const gen = SessionGeneration.switchConversation(convId);

    // Initial baseline: 1000 tokens
    CanonicalDerivedStore.set({
      conversationId: convId,
      canonicalVersion: 1,
      messageCount: 4,
      tokenCount: 1000,
      inputTokens: 500,
      outputTokens: 500,
      confidence: 1,
      turns: 2,
      status: 'healthy',
      healthMetrics: {},
      currentSummary: null,
      timestamp: Date.now(),
    });

    await projectActiveCanonicalTokens(convId, 1);
    let state = await storageLayer.appState.getValue(1);
    expect(state.tokenEstimate.count).toBe(1000);

    // 1. User sends prompt (+150 tokens) -> Committed to Canonical version 2
    const userJob: JobContext = {
      jobId: 'job-user-prompt',
      conversationId: convId,
      conversationVersion: 2,
      inputHash: 'hash-v2',
      inputMessageCount: 5,
      generation: gen,
    };

    await publishCanonicalTokenResult(userJob, {
      tokenCount: 1150,
      inputTokens: 650,
      outputTokens: 500,
      confidence: 1,
      isStreaming: false,
      source: 'canonical',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 3,
      avgTokensPerTurn: 383,
      healthMetrics: {},
      tabId: 1,
    });

    state = await storageLayer.appState.getValue(1);
    expect(state.tokenEstimate.count).toBe(1150);

    // 2. Assistant streams (turns commit text to canonical, but token publication occurs on final completion)
    // Completed streaming turn -> Canonical version 3 (1550 tokens)
    const finJob: JobContext = {
      jobId: 'job-turn-complete',
      conversationId: convId,
      conversationVersion: 3,
      inputHash: 'hash-v3',
      inputMessageCount: 6,
      generation: gen,
    };

    await publishCanonicalTokenResult(finJob, {
      tokenCount: 1550,
      inputTokens: 650,
      outputTokens: 900,
      confidence: 1,
      isStreaming: false,
      source: 'canonical',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 3,
      avgTokensPerTurn: 516,
      healthMetrics: {},
      tabId: 1,
    });

    state = await storageLayer.appState.getValue(1);
    expect(state.tokenEstimate.count).toBe(1550);
  });

  it('TEST 7 & 8: should reject background token completion from inactive conversation when user navigates away', async () => {
    // 1. Start on Conversation A
    const genA = SessionGeneration.switchConversation('chatgpt:conv-A');

    const jobA: JobContext = {
      jobId: 'job-slow-A',
      conversationId: 'chatgpt:conv-A',
      conversationVersion: 1,
      inputHash: 'hash-A',
      inputMessageCount: 100,
      generation: genA,
    };

    // 2. User quickly navigates to Conversation B
    SessionGeneration.switchConversation('chatgpt:conv-B');
    await projectActiveCanonicalTokens('chatgpt:conv-B', 1);

    let state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe('chatgpt:conv-B');
    expect(state.tokenEstimate.count).toBe(0); // B is in loading/neutral state

    // 3. Slow job for A finishes
    const published = await publishCanonicalTokenResult(jobA, {
      tokenCount: 88000,
      inputTokens: 40000,
      outputTokens: 48000,
      confidence: 1,
      isStreaming: false,
      source: 'canonical',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 50,
      avgTokensPerTurn: 1760,
      healthMetrics: {},
      tabId: 1,
    });

    // Verify rejection from active UI
    expect(published).toBe(false);

    // Verify A stored its derived tokens for later
    expect(CanonicalDerivedStore.get('chatgpt:conv-A')?.tokenCount).toBe(88000);

    // Verify B was NOT corrupted
    state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe('chatgpt:conv-B');
    expect(state.tokenEstimate.count).toBe(0);
  });
});
