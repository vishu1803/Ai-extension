import { browser } from 'wxt/browser';
import { ExtensionMessage, MessageResponse, MessageType } from './types';

export const messaging = {
  /**
   * Send a message from UI/Content script to the Background Service Worker.
   */
  async sendToBackground<T = any>(message: ExtensionMessage): Promise<MessageResponse<T>> {
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
  async sendToTab<T = any>(tabId: number, message: ExtensionMessage): Promise<MessageResponse<T>> {
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
  addListener(handler: (message: ExtensionMessage, sender: any) => Promise<any> | any) {
    const listener = (message: any, sender: any, sendResponse: (response: any) => void) => {
      // Validate it's our message format
      if (message && message.type) {
        const result = handler(message as ExtensionMessage, sender);
        if (result instanceof Promise) {
          result.then(
            (data) => sendResponse({ success: true, data }),
            (error) => sendResponse({ success: false, error: String(error) })
          );
          return true; // Indicates asynchronous response
        } else {
          sendResponse({ success: true, data: result });
          return false;
        }
      }
      return false;
    };

    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }
};
