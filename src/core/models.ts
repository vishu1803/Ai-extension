import { PlatformId, ContextHealthMetrics } from '../shared/types';
import { StructuredSummary } from '../engines/summary/types';

export type MessageRole = 'user' | 'ai' | 'system';

/**
 * History Completeness Classification for network payloads.
 *
 * FULL:        Authoritative root-to-leaf path verified in node mapping DAG.
 *              Permitted to replace canonical message list and committed baseline.
 * PARTIAL:     Missing root node, disconnected subtree, or trailing fragment.
 *              Non-destructive merge only — never resets messages or baseline.
 * INCREMENTAL: Live DOM mutation or single streaming chunk.
 *              Routes exclusively to TokenLiveStore for delta computation.
 */
export type HistoryCompleteness = 'FULL' | 'PARTIAL' | 'INCREMENTAL' | 'UNKNOWN';

export interface ChatMessage {
  id: string;
  conversationId?: string;
  role: MessageRole;
  text: string;
  timestamp?: number;
}

export interface TokenEstimate {
  count: number;
  inputCount: number;
  outputCount: number;
  confidence: number;
  isStreaming: boolean;
}

export interface ConversationStats {
  turns: number;
  avgTokensPerTurn: number;
  contextLimit: number;
  healthMetrics: ContextHealthMetrics;
}

/**
 * The Canonical Conversation Entity
 */
export interface Conversation {
  id: string; // Canonical ID: e.g. "chatgpt:uuid"
  platform: PlatformId;
  threadId: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;

  // O(1) merge updates and chronological order
  messages: Record<string, ChatMessage>;
  orderedMessageIds: string[];

  // Derived state attached directly to the entity
  summary: StructuredSummary | null;
  tokenEstimate: TokenEstimate;
  stats: ConversationStats;
  version: number; // Incremented on every successful merge
}

/**
 * The payload emitted by content script adapters
 */
export interface DOMObservation {
  platform: PlatformId;
  threadId: string | null; // Null if unable to resolve (e.g. temporary root URL)
  conversationId?: string;
  url: string;
  pageTitle: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  model?: string;
  source?: 'NETWORK' | 'DOM';
  completeness?: HistoryCompleteness;
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
}

export interface MutationLog {
  id?: number; // Auto-incremented by IndexedDB
  conversationId: string;
  timestamp: number;
  observation: DOMObservation;
}
