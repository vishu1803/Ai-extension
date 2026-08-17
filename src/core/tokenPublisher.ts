import { storageLayer } from '../storage';
import { EstimatedContext, HealthStatus } from '../shared/types';
import { StructuredSummary } from '../engines/summary/types';
import { conversationManager, computeInputHash } from './ConversationManager';
import { SessionGeneration } from './sessionGeneration';
import { logger, DEBUG_TRACKER } from '../shared/logger';
import {
  CanonicalDerivedStore,
  CanonicalDerivedState,
  TokenLiveStore,
  computeLiveDelta,
} from './tokenStore';

export interface JobContext {
  jobId: string;
  conversationId: string;
  conversationVersion: number;
  inputHash: string;
  inputMessageCount: number;
  generation: number;
}

export interface PublishTokenMeta {
  tokenCount: number;
  inputTokens: number;
  outputTokens: number;
  confidence: number;
  isStreaming: boolean;
  source: string;
  platform: string;
  status: HealthStatus;
  currentSummary: StructuredSummary | null;
  turns: number;
  avgTokensPerTurn: number;
  healthMetrics: any;
  estimatedContext?: EstimatedContext;
  tabId?: number;
}

/**
 * THE SINGLE AUTHORITATIVE TOKEN PIPELINE WRITER.
 * Writes canonical token result to ConversationDerivedState and projects to UI if active.
 */
export async function publishCanonicalTokenResult(
  jobContext: JobContext,
  meta: PublishTokenMeta
): Promise<boolean> {
  const activeState = await storageLayer.appState.getValue(meta.tabId);
  let currentActiveConversationId =
    SessionGeneration.getActiveConversation() || activeState.activeConversationId;
  let currentGeneration = SessionGeneration.getGeneration();

  // If active conversation is not yet established, auto-adopt incoming conversation
  if (
    !currentActiveConversationId ||
    currentActiveConversationId === 'none' ||
    currentActiveConversationId === ''
  ) {
    currentGeneration = SessionGeneration.switchConversation(jobContext.conversationId);
    currentActiveConversationId = jobContext.conversationId;
  }

  const canonicalConv = await conversationManager.getConversation(jobContext.conversationId);
  const currentConversationVersion = canonicalConv?.version ?? jobContext.conversationVersion;
  const canonicalMessages = canonicalConv
    ? canonicalConv.orderedMessageIds.map((id) => canonicalConv.messages[id])
    : [];
  const currentInputHash = canonicalConv
    ? computeInputHash(canonicalMessages)
    : jobContext.inputHash;

  // 1. Store in CanonicalDerivedStore strictly under jobContext.conversationId
  const derivedRecord: CanonicalDerivedState = {
    conversationId: jobContext.conversationId,
    canonicalVersion: jobContext.conversationVersion,
    messageCount: jobContext.inputMessageCount,
    tokenCount: meta.tokenCount,
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    confidence: meta.confidence,
    turns: meta.turns,
    status: meta.status,
    healthMetrics: meta.healthMetrics,
    currentSummary: meta.currentSummary,
    timestamp: Date.now(),
  };
  CanonicalDerivedStore.set(derivedRecord);

  // 2. Persist to IndexedDB
  try {
    await conversationManager.updateTokenEstimate(jobContext.conversationId, {
      count: meta.tokenCount,
      inputCount: meta.inputTokens,
      outputCount: meta.outputTokens,
      confidence: meta.confidence,
      isStreaming: meta.isStreaming || false,
    });
  } catch (err) {
    logger.error('Failed to persist token estimate in IndexedDB', err);
  }

  // 3. Fencing: Verify active conversation and generation
  let rejectReason: string | null = null;
  if (jobContext.conversationId !== currentActiveConversationId) {
    rejectReason = 'STALE_CONVERSATION';
  } else if (jobContext.generation !== currentGeneration) {
    rejectReason = 'STALE_GENERATION';
  }

  if (rejectReason !== null) {
    if (DEBUG_TRACKER) {
      console.log(
        `[TOKEN_REJECT] reason=${rejectReason} ` +
          `jobConversation=${jobContext.conversationId} activeConversation=${currentActiveConversationId} ` +
          `jobGen=${jobContext.generation} curGen=${currentGeneration}`
      );
    }
    return false;
  }

  // 4. Project single authoritative token count to active UI
  const turns = meta.turns || activeState.stats.turns || 1;
  await storageLayer.updateAppState(
    {
      conversationId: jobContext.conversationId,
      activeConversationId: jobContext.conversationId,
      generation: currentGeneration,
      version: jobContext.conversationVersion,
      tokenEstimate: {
        count: meta.tokenCount,
        inputCount: meta.inputTokens,
        outputCount: meta.outputTokens,
        confidence: meta.confidence,
        isStreaming: meta.isStreaming || false,
      },
      platform: (meta.platform || activeState.platform) as any,
      status: meta.status || 'healthy',
      currentSummary:
        meta.currentSummary !== undefined ? meta.currentSummary : activeState.currentSummary,
      stats: {
        ...activeState.stats,
        turns,
        avgTokensPerTurn: turns > 0 ? meta.tokenCount / turns : 0,
        healthMetrics: meta.healthMetrics || activeState.stats.healthMetrics || {},
      },
    } as any,
    meta.tabId
  );

  logger.tracker('TOKENS_UPDATED', {
    conversationId: jobContext.conversationId,
    tokens: meta.tokenCount,
  });

  logger.tracker('UI_STATE_UPDATED', {
    conversationId: jobContext.conversationId,
    tokens: meta.tokenCount,
  });

  return true;
}

