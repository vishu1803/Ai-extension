import { PlatformAdapter } from './types';
import { ChatMessage } from '../core/models';
import { logger } from '../shared/logger';
import { safeQuerySelector } from './utils';

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

  domSelectors: [
    '[data-message-author-role]',
    'article',
    'div[class*="conversation-turn"]',
    '.prose, .whitespace-pre-wrap',
  ],

  async extractHydrationData(): Promise<ChatMessage[] | null> {
    try {
      const scripts = Array.from(document.querySelectorAll('script'));
      let conversationData = null;

      for (const script of scripts) {
        if (!script.textContent) continue;

        if (script.id === '__NEXT_DATA__') {
          try {
            const data = JSON.parse(script.textContent);
            conversationData =
              data?.props?.pageProps?.serverResponse?.mapping ||
              data?.props?.pageProps?.initialState?.serverState?.mapping;
          } catch (e) {}
        }

        if (
          script.textContent.includes('__remixContext') ||
          script.textContent.includes('"mapping":')
        ) {
          try {
            const jsonMatch = script.textContent.match(/(\{.*\})/);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[1]);
              if (data.mapping) {
                conversationData = data.mapping;
              } else if (data?.state?.loaderData) {
                const routes = Object.values(data.state.loaderData);
                for (const route of routes) {
                  if ((route as any)?.serverResponse?.mapping) {
                    conversationData = (route as any).serverResponse.mapping;
                    break;
                  }
                }
              }
            }
          } catch (e) {}
        }

        if (conversationData) break;
      }

      if (!conversationData) return null;

      const messages: ChatMessage[] = [];

      Object.values(conversationData).forEach((node: any) => {
        const msg = node?.message;
        if (!msg || !msg.content || !msg.content.parts) return;

        const role = msg.author?.role === 'user' ? 'user' : 'ai';
        const text = msg.content.parts.join('\n');
        const id = msg.id;
        const timestamp = msg.create_time || 0;

        if (text && text.length > 0) {
          messages.push({ id, role, text, timestamp });
        }
      });

      messages.sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));

      logger.debug(`[ChatGPT Adapter] Extracted ${messages.length} messages from Hydration Data.`);
      return messages.length > 0 ? messages : null;
    } catch (err) {
      logger.debug('[ChatGPT Adapter] Hydration parsing failed:', err);
      return null;
    }
  },

  isStreaming() {
    const stopButton = safeQuerySelector(
      'button[aria-label="Stop generating"], button[aria-label="Stop streaming"], button[data-testid="stop-button"]'
    );
    const streamingCursor = safeQuerySelector(
      '.result-streaming, .streaming, [data-is-streaming="true"]'
    );
    return !!(stopButton || streamingCursor);
  },

  getModelId(): string | null {
    // 1. Check data-message-model-slug attribute on assistant turn
    const assistantEl = safeQuerySelector(
      '[data-message-author-role="assistant"][data-message-model-slug], [data-message-model-slug]'
    );
    if (assistantEl) {
      const slug =
        assistantEl.getAttribute('data-message-model-slug') ||
        assistantEl.getAttribute('data-model');
      if (slug) return slug;
    }

    // 2. Check model selector dropdown / button (using textContent to prevent forced reflow)
    const modelBtn = safeQuerySelector(
      'button[data-testid="model-switcher-button"], button[data-testid="model-selector-dropdown"], div[class*="model-selector"]'
    );
    if (modelBtn) {
      const text = (modelBtn as HTMLElement).textContent?.trim();
      if (text && text.length > 0 && text.length < 50) {
        return text;
      }
    }

    // 3. Check header model badge (using textContent to prevent forced reflow)
    const headerBadge = safeQuerySelector(
      'header span[class*="font-semibold"], [data-testid="model-name"]'
    );
    if (headerBadge) {
      const text = (headerBadge as HTMLElement).textContent?.trim();
      if (text && text.length > 0 && text.length < 50) {
        return text;
      }
    }

    return 'unknown';
  },

  extractMessages(): ChatMessage[] {
    return [];
  },
};
