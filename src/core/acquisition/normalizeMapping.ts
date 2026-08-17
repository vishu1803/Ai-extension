import { ChatMessage, MessageRole, HistoryCompleteness } from '../models';

// Memoization cache for normalized ChatGPT mapping payloads
const normalizedMappingCache = new Map<string, { key: string; messages: ChatMessage[] }>();

/**
 * Result of tree-path verified mapping normalization.
 * Includes completeness classification based on DAG structure analysis.
 */
export interface VerifiedMappingResult {
  messages: ChatMessage[];
  completeness: HistoryCompleteness;
  rootNodeId: string | null;
  currentNodeId: string | null;
  isCompletePath: boolean;
}

/**
 * Normalize ChatGPT's API response (containing a `mapping` object) into a
 * chronologically sorted ChatMessage[].
 *
 * ChatGPT's /backend-api/conversation/{id} endpoint returns:
 * {
 *   "conversation_id": "...",
 *   "mapping": {
 *     "node_id_1": {
 *       "id": "...",
 *       "message": {
 *         "id": "msg_id_1",
 *         "author": { "role": "user" | "assistant" | "system" },
 *         "content": { "parts": ["text content"] },
 *         "create_time": timestamp
 *       }
 *     },
 *     ...
 *   },
 *   "current_node": "..."
 * }
 *
 * This function is shared by APIStrategy and the network intercept bridge.
 */
export function normalizeChatGPTMapping(data: unknown): ChatMessage[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const record = data as Record<string, unknown>;
  const mapping = record.mapping;

  if (!mapping || typeof mapping !== 'object') {
    return [];
  }

  const mappingObj = mapping as Record<string, Record<string, unknown>>;
  const nodeCount = Object.keys(mappingObj).length;
  const conversationId =
    (record.conversation_id as string) || (record.conversationId as string) || '';
  const currentNode = (record.current_node as string) || (record.currentNode as string) || '';

  // Cache key based on conversationId, node count, and current_node
  const cacheKey = `${conversationId}_${nodeCount}_${currentNode}`;
  if (conversationId && normalizedMappingCache.has(conversationId)) {
    const cached = normalizedMappingCache.get(conversationId);
    if (cached && cached.key === cacheKey) {
      return cached.messages;
    }
  }

  // Collect entries with timestamps for sorting
  const messageEntries: Array<{ msg: Record<string, unknown>; time: number }> = [];

  for (const nodeId in mappingObj) {
    try {
      const node = mappingObj[nodeId];

      // Some nodes may not have messages (they're structural)
      if (!node || !node.message) {
        continue;
      }

      const msg = node.message as Record<string, unknown>;
      const createTime = (msg.create_time as number) || 0;

      messageEntries.push({ msg, time: createTime });
    } catch {
      // Skip malformed entries
      continue;
    }
  }

  // Sort by creation time to preserve conversation order
  messageEntries.sort((a, b) => a.time - b.time);

  const messages: ChatMessage[] = [];

  // Extract messages
  for (const entry of messageEntries) {
    try {
      const msg = entry.msg;

      // Determine role
      const author = msg.author as Record<string, unknown> | undefined;
      const authorRole = author?.role;
      let role: MessageRole;

      if (authorRole === 'user') {
        role = 'user';
      } else if (authorRole === 'assistant') {
        role = 'ai';
      } else {
        // Skip system messages or unknown roles
        continue;
      }

      // Extract text content
      let text = '';
      const content = msg.content as Record<string, unknown> | string | undefined;

      if (
        content &&
        typeof content === 'object' &&
        'parts' in content &&
        Array.isArray(content.parts)
      ) {
        text = (content.parts as unknown[])
          .filter((part: unknown) => typeof part === 'string')
          .join('\n');
      } else if (typeof content === 'string') {
        text = content;
      }

      // Only include messages with actual content
      if (text && text.trim()) {
        messages.push({
          id: (msg.id as string) || `msg_${messages.length}`,
          role,
          text: text.trim(),
          timestamp: entry.time || undefined,
        });
      }
    } catch {
      // Skip messages that fail to parse
      continue;
    }
  }

  if (conversationId) {
    normalizedMappingCache.set(conversationId, { key: cacheKey, messages });
  }

  return messages;
}

