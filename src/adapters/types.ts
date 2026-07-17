import { ChatMessage } from '../core/models';
import { PlatformId } from '../shared/types';

export interface PlatformAdapter {
  /**
   * Unique identifier for the platform (e.g., 'chatgpt', 'claude')
   */
  id: PlatformId;

  /**
   * Human-readable name (e.g., 'ChatGPT', 'Claude')
   */
  name: string;

  /**
   * Determines if this adapter is capable of handling the current URL.
   */
  matches(url: URL): boolean;

  /**
   * Defines the CSS selectors used by the VisibleDOMStrategy to extract messages.
   * Required for platforms using the DOM acquisition strategy.
   */
  domSelectors?: string[];

  /**
   * Extracts historical conversation state from embedded page data (e.g. Next.js __NEXT_DATA__).
   * Returns a promise resolving to an array of ChatMessages, or null if no data found.
   */
  extractHydrationData?(): Promise<ChatMessage[] | null>;

  /**
   * @deprecated Handled by History Acquisition Layer strategies.
   */
  extractMessages(): ChatMessage[];

  /**
   * Attempts to resolve the canonical Thread ID for this platform (e.g., from a <meta> tag or URL).
   * If unable (e.g. at a temporary root URL), returns null.
   */
  getThreadId?(): string | null;

  /**
   * Returns true if the UI currently indicates an AI response is streaming.
   */
  isStreaming?(): boolean;

  /**
   * Optional CSS selector to scope the MutationObserver to, reducing CPU usage.
   */
  observeSelector?: string;
}
