import { PlatformAdapter } from './types';
import { chatGptAdapter } from './chatgpt';
import { claudeAdapter } from './claude';
import { geminiAdapter } from './gemini';
import { grokAdapter } from './grok';
import { perplexityAdapter } from './perplexity';

// Registry of all supported platforms
const adapters: PlatformAdapter[] = [
  chatGptAdapter,
  claudeAdapter,
  geminiAdapter,
  grokAdapter,
  perplexityAdapter
];

/**
 * Registers a new platform adapter into the engine at runtime.
 */
export function registerAdapter(adapter: PlatformAdapter) {
  adapters.push(adapter);
}

/**
 * Detects the current platform based on the URL and returns the appropriate adapter.
 * If no adapter matches, returns null.
 */
export function detectPlatform(url: URL): PlatformAdapter | null {
  for (const adapter of adapters) {
    if (adapter.matches(url)) {
      return adapter;
    }
  }
  return null;
}
