import { defineContentScript } from 'wxt/sandbox';
import { mountWidget } from './content/widget/mount';
import { detectPlatform } from '../adapters';
import { RobustDOMEngine } from '../adapters/engine';
import { messaging } from '../messaging/client';
import { storageLayer } from '../storage';

import '../ui/styles/tailwind.css';

export default defineContentScript({
  matches: [
    '*://chatgpt.com/*',
    '*://*.chatgpt.com/*',
    '*://chat.openai.com/*',
    '*://claude.ai/*',
    '*://gemini.google.com/*',
    '*://*.x.com/*',
    '*://*.grok.com/*',
    '*://*.perplexity.ai/*',
  ],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log(`[Startup] AI Context Tracker: Content Script injected on ${window.location.href}`);

    const url = new URL(window.location.href);
    const adapter = detectPlatform(url);

    if (adapter) {
      let state;
      try {
        state = await storageLayer.appState.getValue();
      } catch (error) {
        console.warn('[Startup] Failed to access storage (context restricted). Falling back to default tracking state.', error);
        // Default state fallback guarantees the tracker and observer always start
        const { defaultState } = await import('../storage');
        state = defaultState;
      }

      if (!state.trackingEnabled || !state.supportedPlatforms[adapter.id]) {
        console.log(`[Startup] Tracking disabled for ${adapter.name}. Observer not started.`);
        return;
      }

      console.log(`[Startup] Detected Platform: ${adapter.name}. Initializing engine.`);

      // Initialize Robust DOM Engine
      const engine = new RobustDOMEngine(
        () => adapter.extractMessages(),
        (fullText) => {
          console.log(
            `[Extractor] Conversation updated for ${adapter.name}. Full text length: ${fullText.length} characters.`
          );

          // Send all extracted messages to Token Engine via background service worker
          const messages = adapter.extractMessages();
          messaging.sendToBackground({
            type: 'CONTENT_MUTATION',
            payload: {
              messages,
              platform: adapter.id,
            },
          });
        },
        adapter.observeSelector
      );

      engine.start();

      // Mount the UI widget
      await mountWidget(ctx);
    } else {
      console.log('[Startup] No matching AI platform adapter found for this URL.');
    }
  },
});
