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

import { RobustDOMEngine } from '../adapters/engine';
import { VisibleDOMStrategy } from '../core/acquisition/strategies/VisibleDOMStrategy';
import { normalizeChatGPTMapping } from '../core/acquisition/normalizeMapping';
import { PlatformAdapter } from '../adapters/types';
import { messaging } from '../messaging/client';

describe('Performance and Lifecycle Tests', () => {
  let mockAdapter: PlatformAdapter;
  let currentThreadId: string | null = 'thread-1';

  beforeEach(() => {
    document.body.innerHTML = '';
    currentThreadId = 'thread-1';
    mockAdapter = {
      id: 'chatgpt',
      name: 'ChatGPT',
      matches: () => true,
      extractMessages: () => [],
      getThreadId: () => currentThreadId,
      domSelectors: ['[data-message-author-role]', 'article'],
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should cleanly initialize and dispose RobustDOMEngine without memory or observer leaks', () => {
    const onObservation = vi.fn();
    const engine1 = new RobustDOMEngine(mockAdapter, onObservation);
    engine1.start();

    expect(engine1.engineId).toBeDefined();
    expect(engine1.observerId).toBeDefined();

    // Dispose engine1
    engine1.dispose();

    // Subsequent events should not trigger onObservation
    engine1.triggerAcquisition('test');
    vi.advanceTimersByTime(1000);
    expect(onObservation).not.toHaveBeenCalled();
  });

  it('should deduplicate repeated navigation events to the same conversation ID (A -> B -> B -> B = 1 event)', () => {
    const sendSpy = vi
      .spyOn(messaging, 'sendToBackground')
      .mockResolvedValue({ success: true } as any);
    const onObservation = vi.fn();
    const engine = new RobustDOMEngine(mockAdapter, onObservation);
    engine.start();

    // Initial state
    currentThreadId = 'thread-A';
    window.dispatchEvent(new Event('locationchange'));
    vi.advanceTimersByTime(200); // Wait for stabilization (150ms)

    const initialCalls = sendSpy.mock.calls.filter(
      (c) => (c[0] as any).type === 'SET_ACTIVE_CONVERSATION'
    ).length;

    // Switch to thread B
    currentThreadId = 'thread-B';
    window.dispatchEvent(new Event('locationchange'));
    vi.advanceTimersByTime(200); // Wait for stabilization

    const switchBCalls = sendSpy.mock.calls.filter(
      (c) =>
        (c[0] as any).type === 'SET_ACTIVE_CONVERSATION' &&
        (c[0] as any).payload.conversationId === 'chatgpt:thread-B'
    ).length;
    expect(switchBCalls).toBe(1);

    // Repeated events to thread B
    window.dispatchEvent(new Event('locationchange'));
    window.dispatchEvent(new Event('locationchange'));
    window.dispatchEvent(new Event('locationchange'));
    vi.advanceTimersByTime(300);

    const repeatedBCalls = sendSpy.mock.calls.filter(
      (c) =>
        (c[0] as any).type === 'SET_ACTIVE_CONVERSATION' &&
        (c[0] as any).payload.conversationId === 'chatgpt:thread-B'
    ).length;
    expect(repeatedBCalls).toBe(1); // Still exactly 1 event!

    engine.dispose();
  });

  it('should stabilize rapid multi-hop navigation (A -> B -> C -> D) and commit only final destination', () => {
    const sendSpy = vi
      .spyOn(messaging, 'sendToBackground')
      .mockResolvedValue({ success: true } as any);
    const onObservation = vi.fn();
    const engine = new RobustDOMEngine(mockAdapter, onObservation);
    engine.start();

    // Initial state A
    currentThreadId = 'thread-A';
    window.dispatchEvent(new Event('locationchange'));
    vi.advanceTimersByTime(200);

    // Rapid switches: B -> C -> D in < 100ms
    currentThreadId = 'thread-B';
    window.dispatchEvent(new Event('locationchange'));
    vi.advanceTimersByTime(40);

    currentThreadId = 'thread-C';
    window.dispatchEvent(new Event('locationchange'));
    vi.advanceTimersByTime(40);

    currentThreadId = 'thread-D';
    window.dispatchEvent(new Event('locationchange'));
    vi.advanceTimersByTime(200); // Stabilize on D

    // Intermediate states B and C should NEVER have committed!
    const switchBCalls = sendSpy.mock.calls.filter(
      (c) =>
        (c[0] as any).type === 'SET_ACTIVE_CONVERSATION' &&
        (c[0] as any).payload.conversationId === 'chatgpt:thread-B'
    ).length;
    const switchCCalls = sendSpy.mock.calls.filter(
      (c) =>
        (c[0] as any).type === 'SET_ACTIVE_CONVERSATION' &&
        (c[0] as any).payload.conversationId === 'chatgpt:thread-C'
    ).length;
    const switchDCalls = sendSpy.mock.calls.filter(
      (c) =>
        (c[0] as any).type === 'SET_ACTIVE_CONVERSATION' &&
        (c[0] as any).payload.conversationId === 'chatgpt:thread-D'
    ).length;

    expect(switchBCalls).toBe(0);
    expect(switchCCalls).toBe(0);
    expect(switchDCalls).toBe(1); // Only final destination D committed

    engine.dispose();
  });

  it('should extract DOM messages using WeakMap without mutating DOM attributes with setAttribute', async () => {
    const container = document.createElement('main');
    const msgEl = document.createElement('article');
    msgEl.setAttribute('data-message-author-role', 'user');
    msgEl.innerText = 'Hello there!';
    container.appendChild(msgEl);
    document.body.appendChild(container);

    const setAttributeSpy = vi.spyOn(msgEl, 'setAttribute');
    const strategy = new VisibleDOMStrategy(mockAdapter);

    const result = await strategy.execute('thread-1');

    expect(result.success).toBe(true);
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].text).toBe('Hello there!');
    expect(result.messages[0].role).toBe('user');

    // Verify setAttribute was NEVER called during extraction (no forced reflow from DOM write)
    expect(setAttributeSpy).not.toHaveBeenCalledWith('data-tracker-id', expect.any(String));
  });

  it('should cache and memoize normalized ChatGPT mapping for identical conversationId + nodeCount', () => {
    const rawMapping: Record<string, any> = {};
    for (let i = 0; i < 50; i++) {
      rawMapping[`node_${i}`] = {
        id: `node_${i}`,
        message: {
          id: `msg_${i}`,
          author: { role: i % 2 === 0 ? 'user' : 'assistant' },
          content: { parts: [`Message content ${i}`] },
          create_time: 1000 + i,
        },
      };
    }

    const payload = {
      conversation_id: 'conv-perf-test-123',
      current_node: 'node_49',
      mapping: rawMapping,
    };

    // First normalization
    const t0 = performance.now();
    const result1 = normalizeChatGPTMapping(payload);
    const duration1 = performance.now() - t0;

    expect(result1.length).toBe(50);

    // Second normalization should return memoized cached array
    const t1 = performance.now();
    const result2 = normalizeChatGPTMapping(payload);
    const duration2 = performance.now() - t1;

    expect(result2).toBe(result1); // Exact reference match from memoization cache
    expect(duration2).toBeLessThanOrEqual(duration1 + 5);
  });
});
