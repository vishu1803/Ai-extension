import { HealthStatus } from '../shared/types';
import { StructuredSummary } from '../engines/summary/types';
import { DEBUG_TRACKER } from '../shared/logger';

/**
 * Authoritative Canonical Derived State
 * Exactly one record per conversation representing the tokenization of the canonical conversation.
 */
export interface CanonicalDerivedState {
  conversationId: string;
  canonicalVersion: number;
  messageCount: number;
  tokenCount: number;
  inputTokens: number;
  outputTokens: number;
  confidence: number;
  turns: number;
  status: HealthStatus;
  healthMetrics: any;
  currentSummary: StructuredSummary | null;
  timestamp: number;
}

// In-memory store partitioned strictly by conversationId
const canonicalStore = new Map<string, CanonicalDerivedState>();

export const CanonicalDerivedStore = {
  get(conversationId: string): CanonicalDerivedState | undefined {
    return canonicalStore.get(conversationId);
  },

  set(state: CanonicalDerivedState): void {
    canonicalStore.set(state.conversationId, { ...state });
  },

  has(conversationId: string): boolean {
    return canonicalStore.has(conversationId);
  },

  delete(conversationId: string): boolean {
    return canonicalStore.delete(conversationId);
  },

  clear(): void {
    canonicalStore.clear();
  },
};

// Backwards-compatible aliases for existing tests
export const TokenBaselineStore = {
  get(conversationId: string): CanonicalDerivedState | undefined {
    return CanonicalDerivedStore.get(conversationId);
  },
  set(state: any): void {
    CanonicalDerivedStore.set({
      conversationId: state.conversationId,
      canonicalVersion: state.canonicalVersion || 1,
      messageCount: state.messageCount || 0,
      tokenCount: state.tokenCount || 0,
      inputTokens: state.inputTokens || 0,
      outputTokens: state.outputTokens || 0,
      confidence: state.confidence ?? 1,
      turns: state.turns || 1,
      status: state.status || 'healthy',
      healthMetrics: state.healthMetrics || {},
      currentSummary: state.currentSummary || null,
      timestamp: Date.now(),
    });
  },
  clear(conversationId?: string): void {
    if (conversationId) {
      CanonicalDerivedStore.delete(conversationId);
    } else {
      CanonicalDerivedStore.clear();
    }
  },
};

/**
 * Live Token Delta Store — Two-Layer Architecture
 *
 * During streaming, tracks per-message token counts for uncommitted messages.
 * The displayed total = committedTokenBaseline (CanonicalDerivedStore) + liveTokenDelta.
 *
 * On stream completion / turn commit:
 *   1. New canonical baseline is established
 *   2. Live deltas are cleared (reset to zero)
 *
 * On conversation switch:
 *   Live deltas are cleared for the old conversation.
 */

export interface LiveMessageState {
  messageId: string;
  role: 'user' | 'ai' | 'system';
  tokens: number; // Current token count for this message
  textLength: number; // Track text length for cheap change detection
}

export interface LiveConversationState {
  conversationId: string;
  messageDeltas: Map<string, LiveMessageState>;
  status: 'idle' | 'streaming' | 'committing';
}

export interface LiveDeltaResult {
  totalDelta: number;
  inputDelta: number;
  outputDelta: number;
  userTokens: number;
  assistantTokens: number;
  messageCount: number;
}

const liveStore = new Map<string, LiveConversationState>();

export const TokenLiveStore = {
  get(conversationId: string): LiveConversationState | undefined {
    return liveStore.get(conversationId);
  },

  getOrCreate(conversationId: string): LiveConversationState {
    let state = liveStore.get(conversationId);
    if (!state) {
      state = {
        conversationId,
        messageDeltas: new Map(),
        status: 'idle',
      };
      liveStore.set(conversationId, state);
    }
    return state;
  },

  /**
   * Update token count for a single message during streaming.
   * For cumulative streaming text:
   *   previousTokens = 300, newTokens = 450 → delta contribution = 450 (not 300+450).
   *   The delta is computed against the canonical baseline, not accumulated.
   */
  updateMessageDelta(
    conversationId: string,
    messageId: string,
    role: 'user' | 'ai' | 'system',
    tokens: number,
    textLength: number
  ): void {
    const state = this.getOrCreate(conversationId);
    state.status = 'streaming';
    state.messageDeltas.set(messageId, {
      messageId,
      role,
      tokens,
      textLength,
    });
  },

  /**
   * Check if a message's text has changed (cheap length-based check).
   */
  hasMessageChanged(conversationId: string, messageId: string, newTextLength: number): boolean {
    const state = liveStore.get(conversationId);
    if (!state) return true;
    const existing = state.messageDeltas.get(messageId);
    if (!existing) return true;
    return existing.textLength !== newTextLength;
  },

  setStatus(conversationId: string, status: 'idle' | 'streaming' | 'committing'): void {
    const state = liveStore.get(conversationId);
    if (state) {
      state.status = status;
    }
  },

  clearLiveDeltas(conversationId: string): void {
    const state = liveStore.get(conversationId);
    if (state) {
      state.messageDeltas.clear();
      state.status = 'idle';
    }
  },

  clear(): void {
    liveStore.clear();
  },
};

/**
 * Compute aggregate live token delta for a conversation.
 * These are tokens from uncommitted streaming messages that sit ON TOP of the canonical baseline.
 */
export function computeLiveDelta(conversationId?: string): LiveDeltaResult {
  const empty: LiveDeltaResult = {
    totalDelta: 0,
    inputDelta: 0,
    outputDelta: 0,
    userTokens: 0,
    assistantTokens: 0,
    messageCount: 0,
  };

  if (!conversationId) return empty;

  const state = liveStore.get(conversationId);
  if (!state || state.messageDeltas.size === 0) return empty;

  let totalDelta = 0;
  let inputDelta = 0;
  let outputDelta = 0;
  let userTokens = 0;
  let assistantTokens = 0;

  for (const msg of state.messageDeltas.values()) {
    totalDelta += msg.tokens;
    if (msg.role === 'user') {
      inputDelta += msg.tokens;
      userTokens += msg.tokens;
    } else {
      outputDelta += msg.tokens;
      assistantTokens += msg.tokens;
    }
  }

  return {
    totalDelta,
    inputDelta,
    outputDelta,
    userTokens,
    assistantTokens,
    messageCount: state.messageDeltas.size,
  };
}
