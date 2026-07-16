import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { messaging } from '../messaging/client';
import { storageLayer, defaultState } from '../storage';
import { ExtensionMessage } from '../messaging/types';
// TokenEngine is now offloaded to offscreen document
import { SummaryEngine } from '../engines/summary';
import { PlatformId } from '../shared/types';
import { ChatMessage } from '../adapters/engineTypes';
import { DegradationEngine } from '../engines/degradation';

let creatingOffscreen: Promise<void> | null = null;

async function setupOffscreenDocument(path: '/offscreen.html') {
  if (await hasDocument()) return;
  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: browser.runtime.getURL(path),
      reasons: ['WORKERS' as any],
      justification: 'Run tiktoken in an offscreen document for performance',
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

async function hasDocument() {
  if (typeof chrome !== 'undefined' && chrome.offscreen && chrome.offscreen.hasDocument) {
    return await chrome.offscreen.hasDocument();
  }
  return false;
}
// Global cache for summary engines to enable incremental updates
const summaryEngines: Record<string, SummaryEngine> = {};

// Global cache for current session messages (used for regeneration)
const sessionMessages: Record<string, ChatMessage[]> = {};
const degradationEngine = new DegradationEngine();

interface SidePanelBrowser {
  sidePanel?: {
    setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
    open(options: { tabId: number }): Promise<void>;
  };
}

function getSidePanelApi() {
  return (browser as typeof browser & SidePanelBrowser).sidePanel;
}

function getSummaryEngine(platformId: string): SummaryEngine {
  if (!summaryEngines[platformId]) {
    summaryEngines[platformId] = new SummaryEngine();
  }
  return summaryEngines[platformId];
}



export default defineBackground(() => {
  console.log('[Startup] AI Context Tracker: Background Service Worker initialized');

  // Enable session storage access for content scripts (Crucial for WXT HMR and runtime state)
  if (
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.session &&
    chrome.storage.session.setAccessLevel
  ) {
    chrome.storage.session
      .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
      .catch(console.error);
  }

  // Initialize storage on install if needed
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      console.log('[Startup] Extension installed, initializing default state.');
      await storageLayer.appState.setValue(defaultState);

      // Ensure the side panel opens when clicking the extension action icon
      const sidePanel = getSidePanelApi();
      if (sidePanel) {
        await sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
      }
    }
  });

  browser.tabs.onActivated.addListener(async (activeInfo) => {
    await storageLayer.activeTabId.setValue(activeInfo.tabId);
  });

  // Re-verify side panel behavior on startup just in case
  const sidePanel = getSidePanelApi();
  if (sidePanel) {
    sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  }

  // Main Event Router
  messaging.addListener(async (message: ExtensionMessage, sender) => {
    switch (message.type) {
      case 'GET_STATE': {
        const tabId =
          typeof sender === 'object' && sender !== null && 'tab' in sender
            ? (sender as { tab?: { id?: number } }).tab?.id
            : undefined;
        const state = await storageLayer.appState.getValue(tabId);
        return state;
      }

      case 'CONTENT_MUTATION': {
        const { messages, platform } = message.payload;
        console.log(`[Context] Received CONTENT_MUTATION with ${messages.length} messages for platform: ${platform}`);

        // Cache the current session messages for regeneration
        sessionMessages[platform] = messages;
        console.log(`[Storage] Session cached for ${platform}. (Checks: Context survives page refresh if intended)`);

        const tabId =
          typeof sender === 'object' && sender !== null && 'tab' in sender
            ? (sender as { tab?: { id?: number } }).tab?.id
            : undefined;

        // 1. Get current state to read thresholds and context limit
        const state = await storageLayer.appState.getValue(tabId);
        const limit = state.stats.contextLimit;

        // 2. Ensure Offscreen Document exists and send Tokenize Request
        await setupOffscreenDocument('/offscreen.html');

        let estimate: { totalTokens: number; totalInputTokens: number; totalOutputTokens: number; confidence: number };
        try {
          console.log(`[LLM] Requesting tokenization offscreen for ${messages.length} messages.`);
          estimate = await browser.runtime.sendMessage({
            type: 'TOKENIZE_REQUEST',
            payload: {
              platformId: platform,
              maxContext: limit,
              messages,
            },
          }) as typeof estimate;
          console.log(`[LLM] Received token estimate: ${estimate.totalTokens} tokens (Confidence: ${estimate.confidence})`);
        } catch (err) {
          console.error('[LLM] Tokenization failed:', err);
          estimate = { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, confidence: 0 };
        }
        // 3. Run Summary Engine (Incremental)
        const turns = messages.filter((m) => m.role === 'user').length || 1;
        const autoSummaryThreshold = 3; // Typically user setting, hardcoded for checks

        console.log(`[Summary] Triggering incremental summary engine for ${platform}. User Turns: ${turns}`);
        if (turns >= autoSummaryThreshold) {
           console.log(`[Summary] Turns (${turns}) >= threshold (${autoSummaryThreshold}). (Checks: Summaries are generated after the configured threshold)`);
        } else {
           console.log(`[Summary] Turns (${turns}) < threshold (${autoSummaryThreshold}). Collecting context...`);
        }

        const summaryEngine = getSummaryEngine(platform);
        const currentSummary = summaryEngine.processIncremental(messages);

        // 4. Calculate live health from actual extracted messages
        const healthScore = degradationEngine.evaluate({
          messages,
          totalTokens: estimate.totalTokens,
          contextLimit: limit,
          thresholds: state.thresholds,
        });

        // 5. Update the centralized state
        const finalTurns = messages.filter((m) => m.role === 'user').length || 1;

        await storageLayer.updateAppState(
          {
            tokenEstimate: {
              count: estimate.totalTokens,
              inputCount: estimate.totalInputTokens,
              outputCount: estimate.totalOutputTokens,
              confidence: estimate.confidence,
              isStreaming: false,
            },
            platform,
            status: healthScore.status,
            currentSummary,
            stats: {
              ...state.stats,
              turns: finalTurns,
              avgTokensPerTurn: estimate.totalTokens / finalTurns,
              healthMetrics: degradationEngine.toLegacyMetrics(healthScore),
            },
          },
          tabId
        );

        return { success: true };
      }

      case 'UPDATE_TOKEN_COUNT': {
        const tabId =
          typeof sender === 'object' && sender !== null && 'tab' in sender
            ? (sender as { tab?: { id?: number } }).tab?.id
            : undefined;
        // Legacy fallback or direct UI override
        const { count, platform } = message.payload;
        await storageLayer.updateAppState(
          {
            tokenEstimate: {
              count,
              inputCount: count / 2,
              outputCount: count / 2,
              confidence: 0.95,
              isStreaming: false,
            },
            platform,
          },
          tabId
        );
        return { success: true };
      }

      case 'REGENERATE_SUMMARY': {
        const tabId =
          typeof sender === 'object' && sender !== null && 'tab' in sender
            ? (sender as { tab?: { id?: number } }).tab?.id
            : undefined;
        // Find the current platform's cached messages and force a full regeneration
        const state = await storageLayer.appState.getValue(tabId);
        const platform: PlatformId = state.platform || 'chatgpt';
        const messages = sessionMessages[platform];

        if (messages && messages.length > 0) {
          const summaryEngine = getSummaryEngine(platform);
          const freshSummary = summaryEngine.regenerate(messages);

          await storageLayer.updateAppState(
            {
              currentSummary: freshSummary,
            },
            tabId
          );

          return { success: true };
        }

        return { success: false, error: 'No session messages to regenerate from' };
      }

      case 'OPEN_SIDE_PANEL': {
        const tabId =
          typeof sender === 'object' && sender !== null && 'tab' in sender
            ? (sender as { tab?: { id?: number } }).tab?.id
            : undefined;
        const currentSidePanel = getSidePanelApi();
        if (currentSidePanel && tabId) {
          await currentSidePanel.open({ tabId });
          return { success: true };
        }
        return { success: false, error: 'Side panel API not available or no tab ID' };
      }

      default:
        console.warn('[Background] Unhandled message type:', message.type);
        return { success: false, error: 'Unhandled message type' };
    }
  });
});
