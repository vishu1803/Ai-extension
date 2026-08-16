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

import { storageLayer } from '../storage';
import { SessionGeneration } from '../core/sessionGeneration';
import { CanonicalDerivedStore } from '../core/tokenStore';
import { normalizeChatGPTMapping } from '../core/acquisition/normalizeMapping';
import { conversationManager, computeInputHash } from '../core/ConversationManager';
import { DOMObservation } from '../core/models';
import { publishCanonicalTokenResult, JobContext } from '../core/tokenPublisher';
import { RobustDOMEngine } from '../adapters/engine';
import { PlatformAdapter } from '../adapters/types';
import { logger } from '../shared/logger';

describe('Production Pipeline End-to-End Verification', () => {
  let consoleLogs: string[] = [];
  const originalLog = console.log;

  beforeEach(async () => {
    consoleLogs = [];
    console.log = vi.fn((...args: any[]) => {
      consoleLogs.push(args.map(String).join(' '));
      originalLog.apply(console, args);
    });

    SessionGeneration.reset();
    CanonicalDerivedStore.clear();
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    console.log = originalLog;
    vi.restoreAllMocks();
  });

  it('Stage 1-4: should execute startup trace and detect platform, engine, conversation identity', () => {
    const dummyAdapter: PlatformAdapter = {
      id: 'chatgpt',
      name: 'ChatGPT',
      matches: () => true,
      extractMessages: () => [],
      domSelectors: ['article', '[data-message-author-role]'],
      getThreadId: () => 'conv-123',
    };

    logger.tracker('CONTENT_SCRIPT_STARTED', {
      platform: dummyAdapter.id,
      url: 'https://chatgpt.com/c/conv-123',
    });
    logger.tracker('PLATFORM_DETECTED', dummyAdapter.id);

    const engine = new RobustDOMEngine(dummyAdapter, () => {});
    engine.start();

    const output = consoleLogs.join('\n');

    expect(output).toContain(
      '[Tracker] CONTENT_SCRIPT_STARTED\nplatform=chatgpt\nurl=https://chatgpt.com/c/conv-123'
    );
    expect(output).toContain('[Tracker] PLATFORM_DETECTED\nchatgpt');
    expect(output).toContain('[Tracker] ENGINE_STARTED\nplatform=chatgpt');
    expect(output).toContain('[Tracker] CONVERSATION_DETECTED\nconversationId=chatgpt:conv-123');
    expect(output).toContain('[Tracker] ENGINE_ACTIVE');

    engine.dispose();
  });

  it('Stage 5-6: should acquire network history and merge canonically into ConversationManager', async () => {
    const rawMapping = {
      'msg-user-1': {
        id: 'msg-user-1',
        parent: null,
        children: ['msg-ai-1'],
        message: {
          id: 'msg-user-1',
          author: { role: 'user' },
          create_time: 1700000000,
          content: { content_type: 'text', parts: ['How many tokens is this?'] },
        },
      },
      'msg-ai-1': {
        id: 'msg-ai-1',
        parent: 'msg-user-1',
        children: [],
        message: {
          id: 'msg-ai-1',
          author: { role: 'assistant' },
          create_time: 1700000005,
          content: {
            content_type: 'text',
            parts: ['This response contains approximately 10 tokens.'],
          },
        },
      },
    };

    logger.tracker('NETWORK_BRIDGE_READY');
    logger.tracker('HISTORY_RECEIVED', {
      conversationId: 'chatgpt:conv-123',
      messages: 2,
    });

    const messages = normalizeChatGPTMapping({
      mapping: rawMapping,
      conversation_id: 'conv-123',
      current_node: 'msg-ai-1',
    });

    expect(messages.length).toBe(2);

    logger.tracker('HISTORY_ACQUIRED', {
      conversationId: 'chatgpt:conv-123',
      messages: messages.length,
    });

    const canonicalConvId = 'chatgpt:conv-123';
    const observation: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-123',
      conversationId: canonicalConvId,
      url: 'https://chatgpt.com/c/conv-123',
      pageTitle: 'Test Conversation',
      messages: messages.map((m) => ({ ...m, conversationId: canonicalConvId })),
      isStreaming: false,
      source: 'NETWORK',
    };

    const { conversation } = await conversationManager.processMutation(observation);
    logger.tracker('CANONICAL_UPDATED', {
      conversationId: conversation.id,
      messageCount: conversation.orderedMessageIds.length,
    });

    expect(conversation.orderedMessageIds.length).toBe(2);

    const output = consoleLogs.join('\n');
    expect(output).toContain('[Tracker] NETWORK_BRIDGE_READY');
    expect(output).toContain(
      '[Tracker] HISTORY_RECEIVED\nconversationId=chatgpt:conv-123\nmessages=2'
    );
    expect(output).toContain(
      '[Tracker] HISTORY_ACQUIRED\nconversationId=chatgpt:conv-123\nmessages=2'
    );
    expect(output).toContain(
      '[Tracker] CANONICAL_UPDATED\nconversationId=chatgpt:conv-123\nmessageCount=2'
    );
  });

  it('Stage 7-10: should tokenize canonical conversation and update AppState and UI', async () => {
    const convId = 'chatgpt:conv-123';
    const gen = SessionGeneration.switchConversation(convId);

    const jobContext: JobContext = {
      jobId: 'job-pipeline-test',
      conversationId: convId,
      conversationVersion: 1,
      inputHash: 'hash-test',
      inputMessageCount: 2,
      generation: gen,
    };

    await publishCanonicalTokenResult(jobContext, {
      tokenCount: 1540,
      inputTokens: 700,
      outputTokens: 840,
      confidence: 1,
      isStreaming: false,
      source: 'canonical',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: 1,
      avgTokensPerTurn: 1540,
      healthMetrics: {},
      tabId: 1,
    });

    const appState = await storageLayer.appState.getValue(1);
    expect(appState.activeConversationId).toBe(convId);
    expect(appState.tokenEstimate.count).toBe(1540);

    const output = consoleLogs.join('\n');
    expect(output).toContain(
      '[Tracker] TOKENS_UPDATED\nconversationId=chatgpt:conv-123\ntokens=1540'
    );
    expect(output).toContain(
      '[Tracker] UI_STATE_UPDATED\nconversationId=chatgpt:conv-123\ntokens=1540'
    );
  });

  it('Stage 11-12: should detect live DOM messages, verify [DOM_OBSERVER] diagnostic and canonical increment', async () => {
    const convId = 'chatgpt:conv-live-test';
    let emittedObservation: DOMObservation | null = null;

    const dummyAdapter: PlatformAdapter = {
      id: 'chatgpt',
      name: 'ChatGPT',
      matches: () => true,
      extractMessages: () => [],
      domSelectors: ['article', '[data-message-author-role]'],
      getThreadId: () => 'conv-live-test',
    };

    document.body.innerHTML = `
      <main>
        <article data-message-id="msg-live-user-1" data-message-author-role="user">
          <div class="whitespace-pre-wrap">Hello AI!</div>
        </article>
      </main>
    `;

    const engine = new RobustDOMEngine(dummyAdapter, (obs) => {
      emittedObservation = obs;
    });

    engine.start();
    (engine as any).onConversationReady();
    await (engine as any).observeLatestMessage('TestTrigger');

    expect(emittedObservation).not.toBeNull();
    expect(emittedObservation!.messages[0].id).toBe('msg-live-user-1');
    expect(emittedObservation!.messages[0].role).toBe('user');
    expect(emittedObservation!.messages[0].text).toBe('Hello AI!');

    // Canonical increment N -> N+1
    const { conversation: conv1, addedCount: added1 } = await conversationManager.processMutation(
      emittedObservation!
    );
    expect(added1).toBe(1);
    expect(conv1.orderedMessageIds.length).toBe(1);

    // Assistant streaming turn: same message ID updated in-place without N+1 increment
    const streamObservation1: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-live-test',
      conversationId: convId,
      url: 'https://chatgpt.com/c/conv-live-test',
      pageTitle: '',
      messages: [{ id: 'msg-live-ai-1', role: 'ai', text: 'Hel' }],
      isStreaming: true,
      source: 'DOM',
    };
    const {
      conversation: conv2,
      addedCount: added2,
      updatedCount: updated2,
    } = await conversationManager.processMutation(streamObservation1);
    expect(added2).toBe(1);
    expect(conv2.orderedMessageIds.length).toBe(2);

    const streamObservation2: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-live-test',
      conversationId: convId,
      url: 'https://chatgpt.com/c/conv-live-test',
      pageTitle: '',
      messages: [{ id: 'msg-live-ai-1', role: 'ai', text: 'Hello! How can I help you today?' }],
      isStreaming: false,
      source: 'DOM',
    };
    const {
      conversation: conv3,
      addedCount: added3,
      updatedCount: updated3,
    } = await conversationManager.processMutation(streamObservation2);
    expect(added3).toBe(0);
    expect(updated3).toBe(1);
    // Message count remains 2 (in-place text update, no duplication)
    expect(conv3.orderedMessageIds.length).toBe(2);
    expect(conv3.messages['msg-live-ai-1'].text).toBe('Hello! How can I help you today?');

    engine.dispose();
  });
});
