import { ChatMessage, MessageRole } from '../models';

// Memoization cache for normalized ChatGPT mapping payloads
const normalizedMappingCache = new Map<string, { key: string; messages: ChatMessage[] }>();

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
