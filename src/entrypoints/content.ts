import { defineContentScript } from 'wxt/sandbox';
import { mountWidget } from './content/widget/mount';
import { detectPlatform } from '../adapters';
import { RobustDOMEngine } from '../adapters/engine';

export default defineContentScript({
  matches: ['*://*.chatgpt.com/*', '*://chat.openai.com/*', '*://claude.ai/*', '*://gemini.google.com/*', '*://*.x.com/*', '*://*.grok.com/*', '*://*.perplexity.ai/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('AI Context Tracker: Content Script injected.');
    
    const url = new URL(window.location.href);
    const adapter = detectPlatform(url);
    
    if (adapter) {
      console.log(`Detected Platform: ${adapter.name}`);
      
      // Initialize Robust DOM Engine
      const engine = new RobustDOMEngine(
        () => adapter.extractMessages(),
        (fullText) => {
          console.log(`[Adapter: ${adapter.name}] Conversation updated. Length: ${fullText.length}`);
          
          // Send all extracted messages to Token Engine via background service worker
          const messages = adapter.extractMessages();
          messaging.sendToBackground({
            type: 'CONTENT_MUTATION',
            payload: {
              messages,
              platform: adapter.id as any
            }
          });
        }
      );
      
      engine.start();
      
      // Mount the UI widget
      await mountWidget(ctx);
    } else {
      console.log('No matching AI platform adapter found for this URL.');
    }
  }
});
