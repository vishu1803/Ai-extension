import { PlatformId } from '../../../shared/types';
import { PlatformAdapter } from '../../../adapters/types';
import { ChatMessage, MessageRole } from '../../models';
import { AcquisitionResult, AcquisitionStatus, AcquisitionStrategy, AcquisitionStrategyType } from '../types';

export class VisibleDOMStrategy implements AcquisitionStrategy {
  public type: AcquisitionStrategyType = 'DOM';
  private adapter: PlatformAdapter;

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
  }

  public canExecute(platform: PlatformId): boolean {
    return true; // The DOM strategy is a universal fallback
  }

  public async execute(
    threadId: string,
    signal?: AbortSignal,
    onProgress?: (status: AcquisitionStatus) => void
  ): Promise<AcquisitionResult> {
    
    // Check if aborted before starting
    if (signal?.aborted) {
      return { strategy: this.type, success: false, messages: [], isComplete: false };
    }

    try {
      const messages = this.extractMessages();
      
      // The DOM strategy only sees what's visible. It cannot guarantee completeness due to virtualization.
      return {
        strategy: this.type,
        success: true,
        messages,
        isComplete: false 
      };
    } catch (error) {
      return {
        strategy: this.type,
        success: false,
        messages: [],
        isComplete: false,
        error: error as Error
      };
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  private extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const isChatGPT = this.adapter.id === 'chatgpt';
    
    if (isChatGPT) {
      console.group(`\n--- [ChatGPT Adapter] DOM Extraction Trace ---`);
    }
    
    const selectors = this.adapter.domSelectors || ['article', '.prose, .whitespace-pre-wrap'];
    
    let elements: Element[] = [];
    let fallbackLevel = '';

    for (const selector of selectors) {
      const matches = Array.from(document.querySelectorAll(selector));
      if (isChatGPT) {
        console.log(`Selector checked: ${selector} -> ${matches.length} nodes matched`);
      }
      if (matches.length > 0 && elements.length === 0) {
        elements = matches;
        fallbackLevel = selector;
      }
    }
    
    if (isChatGPT) {
      console.log(`\nActive selector chosen: ${fallbackLevel}`);
    }
    
    let isProseFallback = false;
    if (fallbackLevel === '.prose, .whitespace-pre-wrap') {
      isProseFallback = true;
      elements = elements.filter(el => {
        const text = (el as HTMLElement).innerText || '';
        return text.length > 5;
      });
    }

    const seenIds = new Set<string>();
    let rejectedOlderMessages = 0;

    elements.forEach((el, index) => {
      let role: MessageRole | null = null;
      let rejectReason: string | null = null;
      
      const roleAttr = el.getAttribute('data-message-author-role');
      if (roleAttr === 'user') {
        role = 'user';
      } else if (roleAttr === 'assistant' || roleAttr === 'ai') {
        role = 'ai';
      } else {
        const text = (el as HTMLElement).innerText || '';
        const html = el.innerHTML || '';
        
        if (el.classList.contains('whitespace-pre-wrap') && !el.classList.contains('prose')) {
          role = 'user';
        } else if (text.startsWith('You\n') || html.includes('alt="User"')) {
          role = 'user';
        }
      }

      if (!role) {
        rejectReason = 'missing role';
      }

      const text = (el as HTMLElement).innerText?.trim();
      
      if (!rejectReason && (!text || text.length === 0)) {
        rejectReason = 'empty text / missing content';
      }
      
      if (!rejectReason && isProseFallback && text && text.length <= 5) {
        rejectReason = 'text too short for prose fallback';
      }
      
      let id = el.getAttribute('data-message-id');
      if (!id) {
        id = el.getAttribute('data-tracker-id');
        if (!id) {
          id = `hash-${this.hashString((text || '') + (role || ''))}-${(text || '').length}`;
          el.setAttribute('data-tracker-id', id);
        }
      }

      if (!rejectReason && seenIds.has(id)) {
        rejectReason = 'duplicate ID';
      }
      
      // Check if it's a streaming placeholder (e.g., blinking cursor without real text)
      if (!rejectReason && el.querySelector('.result-streaming') && text && text.length < 2) {
        rejectReason = 'streaming placeholder';
      }

      if (rejectReason) {
        if (isChatGPT) {
          console.log(`Rejected [Node ${index}]: ${rejectReason}`);
        }
        rejectedOlderMessages++; // Keep a loose count
        return;
      }
      
      seenIds.add(id);
      messages.push({ id, role: role as MessageRole, text: text as string });
    });

    if (isChatGPT) {
      if (messages.length > 0) {
        const first = messages[0];
        const last = messages[messages.length - 1];
        console.log(`\nFIRST visible message: [${first.role}] ${first.text.substring(0, 50).replace(/\n/g, ' ')}...`);
        console.log(`LAST visible message: [${last.role}] ${last.text.substring(0, 50).replace(/\n/g, ' ')}...`);
        
        // Is first visible also the first chronological?
        // ChatGPT usually has no marker, but if there's no older rejected nodes and it's the top node in the list, it might be.
        const firstChronological = rejectedOlderMessages === 0 && document.querySelector('.conversation-turn') === elements[0];
        console.log(`First visible message is first chronological message: ${firstChronological ? 'YES' : 'UNKNOWN'}`);
      } else {
        console.log(`\nFIRST visible message: NONE`);
        console.log(`LAST visible message: NONE`);
      }
      
      console.log(`\nOlder messages exist in the DOM but were rejected: ${rejectedOlderMessages > 0 ? 'YES' : 'NO'}`);
      
      if (messages.length <= 5 && messages.length > 0) {
        console.log(`\n[EXPLANATION] Why only ${messages.length} messages are available:`);
        console.log(`ChatGPT heavily virtualizes its DOM. Older messages are physically removed from the Document Object Model to save memory when scrolling down. querySelectorAll can only 'see' the nodes currently attached to the viewport.`);
      }
      
      console.groupEnd();
    }

    return messages;
  }
}
