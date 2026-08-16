import { PlatformAdapter } from './types';
import { ChatMessage } from '../core/models';
import { safeQuerySelectorAll } from './utils';

export const claudeAdapter: PlatformAdapter = {
  id: 'claude',
  name: 'Claude',

  matches(url: URL) {
    return url.hostname.includes('claude.ai');
  },

  observeSelector: '.flex-1.overflow-hidden',

  extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const elements = safeQuerySelectorAll(
      '.font-claude-message, .font-user-message, [data-is-streaming]'
    );

    elements.forEach((el, index) => {
      const id = el.getAttribute('data-test-render-count') || `msg-${index}`;
      const role = el.className.includes('claude') ? 'ai' : 'user';
      const text = (el as HTMLElement).innerText?.trim();

      if (text) {
        messages.push({ id, role, text });
      }
    });

    return messages;
  },
};
