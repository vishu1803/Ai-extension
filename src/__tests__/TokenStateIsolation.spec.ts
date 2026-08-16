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

describe('Token State Isolation & Conversation Scoping', () => {
  beforeEach(async () => {
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
  });

  it('should isolate token state per conversationId and never bleed conversation A tokens into B', async () => {
    // 1. Set Conversation A as active with 148,000 tokens
    await storageLayer.updateAppState(
      {
        conversationId: 'chatgpt:conv-A',
        activeConversationId: 'chatgpt:conv-A',
        tokenEstimate: {
          count: 148000,
          inputCount: 74000,
          outputCount: 74000,
          confidence: 1,
          isStreaming: false,
        },
        platform: 'chatgpt',
        status: 'warning',
      },
      1
    );

    const stateA = await storageLayer.appState.getValue(1);
    expect(stateA.activeConversationId).toBe('chatgpt:conv-A');
    expect(stateA.tokenEstimate.count).toBe(148000);

    // 2. Switch to Conversation B (no derived state yet)
    await storageLayer.updateAppState(
      {
        activeConversationId: 'chatgpt:conv-B',
        conversationId: 'chatgpt:conv-B',
        tokenEstimate: {
          count: 0,
          inputCount: 0,
          outputCount: 0,
          confidence: 1,
          isStreaming: false,
        },
      },
      1
    );

    const stateB = await storageLayer.appState.getValue(1);
    expect(stateB.activeConversationId).toBe('chatgpt:conv-B');
    expect(stateB.tokenEstimate.count).toBe(0);
    expect(stateB.status).toBe('healthy');

    // 3. Populate Conversation B with 20,000 tokens
    await storageLayer.updateAppState(
      {
        conversationId: 'chatgpt:conv-B',
        activeConversationId: 'chatgpt:conv-B',
        tokenEstimate: {
          count: 20000,
          inputCount: 10000,
          outputCount: 10000,
          confidence: 1,
          isStreaming: false,
        },
        platform: 'chatgpt',
        status: 'healthy',
      },
      1
    );

    const updatedB = await storageLayer.appState.getValue(1);
    expect(updatedB.tokenEstimate.count).toBe(20000);

    // 4. Switch back to Conversation A (B -> A)
    await storageLayer.updateAppState(
      {
        activeConversationId: 'chatgpt:conv-A',
      },
      1
    );

    const restoredA = await storageLayer.appState.getValue(1);
    expect(restoredA.activeConversationId).toBe('chatgpt:conv-A');
    expect(restoredA.tokenEstimate.count).toBe(148000);
  });

  it('should maintain distinct token counts across multi-hop navigation (A -> B -> C -> A)', async () => {
    // Populate A (160,000 tokens), B (5,000 tokens), C (12,000 tokens)
    await storageLayer.updateAppState(
      {
        conversationId: 'chatgpt:A',
        activeConversationId: 'chatgpt:A',
        tokenEstimate: {
          count: 160000,
          inputCount: 80000,
          outputCount: 80000,
          confidence: 1,
          isStreaming: false,
        },
      },
      1
    );
    await storageLayer.updateAppState(
      {
        conversationId: 'chatgpt:B',
        activeConversationId: 'chatgpt:B',
        tokenEstimate: {
          count: 5000,
          inputCount: 2500,
          outputCount: 2500,
          confidence: 1,
          isStreaming: false,
        },
      },
      1
    );
    await storageLayer.updateAppState(
      {
        conversationId: 'chatgpt:C',
        activeConversationId: 'chatgpt:C',
        tokenEstimate: {
          count: 12000,
          inputCount: 6000,
          outputCount: 6000,
          confidence: 1,
          isStreaming: false,
        },
      },
      1
    );

    // Switch C -> A
    await storageLayer.updateAppState({ activeConversationId: 'chatgpt:A' }, 1);
    expect((await storageLayer.appState.getValue(1)).tokenEstimate.count).toBe(160000);

    // Switch A -> B
    await storageLayer.updateAppState({ activeConversationId: 'chatgpt:B' }, 1);
    expect((await storageLayer.appState.getValue(1)).tokenEstimate.count).toBe(5000);

    // Switch B -> C
    await storageLayer.updateAppState({ activeConversationId: 'chatgpt:C' }, 1);
    expect((await storageLayer.appState.getValue(1)).tokenEstimate.count).toBe(12000);
  });

  it('should return neutral state on page refresh if active conversation is not set', async () => {
    await storageLayer.updateAppState(
      {
        conversationId: 'chatgpt:conv-A',
        activeConversationId: 'chatgpt:conv-A',
        tokenEstimate: {
          count: 95000,
          inputCount: 45000,
          outputCount: 50000,
          confidence: 1,
          isStreaming: false,
        },
      },
      1
    );

    await storageLayer.updateAppState(
      {
        activeConversationId: null,
      },
      1
    );

    const stateRefreshed = await storageLayer.appState.getValue(1);
    expect(stateRefreshed.tokenEstimate.count).toBe(0);
    expect(stateRefreshed.status).toBe('healthy');
  });
});
