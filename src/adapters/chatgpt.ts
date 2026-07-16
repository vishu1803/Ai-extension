import { PlatformAdapter } from './types';
import { ChatMessage, MessageRole } from '../core/models';

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

export const chatGptAdapter: PlatformAdapter = {
  id: 'chatgpt',
  name: 'ChatGPT',

  matches(url: URL) {
    return url.hostname.includes('chatgpt.com') || url.hostname.includes('chat.openai.com');
  },

  getThreadId() {
    const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  },

  isStreaming() {
    // Look for the "Stop generating" button or the blinking cursor
    const stopButton = document.querySelector('button[aria-label="Stop generating"]');
    const streamingCursor = document.querySelector('.result-streaming');
    return !!(stopButton || streamingCursor);
  },

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    
    console.group(`[ChatGPT Adapter Audit] extractMessages() triggered`);
    console.log(`[Audit] Scanning DOM. Shadow DOM is NOT penetrated. We query the main document.`);
    
    const selectors = [
      '[data-message-author-role]',
      'article',
      'div[class*="conversation-turn"]',
      '.prose, .whitespace-pre-wrap'
    ];
    
    console.log(`[Audit] Selectors evaluated in order:`, selectors);

    let elements: Element[] = [];
    let fallbackLevel = '';

    for (const selector of selectors) {
      const matches = Array.from(document.querySelectorAll(selector));
      console.log(`[Audit] Selector "${selector}" matching node count: ${matches.length}`);
      if (matches.length > 0 && elements.length === 0) {
        elements = matches;
        fallbackLevel = selector;
      }
    }
    
    // Filter prose if we used the prose fallback
    let isProseFallback = false;
    if (fallbackLevel === '.prose, .whitespace-pre-wrap') {
      isProseFallback = true;
      elements = elements.filter(el => {
        const text = (el as HTMLElement).innerText || '';
        return text.length > 5;
      });
    }

    console.log(`[Audit] Total DOM nodes matching final selector '${fallbackLevel}': ${elements.length}`);
    
    // Note on virtualization
    if (elements.length < 5) {
      console.warn(`[Audit] EXPLANATION for missing messages: Found ${elements.length} nodes. ChatGPT likely heavily virtualized the DOM, entirely removing older elements from the document.querySelectorAll scope. Only the current viewport is physically present in the DOM.`);
    }

    let userCount = 0;
    let assistantCount = 0;
    let discardedCount = 0;
    const discardReasons: Record<string, string> = {};

    elements.forEach((el, index) => {
      let role: MessageRole = 'ai';
      
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

      const text = (el as HTMLElement).innerText?.trim();
      
      // Discard checks
      if (!text || text.length === 0) {
        discardedCount++;
        discardReasons[`Node ${index}`] = 'Text is completely empty or missing.';
        return;
      }
      
      if (isProseFallback && text.length <= 5) {
        discardedCount++;
        discardReasons[`Node ${index}`] = `Text length (${text.length}) <= 5 during prose fallback. Text: "${text}"`;
        return;
      }
      
      let id = el.getAttribute('data-message-id');
      if (!id) {
        id = el.getAttribute('data-tracker-id');
        if (!id) {
          id = `hash-${hashString((text || '') + role)}-${(text || '').length}`;
          el.setAttribute('data-tracker-id', id);
        }
      }

      if (role === 'user') userCount++;
      if (role === 'ai') assistantCount++;

      const snippet = text.replace(/\n/g, ' ').substring(0, 60);
      console.log(`[Audit Extracted Node] Index: ${index} | ID: ${id} | Role: ${role} | Text: "${snippet}..."`);
      
      messages.push({ id, role, text });
    });

    console.log(`[Audit Summary] DOM nodes found: ${elements.length}`);
    console.log(`[Audit Summary] Messages extracted: ${messages.length}`);
    console.log(`[Audit Summary] Total User nodes: ${userCount}`);
    console.log(`[Audit Summary] Total Assistant nodes: ${assistantCount}`);
    console.log(`[Audit Summary] Messages discarded: ${discardedCount}`);
    if (discardedCount > 0) {
      console.table(discardReasons);
    }
    console.groupEnd();
    
    return messages;
  },
};
