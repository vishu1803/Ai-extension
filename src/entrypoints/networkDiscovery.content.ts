import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://chatgpt.com/*', '*://*.chatgpt.com/*', '*://chat.openai.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    if ((window as any).__chatgpt_network_discovery_injected) return;
    (window as any).__chatgpt_network_discovery_injected = true;

    // Match ChatGPT conversation API endpoints (with or without query params)
    const CONVERSATION_URL_PATTERN = /\/backend-api\/conversation\/[a-f0-9-]+/i;

    function isConversationEndpoint(url: string): boolean {
      if (!url) return false;
      // Skip telemetry/analytics
      const lower = url.toLowerCase();
      if (
        lower.includes('sentry') ||
        lower.includes('telemetry') ||
        lower.includes('amplitude') ||
        lower.includes('datadog')
      )
        return false;
      return CONVERSATION_URL_PATTERN.test(url);
    }

    let lastProcessedKey = '';

    function processResponseBody(url: string, status: number, bodyText: string) {
      if (status !== 200 || !bodyText) return;

      try {
        // Single JSON.parse — no double-parsing
        const data = JSON.parse(bodyText);
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;

        const hasMapping = 'mapping' in data;
        const hasConversationId = 'conversation_id' in data;

        if (hasMapping && hasConversationId) {
          const rawNodes =
            typeof data.mapping === 'object' && data.mapping !== null
              ? Object.keys(data.mapping).length
              : 0;
          const currentNode = data.current_node || '';
          const processKey = `${data.conversation_id}_${rawNodes}_${currentNode}`;

          if (processKey === lastProcessedKey) {
            return;
          }
          lastProcessedKey = processKey;

          // Push to pending queue in window so content script can process if registered later
          (window as any).__CTXTRACKER_PENDING_NETWORK_CONVERSATIONS__ =
            (window as any).__CTXTRACKER_PENDING_NETWORK_CONVERSATIONS__ || [];
          (window as any).__CTXTRACKER_PENDING_NETWORK_CONVERSATIONS__.push({
            url,
            conversationId: data.conversation_id,
            mapping: data.mapping,
            currentNode: data.current_node || null,
          });

          // Post message to ISOLATED content script window
          window.postMessage(
            {
              type: '__CTXTRACKER_NETWORK_CONVERSATION__',
              payload: {
                url,
                conversationId: data.conversation_id,
                mapping: data.mapping,
                currentNode: data.current_node || null,
              },
            },
            '*'
          );
        }
      } catch {
        // Skip malformed responses
      }
    }

    // Intercept window.fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const resource = args[0];
      const url =
        typeof resource === 'string'
          ? resource
          : resource && (resource as Request).url
            ? (resource as Request).url
            : '';

      const response = await originalFetch.apply(this, args);

      if (isConversationEndpoint(url)) {
        if ((window as any).__TRACKER_PERF_MODE__ === 'DISABLED') {
          return response;
        }
        try {
          const clone = response.clone();
          const bodyText = await clone.text();
          processResponseBody(url, response.status, bodyText);
        } catch {}
      }

      return response;
    };

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (this: any, method: string, url: string) {
      this._nd_url = url;
      return originalOpen.apply(this, arguments as any);
    };

    XMLHttpRequest.prototype.send = function (this: any, body?: any) {
      this.addEventListener('load', function (this: any) {
        if (isConversationEndpoint(this._nd_url)) {
          processResponseBody(this._nd_url, this.status, this.responseText);
        }
      });
      return originalSend.apply(this, arguments as any);
    };
  },
});
