import { storage } from 'wxt/storage';
import {
  AppState,
  DerivedConversationState,
  PlatformId,
  HealthStatus,
  TokenEstimate,
  ConversationStats,
  EstimatedContext,
} from '../shared/types';
import { StructuredSummary } from '../engines/summary/types';
import { SessionGeneration } from '../core/sessionGeneration';
import { DEBUG_TRACKER } from '../shared/logger';

export type SettingsState = Pick<
  AppState,
  | 'theme'
  | 'thresholds'
  | 'widgetPosition'
  | 'widgetCollapsed'
  | 'notificationsEnabled'
  | 'trackingEnabled'
  | 'onboardingComplete'
  | 'supportedPlatforms'
  | 'summaryFrequency'
  | 'exportFormat'
  | 'storageLocation'
  | 'privacy'
>;

export type SnapshotState = Pick<AppState, 'snapshots'>;

export interface RuntimeState {
  platform: PlatformId | null;
  status: HealthStatus;
  tokenEstimate: TokenEstimate;
  stats: ConversationStats;
  currentSummary: StructuredSummary | null;
  estimatedContext?: EstimatedContext;
  activeConversationId: string | null;
  derivedState: Record<string, DerivedConversationState>;
}

export const defaultState: AppState = {
  theme: 'dark',
  platform: null,
  status: 'healthy',
  tokenEstimate: {
    count: 0,
    inputCount: 0,
    outputCount: 0,
    confidence: 1,
    isStreaming: false,
  },
  stats: {
    turns: 0,
    avgTokensPerTurn: 0,
    contextLimit: 128000,
    healthMetrics: {
      repetition: 'Low',
      lengthDrift: 'Stable',
      instruction: 'Good',
      explicit: 'None',
    },
  },
  thresholds: {
    caution: 70,
    warning: 85,
    critical: 95,
  },
  currentSummary: null,
  widgetPosition: { x: 20, y: 20 },
  widgetCollapsed: true,
  notificationsEnabled: true,
  trackingEnabled: true,
  onboardingComplete: false,
  snapshots: [],
  supportedPlatforms: {
    chatgpt: true,
    claude: true,
    gemini: true,
    grok: false,
    perplexity: false,
  },
  summaryFrequency: 5,
  exportFormat: 'markdown',
  storageLocation: 'local',
  privacy: {
    enableHistory: true,
    allowAnalytics: false,
  },
  estimatedContext: {
    observedTokens: 0,
    estimatedTokens: 0,
    observedTurns: 0,
    estimatedTurns: 0,
    coverageRatio: 1.0,
    estimationSource: 'none',
  },
};

export const neutralDerivedState: DerivedConversationState = {
  conversationId: '',
  platform: null,
  status: 'healthy',
  tokenEstimate: {
    count: 0,
    inputCount: 0,
    outputCount: 0,
    confidence: 1,
    isStreaming: false,
  },
  stats: {
    turns: 0,
    avgTokensPerTurn: 0,
    contextLimit: 128000,
    healthMetrics: {
      repetition: 'Low',
      lengthDrift: 'Stable',
      instruction: 'Good',
      explicit: 'None',
    },
  },
  currentSummary: null,
  estimatedContext: {
    observedTokens: 0,
    estimatedTokens: 0,
    observedTurns: 0,
    estimatedTurns: 0,
    coverageRatio: 1.0,
    estimationSource: 'none',
  },
};

export const defaultRuntimeState: RuntimeState = {
  platform: defaultState.platform,
  status: defaultState.status,
  tokenEstimate: neutralDerivedState.tokenEstimate,
  stats: neutralDerivedState.stats,
  currentSummary: null,
  estimatedContext: neutralDerivedState.estimatedContext,
  activeConversationId: null,
  derivedState: {},
};

export const defaultSettingsState: SettingsState = {
  theme: defaultState.theme,
  thresholds: defaultState.thresholds,
  widgetPosition: defaultState.widgetPosition,
  widgetCollapsed: defaultState.widgetCollapsed,
  notificationsEnabled: defaultState.notificationsEnabled,
  trackingEnabled: defaultState.trackingEnabled,
  onboardingComplete: defaultState.onboardingComplete,
  supportedPlatforms: defaultState.supportedPlatforms,
  summaryFrequency: defaultState.summaryFrequency,
  exportFormat: defaultState.exportFormat,
  storageLocation: defaultState.storageLocation,
  privacy: defaultState.privacy,
};

