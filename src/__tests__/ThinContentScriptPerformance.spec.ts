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
import { normalizeChatGPTMapping } from '../core/acquisition/normalizeMapping';
import { conversationManager, computeInputHash } from '../core/ConversationManager';
import { DOMObservation } from '../core/models';
import { publishCanonicalTokenResult } from '../core/tokenPublisher';

describe('Thin Content Script & Off-Main-Thread Processing Tests', () => {
  beforeEach(async () => {
    SessionGeneration.reset();
    CanonicalDerivedStore.clear();
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
  });

  it('should process large network payload in background off the content script thread', async () => {
    // Construct 100 message mapping
    const mapping: Record<string, any> = {};
    let prevId: string | null = null;

    for (let i = 0; i < 100; i++) {
      const id = `msg-${i}`;
      mapping[id] = {
        id,
        parent: prevId,
        children: [],
        message: {
          id,
          author: { role: i % 2 === 0 ? 'user' : 'assistant' },
          create_time: 1700000000 + i * 10,
          content: {
            content_type: 'text',
            parts: [`This is message ${i} containing text tokens for testing thin content script.`],
          },
        },
      };
      if (prevId) {
        mapping[prevId].children.push(id);
      }
      prevId = id;
    }

    const t0 = performance.now();
    // Simulate background worker processing
    const messages = normalizeChatGPTMapping({
      mapping,
      conversation_id: 'conv-large-test',
      current_node: prevId,
    });
    const normDuration = performance.now() - t0;

    expect(messages.length).toBe(100);

    // Merge into canonical conversation
    const canonicalConvId = 'chatgpt:conv-large-test';
    const observation: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-large-test',
      conversationId: canonicalConvId,
      url: 'https://chatgpt.com/c/conv-large-test',
      pageTitle: 'Test Thread',
      messages: messages.map((m) => ({ ...m, conversationId: canonicalConvId })),
      isStreaming: false,
      source: 'NETWORK',
    };

    const { conversation } = await conversationManager.processMutation(observation);
    expect(conversation.orderedMessageIds.length).toBe(100);

    // Tokenize canonical snapshot
    const gen = SessionGeneration.switchConversation(canonicalConvId);
    const fullMessages = conversation.orderedMessageIds.map((id) => conversation.messages[id]);
    const inputHash = computeInputHash(fullMessages);

    const published = await publishCanonicalTokenResult(
      {
        jobId: 'job-can-1',
        conversationId: canonicalConvId,
        conversationVersion: conversation.version,
        inputHash,
        inputMessageCount: 100,
        generation: gen,
      },
      {
        tokenCount: 15400,
        inputTokens: 7700,
        outputTokens: 7700,
        confidence: 1,
        isStreaming: false,
        source: 'canonical',
        platform: 'chatgpt',
        status: 'healthy',
        currentSummary: null,
        turns: 50,
        avgTokensPerTurn: 308,
        healthMetrics: {},
        tabId: 1,
      }
    );

    expect(published).toBe(true);

    const derived = CanonicalDerivedStore.get(canonicalConvId);
    expect(derived).toBeDefined();
    expect(derived?.tokenCount).toBe(15400);

    const appState = await storageLayer.appState.getValue(1);
    expect(appState.activeConversationId).toBe(canonicalConvId);
    expect(appState.tokenEstimate.count).toBe(15400);
  });
});
