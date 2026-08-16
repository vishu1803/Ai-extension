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
import { CanonicalDerivedStore, TokenBaselineStore } from '../core/tokenStore';
import {
  publishCanonicalTokenResult,
  projectActiveCanonicalTokens,
  JobContext,
} from '../core/tokenPublisher';

describe('Authoritative Canonical Token Architecture', () => {
  beforeEach(async () => {
    SessionGeneration.reset();
    CanonicalDerivedStore.clear();
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
  });

  it('should establish canonical token state and derive displayed tokens correctly', async () => {
    const convId = 'chatgpt:conv-A';
    const gen = SessionGeneration.switchConversation(convId);

    const jobContext: JobContext = {
      jobId: 'job-1',
      conversationId: convId,
      conversationVersion: 1,
      inputHash: 'hash-1',
      inputMessageCount: 189,
      generation: gen,
    };

    // 1. Establish canonical tokens of 192,000
    await publishCanonicalTokenResult(jobContext, {
      tokenCount: 192000,
      inputTokens: 90000,
      outputTokens: 102000,
      confidence: 1,
      isStreaming: false,
      source: 'canonical',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 94,
      avgTokensPerTurn: 2042,
      healthMetrics: {},
      tabId: 1,
    });

    const record = CanonicalDerivedStore.get(convId);
    expect(record).toBeDefined();
    expect(record?.tokenCount).toBe(192000);
    expect(record?.canonicalVersion).toBe(1);

    const appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(192000);
    expect(appState.tokenEstimate.isStreaming).toBe(false);
  });

  it('should update canonical token state cleanly upon turn completion', async () => {
    const convId = 'chatgpt:conv-A';
    const gen = SessionGeneration.switchConversation(convId);

    // Initial version 1
    await publishCanonicalTokenResult(
      {
        jobId: 'job-1',
        conversationId: convId,
        conversationVersion: 1,
        inputHash: 'hash-1',
        inputMessageCount: 189,
        generation: gen,
      },
      {
        tokenCount: 192000,
        inputTokens: 90000,
        outputTokens: 102000,
        confidence: 1,
        isStreaming: false,
        source: 'canonical',
        platform: 'chatgpt',
        status: 'healthy',
        currentSummary: null,
        turns: 94,
        avgTokensPerTurn: 2042,
        healthMetrics: {},
        tabId: 1,
      }
    );

    let appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(192000);

    // Completed turn -> Version 2 (194,270 tokens)
    await publishCanonicalTokenResult(
      {
        jobId: 'job-2',
        conversationId: convId,
        conversationVersion: 2,
        inputHash: 'hash-2',
        inputMessageCount: 191,
        generation: gen,
      },
      {
        tokenCount: 194270,
        inputTokens: 90850,
        outputTokens: 103420,
        confidence: 1,
        isStreaming: false,
        source: 'canonical',
        platform: 'chatgpt',
        status: 'healthy',
        currentSummary: null,
        turns: 95,
        avgTokensPerTurn: 2044,
        healthMetrics: {},
        tabId: 1,
      }
    );

    const finalRecord = CanonicalDerivedStore.get(convId);
    expect(finalRecord?.tokenCount).toBe(194270);
    expect(finalRecord?.canonicalVersion).toBe(2);

    appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(194270);
    expect(appState.tokenEstimate.isStreaming).toBe(false);
  });

  it('should isolate token state across conversation switching (A -> B -> A) without cross-contamination', async () => {
    // 1. Establish Conversation A
    const genA = SessionGeneration.switchConversation('chatgpt:conv-A');
    await publishCanonicalTokenResult(
      {
        jobId: 'job-A',
        conversationId: 'chatgpt:conv-A',
        conversationVersion: 1,
        inputHash: 'hash-A',
        inputMessageCount: 189,
        generation: genA,
      },
      {
        tokenCount: 166795,
        inputTokens: 80000,
        outputTokens: 86795,
        confidence: 1,
        isStreaming: false,
        source: 'canonical',
        platform: 'chatgpt',
        status: 'healthy',
        currentSummary: null,
        turns: 94,
        avgTokensPerTurn: 1774,
        healthMetrics: {},
        tabId: 1,
      }
    );

    let state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe('chatgpt:conv-A');
    expect(state.tokenEstimate.count).toBe(166795);

    // 2. Switch to Conversation B
    const genB = SessionGeneration.switchConversation('chatgpt:conv-B');
    await publishCanonicalTokenResult(
      {
        jobId: 'job-B',
        conversationId: 'chatgpt:conv-B',
        conversationVersion: 1,
        inputHash: 'hash-B',
        inputMessageCount: 14,
        generation: genB,
      },
      {
        tokenCount: 11451,
        inputTokens: 5000,
        outputTokens: 6451,
        confidence: 1,
        isStreaming: false,
        source: 'canonical',
        platform: 'chatgpt',
        status: 'healthy',
        currentSummary: null,
        turns: 7,
        avgTokensPerTurn: 1635,
        healthMetrics: {},
        tabId: 1,
      }
    );

    state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe('chatgpt:conv-B');
    expect(state.tokenEstimate.count).toBe(11451);

    // 3. Stale background job for A arrives while active conversation is B
    const staleResult = await publishCanonicalTokenResult(
      {
        jobId: 'job-A-stale',
        conversationId: 'chatgpt:conv-A',
        conversationVersion: 1,
        inputHash: 'hash-A',
        inputMessageCount: 189,
        generation: genA,
      },
      {
        tokenCount: 166795,
        inputTokens: 80000,
        outputTokens: 86795,
        confidence: 1,
        isStreaming: false,
        source: 'canonical',
        platform: 'chatgpt',
        status: 'healthy',
        currentSummary: null,
        turns: 94,
        avgTokensPerTurn: 1774,
        healthMetrics: {},
        tabId: 1,
      }
    );
    expect(staleResult).toBe(false); // Rejected because active conversation is B!

    state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe('chatgpt:conv-B');
    expect(state.tokenEstimate.count).toBe(11451); // B is untouched

    // 4. Switch back to Conversation A
    SessionGeneration.switchConversation('chatgpt:conv-A');
    await projectActiveCanonicalTokens('chatgpt:conv-A', 1);

    state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe('chatgpt:conv-A');
    expect(state.tokenEstimate.count).toBe(166795); // A is restored perfectly
  });
});
