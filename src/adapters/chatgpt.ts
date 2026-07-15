import { PlatformAdapter } from './types';
import { ChatMessage, MessageRole } from './engineTypes';

export const chatGptAdapter: PlatformAdapter = {
  id: 'chatgpt',
  name: 'ChatGPT',

  matches(url: URL) {
    return url.hostname.includes('chatgpt.com') || url.hostname.includes('chat.openai.com');
  },

  observeSelector: 'main',

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    // Try multiple selectors as ChatGPT frequently updates its DOM
    let elements = document.querySelectorAll('[data-message-author-role]');

    if (elements.length === 0) {
      // Fallback 1: message articles
      elements = document.querySelectorAll('article');
    }

    elements.forEach((el, index) => {
      const id = el.getAttribute('data-message-id') || `msg-${index}`;

      let role: MessageRole = 'ai';
      const roleAttr = el.getAttribute('data-message-author-role');
      if (roleAttr === 'user') {
        role = 'user';
      } else if (roleAttr === 'assistant' || roleAttr === 'ai') {
        role = 'ai';
      } else if (el.tagName.toLowerCase() === 'article') {
        // Fallback role detection based on common DOM structures in articles
        if (
          el.querySelector('[data-message-author-role="user"]') ||
          (el.textContent?.includes('You') && el.textContent?.length < 100)
        ) {
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
