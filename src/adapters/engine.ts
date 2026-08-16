import { ChatMessage, DOMObservation } from '../core/models';
import { PlatformAdapter } from './types';
import { ConversationAcquirer } from '../core/acquisition/ConversationAcquirer';
import {
  NetworkInterceptStrategy,
  NetworkHistoryStore,
} from '../core/acquisition/strategies/NetworkInterceptStrategy';
import { HydrationStrategy } from '../core/acquisition/strategies/HydrationStrategy';
import { VisibleDOMStrategy } from '../core/acquisition/strategies/VisibleDOMStrategy';
import { ConversationReadyDetector } from './ConversationReadyDetector';
import { safeQuerySelector } from './utils';
import { isExtensionContextInvalidated, messaging } from '../messaging/client';
import { logger, DEBUG_TRACKER } from '../shared/logger';

import { perfMetrics, startMeasure, endMeasure } from '../shared/perfMode';
import { SessionGeneration } from '../core/sessionGeneration';

let globalActiveEngineCount = 0;

const elementIdMap = new WeakMap<Element, string>();

/**
 * Extracts message ID and role from a single message element with robust fallbacks.
 */
function extractMessageMeta(el: Element, index: number): { id: string; role: 'user' | 'ai' } {
  let role: 'user' | 'ai' | null = null;
  const roleAttr =
    el.getAttribute('data-message-author-role') ||
    el.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role');
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
    } else if (
      el.classList.contains('prose') ||
      el.querySelector('.prose') ||
      el.querySelector('.result-streaming')
    ) {
      role = 'ai';
    } else {
      role = index % 2 === 0 ? 'user' : 'ai';
    }
  }

  const parentContainer =
    el.closest?.('article, [data-message-author-role], div[class*="conversation-turn"]') || el;

  let id =
    el.getAttribute('data-message-id') ||
    el.querySelector('[data-message-id]')?.getAttribute('data-message-id') ||
    el.closest?.('[data-message-id]')?.getAttribute('data-message-id') ||
    parentContainer.getAttribute('data-message-id') ||
    null;

  if (!id) {
    id = elementIdMap.get(parentContainer) || elementIdMap.get(el) || null;
    if (!id) {
      id = `msg-${role || 'turn'}-${index}-${Date.now().toString(36)}`;
      elementIdMap.set(parentContainer, id);
      elementIdMap.set(el, id);
    }
  }

  return { id, role: role || 'ai' };
}

/**
 * Extracts text from a single message element.
 */
function extractSingleMessageText(el: Element): string {
  return (el as HTMLElement).innerText?.trim() || '';
}

export class RobustDOMEngine {
  public readonly engineId: string;
  public readonly observerId: string;
  private observer: MutationObserver | null = null;
  private adapter: PlatformAdapter;
  private onObservation: (obs: DOMObservation) => void;
  private lastHash: string = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stabilizationTimer: ReturnType<typeof setTimeout> | null = null;
  private mutationBatchTimer: ReturnType<typeof setTimeout> | null = null;
  private isChecking: boolean = false;
  private mutationPending: boolean = false;
  private isNavigating: boolean = false;
  private quietMode: boolean = false;
  private acquirer: ConversationAcquirer;
  private readyDetector: ConversationReadyDetector;
  private conversationReady: boolean = false;
  private destroyed: boolean = false;

  private wasStreaming = false;
  private lastUserMsgId = '';
  private lastAssistantMsgId = '';
  private currentConversationId: string = '';
  private activeConversationId: string | null = null;
  private lastCommittedConversationId: string = '';
  private candidateConversationId: string | null = null;

  // Track the last observed message to detect actual changes cheaply
  private lastObservedMsgId: string = '';
  private lastObservedTextLength: number = 0;

  constructor(adapter: PlatformAdapter, onObservation: (obs: DOMObservation) => void) {
    this.engineId = `engine_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.observerId = `obs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.adapter = adapter;
    this.onObservation = onObservation;

    // ChatGPT uses NetworkInterceptStrategy as primary history source; APIStrategy is omitted to prevent 404s
    this.acquirer = new ConversationAcquirer([
      new NetworkInterceptStrategy(adapter),
      new HydrationStrategy(adapter),
      new VisibleDOMStrategy(adapter),
    ]);

    this.readyDetector = new ConversationReadyDetector(adapter, () => {
      this.onConversationReady();
    });
  }

  public triggerAcquisition(reason: string = 'ExternalTrigger'): void {
    this.scheduleUpdate(reason);
  }

