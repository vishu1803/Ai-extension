import { PlatformAdapter } from './types';
import { ChatMessage } from './engineTypes';

export const geminiAdapter: PlatformAdapter = {
  id: 'gemini',
  name: 'Gemini',

  matches(url: URL) {
    return url.hostname.includes('gemini.google.com');
  },

  observeSelector: 'message-list',

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const elements = document.querySelectorAll(
      'message-content, .model-response-text, user-query, .user-query-text, .message-content'
    );

    elements.forEach((el, index) => {
      const id = `msg-${index}`;
      const tagName = el.tagName.toLowerCase();
      const role = tagName === 'user-query' || el.className.includes('user-query') ? 'user' : 'ai';
      const text = (el as HTMLElement).innerText?.trim();

      if (text) {
        messages.push({ id, role, text });
      }
    });

    return messages;
  },
};
