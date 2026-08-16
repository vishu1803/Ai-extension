import { create } from 'zustand';
import { AppState } from '../../shared/types';
import { storageLayer, defaultState } from '../../storage';
import { messaging } from '../../messaging/client';
import { logger } from '../../shared/logger';

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
    await messaging.sendToBackground({
      type: 'UPDATE_TOKEN_COUNT',
      payload: { count, platform: get().platform || 'chatgpt' },
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
    storageLayer.appState.getValue().then((state) => {
      logger.debug(`[UI] Initial state loaded. Tokens: ${state.tokenEstimate.count}`);
      set({ ...state });
    });

    storageLayer.watchAppState((newState) => {
      if (!newState) return;
      set({ ...newState });
    });
  },
}));