  private onConversationReady = (): void => {
    if (this.destroyed || this.isNavigating || this.quietMode) return;
    this.conversationReady = true;

    if (!this.observer) {
      this.observer = new MutationObserver((records) => {
        perfMetrics.recordsObserved += records.length;
        this.handleMutationBatch();
      });

      const target = this.getObservationTarget();
      if (target) {
        this.observer.observe(target, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        logger.debug(`[Observer] Attached to ${target.tagName || 'Document'}`);
      }
    }

    this.scheduleUpdate('ConversationReady');
  };

  /**
   * THIN MUTATION HANDLER — Sets dirty flag and schedules lightweight observation.
   * This runs in the MutationObserver callback and completes in <1ms.
   */
  private handleMutationBatch = () => {
    perfMetrics.mutationCallbacks++;
    if (this.destroyed) return;

    // PHASE 1: QUIET WINDOW — Cheap dirty flag only, zero work while ChatGPT renders
    if (this.quietMode || this.isNavigating || !this.conversationReady) {
      this.mutationPending = true;
      return;
    }

    if (this.mutationPending) return; // Coalesce: already scheduled
    this.mutationPending = true;

    const isStreaming = this.adapter.isStreaming ? this.adapter.isStreaming() : false;
    const delay = isStreaming ? 400 : 250;

    this.mutationBatchTimer = setTimeout(() => {
      startMeasure('tracker:mutationBatch');
      this.mutationPending = false;
      this.mutationBatchTimer = null;

      if (!this.destroyed && !this.isNavigating && !this.quietMode && this.conversationReady) {
        this.observeLatestMessage('MutationBatch');
      }

      const duration = endMeasure('tracker:mutationBatch');
      if (DEBUG_TRACKER) {
        logger.perf('mutationBatch', duration);
      }
    }, delay);
  };

  private getObservationTarget = (): Element | null => {
    perfMetrics.domQueries++;
    if (this.adapter.observeSelector) {
      const el = safeQuerySelector(this.adapter.observeSelector);
      if (el) return el;
    }
    return safeQuerySelector('main') || (typeof document !== 'undefined' ? document.body : null);
  };

  public start() {
    this.destroyed = false;
    globalActiveEngineCount++;

    logger.tracker('ENGINE_STARTED', { platform: this.adapter.id });

    const threadId = this.adapter.getThreadId ? this.adapter.getThreadId() : null;
    const conversationId = `${this.adapter.id}:${threadId || window.location.href}`;
    this.currentConversationId = conversationId;
    this.activeConversationId = conversationId;

    logger.tracker('CONVERSATION_DETECTED', { conversationId });

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.setupUrlListener();
    this.readyDetector.start();

    // Notify background of active conversation immediately
    messaging
      .sendToBackground({
        type: 'SET_ACTIVE_CONVERSATION',
        payload: { conversationId },
      })
      .catch(() => {});

    logger.tracker('ENGINE_ACTIVE');
  }

  public stop() {
    this.dispose();
  }

  public dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    globalActiveEngineCount = Math.max(0, globalActiveEngineCount - 1);

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.acquirer.cancel();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.stabilizationTimer) {
      clearTimeout(this.stabilizationTimer);
      this.stabilizationTimer = null;
    }
    if (this.mutationBatchTimer) {
      clearTimeout(this.mutationBatchTimer);
      this.mutationBatchTimer = null;
    }
    this.readyDetector.stop();
    this.conversationReady = false;
    this.isNavigating = false;
    this.quietMode = false;
    this.mutationPending = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('locationchange', this.handleLocationChange);
    window.removeEventListener('popstate', this.handlePopState);
  }

  private handleVisibilityChange = () => {
    if (this.destroyed || this.isNavigating || this.quietMode) return;
    if (document.visibilityState === 'visible') {
      this.scheduleUpdate('VisibilityChanged');
    }
  };

  private handlePopState = () => {
    if (this.destroyed) return;
    window.dispatchEvent(new Event('locationchange'));
  };

  /**
   * Navigation Transaction:
   * PROVISIONAL NAVIGATION (QUIET MODE) -> STABILIZE -> COMMIT CONVERSATION SWITCH
   */
  private handleLocationChange = () => {
    if (this.destroyed) return;

    const candidateThreadId = this.adapter.getThreadId ? this.adapter.getThreadId() : null;
    const candidateConvId = `${this.adapter.id}:${candidateThreadId || window.location.href}`;

    // 1. If candidate ID is already the active/committed conversation, do nothing
    if (
      this.activeConversationId === candidateConvId ||
      this.lastCommittedConversationId === candidateConvId
    ) {
      return;
    }

    // 2. PROVISIONAL NAVIGATION: Enter QUIET MODE and freeze observations during transition
    this.isNavigating = true;
    this.quietMode = true;
    this.candidateConversationId = candidateConvId;
    this.conversationReady = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.stabilizationTimer) {
      clearTimeout(this.stabilizationTimer);
    }
    if (this.mutationBatchTimer) {
      clearTimeout(this.mutationBatchTimer);
      this.mutationBatchTimer = null;
    }

    // 3. STABILIZE: Schedule single stabilization check (150ms window)
    this.stabilizationTimer = setTimeout(() => {
      this.stabilizationTimer = null;
      this.commitNavigationTransaction();
    }, 150);
  };

  private commitNavigationTransaction = () => {
    if (this.destroyed) return;
    startMeasure('tracker:navigation');
    const t0 = performance.now();

    const resolvedThreadId = this.adapter.getThreadId ? this.adapter.getThreadId() : null;
    const resolvedConvId = `${this.adapter.id}:${resolvedThreadId || window.location.href}`;

    if (
      this.activeConversationId === resolvedConvId &&
      this.lastCommittedConversationId === resolvedConvId
    ) {
      this.isNavigating = false;
      this.quietMode = false;
      this.candidateConversationId = null;
      return;
    }

    const previousConvId = this.lastCommittedConversationId || this.activeConversationId || 'none';
    this.activeConversationId = resolvedConvId;
    this.lastCommittedConversationId = resolvedConvId;
    this.currentConversationId = resolvedConvId;
    this.candidateConversationId = null;
    this.isNavigating = false;
    this.quietMode = false;
    this.lastHash = '';
    this.lastUserMsgId = '';
    this.lastAssistantMsgId = '';
    this.lastObservedMsgId = '';
    this.lastObservedTextLength = 0;

    // Invalidate stale work and advance generation
    SessionGeneration.switchConversation(resolvedConvId);

    const duration = performance.now() - t0;
    perfMetrics.navigationMs.push(duration);
    endMeasure('tracker:navigation');

    // Emit exactly ONE switch event
    logger.tracker('conversation changed', `${previousConvId} -> ${resolvedConvId}`);
    messaging.sendToBackground({
      type: 'SET_ACTIVE_CONVERSATION',
      payload: { conversationId: resolvedConvId },
    });

    // Reset ready detector and start observation for the new conversation
    this.readyDetector.reset();

    if (DEBUG_TRACKER) {
      logger.perf('navigationCommit', duration);
    }
  };

  private setupUrlListener() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    if (!(history as any).__CTXTRACKER_PATCHED__) {
      (history as any).__CTXTRACKER_PATCHED__ = true;
      history.pushState = function (...args) {
        originalPushState.apply(this, args);
        window.dispatchEvent(new Event('locationchange'));
      };
      history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        window.dispatchEvent(new Event('locationchange'));
      };
    }

    window.addEventListener('popstate', this.handlePopState);
    window.addEventListener('locationchange', this.handleLocationChange);
  }

  private scheduleUpdate(reason: string = 'Unknown') {
    if (this.destroyed || this.isNavigating) return;
    if (isExtensionContextInvalidated()) {
      this.dispose();
      return;
    }
    if (document.visibilityState === 'hidden') return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const boundConvId = this.currentConversationId;
    // Use longer debounce during streaming to coalesce rapid DOM mutations
    const isStreaming = this.adapter.isStreaming ? this.adapter.isStreaming() : false;
    const delay = isStreaming ? 400 : 250;

    this.debounceTimer = setTimeout(() => {
      this.observeLatestMessage(reason, boundConvId);
      this.debounceTimer = null;
    }, delay);
  }

  /**
   * LIGHTWEIGHT OBSERVATION — Replaces the old heavy processDOM().
   *
   * Instead of iterating ALL message elements and extracting ALL text:
   * 1. Find the LAST message element (1 querySelector call)
   * 2. Extract its ID, role, and text (1 element only)
   * 3. If it changed, send a lightweight observation to background
   *
   * Target: < 16ms total execution time, typically < 2ms.
   *
   * The background worker handles all heavy work:
   * - Canonical merge, tokenization, IndexedDB, AppState updates
   */
  private async observeLatestMessage(reason: string = 'Unknown', boundConvId?: string) {
    if (this.destroyed || this.isNavigating || this.quietMode) return;
    if (isExtensionContextInvalidated()) {
      this.dispose();
      return;
    }

    if (!this.conversationReady) {
      logger.debug(`[Engine] Skip: conversation not ready yet`);
      return;
    }

    if (this.isChecking) {
      logger.debug(`[Engine] Skip Emission: lock active`);
      return;
    }

    this.isChecking = true;
    startMeasure('tracker:observeLatest');

    try {
      let threadId = this.adapter.getThreadId ? this.adapter.getThreadId() : null;
      if (!threadId) {
        const stored = NetworkHistoryStore.get();
        if (stored?.conversationId) {
          threadId = stored.conversationId;
        }
      }

      const conversationId = `${this.adapter.id}:${threadId || window.location.href}`;
      const isStreaming = this.adapter.isStreaming ? this.adapter.isStreaming() : false;

      // === THIN OBSERVATION: Find only the latest message elements ===
      perfMetrics.domQueries++;
      const selectors = this.adapter.domSelectors || ['[data-message-author-role]', 'article'];
      let matchingNodes: Element[] = [];

      const rootContainer =
        safeQuerySelector('main') || (typeof document !== 'undefined' ? document.body : null);

      if (rootContainer) {
        for (const selector of selectors) {
          perfMetrics.domQueries++;
          const matches = rootContainer.querySelectorAll(selector);
          if (matches.length > 0) {
            matchingNodes = Array.from(matches);
            break;
          }
        }
      }

      if (matchingNodes.length === 0) {
        this.isChecking = false;
        return;
      }

      // Check the latest messages (up to last 2: user and/or assistant)
      const candidateElements = matchingNodes.slice(-2);
      const observedMessages: ChatMessage[] = [];

      for (let i = 0; i < candidateElements.length; i++) {
        const el = candidateElements[i];
        const meta = extractMessageMeta(el, matchingNodes.length - candidateElements.length + i);
        if (!meta) continue;
        const text = extractSingleMessageText(el);
        if (!text) continue;
        observedMessages.push({
          id: meta.id,
          role: meta.role,
          text,
        });
      }

      if (observedMessages.length === 0) {
        this.isChecking = false;
        return;
      }

      const model = this.adapter.getModelId ? this.adapter.getModelId() : undefined;

      // Cheap change detection across the active turn
      const turnSignature =
        observedMessages
          .map(
            (m) => `${m.id}:${m.role}:${m.text.length}:${m.text.slice(0, 30)}_${m.text.slice(-30)}`
          )
          .join('|') + `:${isStreaming}:${model || 'unknown'}`;

      const streamingJustFinished = !isStreaming && this.wasStreaming;
      if (isStreaming && !this.wasStreaming) {
        this.wasStreaming = true;
      } else if (streamingJustFinished) {
        this.wasStreaming = false;
      }

      // Track user/assistant message IDs
      const latestUser = observedMessages.find((m) => m.role === 'user');
      const latestAi = observedMessages.find((m) => m.role === 'ai');
      if (latestUser && latestUser.id !== this.lastUserMsgId) {
        this.lastUserMsgId = latestUser.id;
      }
      if (latestAi && latestAi.id !== this.lastAssistantMsgId) {
        this.lastAssistantMsgId = latestAi.id;
      }

      // Decide whether to emit: Only emit if content actually changed
      let willEmit = false;
      if (isStreaming) {
        willEmit = turnSignature !== this.lastHash;
      } else if (streamingJustFinished) {
        willEmit = true; // Crucial: dispatch final state when streaming finishes
      } else if (turnSignature !== this.lastHash) {
        willEmit = true;
      }

      if (!willEmit) {
        this.isChecking = false;
        return; // IGNORE DUPLICATE OBSERVATION
      }

      if (willEmit && !this.destroyed && !this.isNavigating && !this.quietMode) {
        this.lastHash = turnSignature;

        // Send lightweight observation to background
        const observation: DOMObservation = {
          platform: this.adapter.id,
          threadId,
          conversationId,
          url: window.location.href,
          pageTitle: document.title,
          messages: observedMessages,
          isStreaming: isStreaming,
          model: model || 'unknown',
          source: 'DOM',
        };

        this.onObservation(observation);
      }
    } catch (err) {
      logger.error('DOM observation error', err);
    } finally {
      this.isChecking = false;
      const duration = endMeasure('tracker:observeLatest');
      if (DEBUG_TRACKER) {
        logger.perf('observeLatest', duration);
      }
    }
  }
}