/**
 * Projects cached canonical tokens onto UI during conversation switch or refresh.
 */
export async function projectActiveCanonicalTokens(
  conversationId: string,
  tabId?: number
): Promise<boolean> {
  const activeConv = SessionGeneration.getActiveConversation();
  if (activeConv && activeConv !== conversationId) {
    return false;
  }

  const derived = CanonicalDerivedStore.get(conversationId);
  const activeState = await storageLayer.appState.getValue(tabId);
  const currentGen = SessionGeneration.getGeneration();

  if (derived && derived.tokenCount > 0) {
    await storageLayer.updateAppState(
      {
        conversationId,
        activeConversationId: conversationId,
        generation: currentGen,
        version: derived.canonicalVersion,
        tokenEstimate: {
          count: derived.tokenCount,
          inputCount: derived.inputTokens,
          outputCount: derived.outputTokens,
          confidence: derived.confidence,
          isStreaming: false,
        },
        status: derived.status || 'healthy',
        currentSummary: derived.currentSummary || null,
        stats: {
          ...activeState.stats,
          turns: derived.turns,
          avgTokensPerTurn: derived.turns > 0 ? derived.tokenCount / derived.turns : 0,
          healthMetrics: derived.healthMetrics || {},
        },
      } as any,
      tabId
    );
    logger.tracker('TOKENS_UPDATED', { conversationId, tokens: derived.tokenCount });
    logger.tracker('UI_STATE_UPDATED', { conversationId, tokens: derived.tokenCount });
    return true;
  } else {
    // Show neutral loading state
    await storageLayer.updateAppState(
      {
        conversationId,
        activeConversationId: conversationId,
        generation: currentGen,
        version: 0,
        tokenEstimate: {
          count: 0,
          inputCount: 0,
          outputCount: 0,
          confidence: 1,
          isStreaming: false,
        },
      } as any,
      tabId
    );
    return false;
  }
}

const liveDeltaThrottles = new Map<string, number>();
const liveDeltaTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Publishes live streaming token state: baseline + live delta.
 * Called during active streaming when individual messages are updated.
 * The displayed total = canonical baseline + live delta from uncommitted messages.
 *
 * This NEVER re-tokenizes the full conversation. Only the changed message's
 * token count is passed in by the caller.
 *
 * Uses a 100ms throttle/debounce to prevent storage & UI thrashing.
 */
