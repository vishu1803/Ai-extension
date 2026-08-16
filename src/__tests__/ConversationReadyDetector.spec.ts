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

import { ConversationReadyDetector } from '../adapters/ConversationReadyDetector';
import { PlatformAdapter } from '../adapters/types';

describe('ConversationReadyDetector Unit Tests', () => {
  let mockAdapter: PlatformAdapter;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockAdapter = {
      id: 'chatgpt',
      name: 'ChatGPT',
      matches: () => true,
      extractMessages: () => [],
      getThreadId: () => null,
      domSelectors: ['[data-message-author-role]', 'article'],
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should fast-track readiness for empty conversation when prompt input is present', () => {
    // Set up empty conversation DOM with prompt input box
    const main = document.createElement('main');
    const textarea = document.createElement('textarea');
    textarea.id = 'prompt-textarea';
    main.appendChild(textarea);
    document.body.appendChild(main);

    let onReadyCalled = false;
    const detector = new ConversationReadyDetector(mockAdapter, () => {
      onReadyCalled = true;
    });

    detector.start();

    // Fast forward poll timer (150ms)
    vi.advanceTimersByTime(300);

    expect(onReadyCalled).toBe(true);
    detector.stop();
  });

  it('should detect existing messages and reach ready state when messages are present', () => {
    const main = document.createElement('main');
    const msg = document.createElement('article');
    msg.setAttribute('data-message-author-role', 'user');
    msg.innerText = 'Hello AI';
    main.appendChild(msg);
    document.body.appendChild(main);

    let onReadyCalled = false;
    const detector = new ConversationReadyDetector(mockAdapter, () => {
      onReadyCalled = true;
    });

    detector.start();

    // Advance timers for polling and layout stability (3 checks = 450ms + 500ms quiescence)
    vi.advanceTimersByTime(2000);

    expect(onReadyCalled).toBe(true);
    detector.stop();
  });

  it('should reach readiness for idle empty conversation after idle fallback checks', () => {
    // Empty DOM with main element but no messages or specific textarea
    const main = document.createElement('main');
    document.body.appendChild(main);

    let onReadyCalled = false;
    const detector = new ConversationReadyDetector(mockAdapter, () => {
      onReadyCalled = true;
    });

    detector.start();

    // Advance time by 1.6 seconds (10 poll intervals)
    vi.advanceTimersByTime(1600);

    expect(onReadyCalled).toBe(true);
    detector.stop();
  });
});
