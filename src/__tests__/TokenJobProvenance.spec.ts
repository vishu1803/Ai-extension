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

// Mock IndexedDB for ConversationManager
const mockConversations: Record<string, any> = {};
vi.mock('../storage/db', () => ({
  getDB: async () => ({
    transaction: () => ({
      objectStore: () => ({
        get: async (id: string) => mockConversations[id],
        put: async (val: any) => {
          mockConversations[val.id] = val;
        },
      }),
      done: Promise.resolve(),
    }),
  }),
}));

import { storageLayer } from '../storage';
import { publishTokenState, JobContext, PublishTokenMeta } from '../core/tokenPublisher';
import { SessionGeneration } from '../core/sessionGeneration';
import { computeInputHash } from '../core/ConversationManager';

describe('Token Job Provenance & Generation Fencing', () => {
  beforeEach(async () => {
    SessionGeneration.reset();
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
    for (const k of Object.keys(mockConversations)) {
      delete mockConversations[k];
    }
  });

  const sampleMeta: PublishTokenMeta = {
    tokenCount: 1500,
    inputTokens: 750,
    outputTokens: 750,
    confidence: 1,
    isStreaming: false,
    source: 'network_history',
    platform: 'chatgpt',
    status: 'healthy',
    currentSummary: null,
    turns: 5,
    avgTokensPerTurn: 300,
    healthMetrics: {},
    tabId: 1,
  };

  it('should successfully publish when job context matches active conversation and generation', async () => {
    const convId = 'chatgpt:conv-1';
    SessionGeneration.switchConversation(convId);
    await storageLayer.updateAppState({ activeConversationId: convId, conversationId: convId }, 1);

    const messages = [{ id: 'm1', text: 'Hello' }];
    mockConversations[convId] = {
      id: convId,
      version: 1,
      orderedMessageIds: ['m1'],
      messages: { m1: messages[0] },
    };

    const hash = computeInputHash(messages);

    const jobContext: JobContext = {
      jobId: 'job_1',
      conversationId: convId,
      conversationVersion: 1,
      inputHash: hash,
      inputMessageCount: 1,
      generation: SessionGeneration.getGeneration(),
    };

    const published = await publishTokenState(jobContext, sampleMeta);
    expect(published).toBe(true);

    const state = await storageLayer.appState.getValue(1);
    expect(state.activeConversationId).toBe(convId);
    expect(state.tokenEstimate.count).toBe(1500);
  });

  it('should reject token result from conversation A when active conversation has switched to B', async () => {
    // 1. Start on Conversation A (gen 1)
    const convA = 'chatgpt:conv-A';
    SessionGeneration.switchConversation(convA);
    const genA = SessionGeneration.getGeneration();

    const messagesA = [{ id: 'm1', text: 'Large conversation content' }];
    mockConversations[convA] = {
      id: convA,
      version: 1,
      orderedMessageIds: ['m1'],
      messages: { m1: messagesA[0] },
    };

    const jobA: JobContext = {
      jobId: 'job_A',
      conversationId: convA,
      conversationVersion: 1,
      inputHash: computeInputHash(messagesA),
      inputMessageCount: 183,
      generation: genA,
    };

    // 2. User navigates to Conversation B (gen 2)
    const convB = 'chatgpt:conv-B';
    SessionGeneration.switchConversation(convB);
    await storageLayer.updateAppState({ activeConversationId: convB, conversationId: convB }, 1);

    // Initial state of B must be clean (0 tokens)
    const initialB = await storageLayer.appState.getValue(1);
    expect(initialB.activeConversationId).toBe(convB);
    expect(initialB.tokenEstimate.count).toBe(0);

    // 3. Job A finishes late with 210,000 tokens
    const publishedA = await publishTokenState(jobA, {
      ...sampleMeta,
      tokenCount: 210129,
    });

    expect(publishedA).toBe(false);

    // UI state for B must remain untouched (0 tokens, not 210K)
    const stateAfterA = await storageLayer.appState.getValue(1);
    expect(stateAfterA.activeConversationId).toBe(convB);
    expect(stateAfterA.tokenEstimate.count).toBe(0);
  });

  it('should handle out-of-order async completions across multi-hop navigation (A -> B -> A -> B)', async () => {
    // Conversation A (gen 1)
    const convA = 'chatgpt:conv-A';
    SessionGeneration.switchConversation(convA);
    const jobA1: JobContext = {
      jobId: 'job_A1',
      conversationId: convA,
      conversationVersion: 1,
      inputHash: 'hash_A1',
      inputMessageCount: 100,
      generation: SessionGeneration.getGeneration(),
    };

    // Switch to B (gen 2)
    const convB = 'chatgpt:conv-B';
    SessionGeneration.switchConversation(convB);
    const jobB1: JobContext = {
      jobId: 'job_B1',
      conversationId: convB,
      conversationVersion: 1,
      inputHash: 'hash_B1',
      inputMessageCount: 14,
      generation: SessionGeneration.getGeneration(),
    };

    // Switch to A again (gen 3)
    SessionGeneration.switchConversation(convA);
    const jobA2: JobContext = {
      jobId: 'job_A2',
      conversationId: convA,
      conversationVersion: 2,
      inputHash: 'hash_A2',
      inputMessageCount: 105,
      generation: SessionGeneration.getGeneration(),
    };

    // Switch to B again (gen 4)
    SessionGeneration.switchConversation(convB);
    await storageLayer.updateAppState({ activeConversationId: convB, conversationId: convB }, 1);

    const messagesB = [{ id: 'm1', text: 'B messages' }];
    mockConversations[convB] = {
      id: convB,
      version: 2,
      orderedMessageIds: ['m1'],
      messages: { m1: messagesB[0] },
    };
    const hashB2 = computeInputHash(messagesB);

    const jobB2: JobContext = {
      jobId: 'job_B2',
      conversationId: convB,
      conversationVersion: 2,
      inputHash: hashB2,
      inputMessageCount: 15,
      generation: SessionGeneration.getGeneration(),
    };

    // 1. Old job A1 finishes -> must be rejected
    const resA1 = await publishTokenState(jobA1, { ...sampleMeta, tokenCount: 180000 });
    expect(resA1).toBe(false);

    // 2. Old job B1 finishes (generation mismatch: gen 2 vs active gen 4) -> must be rejected
    const resB1 = await publishTokenState(jobB1, { ...sampleMeta, tokenCount: 1200 });
    expect(resB1).toBe(false);

    // 3. Old job A2 finishes -> must be rejected
    const resA2 = await publishTokenState(jobA2, { ...sampleMeta, tokenCount: 185000 });
    expect(resA2).toBe(false);

    // 4. Current job B2 finishes -> must succeed
    const resB2 = await publishTokenState(jobB2, { ...sampleMeta, tokenCount: 1350 });
    expect(resB2).toBe(true);

    const finalState = await storageLayer.appState.getValue(1);
    expect(finalState.activeConversationId).toBe(convB);
    expect(finalState.tokenEstimate.count).toBe(1350);
  });
});