export const defaultSnapshotState: SnapshotState = {
  snapshots: defaultState.snapshots,
};

async function readMergedState(tabId?: number): Promise<AppState> {
  const [runtimeStateMap, settingsState, snapshotState, activeTabId] = await Promise.all([
    storageLayer.runtimeState.getValue(),
    storageLayer.settingsState.getValue(),
    storageLayer.snapshotState.getValue(),
    storageLayer.activeTabId.getValue(),
  ]);

  const targetTabId = tabId ?? activeTabId;
  const rawRuntimeState =
    targetTabId && runtimeStateMap[targetTabId]
      ? runtimeStateMap[targetTabId]
      : defaultRuntimeState;

  const activeId =
    SessionGeneration.getActiveConversation() || rawRuntimeState.activeConversationId;
  const currentGen = SessionGeneration.getGeneration();
  let activeDerived: Partial<RuntimeState> = neutralDerivedState;

  if (activeId && rawRuntimeState.derivedState?.[activeId]) {
    const d = rawRuntimeState.derivedState[activeId];
    if (d.conversationId === activeId) {
      activeDerived = {
        platform: d.platform,
        status: d.status,
        tokenEstimate: d.tokenEstimate,
        stats: d.stats,
        currentSummary: d.currentSummary,
        estimatedContext: d.estimatedContext || neutralDerivedState.estimatedContext,
      };
    }
  }

  return {
    ...defaultState,
    ...settingsState,
    activeConversationId: activeId,
    derivedState: rawRuntimeState.derivedState || {},
    ...activeDerived,
    ...snapshotState,
  };
}

function splitUpdates(updates: Partial<AppState>) {
  const runtimeUpdates: Partial<RuntimeState> = {};
  const settingsUpdates: Partial<SettingsState> = {};
  const snapshotUpdates: Partial<SnapshotState> = {};

  for (const [key, value] of Object.entries(updates) as [
    keyof AppState,
    AppState[keyof AppState],
  ][]) {
    if (key in defaultRuntimeState || key === 'activeConversationId' || key === 'derivedState') {
      Object.assign(runtimeUpdates, { [key]: value });
    } else if (key in defaultSettingsState) {
      Object.assign(settingsUpdates, { [key]: value });
    } else if (key in defaultSnapshotState) {
      Object.assign(snapshotUpdates, { [key]: value });
    }
  }

  return { runtimeUpdates, settingsUpdates, snapshotUpdates };
}

