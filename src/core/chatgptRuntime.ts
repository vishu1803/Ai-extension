import { storageLayer } from '../storage';
import { logger } from '../shared/logger';
import { DOMObservation } from './models';
import { normalizeChatGPTMapping } from './acquisition/normalizeMapping';

/**
 * Normalizes any conversation ID or URL into canonical "chatgpt:<uuid>" or "chatgpt:<id>".
 */
export function normalizeConversationId(idOrUrl: string): string {
  if (!idOrUrl || idOrUrl === 'none') return '';
  const match = idOrUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (match) {
    return `chatgpt:${match[1]}`;
  }
  if (idOrUrl.startsWith('chatgpt:')) {
    return idOrUrl;
  }
  return `chatgpt:${idOrUrl}`;
}

/**
 * Authoritative In-Memory Runtime State for ChatGPT.
 *
 * Exactly TWO core token values:
 * 1. historicalTokens (set ONLY by network history, IMMUTABLE during active conversation)
 * 2. liveTokens (liveUserTokens + activeAssistantTokens, set ONLY by live DOM)
 *
 * Displayed total = historicalTokens + liveUserTokens + activeAssistantTokens.
 * The DOM observer NEVER modifies or resets historicalTokens.
 */
export interface ChatGPTActiveRuntimeState {
  activeConversationId: string;
  historicalTokens: number;
  historicalTokenCount: number;
  historicalMessageIds: Set<string>;
  liveUserTokens: number;
  liveUserTokenCount: number;
  liveAssistantTokens: number;
  liveAssistantTokenCount: number;
  activeAssistantTokens: number;
  activeAssistantTokenCount: number;
  activeAssistantMessageId: string | null;
  activeAssistantContentHash: string | null;
  activeUserMessageId: string | null;
  activeUserContentHash: string | null;
  lastLoggedModel: string | null;
  lastStatus: 'IDLE' | 'STREAMING' | 'COMPLETE';
}

let activeRuntime = {
  activeConversationId: '',
  historicalTokens: 0,
  historicalMessageIds: new Set<string>(),
  liveUserTokens: 0,
  activeAssistantTokens: 0,
  activeAssistantMessageId: null as string | null,
  activeAssistantContentHash: null as string | null,
  activeUserMessageId: null as string | null,
  activeUserContentHash: null as string | null,
  lastLoggedModel: null as string | null,
  lastStatus: 'IDLE' as 'IDLE' | 'STREAMING' | 'COMPLETE',
};

/**
 * SINGLE AUTHORITATIVE UI PUBLISHER.
 *
 * Calculates:
 * const displayedTokens = historicalTokens + liveUserTokens + activeAssistantTokens;
 * and sends that value to the existing UI.
 */
async function publishTokenDisplay(
  options: {
    isStreaming?: boolean;
    turns?: number;
    inputTokens?: number;
    outputTokens?: number;
    tabId?: number;
  } = {}
): Promise<number> {
  const liveTokens = activeRuntime.liveUserTokens + activeRuntime.activeAssistantTokens;
  const displayedTokens = activeRuntime.historicalTokens + liveTokens;
  const conversationId = activeRuntime.activeConversationId || 'unknown';

  // [DISPLAY] log (Exact specification)
  console.log(
    `[DISPLAY]\nconversationId=${conversationId}\nhistorical=${activeRuntime.historicalTokens}\nliveUser=${activeRuntime.liveUserTokens}\nliveAssistant=${activeRuntime.activeAssistantTokens}\ntotal=${displayedTokens}`
  );

  // [TOKEN_STATE] diagnostic log
  console.log(
    `[TOKEN_STATE]\nconversationId=${conversationId}\nhistoricalTokens=${activeRuntime.historicalTokens}\nliveUserTokens=${activeRuntime.liveUserTokens}\nliveAssistantTokens=${activeRuntime.activeAssistantTokens}\ndisplayedTokens=${displayedTokens}`
  );

  // [Tracker] display log
  logger.tracker('display', {
    conversationId,
    totalTokens: displayedTokens,
  });

  await storageLayer.updateAppState(
    {
      conversationId,
      activeConversationId: conversationId,
      tokenEstimate: {
        count: displayedTokens,
        inputCount: options.inputTokens || Math.floor(displayedTokens / 2),
        outputCount: options.outputTokens || Math.ceil(displayedTokens / 2),
        confidence: 1,
        isStreaming: options.isStreaming || false,
      },
      status: 'healthy',
      stats: {
        turns: options.turns || 1,
        avgTokensPerTurn: options.turns ? displayedTokens / options.turns : displayedTokens,
        contextLimit: 128000,
        healthMetrics: {},
      },
    } as any,
    options.tabId
  );

  return displayedTokens;
}

