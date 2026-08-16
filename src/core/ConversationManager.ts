import { getDB } from '../storage/db';
import { Conversation, DOMObservation, ChatMessage } from './models';
import { logger, DEBUG_TRACKER } from '../shared/logger';
import { perfMetrics } from '../shared/perfMode';

export function computeInputHash(messages: { id: string; text?: string }[]): string {
  let idsStr = '';
  for (const m of messages) {
    idsStr += `${m.id}:${m.text?.length || 0},`;
  }
  let hash = 0;
  for (let i = 0; i < idsStr.length; i++) {
    hash = (hash << 5) - hash + idsStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export class ConversationManager {
  /**
   * Retrieves current canonical conversation state from IndexedDB.
   */
  public async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const db = await getDB();
    const tx = db.transaction(['conversations'], 'readonly');
    const convStore = tx.objectStore('conversations');
    const conversation = await convStore.get(conversationId);
    await tx.done;
    return conversation;
  }

  /**
   * Processes a DOM or Network observation from the content script.
   * Exclusively locks the specific conversation, performs a deterministic merge,
   * logs the mutation, and persists back to IndexedDB.
   */
  public async processMutation(
    observation: DOMObservation
  ): Promise<{ conversation: Conversation; addedCount: number; updatedCount: number }> {
    const threadId = observation.threadId || observation.url;
    const conversationId = observation.conversationId || `${observation.platform}:${threadId}`;
    const lockName = `conversation-lock:${conversationId}`;

    const runWork = async () => {
      const db = await getDB();
      const tx = db.transaction(['conversations', 'mutation_logs'], 'readwrite');

      const convStore = tx.objectStore('conversations');
      const logStore = tx.objectStore('mutation_logs');

      // 1. Fetch current canonical state
      let conversation = await convStore.get(conversationId);
      const now = Date.now();

      if (!conversation) {
        conversation = {
          id: conversationId,
          platform: observation.platform,
          threadId: threadId,
          metadata: {
            url: observation.url,
            title: observation.pageTitle,
          },
          createdAt: now,
          updatedAt: now,
          messages: {},
          orderedMessageIds: [],
          summary: null,
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
          version: 0,
        };
      }

      let addedCount = 0;
      let updatedCount = 0;

      // 2. Deterministic Merge Logic
      if (observation.source === 'NETWORK') {
        // Authoritative network history is canonical ground truth.
        // Replaces any preliminary DOM scrapings captured during SPA transitions.
        conversation.messages = {};
        conversation.orderedMessageIds = [];
        for (const msg of observation.messages) {
          msg.conversationId = conversationId;
          conversation.messages[msg.id] = { ...msg, conversationId };
          conversation.orderedMessageIds.push(msg.id);
          addedCount++;
        }
        conversation.version += 1;
      } else {
        // Live incremental mutations (streaming turns / user prompt submissions)
        for (const msg of observation.messages) {
          msg.conversationId = conversationId;
          const existing = conversation.messages[msg.id];

          if (!existing) {
            conversation.messages[msg.id] = { ...msg, conversationId };
            conversation.orderedMessageIds.push(msg.id);
            addedCount++;
          } else {
            if (existing.text !== msg.text) {
              existing.text = msg.text;
              existing.conversationId = conversationId;
              updatedCount++;
            }
          }
        }
        if (addedCount > 0 || updatedCount > 0) {
          conversation.version += 1;
        }
      }

      // 3. Update Meta & Version
      if (
        addedCount > 0 ||
        updatedCount > 0 ||
        observation.source === 'NETWORK' ||
        !conversation.updatedAt
      ) {
        conversation.updatedAt = now;
      }

      // Compute turn count roughly based on user messages
      const turns = conversation.orderedMessageIds.filter(
        (id) => conversation.messages[id]?.role === 'user'
      ).length;
      conversation.stats.turns = turns;

      // 4. Append Mutation Log for Event Sourcing (skip text-only updates to reduce IDB writes during streaming)
      if (addedCount > 0 || observation.source === 'NETWORK') {
        perfMetrics.idbWrites++;
        await logStore.add({
          conversationId: conversationId,
          timestamp: now,
          observation: { ...observation, conversationId },
        });
      }

      // 5. Persist Canonical State (only when state changed or initial creation)
      if (
        addedCount > 0 ||
        updatedCount > 0 ||
        observation.source === 'NETWORK' ||
        conversation.version === 0
      ) {
        perfMetrics.idbWrites++;
        await convStore.put(conversation);
      }
      await tx.done;

      if (DEBUG_TRACKER) {
        console.log(
          `[TRACE:CANONICAL] conv=${conversationId} messages=${conversation.orderedMessageIds.length}`
        );
      }

      return { conversation, addedCount, updatedCount };
    };

    if (typeof navigator !== 'undefined' && navigator?.locks?.request) {
      return await navigator.locks.request(lockName, runWork);
    }
    return await runWork();
  }

  /**
   * Updates and persists calculated token estimate and stats for a canonical conversation.
   */
  public async updateTokenEstimate(
    conversationId: string,
    tokenEstimate: Conversation['tokenEstimate'],
    stats?: Partial<Conversation['stats']>,
    summary?: any
  ): Promise<void> {
    const lockName = `conversation-lock:${conversationId}`;
    const runWork = async () => {
      const db = await getDB();
      const tx = db.transaction(['conversations'], 'readwrite');
      const convStore = tx.objectStore('conversations');
      const conversation = await convStore.get(conversationId);
      if (conversation) {
        conversation.tokenEstimate = { ...tokenEstimate };
        if (stats) {
          conversation.stats = { ...conversation.stats, ...stats };
        }
        if (summary !== undefined) {
          conversation.summary = summary;
        }
        conversation.updatedAt = Date.now();
        perfMetrics.idbWrites++;
        await convStore.put(conversation);
      }
      await tx.done;
    };

    if (typeof navigator !== 'undefined' && navigator?.locks?.request) {
      return await navigator.locks.request(lockName, runWork);
    }
    return await runWork();
  }
}

export const conversationManager = new ConversationManager();