export async function publishLiveTokenDelta(
  conversationId: string,
  tabId?: number
): Promise<boolean> {
  return new Promise((resolve) => {
    if (liveDeltaTimers.has(conversationId)) {
      clearTimeout(liveDeltaTimers.get(conversationId)!);
    }

    const now = Date.now();
    const lastUpdate = liveDeltaThrottles.get(conversationId) || 0;

    const execute = async () => {
      liveDeltaThrottles.set(conversationId, Date.now());
      liveDeltaTimers.delete(conversationId);
      const res = await _executePublishLiveTokenDelta(conversationId, tabId);
      resolve(res);
    };

    if (now - lastUpdate < 100) {
      // Schedule to run after the throttle window
      const timer = setTimeout(execute, 100);
      liveDeltaTimers.set(conversationId, timer);
    } else {
      // Execute immediately
      execute();
    }
  });
}

async function _executePublishLiveTokenDelta(
  conversationId: string,
  tabId?: number
): Promise<boolean> {
  const activeConv = SessionGeneration.getActiveConversation();
  if (activeConv && activeConv !== conversationId) {
    return false;
  }

  const derived = CanonicalDerivedStore.get(conversationId);
  const baseline = derived?.tokenCount || 0;
  const baselineInput = derived?.inputTokens || 0;
  const baselineOutput = derived?.outputTokens || 0;

  const liveDelta = computeLiveDelta(conversationId);
  const displayedTotal = baseline + liveDelta.totalDelta;
  const displayedInput = baselineInput + liveDelta.inputDelta;
  const displayedOutput = baselineOutput + liveDelta.outputDelta;

  const activeState = await storageLayer.appState.getValue(tabId);
  const currentGen = SessionGeneration.getGeneration();
  const turns = derived?.turns || activeState.stats.turns || 1;

  await storageLayer.updateAppState(
    {
      conversationId,
      activeConversationId: conversationId,
      generation: currentGen,
      version: derived?.canonicalVersion || 0,
      tokenEstimate: {
        count: displayedTotal,
        inputCount: displayedInput,
        outputCount: displayedOutput,
        confidence: derived?.confidence || 0.8,
        isStreaming: true,
      },
      status: derived?.status || 'healthy',
      stats: {
        ...activeState.stats,
        turns,
        avgTokensPerTurn: turns > 0 ? displayedTotal / turns : 0,
      },
    } as any,
    tabId
  );

  return true;
}

// Backward-compatible aliases
export const publishTokenState = publishCanonicalTokenResult;
export const publishBaselineState = publishCanonicalTokenResult;
export const publishDisplayedTokenState = async (convId: string, meta?: any) => {
  return projectActiveCanonicalTokens(convId, meta?.tabId);
};
export const finalizeConversationSession = async (convId: string, count: number, meta: any) => {
  const derived = CanonicalDerivedStore.get(convId);
  return publishCanonicalTokenResult(
    {
      jobId: `job_fin_${Date.now()}`,
      conversationId: convId,
      conversationVersion: meta.canonicalVersion || derived?.canonicalVersion || 1,
      inputHash: '',
      inputMessageCount: meta.messageCount || derived?.messageCount || 0,
      generation: SessionGeneration.getGeneration(),
    },
    {
      tokenCount: count,
      inputTokens: meta.inputTokens || 0,
      outputTokens: meta.outputTokens || 0,
      confidence: 1,
      isStreaming: false,
      source: 'canonical',
      platform: 'chatgpt',
      status: 'healthy',
      currentSummary: null,
      turns: meta.turns || 1,
      avgTokensPerTurn: count / (meta.turns || 1),
      healthMetrics: {},
      tabId: meta.tabId,
    }
  );
};
