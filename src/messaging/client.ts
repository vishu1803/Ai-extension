import { browser } from 'wxt/browser';
import { ExtensionMessage, MessageResponse } from './types';
import { logger } from '../shared/logger';

type MessageSender = Parameters<typeof browser.runtime.onMessage.addListener>[0] extends (
  message: unknown,
  sender: infer Sender,
  sendResponse: (response?: unknown) => void
) => unknown
  ? Sender
  : unknown;

type MessageHandler = (
  message: ExtensionMessage,
  sender: MessageSender
) => Promise<unknown> | unknown;

function isExtensionMessage(message: unknown): message is ExtensionMessage {
  return typeof message === 'object' && message !== null && 'type' in message;
}

export function isExtensionContextInvalidated(error?: unknown): boolean {
  try {
    if (typeof browser !== 'undefined' && !browser.runtime?.id) {
      return true;
    }
    if (typeof chrome !== 'undefined' && !chrome.runtime?.id) {
      return true;
    }
  } catch (e) {
    return true;
  }
  if (error) {
    const str = String((error as any)?.message || error).toLowerCase();
    return (
      str.includes('extension context invalidated') ||
      str.includes('context invalidated') ||
      str.includes('script context invalidated') ||
      str.includes('could not establish connection') ||
      str.includes('receiving end does not exist')
    );
  }
  return false;
}

export const messaging = {
  /**
   * Send a message from UI/Content script to the Background Service Worker.
   */
  async sendToBackground<T = unknown>(message: ExtensionMessage): Promise<MessageResponse<T>> {
    if (isExtensionContextInvalidated()) {
      return { success: false, error: 'Extension context invalidated', contextInvalidated: true };
    }
    try {
      const response = await browser.runtime.sendMessage(message);
      return response as MessageResponse<T>;
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        return { success: false, error: String(error), contextInvalidated: true };
      }
      console.error(`Error sending message ${message.type} to background:`, error);
      return { success: false, error: String(error) };
    }
  },

  /**
   * Send a message from Background to a specific Content Script tab.
   */
  async sendToTab<T = unknown>(
    tabId: number,
    message: ExtensionMessage
  ): Promise<MessageResponse<T>> {
    if (isExtensionContextInvalidated()) {
      return { success: false, error: 'Extension context invalidated', contextInvalidated: true };
    }
    try {
      const response = await browser.tabs.sendMessage(tabId, message);
      return response as MessageResponse<T>;
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        return { success: false, error: String(error), contextInvalidated: true };
      }
      console.error(`Error sending message ${message.type} to tab ${tabId}:`, error);
      return { success: false, error: String(error) };
    }
  },

  /**
   * Add a typed listener for incoming messages.
   * Automatically handles sending the response asynchronously if the handler returns a promise.
   */
  addListener(handler: MessageHandler) {
    const listener = (
      message: unknown,
      sender: MessageSender,
      sendResponse: (response: MessageResponse) => void
    ) => {
      if (isExtensionMessage(message)) {
        const result = handler(message, sender);
        if (result instanceof Promise) {
          result.then(
            (data) => sendResponse({ success: true, data }),
            (error) => sendResponse({ success: false, error: String(error) })
          );
          return true; // Indicates asynchronous response
        } else {
          sendResponse({ success: true, data: result });
          return undefined;
        }
      }
      return undefined;
    };

    browser.runtime.onMessage.addListener(listener as any);
    return () => browser.runtime.onMessage.removeListener(listener as any);
  },
};
