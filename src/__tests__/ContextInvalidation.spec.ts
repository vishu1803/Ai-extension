import { describe, it, expect, vi } from 'vitest';

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
    tabs: {
      sendMessage: vi.fn(),
    },
  },
}));

import { isExtensionContextInvalidated, messaging } from '../messaging/client';
import { browser } from 'wxt/browser';

describe('Context Invalidation Unit Tests', () => {
  it('should identify extension context invalidation from error messages', () => {
    const err1 = new Error('Extension context invalidated.');
    const err2 = new Error('Could not establish connection. Receiving end does not exist.');
    const err3 = new Error('Unrelated error');

    expect(isExtensionContextInvalidated(err1)).toBe(true);
    expect(isExtensionContextInvalidated(err2)).toBe(true);
    expect(isExtensionContextInvalidated(err3)).toBe(false);
  });

  it('should gracefully handle context invalidation in sendToBackground without throwing or console.error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(browser.runtime.sendMessage).mockRejectedValueOnce(
      new Error('Extension context invalidated.')
    );

    const res = await messaging.sendToBackground({ type: 'GET_STATE' });

    expect(res.success).toBe(false);
    expect(res.contextInvalidated).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
