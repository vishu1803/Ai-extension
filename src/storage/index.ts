import { storage } from 'wxt/storage';
import { AppState } from '../shared/types';

// Default initial state for the extension
export const defaultState: AppState = {
  theme: 'dark',
  platform: null,
  status: 'healthy',
  tokenEstimate: { count: 0, confidence: 1, isStreaming: false },
  stats: { turns: 0, avgTokensPerTurn: 0, contextLimit: 128000 }, // Defaulting to standard limit
  thresholds: {
    caution: 70,
    warning: 85,
    critical: 95
  },
  currentSummary: null,
  widgetPosition: { x: 20, y: 20 },
  widgetCollapsed: true,
  notificationsEnabled: true,
  snapshots: [],
  supportedPlatforms: {
    chatgpt: true,
    claude: true,
    gemini: true
  },
  summaryFrequency: 5,
  exportFormat: 'markdown',
  storageLocation: 'local',
  privacy: {
    enableHistory: true,
    allowAnalytics: false
  }
};

/**
 * Storage Abstraction Layer
 * Using wxt/storage for reactive bindings and cross-context sync.
 */
export const storageLayer = {
  // AppState Item
  appState: storage.defineItem<AppState>('local:appState', {
    fallback: defaultState,
  }),

  // Optional: Session storage for highly ephemeral data (e.g., current tab ID)
  activeTabId: storage.defineItem<number | null>('session:activeTabId', {
    fallback: null,
  }),

  /**
   * Helper to perform a partial update on the AppState.
   */
  async updateAppState(updates: Partial<AppState>) {
    const currentState = await this.appState.getValue();
    await this.appState.setValue({ ...currentState, ...updates });
  },
  
  /**
   * Listen to state changes. Great for UI reactivity.
   */
  watchAppState(callback: (newValue: AppState, oldValue: AppState) => void) {
    return this.appState.watch(callback);
  }
};
