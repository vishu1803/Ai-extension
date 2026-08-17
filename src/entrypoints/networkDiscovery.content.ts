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
        // Fast pre-check: skip 5MB-20MB JSON.parse if it obviously lacks mapping
        if (!bodyText.includes('"mapping"')) return;

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

          // Dispatch targeted CustomEvent instead of window.postMessage
          // This avoids waking up all other 'message' event listeners on the page (e.g. React, Next.js, telemetry)
          // which were causing [Violation] 'message' handler took 1300ms.
          document.dispatchEvent(
            new CustomEvent('__CTXTRACKER_NETWORK_CONVERSATION__', {
              detail: {
                url,
                conversationId: data.conversation_id,
                mapping: data.mapping,
                currentNode: data.current_node || null,
              },
            })
          );
        }
      } catch {
        // Skip malformed responses
      }
    }

    // Intercept window.fetch (completely non-blocking for page requests)
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
        if ((window as any).__TRACKER_PERF_MODE__ !== 'DISABLED') {
          try {
            const clone = response.clone();
            // Process body asynchronously without delaying fetch completion
            clone
              .text()
              .then((bodyText) => {
                setTimeout(() => {
                  processResponseBody(url, response.status, bodyText);
                }, 0);
              })
              .catch(() => {});
          } catch {}
        }
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
          const reqUrl = this._nd_url;
          const status = this.status;
          const text = this.responseText;
          setTimeout(() => {
            processResponseBody(reqUrl, status, text);
          }, 0);
        }
      });
      return originalSend.apply(this, arguments as any);
    };
  },
});
