import { PlatformAdapter } from './types';
import { ChatMessage } from './engineTypes';

export const grokAdapter: PlatformAdapter = {
  id: 'grok',
  name: 'Grok',
  
  matches(url: URL) {
    return url.hostname.includes('x.com') || url.hostname.includes('grok.com');
  },

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const elements = document.querySelectorAll('[data-testid="grok-message"], .grok-message, [data-testid="user-message"]');
    
    elements.forEach((el, index) => {
      const id = `msg-${index}`;
      const role = el.getAttribute('data-testid')?.includes('user') ? 'user' : 'ai';
      const text = (el as HTMLElement).innerText?.trim();
      
      if (text) {
        messages.push({ id, role, text });
      }
    });

    return messages;
  }
};
