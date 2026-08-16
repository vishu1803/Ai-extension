import { browser } from 'wxt/browser';
import { TokenEngine } from '../../engines/token';
import { ExtensionMessage } from '../../messaging/types';

const tokenEngines: Record<string, TokenEngine> = {};

function getEngine(platformId: string, maxContext: number): TokenEngine {
  if (!tokenEngines[platformId]) {
    tokenEngines[platformId] = new TokenEngine(platformId, maxContext);
  }
  return tokenEngines[platformId];
}

browser.runtime.onMessage.addListener(((
  message: ExtensionMessage,
  sender: any,
  sendResponse: any
) => {
  if (message.type === 'TOKENIZE_REQUEST') {
    const { jobContext, platformId, maxContext, messages } = message.payload;
    const engine = getEngine(platformId, maxContext);
    engine
      .estimateConversation(messages)
      .then((estimate) => {
        sendResponse({
          jobContext,
          estimate,
        });
      })
      .catch((err) => {
        console.error('[Offscreen] Tokenization error:', err);
        sendResponse({
          jobContext,
          error: String(err),
          estimate: { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, confidence: 0 },
        });
      });
    return true; // Keep the message channel open for the async response
  }
}) as any);
