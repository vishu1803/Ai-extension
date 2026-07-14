import { ChatMessage } from './engineTypes';

export interface PlatformAdapter {
  /**
   * Unique identifier for the platform (e.g., 'chatgpt', 'claude')
   */
  id: string;

  /**
   * Human-readable name (e.g., 'ChatGPT', 'Claude')
   */
  name: string;

  /**
   * Determines if this adapter is capable of handling the current URL.
   */
  matches(url: URL): boolean;

  /**
   * Extracts all currently visible messages from the DOM.
   * The RobustDOMEngine will call this during mutations and handle state/lazy-loading.
   */
  extractMessages(): ChatMessage[];
}