/**
 * Verify and normalize a ChatGPT mapping payload with tree-path completeness analysis.
 *
 * Performs a backward DAG traversal from `current_node` to root via parent pointers
 * to determine whether the payload represents a FULL conversation history or a
 * PARTIAL subtree/fragment.
 *
 * FULL:    current_node exists, and traversal reaches a root node
 *          (parent === null or parent === 'client-created-root' or parent not in mapping).
 *          The path is contiguous from root to current_node.
 *
 * PARTIAL: current_node is missing, not in mapping, or the traversal does not reach a root.
 *          This typically indicates a secondary network payload (title generation,
 *          moderation, branch metadata) with only a few nodes.
 */
export function verifyAndNormalizeMapping(
  data: {
    mapping: Record<string, any>;
    conversation_id: string;
    current_node?: string | null;
  },
  currentCanonicalCount: number = 0
): VerifiedMappingResult {
  const mapping = data.mapping;
  const conversationId = data.conversation_id || '';
  const currentNodeId = data.current_node || null;

  if (!mapping || typeof mapping !== 'object' || !conversationId) {
    return {
      messages: [],
      completeness: 'UNKNOWN',
      rootNodeId: null,
      currentNodeId: null,
      isCompletePath: false,
    };
  }

  // If current_node is missing or not in mapping, cannot verify full linear path
  if (!currentNodeId || !mapping[currentNodeId]) {
    const fallbackMessages = normalizeChatGPTMapping(data);
    return {
      messages: fallbackMessages,
      completeness: fallbackMessages.length > 0 ? 'PARTIAL' : 'UNKNOWN',
      rootNodeId: null,
      currentNodeId,
      isCompletePath: false,
    };
  }

  // Traverse backwards from current_node to root
  const pathNodeIds: string[] = [];
  let curr: string | null = currentNodeId;
  let rootNodeId: string | null = null;
  const visited = new Set<string>();

  while (curr && mapping[curr]) {
    if (visited.has(curr)) break; // Cycle guard
    visited.add(curr);
    pathNodeIds.unshift(curr);

    const node = mapping[curr];
    const parentId = node.parent as string | null | undefined;
    if (!parentId || parentId === 'client-created-root') {
      // Genuine root: parent is null/undefined or the ChatGPT sentinel
      rootNodeId = curr;
      break;
    }
    if (!mapping[parentId]) {
      // Parent exists but is NOT in this mapping → disconnected subtree
      // This is the typical case for secondary payloads (title gen, moderation)
      // Do NOT mark as root — this path is incomplete
      break;
    }
    curr = parentId;
  }

  // Extract messages only from the verified path (root to current_node)
  const messages: ChatMessage[] = [];
  for (const nodeId of pathNodeIds) {
    const node = mapping[nodeId];
    const msg = node?.message;
    if (!msg || !msg.content || !msg.content.parts) continue;
    const role = msg.author?.role;
    if (role !== 'user' && role !== 'assistant') continue;
    const text = (msg.content.parts as unknown[])
      .filter((part: unknown) => typeof part === 'string')
      .join('\n')
      .trim();
    if (!text) continue;

    messages.push({
      id: msg.id || nodeId,
      role: role === 'user' ? 'user' : 'ai',
      text,
      conversationId: `chatgpt:${conversationId}`,
      timestamp: msg.create_time ? Math.floor(msg.create_time * 1000) : Date.now(),
    });
  }

  // A complete path requires reaching a genuine root node
  const reachesRoot =
    rootNodeId !== null &&
    (!mapping[rootNodeId]?.parent || mapping[rootNodeId]?.parent === 'client-created-root');

  let isCompletePath = reachesRoot;
  let completeness: HistoryCompleteness = 'UNKNOWN';

  if (isCompletePath) {
    if (currentCanonicalCount > 0 && messages.length < currentCanonicalCount) {
      // Shorter than known canonical baseline -> strictly PARTIAL
      isCompletePath = false;
      completeness = 'PARTIAL';
    } else {
      completeness = 'FULL';
    }
  } else {
    completeness = messages.length > 0 ? 'PARTIAL' : 'UNKNOWN';
  }

  return {
    messages,
    completeness,
    rootNodeId,
    currentNodeId,
    isCompletePath,
  };
}
