import { PlatformAdapter } from './types';
import { ChatMessage } from './engineTypes';

export const claudeAdapter: PlatformAdapter = {
  id: 'claude',
  name: 'Claude',
  
  matches(url: URL) {
    return url.hostname.includes('claude.ai');
  },

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    // Claude messages are usually contained in these distinct font classes
    const elements = document.querySelectorAll('.font-claude-message, .font-user-message, [data-is-streaming]');
    
    elements.forEach((el, index) => {
      // Generate a stable ID based on DOM position if no specific ID exists
      const id = el.getAttribute('data-test-render-count') || `msg-${index}`;
      const role = el.className.includes('claude') ? 'ai' : 'user';
      const text = (el as HTMLElement).innerText?.trim();
      
      if (text) {
        messages.push({ id, role, text });
      }
    });

    return messages;
  }
};
