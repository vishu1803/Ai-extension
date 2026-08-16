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
import { chatgptRuntime } from '../core/chatgptRuntime';
import { DOMObservation } from '../core/models';
import { RobustDOMEngine } from '../adapters/engine';
import { PlatformAdapter } from '../adapters/types';

describe('ChatGPT Live DOM & History Tracking Acceptance Tests (1 - 8)', () => {
  let consoleLogs: string[] = [];
  const originalLog = console.log;

  beforeEach(async () => {
    consoleLogs = [];
    console.log = vi.fn((...args: any[]) => {
      consoleLogs.push(args.map(String).join(' '));
      originalLog.apply(console, args);
    });

    chatgptRuntime.reset();
    await storageLayer.runtimeState.setValue({});
    await storageLayer.activeTabId.setValue(1);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    console.log = originalLog;
    vi.restoreAllMocks();
  });

  it('TEST 1: Open existing conversation — network history establishes baseline without reset', async () => {
    const rawMapping = {
      'msg-1': {
        id: 'msg-1',
        parent: null,
        children: ['msg-2'],
        message: {
          id: 'msg-1',
          author: { role: 'user' },
          create_time: 1700000000,
          content: { content_type: 'text', parts: ['Tell me about relativity.'] },
        },
      },
      'msg-2': {
        id: 'msg-2',
        parent: 'msg-1',
        children: [],
        message: {
          id: 'msg-2',
          author: { role: 'assistant' },
          create_time: 1700000005,
          metadata: { model_slug: 'gpt-4o' },
          content: {
            content_type: 'text',
            parts: ['General relativity is a theory of gravitation...'],
          },
        },
      },
    };

    const mockTokenize = vi.fn().mockResolvedValue({
      totalTokens: 192000,
      totalInputTokens: 96000,
      totalOutputTokens: 96000,
    });

    const total = await chatgptRuntime.handleNetworkPayload(
      {
        conversationId: '67acfa01-1234-5678-abcd-1234567890ab',
        mapping: rawMapping,
        currentNode: 'msg-2',
      },
      mockTokenize,
      1
    );

    expect(total).toBe(192000);
    const appState = await storageLayer.appState.getValue(1);
    expect(appState.tokenEstimate.count).toBe(192000);

    const output = consoleLogs.join('\n');
    expect(output).toContain(
      '[Tracker] history\nconversationId=chatgpt:67acfa01-1234-5678-abcd-1234567890ab\nmessages=2\ntokens=192000'
    );
    expect(output).toContain(
      '[MODEL]\nconversationId=chatgpt:67acfa01-1234-5678-abcd-1234567890ab\nmodel=gpt-4o'
    );
    expect(output).toContain(
      '[DISPLAY]\nconversationId=chatgpt:67acfa01-1234-5678-abcd-1234567890ab\nhistorical=192000\nliveUser=0\nliveAssistant=0\ntotal=192000'
    );
  });

  it('TEST 2: Send user message — detects current user message and increases total by user tokens only', async () => {
    chatgptRuntime.setHistoricalBaseline('chatgpt:conv-A', 192000, ['msg-1', 'msg-2']);

    const userText = 'U'.repeat(2736); // 2736 / 4 = 684 tokens
    const userObs: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-A',
      conversationId: 'chatgpt:conv-A',
      url: 'https://chatgpt.com/c/conv-A',
      pageTitle: 'ChatGPT',
      messages: [{ id: 'msg-user-new', role: 'user', text: userText }],
      isStreaming: false,
      source: 'DOM',
    };

    consoleLogs = [];
    const total = await chatgptRuntime.handleLiveMutation(userObs, 1);

    expect(total).toBe(192684);
    const output = consoleLogs.join('\n');
    expect(output).toContain(
      '[LIVE_USER]\nconversationId=chatgpt:conv-A\nmessageId=msg-user-new\ntokens=684'
    );
    expect(output).toContain(
      '[DISPLAY]\nconversationId=chatgpt:conv-A\nhistorical=192000\nliveUser=684\nliveAssistant=0\ntotal=192684'
    );
  });

  it('TEST 3 & 4: Assistant starts responding and streams cumulatively without accumulation (100 -> 250 -> 500 -> 900)', async () => {
    chatgptRuntime.setHistoricalBaseline('chatgpt:conv-A', 192000, ['msg-1', 'msg-2']);
    chatgptRuntime.setLiveUserTokens(684, 'msg-user-new');

    // 100 tokens (400 chars)
    const stream1: DOMObservation = {
      platform: 'chatgpt',
      conversationId: 'chatgpt:conv-A',
      url: '',
      pageTitle: '',
      threadId: 'conv-A',
      messages: [{ id: 'msg-ai-stream', role: 'ai', text: 'A'.repeat(400) }],
      isStreaming: true,
      source: 'DOM',
    };
    consoleLogs = [];
    const total1 = await chatgptRuntime.handleLiveMutation(stream1, 1);
    expect(total1).toBe(192784); // 192000 + 684 + 100
    expect(consoleLogs.join('\n')).toContain(
      '[LIVE_AI]\nconversationId=chatgpt:conv-A\nmessageId=msg-ai-stream\ntokens=100\nstatus=STREAMING'
    );

    // 250 tokens (1000 chars)
    const stream2: DOMObservation = {
      platform: 'chatgpt',
      conversationId: 'chatgpt:conv-A',
      url: '',
      pageTitle: '',
      threadId: 'conv-A',
      messages: [{ id: 'msg-ai-stream', role: 'ai', text: 'A'.repeat(1000) }],
      isStreaming: true,
      source: 'DOM',
    };
    consoleLogs = [];
    const total2 = await chatgptRuntime.handleLiveMutation(stream2, 1);
    expect(total2).toBe(192934); // 192000 + 684 + 250

    // 500 tokens (2000 chars)
    const stream3: DOMObservation = {
      platform: 'chatgpt',
      conversationId: 'chatgpt:conv-A',
      url: '',
      pageTitle: '',
      threadId: 'conv-A',
      messages: [{ id: 'msg-ai-stream', role: 'ai', text: 'A'.repeat(2000) }],
      isStreaming: true,
      source: 'DOM',
    };
    consoleLogs = [];
    const total3 = await chatgptRuntime.handleLiveMutation(stream3, 1);
    expect(total3).toBe(193184); // 192000 + 684 + 500

    // 900 tokens (3600 chars)
    const stream4: DOMObservation = {
      platform: 'chatgpt',
      conversationId: 'chatgpt:conv-A',
      url: '',
      pageTitle: '',
      threadId: 'conv-A',
      messages: [{ id: 'msg-ai-stream', role: 'ai', text: 'A'.repeat(3600) }],
      isStreaming: true,
      source: 'DOM',
    };
    consoleLogs = [];
    const total4 = await chatgptRuntime.handleLiveMutation(stream4, 1);
    expect(total4).toBe(193584); // 192000 + 684 + 900 (NOT 100+250+500+900)
    expect(consoleLogs.join('\n')).toContain(
      '[LIVE_AI]\nconversationId=chatgpt:conv-A\nmessageId=msg-ai-stream\ntokens=900\nstatus=STREAMING'
    );
  });

  it('TEST 5: Assistant completes — status becomes COMPLETE and total remains 193584', async () => {
    chatgptRuntime.setHistoricalBaseline('chatgpt:conv-A', 192000, ['msg-1', 'msg-2']);
    chatgptRuntime.setLiveUserTokens(684, 'msg-user-new');

    const finalObs: DOMObservation = {
      platform: 'chatgpt',
      conversationId: 'chatgpt:conv-A',
      url: '',
      pageTitle: '',
      threadId: 'conv-A',
      messages: [{ id: 'msg-ai-stream', role: 'ai', text: 'A'.repeat(3600) }],
      isStreaming: false,
      source: 'DOM',
    };

    consoleLogs = [];
    const finalTotal = await chatgptRuntime.handleLiveMutation(finalObs, 1);
    expect(finalTotal).toBe(193584);

    const output = consoleLogs.join('\n');
    expect(output).toContain(
      '[LIVE_AI]\nconversationId=chatgpt:conv-A\nmessageId=msg-ai-stream\ntokens=900\nstatus=COMPLETE'
    );
    expect(output).toContain(
      '[DISPLAY]\nconversationId=chatgpt:conv-A\nhistorical=192000\nliveUser=684\nliveAssistant=900\ntotal=193584'
    );
  });

  it('TEST 6: Switch conversation (A -> B) — old live state is cleared, new network history establishes new baseline', async () => {
    // Setup A state
    chatgptRuntime.setHistoricalBaseline('chatgpt:conv-A', 192000);
    chatgptRuntime.setLiveUserTokens(684, 'msg-user-new');

    // Switch A -> B
    await chatgptRuntime.handleConversationSwitch('chatgpt:conv-B', 1);

    const state = chatgptRuntime.getState();
    expect(state.activeConversationId).toBe('chatgpt:conv-B');
    expect(state.historicalTokens).toBe(0);
    expect(state.liveUserTokens).toBe(0);
    expect(state.activeAssistantTokens).toBe(0);

    // B network history arrives (11451 tokens)
    const mockTokenizeB = vi.fn().mockResolvedValue({
      totalTokens: 11451,
      totalInputTokens: 5000,
      totalOutputTokens: 6451,
    });

    const totalB = await chatgptRuntime.handleNetworkPayload(
      {
        conversationId: 'conv-B',
        mapping: {
          'b-1': {
            id: 'b-1',
            message: { author: { role: 'user' }, content: { parts: ['Hello'] } },
          },
        },
      },
      mockTokenizeB,
      1
    );

    expect(totalB).toBe(11451);
    const appStateB = await storageLayer.appState.getValue(1);
    expect(appStateB.tokenEstimate.count).toBe(11451);
  });

  it('TEST 7: Historical message filtering & scroll isolation — old messages never count as live deltas', async () => {
    chatgptRuntime.setHistoricalBaseline('chatgpt:conv-A', 192000, ['hist-1', 'hist-2']);

    // DOM observation containing historical message (e.g. from page load or scrolling up)
    const histObs: DOMObservation = {
      platform: 'chatgpt',
      conversationId: 'chatgpt:conv-A',
      url: '',
      pageTitle: '',
      threadId: 'conv-A',
      messages: [{ id: 'hist-2', role: 'ai', text: 'Historical completed response.' }],
      isStreaming: false,
      source: 'DOM',
    };

    consoleLogs = [];
    const total = await chatgptRuntime.handleLiveMutation(histObs, 1);

    // Baseline remains 192000, live tokens remain 0
    expect(total).toBe(192000);
    expect(chatgptRuntime.getState().liveUserTokens).toBe(0);
    expect(chatgptRuntime.getState().activeAssistantTokens).toBe(0);
    expect(consoleLogs.length).toBe(0); // Ignored with 0 logs
  });

  it('TEST 8: Model detection — extracts model from DOM observation or network metadata', async () => {
    chatgptRuntime.setHistoricalBaseline('chatgpt:conv-A', 192000, ['msg-1']);

    const userObs: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-A',
      conversationId: 'chatgpt:conv-A',
      url: '',
      pageTitle: '',
      model: 'o1-preview',
      messages: [{ id: 'msg-user-model-test', role: 'user', text: 'Solve this.' }],
      isStreaming: false,
      source: 'DOM',
    };

    consoleLogs = [];
    await chatgptRuntime.handleLiveMutation(userObs, 1);

    expect(consoleLogs.join('\n')).toContain(
      '[MODEL]\nconversationId=chatgpt:conv-A\nmodel=o1-preview'
    );
    expect(chatgptRuntime.getState().lastLoggedModel).toBe('o1-preview');
  });
});
