import { browser } from 'wxt/browser';
import { ExtensionMessage, MessageResponse } from './types';

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

export const messaging = {
  /**
   * Send a message from UI/Content script to the Background Service Worker.
   */
  async sendToBackground<T = unknown>(message: ExtensionMessage): Promise<MessageResponse<T>> {
    try {
      const response = await browser.runtime.sendMessage(message);
      return response as MessageResponse<T>;
    } catch (error) {
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
    try {
      const response = await browser.tabs.sendMessage(tabId, message);
      return response as MessageResponse<T>;
    } catch (error) {
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