export const chatgptRuntime = {
  getState(): ChatGPTActiveRuntimeState {
    return {
      activeConversationId: activeRuntime.activeConversationId,
      historicalTokens: activeRuntime.historicalTokens,
      historicalTokenCount: activeRuntime.historicalTokens,
      historicalMessageIds: new Set(activeRuntime.historicalMessageIds),
      liveUserTokens: activeRuntime.liveUserTokens,
      liveUserTokenCount: activeRuntime.liveUserTokens,
      liveAssistantTokens: activeRuntime.activeAssistantTokens,
      liveAssistantTokenCount: activeRuntime.activeAssistantTokens,
      activeAssistantTokens: activeRuntime.activeAssistantTokens,
      activeAssistantTokenCount: activeRuntime.activeAssistantTokens,
      activeAssistantMessageId: activeRuntime.activeAssistantMessageId,
      activeAssistantContentHash: activeRuntime.activeAssistantContentHash,
      activeUserMessageId: activeRuntime.activeUserMessageId,
      activeUserContentHash: activeRuntime.activeUserContentHash,
      lastLoggedModel: activeRuntime.lastLoggedModel,
      lastStatus: activeRuntime.lastStatus,
    };
  },

  /**
   * Reset runtime state ONLY when switching to a completely different conversation.
   */
  reset(newConversationId: string = '', resetHistorical: boolean = true): void {
    const normId = normalizeConversationId(newConversationId);
    activeRuntime = {
      activeConversationId: normId,
      historicalTokens: resetHistorical ? 0 : activeRuntime.historicalTokens,
      historicalMessageIds: resetHistorical
        ? new Set<string>()
        : activeRuntime.historicalMessageIds,
      liveUserTokens: 0,
      activeAssistantTokens: 0,
      activeAssistantMessageId: null,
      activeAssistantContentHash: null,
      activeUserMessageId: null,
      activeUserContentHash: null,
      lastLoggedModel: null,
      lastStatus: 'IDLE',
    };
  },

  setHistoricalBaseline(conversationId: string, tokens: number, messageIds: string[] = []): void {
    const normId = normalizeConversationId(conversationId);
    if (activeRuntime.activeConversationId !== normId) {
      this.reset(normId, false);
    }
    activeRuntime.historicalTokens = tokens;
    if (messageIds.length > 0) {
      activeRuntime.historicalMessageIds = new Set(messageIds);
    }
  },

  setLiveUserTokens(tokens: number, messageId: string = 'msg-user'): void {
    activeRuntime.liveUserTokens = tokens;
    activeRuntime.activeUserMessageId = messageId;
    activeRuntime.activeUserContentHash = `${messageId}:${tokens}`;
  },

  /**
   * Called on conversation navigation (A -> B).
   * Resets the runtime state and updates UI to 0 until B network history arrives.
   */
  async handleConversationSwitch(conversationId: string, tabId?: number): Promise<void> {
    const normId = normalizeConversationId(conversationId);
    if (activeRuntime.activeConversationId !== normId) {
      this.reset(normId, true);

      logger.tracker('conversation changed', {
        conversationId: normId,
      });

      await publishTokenDisplay({ tabId });
    }
  },

  /**
   * NETWORK HISTORY: Historical source of truth.
   * Sets historicalTokens, records historical message IDs, and resets liveTokens to 0.
   */
  async handleNetworkPayload(
    payload: {
      conversationId: string;
      mapping: Record<string, any>;
      currentNode?: string | null;
      url?: string;
    },
    tokenizeFn: (
      messages: any[]
    ) => Promise<{ totalTokens: number; totalInputTokens: number; totalOutputTokens: number }>,
    tabId?: number
  ): Promise<number> {
    const normId = normalizeConversationId(payload.conversationId);

    const messages = normalizeChatGPTMapping({
      mapping: payload.mapping,
      conversation_id: payload.conversationId,
      current_node: payload.currentNode || null,
    });

    let historicalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const tokenRes = await tokenizeFn(messages);
      historicalTokens = tokenRes.totalTokens;
      inputTokens = tokenRes.totalInputTokens;
      outputTokens = tokenRes.totalOutputTokens;
    } catch {
      // Fast fallback if offscreen worker is unavailable
      const totalChars = messages.reduce((sum, m) => sum + (m.text?.length || 0), 0);
      historicalTokens = Math.ceil(totalChars / 4);
      inputTokens = Math.floor(historicalTokens / 2);
      outputTokens = Math.ceil(historicalTokens / 2);
    }

    activeRuntime.activeConversationId = normId;
    activeRuntime.historicalTokens = historicalTokens;
    activeRuntime.historicalMessageIds = new Set(messages.map((m) => m.id));
    activeRuntime.liveUserTokens = 0;
    activeRuntime.activeAssistantTokens = 0;
    activeRuntime.activeAssistantMessageId = null;
    activeRuntime.activeAssistantContentHash = null;
    activeRuntime.activeUserMessageId = null;
    activeRuntime.activeUserContentHash = null;
    activeRuntime.lastStatus = 'IDLE';

    logger.tracker('history', {
      conversationId: normId,
      messages: messages.length,
      tokens: historicalTokens,
    });

    // Detect model from mapping if present
    const lastAiNode = Object.values(payload.mapping || {}).find(
      (n: any) => n?.message?.author?.role === 'assistant' && n?.message?.metadata?.model_slug
    );
    if (lastAiNode && (lastAiNode as any).message.metadata.model_slug) {
      const modelSlug = (lastAiNode as any).message.metadata.model_slug;
      if (modelSlug !== activeRuntime.lastLoggedModel) {
        activeRuntime.lastLoggedModel = modelSlug;
        console.log(`[MODEL]\nconversationId=${normId}\nmodel=${modelSlug}`);
      }
    }

    const turns = messages.filter((m) => m.role === 'user').length || 1;
    return await publishTokenDisplay({
      turns,
      inputTokens,
      outputTokens,
      tabId,
    });
  },

  /**
   * LIVE DOM: Current activity delta ONLY.
   * Calculates tokens for the current turn and adds to historicalTokens.
   * NEVER modifies or resets historicalTokens.
   */
  async handleLiveMutation(observation: DOMObservation, tabId?: number): Promise<number> {
    const rawConvId = observation.conversationId || observation.threadId || observation.url || '';
    const normId = normalizeConversationId(rawConvId);

    // If active conversation ID was empty, adopt normId without resetting historicalTokens
    if (!activeRuntime.activeConversationId) {
      activeRuntime.activeConversationId = normId;
    } else if (normId && activeRuntime.activeConversationId !== normId) {
      // Check if it's really a different conversation UUID
      const activeMatch = activeRuntime.activeConversationId.match(/([a-f0-9-]{36})/i);
      const newMatch = normId.match(/([a-f0-9-]{36})/i);
      if (activeMatch && newMatch && activeMatch[1] === newMatch[1]) {
        // Same UUID! Keep activeRuntime.activeConversationId and preserve historicalTokens
      } else if (!activeRuntime.historicalTokens) {
        // Switch if we had no baseline yet
        this.reset(normId, true);
      }
    }

    // Model detection log
    if (
      observation.model &&
      observation.model !== 'unknown' &&
      observation.model !== activeRuntime.lastLoggedModel
    ) {
      activeRuntime.lastLoggedModel = observation.model;
      console.log(
        `[MODEL]\nconversationId=${activeRuntime.activeConversationId || normId}\nmodel=${observation.model}`
      );
    }

    if (!observation.messages || observation.messages.length === 0) {
      return this.getDisplayedTotal();
    }

    let hasChange = false;

    for (const msg of observation.messages) {
      if (!msg || !msg.text) continue;

      // If message was already in historical baseline, SKIP (already counted in historicalTokens)
      if (activeRuntime.historicalMessageIds.has(msg.id)) {
        continue;
      }

      const contentHash = `${msg.id}:${msg.text.length}:${msg.text.slice(0, 40)}:${msg.text.slice(-40)}`;

      if (msg.role === 'user') {
        // Duplicate check: if same user message and unchanged content, ignore
        if (
          activeRuntime.activeUserMessageId === msg.id &&
          activeRuntime.activeUserContentHash === contentHash
        ) {
          continue;
        }

        const msgTokens = Math.ceil(msg.text.length / 4);
        activeRuntime.activeUserMessageId = msg.id;
        activeRuntime.activeUserContentHash = contentHash;
        activeRuntime.liveUserTokens = msgTokens;
        hasChange = true;

        // [LIVE_USER] log (Exact specification)
        console.log(
          `[LIVE_USER]\nconversationId=${activeRuntime.activeConversationId || normId}\nmessageId=${msg.id}\ntokens=${msgTokens}`
        );

        logger.tracker('live', {
          conversationId: activeRuntime.activeConversationId || normId,
          messageId: msg.id,
          role: 'user',
          tokens: msgTokens,
        });
      } else if (msg.role === 'ai') {
        const currentStatus: 'STREAMING' | 'COMPLETE' = observation.isStreaming
          ? 'STREAMING'
          : 'COMPLETE';

        // Duplicate check: if same assistant message, unchanged content and same streaming status, ignore
        if (
          activeRuntime.activeAssistantMessageId === msg.id &&
          activeRuntime.activeAssistantContentHash === contentHash &&
          activeRuntime.lastStatus === currentStatus
        ) {
          continue;
        }

        // Assistant streaming is cumulative replacement (100 -> 250 -> 500 -> 900), NEVER added
        const msgTokens = Math.ceil(msg.text.length / 4);
        activeRuntime.activeAssistantMessageId = msg.id;
        activeRuntime.activeAssistantContentHash = contentHash;
        activeRuntime.activeAssistantTokens = msgTokens;
        activeRuntime.lastStatus = currentStatus;
        hasChange = true;

        // [LIVE_AI] log (Exact specification)
        console.log(
          `[LIVE_AI]\nconversationId=${activeRuntime.activeConversationId || normId}\nmessageId=${msg.id}\ntokens=${msgTokens}\nstatus=${currentStatus}`
        );

        logger.tracker('live', {
          conversationId: activeRuntime.activeConversationId || normId,
          messageId: msg.id,
          role: 'assistant',
          tokens: msgTokens,
        });
      }
    }

    if (!hasChange) {
      return this.getDisplayedTotal();
    }

    return await publishTokenDisplay({
      isStreaming: observation.isStreaming,
      tabId,
    });
  },

  getDisplayedTotal(): number {
    return (
      activeRuntime.historicalTokens +
      activeRuntime.liveUserTokens +
      activeRuntime.activeAssistantTokens
    );
  },
};
