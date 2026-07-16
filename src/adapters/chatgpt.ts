import { PlatformAdapter } from './types';
import { ChatMessage, MessageRole } from './engineTypes';

export const chatGptAdapter: PlatformAdapter = {
  id: 'chatgpt',
  name: 'ChatGPT',

  matches(url: URL) {
    return url.hostname.includes('chatgpt.com') || url.hostname.includes('chat.openai.com');
  },

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    
    // 1. Try standard author role attribute (Most common in modern ChatGPT)
    let elements = Array.from(document.querySelectorAll('[data-message-author-role]'));
    
    // 2. Fallback: message articles
    if (elements.length === 0) {
      elements = Array.from(document.querySelectorAll('article'));
    }
    
    // 3. Fallback: modern conversation turns if data-attributes are missing
    if (elements.length === 0) {
      elements = Array.from(document.querySelectorAll('div[class*="conversation-turn"]'));
    }
    
    // 4. Fallback: raw prose/text blocks if all structural wrappers fail
    if (elements.length === 0) {
      const texts = Array.from(document.querySelectorAll('.prose, .whitespace-pre-wrap'));
      // Filter out small nav elements or non-chat bubbles
      elements = texts.filter(el => {
        const text = (el as HTMLElement).innerText || '';
        return text.length > 5;
      });
    }

    elements.forEach((el, index) => {
      const id = el.getAttribute('data-message-id') || `msg-${index}`;
      let role: MessageRole = 'ai';
      
      const roleAttr = el.getAttribute('data-message-author-role');
      if (roleAttr === 'user') {
        role = 'user';
      } else if (roleAttr === 'assistant' || roleAttr === 'ai') {
        role = 'ai';
      } else {
        // Fallback heuristic: user messages typically contain "You" or are aligned right, or don't have copy/paste buttons
        const text = (el as HTMLElement).innerText || '';
        const html = el.innerHTML || '';
        
        // If it's a raw .prose block without wrappers, it's usually AI. 
        // User messages in ChatGPT usually don't have .prose but have .whitespace-pre-wrap
        if (el.classList.contains('whitespace-pre-wrap') && !el.classList.contains('prose')) {
          role = 'user';
        } else if (text.startsWith('You\n') || html.includes('alt="User"')) {
          role = 'user';
        }
      }

      const text = (el as HTMLElement).innerText?.trim();
      if (text && text.length > 0) {
        messages.push({ id, role, text });
      }
    });

    return messages;
  },
};
