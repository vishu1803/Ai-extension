import { PlatformId } from '../../../shared/types';
import { PlatformAdapter } from '../../../adapters/types';
import { ChatMessage, MessageRole } from '../../models';
import {
  AcquisitionResult,
  AcquisitionStatus,
  AcquisitionStrategy,
  AcquisitionStrategyType,
} from '../types';
import { safeQuerySelectorAll } from '../../../adapters/utils';
import { logger } from '../../../shared/logger';

import { perfMetrics } from '../../../shared/perfMode';

// In-memory element ID mapping to eliminate forced reflows from DOM attribute writes
const elementIdMap = new WeakMap<Element, string>();

export class VisibleDOMStrategy implements AcquisitionStrategy {
  public type: AcquisitionStrategyType = 'DOM';
  private adapter: PlatformAdapter;

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
  }

  public canExecute(_platform: PlatformId): boolean {
    return true; // Universal fallback
  }

  public async execute(
    threadId: string,
    signal?: AbortSignal,
    _onProgress?: (status: AcquisitionStatus) => void
  ): Promise<AcquisitionResult> {
    if (signal?.aborted) {
      return { strategy: this.type, success: false, messages: [], isComplete: false };
    }

    try {
      const messages = this.extractMessages();
      return {
        strategy: this.type,
        success: true,
        messages,
        isComplete: false,
      };
    } catch (error) {
      return {
        strategy: this.type,
        success: false,
        messages: [],
        isComplete: false,
        error: error as Error,
      };
    }
  }

  private extractMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const selectors = this.adapter.domSelectors || ['article', '.prose, .whitespace-pre-wrap'];

    perfMetrics.domQueries++;
    const rootContainer =
      typeof document !== 'undefined'
        ? document.querySelector('main') || document.body || document
        : undefined;

    let elements: Element[] = [];
    let fallbackLevel = '';

    for (const selector of selectors) {
      perfMetrics.domQueries++;
      const matches = rootContainer
        ? safeQuerySelectorAll(selector, rootContainer)
        : safeQuerySelectorAll(selector);
      if (matches.length > 0 && elements.length === 0) {
        elements = matches;
        fallbackLevel = selector;
      }
    }

    let isProseFallback = false;
    if (fallbackLevel === '.prose, .whitespace-pre-wrap') {
      isProseFallback = true;
      elements = elements.filter((el) => {
        const text = (el as HTMLElement).innerText || '';
        return text.length > 5;
      });
    }

    const seenIds = new Set<string>();

    elements.forEach((el) => {
      let role: MessageRole | null = null;
      let rejectReason: string | null = null;

      const roleAttr = el.getAttribute('data-message-author-role');
      if (roleAttr === 'user') {
        role = 'user';
      } else if (roleAttr === 'assistant' || roleAttr === 'ai') {
        role = 'ai';
      } else {
        const text = (el as HTMLElement).innerText || '';
        const html = el.innerHTML || '';

        if (el.classList.contains('whitespace-pre-wrap') && !el.classList.contains('prose')) {
          role = 'user';
        } else if (text.startsWith('You\n') || html.includes('alt="User"')) {
          role = 'user';
        }
      }

      if (!role) {
        rejectReason = 'missing role';
      }

      const text = (el as HTMLElement).innerText?.trim();

      if (!rejectReason && (!text || text.length === 0)) {
        rejectReason = 'empty text';
      }

      if (!rejectReason && isProseFallback && text && text.length <= 5) {
        rejectReason = 'text too short for prose fallback';
      }

      let id = el.getAttribute('data-message-id');
      if (!id) {
        id = el.closest?.('[data-message-id]')?.getAttribute('data-message-id') || null;
      }
      if (!id) {
        const parentContainer =
          el.closest?.('article, [data-message-author-role], div[class*="conversation-turn"]') ||
          el;
        id = elementIdMap.get(parentContainer) || elementIdMap.get(el) || null;
        if (!id) {
          id = `tracker-${role || 'turn'}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
          elementIdMap.set(parentContainer, id);
          elementIdMap.set(el, id);
        }
      }

      if (!rejectReason && seenIds.has(id)) {
        rejectReason = 'duplicate ID';
      }

      if (!rejectReason && el.querySelector('.result-streaming') && text && text.length < 2) {
        rejectReason = 'streaming placeholder';
      }

      if (rejectReason) {
        return;
      }

      seenIds.add(id);
      messages.push({ id, role: role as MessageRole, text: text as string });
    });

    logger.debug(`[VisibleDOMStrategy] Extracted ${messages.length} visible DOM messages.`);
    return messages;
  }
}
