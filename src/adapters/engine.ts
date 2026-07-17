import { DOMObservation } from '../core/models';
import { PlatformAdapter } from './types';
import { ConversationAcquirer } from '../core/acquisition/ConversationAcquirer';
import { VisibleDOMStrategy } from '../core/acquisition/strategies/VisibleDOMStrategy';
import { HydrationStrategy } from '../core/acquisition/strategies/HydrationStrategy';

function hashMessages(messages: any[]): string {
  let str = '';
  for (const m of messages) {
    str += m.id + m.text.length + m.text.slice(0, 50);
  }
  return str;
}

import { runForensicInvestigation } from './chatgpt';

export class RobustDOMEngine {
  private observer: MutationObserver | null = null;
  private adapter: PlatformAdapter;
  private onObservation: (obs: DOMObservation) => void;
  private lastHash: string = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isChecking: boolean = false;
  private acquirer: ConversationAcquirer;
  
  // Tracing State
  private wasStreaming = false;
  private lastUserMsgId = '';
  private lastAssistantMsgId = '';

  constructor(
    adapter: PlatformAdapter,
    onObservation: (obs: DOMObservation) => void
  ) {
    this.adapter = adapter;
    this.onObservation = onObservation;
    
    this.acquirer = new ConversationAcquirer([
      new HydrationStrategy(adapter),
      new VisibleDOMStrategy(adapter)
    ]);
    
    if (!this.acquirer) {
      throw new Error('[Engine Fatal] Dependency injection failed: ConversationAcquirer is undefined.');
    }
    
    console.log(`[Engine] ConversationAcquirer created`);
    console.log(`[Engine] Registered strategies: Hydration, VisibleDOM`);
    console.log(`[Engine] RobustDOMEngine created`);
    console.log(`[Engine] Acquisition dependency injected: true`);
  }

  public start() {
    console.log(`[Engine] Stateless telemetry observer started for ${this.adapter.id}.`);

    // Removed the hardcoded diagnostic bypass because it's now properly encapsulated
    this.observer = new MutationObserver((mutations) => {
      this.scheduleUpdate('MutationObserver');
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

  private scheduleUpdate(reason: string = 'Unknown') {
    if (document.visibilityState === 'hidden') return;
    if (this.debounceTimer) {
      console.log(`[Engine] Skip Emission: debounce active`);
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.processDOM(reason);
      this.debounceTimer = null;
    }, 250);
  }

  private async processDOM(reason: string = 'Unknown') {
    const timestamp = new Date().toISOString();
    console.log(`\n--- processDOM Executed ---`);
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Mutation reason: ${reason}`);
    
    if (this.isChecking) {
      console.log(`[Engine] Skip Emission: extraction error / isChecking lock active`);
      return;
    }
    
    this.isChecking = true;

    try {
      const threadId = this.adapter.getThreadId ? this.adapter.getThreadId() : null;
      const result = await this.acquirer.acquire(threadId || 'unknown', this.adapter.id);
      const visibleMessages = result.messages;
      const currentHash = hashMessages(visibleMessages);
      
      const isStreaming = this.adapter.isStreaming ? this.adapter.isStreaming() : false;
      
      console.log(`Current DOM message count: ${visibleMessages.length}`);
      
      if (visibleMessages.length === 0) {
        console.log(`[Engine] Skip Emission: no messages`);
        this.isChecking = false;
        return;
      }
      
      const lastMsg = visibleMessages[visibleMessages.length - 1];
      console.log(`Last visible message ID: ${lastMsg.id}`);
      console.log(`Last visible message role: ${lastMsg.role}`);
      console.log(`Last visible message first 100 chars: ${lastMsg.text.substring(0, 100).replace(/\n/g, ' ')}`);
      console.log(`Current extraction hash: ${currentHash}`);
      console.log(`Previous extraction hash: ${this.lastHash}`);

      // Streaming Tracing Logic
      if (lastMsg.role === 'user' && lastMsg.id !== this.lastUserMsgId) {
        console.log(`[Trace] NEW USER PROMPT SUBMITTED: First appeared in DOM (ID: ${lastMsg.id})`);
        this.lastUserMsgId = lastMsg.id;
      }
      
      if (lastMsg.role === 'ai' && lastMsg.id !== this.lastAssistantMsgId) {
        console.log(`[Trace] ASSISTANT PLACEHOLDER APPEARED (ID: ${lastMsg.id})`);
        this.lastAssistantMsgId = lastMsg.id;
      }
      
      if (isStreaming && !this.wasStreaming) {
        console.log(`[Trace] STREAMING BEGINS`);
        this.wasStreaming = true;
      } else if (!isStreaming && this.wasStreaming) {
        console.log(`[Trace] STREAMING ENDS`);
        this.wasStreaming = false;
      }

      let willEmit = false;
      if (isStreaming) {
        willEmit = true;
      } else if (currentHash !== this.lastHash) {
        willEmit = true;
      }
      
      console.log(`Whether emission occurred: ${willEmit ? 'YES' : 'NO'}`);

      if (willEmit) {
        this.lastHash = currentHash;
        
        const observation: DOMObservation = {
          platform: this.adapter.id,
          threadId,
          url: window.location.href,
          pageTitle: document.title,
          messages: visibleMessages,
          isStreaming: isStreaming
        };

        if (!isStreaming && !this.wasStreaming) {
          console.log(`[Trace] FINAL CONTENT_MUTATION EMITTED (Streaming Complete / Steady State)`);
        }

        this.onObservation(observation);
      } else {
        if (!isStreaming && currentHash === this.lastHash) {
          console.log(`[Engine] Skip Emission: identical hash`);
        }
      }
    } catch (err) {
      console.log(`[Engine] Skip Emission: extraction error`);
      console.error('[Engine] Extraction error:', err);
    } finally {
      this.isChecking = false;
    }
  }
}
