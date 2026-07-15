import { PlatformAdapter } from './types';
import { ChatMessage } from './engineTypes';

export const perplexityAdapter: PlatformAdapter = {
  id: 'perplexity',
  name: 'Perplexity',

  matches(url: URL) {
    return url.hostname.includes('perplexity.ai');
  },

  observeSelector: 'main',

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const elements = document.querySelectorAll('.prose, [dir="auto"]');

    elements.forEach((el, index) => {
      const id = `msg-${index}`;
      // Perplexity DOM often alternates or doesn't have strict roles without traversing tree, fallback to heuristics
      const role = index % 2 === 0 ? 'user' : 'ai';
      const text = (el as HTMLElement).innerText?.trim();

      if (text) {
        messages.push({ id, role, text });
      }
    });

    return messages;
  },
};
