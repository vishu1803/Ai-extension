import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { messaging } from '../messaging/client';
import { storageLayer, defaultState } from '../storage';
import { ExtensionMessage } from '../messaging/types';
import { TokenEngine } from '../engines/token';
import { SummaryEngine } from '../engines/summary';
import { HealthStatus } from '../shared/types';

// Global cache for token engines to avoid re-instantiating o200k_base encoder repeatedly
const tokenEngines: Record<string, TokenEngine> = {};

// Global cache for summary engines to enable incremental updates
const summaryEngines: Record<string, SummaryEngine> = {};

function getEngine(platformId: string, maxContext: number): TokenEngine {
  if (!tokenEngines[platformId]) {
    tokenEngines[platformId] = new TokenEngine(platformId, maxContext);
  }
  return tokenEngines[platformId];
}

function getSummaryEngine(platformId: string): SummaryEngine {
  if (!summaryEngines[platformId]) {
    summaryEngines[platformId] = new SummaryEngine();
  }
  return summaryEngines[platformId];
}

export default defineBackground(() => {
  console.log('AI Context Tracker: Background Service Worker initialized');

  // Initialize storage on install if needed
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await storageLayer.appState.setValue(defaultState);
      
      // Ensure the side panel opens when clicking the extension action icon
      if (browser.sidePanel) {
        await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
      }
    }
  });

  // Re-verify side panel behavior on startup just in case
  if (browser.sidePanel) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  }

  // Main Event Router
  messaging.addListener(async (message: ExtensionMessage, sender) => {
    switch (message.type) {
      case 'GET_STATE': {
        const state = await storageLayer.appState.getValue();
        return state;
      }
      
      case 'CONTENT_MUTATION': {
        const { messages, platform } = message.payload;
        
        // 1. Get current state to read thresholds and context limit
        const state = await storageLayer.appState.getValue();
        const limit = state.stats.contextLimit;
        
        // 2. Run Token Engine
        const engine = getEngine(platform, limit);
        const estimate = await engine.estimateConversation(messages);
        
        // 3. Run Summary Engine (Incremental)
        const summaryEngine = getSummaryEngine(platform);
        const currentSummary = summaryEngine.processIncremental(messages);
        
        // 4. Calculate UI Status based on preferences
        const percentUsed = (estimate.totalTokens / limit) * 100;
        let status: HealthStatus = 'healthy';
        
        if (percentUsed >= state.thresholds.critical) {
          status = 'critical';
        } else if (percentUsed >= state.thresholds.warning) {
          status = 'warning';
        } else if (percentUsed >= state.thresholds.caution) {
          status = 'caution';
        }
        
        // 5. Update the centralized state natively
        await storageLayer.updateAppState({
          tokenEstimate: {
            count: estimate.totalTokens,
            confidence: estimate.confidence,
            isStreaming: false
          },
          platform: platform as any,
          status,
          currentSummary,
          stats: {
            ...state.stats,
            turns: messages.filter(m => m.role === 'user').length
          }
        });
        
        return { success: true };
      }

      case 'UPDATE_TOKEN_COUNT': {
        // Legacy fallback or direct UI override
        const { count, platform } = message.payload;
        await storageLayer.updateAppState({
          tokenEstimate: { count, confidence: 0.95, isStreaming: false },
          platform: platform as any
        });
        return { success: true };
      }

      case 'OPEN_SIDE_PANEL': {
        if (browser.sidePanel && sender.tab?.id) {
          await browser.sidePanel.open({ tabId: sender.tab.id });
          return { success: true };
        }
        return { success: false, error: 'Side panel API not available or no tab ID' };
      }

      default:
        console.warn('[Background] Unhandled message type:', (message as any).type);
        return { success: false, error: 'Unhandled message type' };
    }
  });

});
