import { ChatMessage, ConversationState } from './engineTypes';

export class RobustDOMEngine {
  private observer: MutationObserver | null = null;
  private currentConversation: ConversationState | null = null;
  private extractFn: () => ChatMessage[];
  private onUpdate: (fullText: string) => void;
  
  private updatePending = false;
  private lastUrl: string = '';

  constructor(extractFn: () => ChatMessage[], onUpdate: (fullText: string) => void) {
    this.extractFn = extractFn;
    this.onUpdate = onUpdate;
    this.lastUrl = location.href;
  }

  public start() {
    this.resetConversation();

    // 1. Efficient Mutation Observer (Batched via requestAnimationFrame to minimize CPU)
    this.observer = new MutationObserver(() => {
      this.scheduleUpdate();
    });

    this.observer.observe(document.body, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });

    // 2. SPA URL change detection for new conversations
    this.setupUrlListener();
    
    // Initial trigger
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
  }

  private setupUrlListener() {
    // Intercept History API to detect SPA navigation
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
      if (this.lastUrl !== location.href) {
        this.lastUrl = location.href;
        this.resetConversation();
        this.scheduleUpdate();
      }
    });
  }

  private resetConversation() {
    this.currentConversation = {
      id: location.pathname,
      messages: new Map(),
      orderedIds: []
    };
  }

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleUpdate() {
    if (this.debounceTimer) return;

    // Use a 250ms debounce to drastically reduce CPU usage during fast streaming
    this.debounceTimer = setTimeout(() => {
      this.processDOM();
      this.debounceTimer = null;
    }, 250);
  }

  private processDOM() {
    if (!this.currentConversation) return;

    const visibleMessages = this.extractFn();
    let hasChanges = false;

    // Handle Lazy Loading & Edits:
    // If a message ID exists in the DOM, we update our state.
    // If it doesn't exist in the DOM but exists in our state, we KEEP it (assume lazy loaded off-screen)
    // UNLESS the DOM indicates a clear/delete (handled by resetConversation on URL change).
    
    // To handle regenerations/edits properly, we update the text of existing IDs.
    for (const msg of visibleMessages) {
      const existing = this.currentConversation.messages.get(msg.id);
      
      if (!existing) {
        // New message
        this.currentConversation.messages.set(msg.id, msg);
        this.currentConversation.orderedIds.push(msg.id);
        hasChanges = true;
      } else if (existing.text !== msg.text) {
        // Edit / Streaming / Regeneration
        existing.text = msg.text;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.emitUpdate();
    }
  }

  private emitUpdate() {
    if (!this.currentConversation) return;
    
    // Construct the full conversation string from state
    const fullText = this.currentConversation.orderedIds
      .map(id => this.currentConversation!.messages.get(id)?.text)
      .filter(Boolean)
      .join('\n\n');

    this.onUpdate(fullText);
  }
}
