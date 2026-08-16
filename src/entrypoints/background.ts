import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { messaging } from '../messaging/client';
import { storageLayer, defaultState } from '../storage';
import { ExtensionMessage } from '../messaging/types';
import { SummaryEngine } from '../engines/summary';
import { DegradationEngine } from '../engines/degradation';
import { conversationManager, computeInputHash } from '../core/ConversationManager';
import { normalizeChatGPTMapping } from '../core/acquisition/normalizeMapping';
import { DOMObservation } from '../core/models';
import {
  publishCanonicalTokenResult,
  projectActiveCanonicalTokens,
  publishLiveTokenDelta,
  JobContext,
} from '../core/tokenPublisher';
import { CanonicalDerivedStore, TokenLiveStore } from '../core/tokenStore';
import { SessionGeneration } from '../core/sessionGeneration';
import { chatgptRuntime, normalizeConversationId } from '../core/chatgptRuntime';
import { logger, DEBUG_TRACKER } from '../shared/logger';
import { getTrackerPerfMode, perfMetrics, startMeasure, endMeasure } from '../shared/perfMode';

let creatingOffscreen: Promise<void> | null = null;

async function setupOffscreenDocument(path: '/offscreen.html') {
  if (await hasDocument()) return;
  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: browser.runtime.getURL(path),
      reasons: [chrome.offscreen.Reason.WORKERS],
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

const summaryEngines: Record<string, SummaryEngine> = {};
const degradationEngine = new DegradationEngine();

// ==========================================
// NETWORK PAYLOAD DEDUPLICATION
// Prevents repeated normalization/merge/tokenization for the same response version.
// Key: conversationId + nodeCount + currentNode
// ==========================================
const networkPayloadDedup = new Map<string, string>();
const DEDUP_MAX_ENTRIES = 50;

function isDuplicateNetworkPayload(
  conversationId: string,
  mapping: Record<string, any>,
  currentNode?: string | null
): boolean {
  const nodeCount =
    typeof mapping === 'object' && mapping !== null ? Object.keys(mapping).length : 0;
  const dedupKey = `${conversationId}_${nodeCount}_${currentNode || ''}`;

  if (
    networkPayloadDedup.has(conversationId) &&
    networkPayloadDedup.get(conversationId) === dedupKey
  ) {
    return true;
  }

  // Evict oldest entries if map is too large
  if (networkPayloadDedup.size >= DEDUP_MAX_ENTRIES) {
    const firstKey = networkPayloadDedup.keys().next().value;
    if (firstKey !== undefined) {
      networkPayloadDedup.delete(firstKey);
    }
  }

  networkPayloadDedup.set(conversationId, dedupKey);
  return false;
}

// ==========================================
// STREAMING STATE PER CONVERSATION
// Track whether each conversation was streaming to detect stream completion
// ==========================================
const streamingState = new Map<string, boolean>();

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

/**
 * Processes a FULL canonical observation (network history or stream completion).
 * This performs the complete pipeline: merge → tokenize → summarize → persist.
 */
async function processCanonicalObservation(observation: DOMObservation, tabId?: number) {
  // Skip processing 0-message observations
  if (!observation.messages || observation.messages.length === 0) {
    return { success: false, error: 'Empty observation skipped' };
  }

  const perfMode = getTrackerPerfMode();
  if (perfMode === 'DISABLED') {
    return { success: false, error: 'Disabled by TRACKER_PERF_MODE' };
  }

  // 1. Perform canonical merge
  startMeasure('tracker:canonicalMerge');
  const { conversation, addedCount, updatedCount } =
    await conversationManager.processMutation(observation);
  const mergeDuration = endMeasure('tracker:canonicalMerge');
  if (DEBUG_TRACKER) {
    logger.perf('canonicalMerge', mergeDuration);
  }
  const fullMessages = conversation.orderedMessageIds.map((id) => conversation.messages[id]);

  if (observation.source === 'NETWORK') {
    logger.tracker('HISTORY_ACQUIRED', {
      conversationId: conversation.id,
      messages: fullMessages.length,
    });
  }

  logger.tracker('CANONICAL_UPDATED', {
    conversationId: conversation.id,
    messageCount: conversation.orderedMessageIds.length,
  });

  // In NETWORK_ONLY, NETWORK_CANONICAL, or OBSERVER_ONLY modes:
  if (
    perfMode === 'NETWORK_ONLY' ||
    perfMode === 'OBSERVER_ONLY' ||
    perfMode === 'NETWORK_CANONICAL'
  ) {
    return {
      success: true,
      data: {
        conversationId: conversation.id,
        canonicalMessageCount: conversation.orderedMessageIds.length,
        storedMessageCount: conversation.orderedMessageIds.length,
        turns: fullMessages.filter((m) => m.role === 'user').length || 1,
        tokens: 0,
      },
    };
  }

  const state = await storageLayer.appState.getValue(tabId);
  const limit = state.stats.contextLimit;
  const turns = fullMessages.filter((m) => m.role === 'user').length || 1;

  // ==========================================
  // CANONICAL SNAPSHOT OR COMPLETED TURN: Tokenize Canonical Conversation
  // ==========================================
  if (observation.source === 'NETWORK' || addedCount > 0 || updatedCount > 0) {
    if (observation.source !== 'NETWORK') {
      logger.tracker(
        'canonical updated',
        `${conversation.id} (v${conversation.version}, ${fullMessages.length} messages)`
      );
    }

    await setupOffscreenDocument('/offscreen.html');

    const jobId = `job_can_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const inputVersion = conversation.version;
    const inputHash = computeInputHash(fullMessages);
    const generation = SessionGeneration.getGeneration();

    const jobContext: JobContext = {
      jobId,
      conversationId: conversation.id,
      conversationVersion: inputVersion,
      inputHash,
      inputMessageCount: fullMessages.length,
      generation,
    };

    let estimate = { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, confidence: 0 };
    try {
      perfMetrics.tokenJobs++;
      startMeasure('tracker:tokenization');
      const tokenResponse = (await browser.runtime.sendMessage({
        type: 'TOKENIZE_REQUEST',
        payload: {
          jobContext,
          platformId: observation.platform,
          maxContext: limit,
          messages: fullMessages,
        },
      })) as {
        jobContext: JobContext;
        estimate: typeof estimate;
      };
      estimate = tokenResponse?.estimate || estimate;
      const tokDuration = endMeasure('tracker:tokenization');
      if (DEBUG_TRACKER) {
        logger.perf('tokenization', tokDuration);
      }
    } catch (err) {
      logger.error('Tokenization offscreen request failed', err);
    }

    let currentSummary = state.currentSummary;
    if (turns >= 3) {
      perfMetrics.summaryJobs++;
      const summaryEngine = getSummaryEngine(observation.platform);
      currentSummary = summaryEngine.processIncremental(fullMessages);
    }

    const healthScore = degradationEngine.evaluate({
      messages: fullMessages,
      totalTokens: estimate.totalTokens,
      contextLimit: limit,
      thresholds: state.thresholds,
    });

    // Clear live deltas since canonical baseline now encompasses everything
    TokenLiveStore.clearLiveDeltas(conversation.id);

    console.log(
      `[TOKEN]\nconversationId=${conversation.id}\nmessageCount=${conversation.orderedMessageIds.length}\ntokenCount=${estimate.totalTokens}`
    );

    await publishCanonicalTokenResult(jobContext, {
      tokenCount: estimate.totalTokens,
      inputTokens: estimate.totalInputTokens,
      outputTokens: estimate.totalOutputTokens,
      confidence: estimate.confidence,
      isStreaming: false,
      source: observation.source === 'NETWORK' ? 'network_history' : 'canonical',
      platform: observation.platform,
      status: healthScore.status,
      currentSummary,
      turns,
      avgTokensPerTurn: turns > 0 ? estimate.totalTokens / turns : 0,
      healthMetrics: degradationEngine.toLegacyMetrics(healthScore),
      tabId,
    });

    return {
      success: true,
      data: {
        conversationId: conversation.id,
        canonicalMessageCount: conversation.orderedMessageIds.length,
        storedMessageCount: conversation.orderedMessageIds.length,
        turns,
        tokens: estimate.totalTokens,
      },
    };
  }

  return { success: true };
}

/**
 * Processes a LIVE streaming observation — single message only.
 * Updates TokenLiveStore with the streaming message's token count.
 * Publishes displayed total = baseline + live delta.
 * Does NOT re-tokenize the full conversation.
 */
async function processLiveStreamingMutation(observation: DOMObservation, tabId?: number) {
  if (!observation.messages || observation.messages.length === 0) {
    return { success: false, error: 'Empty live mutation' };
  }

  const perfMode = getTrackerPerfMode();
  if (perfMode === 'DISABLED' || perfMode === 'NETWORK_ONLY' || perfMode === 'NETWORK_CANONICAL') {
    return { success: false, error: 'Live tracking disabled in this mode' };
  }

  const conversationId =
    observation.conversationId ||
    `${observation.platform}:${observation.threadId || observation.url}`;
  const msg = observation.messages[observation.messages.length - 1]; // Latest message

  if (!msg || !msg.text) {
    return { success: true };
  }

  // Check if text actually changed (cheap length-based check)
  if (!TokenLiveStore.hasMessageChanged(conversationId, msg.id, msg.text.length)) {
    return { success: true };
  }

  // Quick heuristic token estimate for the single message (4 chars ≈ 1 token)
  // This avoids the overhead of the offscreen tokenizer for streaming chunks
  const quickTokenEstimate = Math.ceil(msg.text.length / 4);

  // Update live store with this message's token count
  // For cumulative streaming: previous=300, new=450 → stored as 450 (not 300+450)
  TokenLiveStore.updateMessageDelta(
    conversationId,
    msg.id,
    msg.role as 'user' | 'ai',
    quickTokenEstimate,
    msg.text.length
  );

  // Also merge incrementally into canonical store (text update only, no version bump for streaming)
  await conversationManager.processMutation(observation);

  // Publish displayed total = baseline + live delta
  await publishLiveTokenDelta(conversationId, tabId);

  return {
    success: true,
    data: {
      conversationId,
      canonicalMessageCount: 0, // Not re-counted during streaming
      storedMessageCount: 0,
      turns: 0,
      tokens: 0, // Live delta is tracked separately
    },
  };
}

export default defineBackground(() => {
  logger.tracker('initialized');

  if (
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.session &&
    chrome.storage.session.setAccessLevel
  ) {
    chrome.storage.session
      .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
      .catch((err) => logger.warn('Failed to set storage access level', err));
  }

  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      logger.tracker('installed');
      await storageLayer.appState.setValue(defaultState);

      const sidePanel = getSidePanelApi();
      if (sidePanel) {
        await sidePanel
          .setPanelBehavior({ openPanelOnActionClick: true })
          .catch((err) => logger.warn('Failed to set sidePanel behavior', err));
      }
    }
  });

  browser.tabs.onActivated.addListener(async (activeInfo) => {
    await storageLayer.activeTabId.setValue(activeInfo.tabId);
  });

  const sidePanel = getSidePanelApi();
  if (sidePanel) {
    sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => logger.warn('Failed to set sidePanel behavior', err));
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

      case 'SET_ACTIVE_CONVERSATION': {
        const tabId =
          typeof sender === 'object' && sender !== null && 'tab' in sender
            ? (sender as { tab?: { id?: number } }).tab?.id
            : undefined;
        const { conversationId } = message.payload;
        const prevState = await storageLayer.appState.getValue(tabId);
        const oldConvId = prevState.activeConversationId || 'none';

        if (conversationId.startsWith('chatgpt:')) {
          const normOld = normalizeConversationId(oldConvId);
          const normNew = normalizeConversationId(conversationId);
          const currentActive = chatgptRuntime.getState().activeConversationId;

          if (normNew && normNew !== normOld && normNew !== currentActive) {
            SessionGeneration.switchConversation(normNew);
            if (tabId) {
              await storageLayer.activeTabId.setValue(tabId);
            }
            await chatgptRuntime.handleConversationSwitch(normNew, tabId);
          }
        } else if (oldConvId !== conversationId) {
          // Increment generation epoch on conversation switch
          const newGen = SessionGeneration.switchConversation(conversationId);

          if (tabId) {
            await storageLayer.activeTabId.setValue(tabId);
          }

          // Other platforms: Check in-memory or canonical DB
          const inMem = CanonicalDerivedStore.get(conversationId);
          if (inMem && inMem.tokenCount > 0) {
            SessionGeneration.setReady(conversationId, newGen, inMem.canonicalVersion);
            await projectActiveCanonicalTokens(conversationId, tabId);
          } else {
            const canonical = await conversationManager.getConversation(conversationId);
            if (canonical && canonical.tokenEstimate && canonical.tokenEstimate.count > 0) {
              CanonicalDerivedStore.set({
                conversationId,
                canonicalVersion: canonical.version,
                messageCount: canonical.orderedMessageIds.length,
                tokenCount: canonical.tokenEstimate.count,
                inputTokens: canonical.tokenEstimate.inputCount,
                outputTokens: canonical.tokenEstimate.outputCount,
                confidence: canonical.tokenEstimate.confidence,
                turns: canonical.stats.turns,
                status: 'healthy',
                healthMetrics: canonical.stats.healthMetrics || {},
                currentSummary: canonical.summary || null,
                timestamp: Date.now(),
              });
              SessionGeneration.setReady(conversationId, newGen, canonical.version);
              await projectActiveCanonicalTokens(conversationId, tabId);
            } else {
              await projectActiveCanonicalTokens(conversationId, tabId);
            }
          }
        }
        return { success: true };
      }

      case 'NETWORK_PAYLOAD': {
        const { conversationId, mapping, currentNode, url } = message.payload;
        if (!mapping || !conversationId) {
          return { success: false, error: 'Invalid network payload' };
        }

        // DEDUPLICATION: Skip if this exact response version was already processed
        if (isDuplicateNetworkPayload(conversationId, mapping, currentNode)) {
          return { success: true, data: { deduplicated: true } };
        }

        const tabId =
          typeof sender === 'object' && sender !== null && 'tab' in sender
            ? (sender as { tab?: { id?: number } }).tab?.id
            : undefined;

        // Tokenization worker bridge
        const tokenizeMessages = async (msgs: any[]) => {
          await setupOffscreenDocument('/offscreen.html');
          const state = await storageLayer.appState.getValue(tabId);
          const limit = state.stats.contextLimit || 128000;
          const tokenResponse = (await browser.runtime.sendMessage({
            type: 'TOKENIZE_REQUEST',
            payload: {
              jobContext: {
                jobId: `job_net_${Date.now()}`,
                conversationId: `chatgpt:${conversationId}`,
                conversationVersion: 1,
                inputHash: '',
                inputMessageCount: msgs.length,
                generation: SessionGeneration.getGeneration(),
              },
              platformId: 'chatgpt',
              maxContext: limit,
              messages: msgs,
            },
          })) as {
            estimate?: { totalTokens: number; totalInputTokens: number; totalOutputTokens: number };
          };
          return (
            tokenResponse?.estimate || {
              totalTokens: msgs.reduce((s, m) => s + Math.ceil((m.text?.length || 0) / 4), 0),
              totalInputTokens: 0,
              totalOutputTokens: 0,
            }
          );
        };

        const totalTokens = await chatgptRuntime.handleNetworkPayload(
          { conversationId, mapping, currentNode, url },
          tokenizeMessages,
          tabId
        );

        return {
          success: true,
          data: {
            conversationId: `chatgpt:${conversationId}`,
            tokens: totalTokens,
          },
        };
      }

      case 'CONTENT_MUTATION': {
        const observation = message.payload;
        const tabId =
          typeof sender === 'object' && sender !== null && 'tab' in sender
            ? (sender as { tab?: { id?: number } }).tab?.id
            : undefined;

        if (observation.platform === 'chatgpt') {
          // ChatGPT: Lightweight live in-memory update (no IDB, no canonical DB)
          const totalTokens = await chatgptRuntime.handleLiveMutation(observation, tabId);
          return {
            success: true,
            data: {
              conversationId: observation.conversationId,
              tokens: totalTokens,
            },
          };
        }

        // Other platforms: Canonical persistence pipeline
        return await processCanonicalObservation(observation, tabId);
      }

      default:
        return { success: false, error: 'Unknown message type' };
    }
  });
});
