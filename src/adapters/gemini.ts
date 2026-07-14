import { PlatformAdapter } from './types';
import { ChatMessage } from './engineTypes';

export const geminiAdapter: PlatformAdapter = {
  id: 'gemini',
  name: 'Gemini',
  
  matches(url: URL) {
    return url.hostname.includes('gemini.google.com');
  },

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const elements = document.querySelectorAll('message-content, .model-response-text, user-query');
    
    elements.forEach((el, index) => {
      const id = `msg-${index}`;
      const role = el.tagName.toLowerCase() === 'user-query' ? 'user' : 'ai';
      const text = (el as HTMLElement).innerText?.trim();
      
      if (text) {
        messages.push({ id, role, text });
      }
    });

    return messages;
  }
};