export const storageLayer = {
  runtimeState: storage.defineItem<Record<number, RuntimeState>>('local:runtimeState', {
    fallback: {},
  }),

  settingsState: storage.defineItem<SettingsState>('sync:settingsState', {
    fallback: defaultSettingsState,
  }),

  snapshotState: storage.defineItem<SnapshotState>('local:snapshotState', {
    fallback: defaultSnapshotState,
  }),

  appState: {
    getValue: readMergedState,
    async setValue(nextState: AppState, tabId?: number) {
      const { runtimeUpdates, settingsUpdates, snapshotUpdates } = splitUpdates(nextState);
      const targetTabId = tabId ?? (await storageLayer.activeTabId.getValue());

      const runtimeStateMap = await storageLayer.runtimeState.getValue();
      const updatedRuntimeMap = targetTabId
        ? { ...runtimeStateMap, [targetTabId]: { ...defaultRuntimeState, ...runtimeUpdates } }
        : runtimeStateMap;

      await Promise.all([
        storageLayer.runtimeState.setValue(updatedRuntimeMap),
        storageLayer.settingsState.setValue({ ...defaultSettingsState, ...settingsUpdates }),
        storageLayer.snapshotState.setValue({ ...defaultSnapshotState, ...snapshotUpdates }),
      ]);
    },
    watch(callback: (newValue: AppState, oldValue: AppState) => void) {
      let previousState: AppState | null = null;
      const notify = async () => {
        const nextState = await readMergedState();
        callback(nextState, previousState ?? nextState);
        previousState = nextState;
      };

      const stops = [
        storageLayer.runtimeState.watch(notify),
        storageLayer.settingsState.watch(notify),
        storageLayer.snapshotState.watch(notify),
      ];

      return () => stops.forEach((stop) => stop());
    },
  },

  activeTabId: storage.defineItem<number | null>('local:activeTabId', {
    fallback: null,
  }),

  async updateAppState(
    updates: Partial<AppState> & { conversationId?: string; activeConversationId?: string | null },
    tabId?: number
  ) {
    const { conversationId, activeConversationId, ...restUpdates } = updates;
    const { runtimeUpdates, settingsUpdates, snapshotUpdates } = splitUpdates(restUpdates);
    const updatePromises: Promise<void>[] = [];

    const effectiveConvId =
      conversationId || (activeConversationId !== null ? activeConversationId : undefined);

    if (
      Object.keys(runtimeUpdates).length > 0 ||
      effectiveConvId ||
      activeConversationId !== undefined
    ) {
      updatePromises.push(
        Promise.all([
          this.runtimeState.getValue(),
          tabId ? Promise.resolve(tabId) : this.activeTabId.getValue(),
        ]).then(([stateMap, targetTabId]) => {
          if (targetTabId) {
            const currentTabState = stateMap[targetTabId] || defaultRuntimeState;
            const updatedDerived = { ...(currentTabState.derivedState || {}) };
            const targetConvId = effectiveConvId || currentTabState.activeConversationId;

            if (targetConvId) {
              const existing = updatedDerived[targetConvId] || {
                conversationId: targetConvId,
                platform: restUpdates.platform !== undefined ? restUpdates.platform : null,
                status:
                  restUpdates.status !== undefined
                    ? restUpdates.status
                    : neutralDerivedState.status,
                tokenEstimate: restUpdates.tokenEstimate || neutralDerivedState.tokenEstimate,
                stats: restUpdates.stats || neutralDerivedState.stats,
                currentSummary:
                  restUpdates.currentSummary !== undefined ? restUpdates.currentSummary : null,
                estimatedContext:
                  restUpdates.estimatedContext || neutralDerivedState.estimatedContext,
              };

              updatedDerived[targetConvId] = {
                ...existing,
                conversationId: targetConvId,
                generation:
                  (updates as any).generation !== undefined
                    ? (updates as any).generation
                    : existing.generation,
                version:
                  (updates as any).version !== undefined
                    ? (updates as any).version
                    : existing.version,
                platform:
                  restUpdates.platform !== undefined ? restUpdates.platform : existing.platform,
                status: restUpdates.status !== undefined ? restUpdates.status : existing.status,
                tokenEstimate:
                  restUpdates.tokenEstimate !== undefined
                    ? restUpdates.tokenEstimate
                    : existing.tokenEstimate,
                stats: restUpdates.stats !== undefined ? restUpdates.stats : existing.stats,
                currentSummary:
                  restUpdates.currentSummary !== undefined
                    ? restUpdates.currentSummary
                    : existing.currentSummary,
                estimatedContext:
                  restUpdates.estimatedContext !== undefined
                    ? restUpdates.estimatedContext
                    : existing.estimatedContext,
              };

              const updatedTokens =
                restUpdates.tokenEstimate !== undefined
                  ? restUpdates.tokenEstimate.count
                  : existing.tokenEstimate.count;

              if (DEBUG_TRACKER) {
                console.log(`[TRACE:APPSTATE_TOKEN] conv=${targetConvId} tokens=${updatedTokens}`);
              }
            }

            const newRuntimeState: RuntimeState = {
              platform:
                restUpdates.platform !== undefined
                  ? restUpdates.platform
                  : currentTabState.platform || null,
              status:
                restUpdates.status !== undefined
                  ? restUpdates.status
                  : currentTabState.status || 'healthy',
              tokenEstimate: neutralDerivedState.tokenEstimate,
              stats: neutralDerivedState.stats,
              currentSummary: null,
              estimatedContext: neutralDerivedState.estimatedContext,
              activeConversationId:
                activeConversationId !== undefined
                  ? activeConversationId
                  : currentTabState.activeConversationId,
              derivedState: updatedDerived,
            };

            return this.runtimeState.setValue({
              ...stateMap,
              [targetTabId]: newRuntimeState,
            });
          }
        })
      );
    }

    if (Object.keys(settingsUpdates).length > 0) {
      updatePromises.push(
        this.settingsState
          .getValue()
          .then((curr) => this.settingsState.setValue({ ...curr, ...settingsUpdates }))
      );
    }

    if (Object.keys(snapshotUpdates).length > 0) {
      updatePromises.push(
        this.snapshotState
          .getValue()
          .then((curr) => this.snapshotState.setValue({ ...curr, ...snapshotUpdates }))
      );
    }

    await Promise.all(updatePromises);
  },

  watchAppState(callback: (state: AppState) => void) {
    return this.appState.watch(callback);
  },
};
