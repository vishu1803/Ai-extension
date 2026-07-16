import { create } from 'zustand';
import { AppState } from '../../shared/types';
import { storageLayer, defaultState } from '../../storage';
import { messaging } from '../../messaging/client';

interface AppStore extends AppState {
  setTheme: (theme: AppState['theme']) => void;
  setStatus: (status: AppState['status']) => void;
  setTokenCount: (count: number) => void;
  setThresholds: (thresholds: AppState['thresholds']) => void;
  toggleWidget: () => void;
  setWidgetPosition: (pos: { x: number; y: number }) => void;
  openSidePanel: () => void;
  init: () => void;
}

// Connected state
export const useAppState = create<AppStore>((set, get) => ({
  ...defaultState,

  setTheme: async (theme) => {
    set({ theme });
    await storageLayer.updateAppState({ theme });
  },
  setThresholds: async (thresholds) => {
    set({ thresholds });
    await storageLayer.updateAppState({ thresholds });
  },
  setStatus: async (status) => {
    set({ status });
    await storageLayer.updateAppState({ status });
  },
  setTokenCount: async (count) => {
    set((state) => ({ tokenEstimate: { ...state.tokenEstimate, count } }));
    await messaging.sendToBackground({
      type: 'UPDATE_TOKEN_COUNT',
      payload: { count, platform: get().platform || 'chatgpt' }
    });
  },
  toggleWidget: async () => {
    const nextCollapsed = !get().widgetCollapsed;
    set({ widgetCollapsed: nextCollapsed });
    await storageLayer.updateAppState({ widgetCollapsed: nextCollapsed });
  },
  setWidgetPosition: async (widgetPosition) => {
    set({ widgetPosition });
    await storageLayer.updateAppState({ widgetPosition });
  },
  openSidePanel: async () => {
    await messaging.sendToBackground({ type: 'OPEN_SIDE_PANEL' });
  },
  init: () => {
    // 1. Initial load from storage
    storageLayer.appState.getValue().then((state) => {
      console.log(`[UI] Initial state loaded. Tokens: ${state.tokenEstimate.count}, Status: ${state.status}`);
      set({ ...state });
    });

    // 2. Watch for changes across contexts
    storageLayer.watchAppState((newState) => {
      if (newState) {
        console.log(`[UI] State updated via storage sync. Tokens: ${newState.tokenEstimate.count}, Status: ${newState.status}`);
        set({ ...newState });
      }
    });
  }
}));


