import { DOMObservation } from '../core/models';
import { PlatformAdapter } from './types';

function hashMessages(messages: any[]): string {
  let str = '';
  for (const m of messages) {
    str += m.id + m.text.length + m.text.slice(0, 50);
  }
  return str;
}

export class RobustDOMEngine {
  private observer: MutationObserver | null = null;
  private adapter: PlatformAdapter;
  private onObservation: (obs: DOMObservation) => void;
  private lastHash: string = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isChecking: boolean = false;

  constructor(
    adapter: PlatformAdapter,
    onObservation: (obs: DOMObservation) => void
  ) {
    this.adapter = adapter;
    this.onObservation = onObservation;
  }

  public start() {
    console.log(`[Engine] Stateless telemetry observer started for ${this.adapter.id}.`);

    if (this.adapter.id === 'chatgpt') {
      console.warn(`[Engine] DIAGNOSTIC MODE: Bypassing MutationObserver. Running pure DOM scan every 2 seconds.`);
      setInterval(() => {
        console.group(`[Diagnostic Audit] Polling at ${new Date().toISOString()}`);
        console.log(`Current URL: ${window.location.href}`);
        console.log(`Conversation ID: ${this.adapter.getThreadId ? this.adapter.getThreadId() : 'unknown'}`);
        this.adapter.extractMessages();
        console.groupEnd();
      }, 2000);
      return; // Do NOT start MutationObserver. Do NOT emit observations.
    }

    this.observer = new MutationObserver(() => {
      this.scheduleUpdate();
    });

    const startObserver = () => {
      const target = this.getObservationTarget();
      if (target) {
        this.observer?.observe(target, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        console.log(`[Observer] Attached to ${target.tagName || 'Document'}`);
      } else {
        setTimeout(startObserver, 50);
      }
    };
    startObserver();

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.setupUrlListener();
    this.scheduleUpdate();
  }

  public stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private getObservationTarget(): Element | null {
    if (this.adapter.observeSelector) {
      const target = document.querySelector(this.adapter.observeSelector);
      if (target) return target;
    }
    return (
      document.querySelector('[role="log"]') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.body
    );
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.observer?.disconnect();
    } else {
      const target = this.getObservationTarget();
      if (target) {
        this.observer?.observe(target, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        this.scheduleUpdate();
      }
    }
  };

  private setupUrlListener() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      window.dispatchEvent(new Event('locationchange'));
    };
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      window.dispatchEvent(new Event('locationchange'));
    };
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));

    window.addEventListener('locationchange', () => {
      // Always trigger an immediate check on navigation
      this.lastHash = '';
      this.scheduleUpdate();
    });
  }

  private scheduleUpdate() {
    if (document.visibilityState === 'hidden') return;
    if (this.debounceTimer) return;

    this.debounceTimer = setTimeout(() => {
      this.processDOM();
      this.debounceTimer = null;
    }, 250);
  }

  private processDOM() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const visibleMessages = this.adapter.extractMessages();
      const currentHash = hashMessages(visibleMessages);
      
      const isStreaming = this.adapter.isStreaming ? this.adapter.isStreaming() : false;

      // Deep logging for diagnostic phase
      const userMessages = visibleMessages.filter(m => m.role === 'user').length;
      const assistantMessages = visibleMessages.filter(m => m.role === 'ai').length;
      console.log(
        `[Engine] CONTENT_MUTATION Event Details:\n` +
        ` URL: ${window.location.href}\n` +
        ` DOM Message Count (total in DOM handled by adapter): unknown\n` + 
        ` Extracted message count: ${visibleMessages.length}\n` +
        ` Visible user messages: ${userMessages}\n` +
        ` Visible assistant messages: ${assistantMessages}\n` +
        ` Streaming: ${isStreaming}`
      );

      // If streaming, the hash changes constantly.
      // If not streaming, only emit if hash changed.
      if (currentHash !== this.lastHash || isStreaming) {
        this.lastHash = currentHash;
        
        const observation: DOMObservation = {
          platform: this.adapter.id,
          threadId: this.adapter.getThreadId ? this.adapter.getThreadId() : null,
          url: window.location.href,
          pageTitle: document.title,
          messages: visibleMessages,
          isStreaming: isStreaming
        };

        this.onObservation(observation);
      } else {
        console.log(`[Engine] Ignored mutation: Hash identical to last extraction (${this.lastHash})`);
      }
    } catch (err) {
      console.error('[Engine] Extraction error:', err);
    } finally {
      this.isChecking = false;
    }
  }
}
