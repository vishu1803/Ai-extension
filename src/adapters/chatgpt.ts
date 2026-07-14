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
    const elements = document.querySelectorAll('[data-message-author-role]');
    
    elements.forEach((el, index) => {
      // Try to find a unique ID, otherwise fallback to index (less robust for lazy loading, but works for MVP)
      const id = el.getAttribute('data-message-id') || `msg-${index}`;
      const roleAttr = el.getAttribute('data-message-author-role');
      const role: MessageRole = roleAttr === 'user' ? 'user' : 'ai';
      const text = (el as HTMLElement).innerText?.trim();
      
      if (text) {
        messages.push({ id, role, text });
      }
    });

    return messages;
  }
};
