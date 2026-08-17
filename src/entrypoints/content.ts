import { defineContentScript } from 'wxt/sandbox';
import { mountWidget } from './content/widget/mount';
import { detectPlatform } from '../adapters';
import { RobustDOMEngine } from '../adapters/engine';
import { messaging } from '../messaging/client';
import { storageLayer } from '../storage';
import { logger } from '../shared/logger';
import '../ui/styles/tailwind.css';

import { getTrackerPerfMode, perfMetrics } from '../shared/perfMode';

export default defineContentScript({
  matches: [
    '*://chatgpt.com/*',
    '*://*.chatgpt.com/*',
    '*://chat.openai.com/*',
    '*://claude.ai/*',
    '*://gemini.google.com/*',
    '*://grok.com/*',
    '*://x.com/i/grok*',
  ],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const perfMode = getTrackerPerfMode();
    if (perfMode === 'DISABLED') {
      logger.debug('[Startup] Extension disabled by TRACKER_PERF_MODE=DISABLED');
      return;
    }

    logger.debug(`[Startup] Content Script injected on ${window.location.href} (mode=${perfMode})`);

    // Clean up any previously running engine from an older content script instance
    if ((window as any).__ACTIVE_ROBUST_DOM_ENGINE__) {
      try {
        (window as any).__ACTIVE_ROBUST_DOM_ENGINE__.dispose();
      } catch (_) {}
      (window as any).__ACTIVE_ROBUST_DOM_ENGINE__ = null;
    }

    const url = new URL(window.location.href);
    const adapter = detectPlatform(url);

    if (adapter) {
      logger.tracker('CONTENT_SCRIPT_STARTED', {
        platform: adapter.id,
        url: window.location.href,
      });
      logger.tracker('PLATFORM_DETECTED', adapter.id);

      let state;
      try {
        state = await storageLayer.appState.getValue();
      } catch (error) {
        logger.warn(
          'Failed to access storage (context restricted). Falling back to default tracking state.',
          error
        );
        const { defaultState } = await import('../storage');
        state = defaultState;
      }

      if (!state.trackingEnabled || !state.supportedPlatforms[adapter.id]) {
        logger.debug(`[Startup] Tracking disabled for ${adapter.name}. Observer not started.`);
        return;
      }

      // Network Intercept Bridge: Thin forwarder to background worker
      if (adapter.id === 'chatgpt') {
        logger.tracker('NETWORK_BRIDGE_READY');

        const handleNetworkPayload = (payload: any) => {
          if (!payload || !ctx.isValid) return;
          const {
            conversationId,
            mapping,
            url: interceptedUrl,
            currentNode,
            current_node,
          } = payload;
          if (!mapping || !conversationId) return;

          const rawNodes =
            typeof mapping === 'object' && mapping !== null ? Object.keys(mapping).length : 0;

          logger.tracker('HISTORY_RECEIVED', {
            conversationId: `chatgpt:${conversationId}`,
            messages: rawNodes,
          });

          // Forward directly to background worker
          messaging
            .sendToBackground({
              type: 'NETWORK_PAYLOAD',
              payload: {
                url: interceptedUrl || window.location.href,
                conversationId,
                mapping,
                currentNode: currentNode || current_node || null,
              },
            })
            .catch(() => {});
        };

        // Flush any pending network items intercepted before main() initialization
        const pendingQueue = (window as any).__CTXTRACKER_PENDING_NETWORK_CONVERSATIONS__;
        if (Array.isArray(pendingQueue) && pendingQueue.length > 0) {
          const queueItems = [...pendingQueue];
          (window as any).__CTXTRACKER_PENDING_NETWORK_CONVERSATIONS__ = [];
          for (const item of queueItems) {
            handleNetworkPayload(item);
          }
        }

        const networkListener = (event: Event) => {
          if (!ctx.isValid) return;
          const customEvent = event as CustomEvent;
          if (!customEvent.detail) return;
          handleNetworkPayload(customEvent.detail);
        };

        document.addEventListener('__CTXTRACKER_NETWORK_CONVERSATION__', networkListener);

        ctx.onInvalidated(() => {
          document.removeEventListener('__CTXTRACKER_NETWORK_CONVERSATION__', networkListener);
        });
      }

      // Initialize Robust DOM Engine (Stateless telemetry observer) unless in network-only modes
      const shouldRunEngine = perfMode === 'FULL' || perfMode === 'OBSERVER_ONLY';
      if (shouldRunEngine) {
        const engine = new RobustDOMEngine(adapter, (observation) => {
          if (!ctx.isValid) return;
          perfMetrics.runtimeMessages++;
          messaging
            .sendToBackground<{
              conversationId?: string;
              canonicalMessageCount?: number;
              storedMessageCount?: number;
              turns?: number;
              tokens?: number;
            }>({
              type: 'CONTENT_MUTATION',
              payload: observation,
            })
            .catch(() => {});
        });

        (window as any).__ACTIVE_ROBUST_DOM_ENGINE__ = engine;

        ctx.onInvalidated(() => {
          engine.dispose();
          if ((window as any).__ACTIVE_ROBUST_DOM_ENGINE__ === engine) {
            (window as any).__ACTIVE_ROBUST_DOM_ENGINE__ = null;
          }
        });

        engine.start();
      }

      // Mount the UI widget only in FULL mode
      if (perfMode === 'FULL') {
        await mountWidget(ctx);
      }
    }
  },
});
