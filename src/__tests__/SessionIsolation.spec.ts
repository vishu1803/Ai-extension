import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationManager } from '../core/ConversationManager';
import { DOMObservation } from '../core/models';

describe('Session Isolation & Streaming Deduplication', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  it('should maintain canonical count when DOM observation is a virtualized subset (NO_SHRINK)', async () => {
    // 1. Initial hydration with 161 messages
    const canonicalMessages = Array.from({ length: 161 }, (_, i) => ({
      id: `msg-${i}`,
      role: (i % 2 === 0 ? 'user' : 'ai') as 'user' | 'ai',
      text: `Message content ${i}`,
    }));

    const obs1: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-123',
      conversationId: 'chatgpt:conv-123',
      url: 'https://chatgpt.com/c/conv-123',
      pageTitle: 'Test Conversation',
      messages: canonicalMessages,
      isStreaming: false,
      source: 'NETWORK',
    };

    const { conversation: conv1 } = await manager.processMutation(obs1);
    expect(conv1.orderedMessageIds.length).toBe(161);
    expect(conv1.id).toBe('chatgpt:conv-123');

    // 2. DOM observation sees only last 23 nodes due to virtualization
    const domSubset = canonicalMessages.slice(138); // 23 nodes
    const obs2: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-123',
      conversationId: 'chatgpt:conv-123',
      url: 'https://chatgpt.com/c/conv-123',
      pageTitle: 'Test Conversation',
      messages: domSubset,
      isStreaming: false,
      source: 'DOM',
    };

    const { conversation: conv2 } = await manager.processMutation(obs2);
    expect(conv2.orderedMessageIds.length).toBe(161); // MUST NOT SHRINK to 23
  });

  it('should keep assistant message ID stable during streaming updates without duplicating canonical count', async () => {
    const initialObs: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-stream',
      conversationId: 'chatgpt:conv-stream',
      url: 'https://chatgpt.com/c/conv-stream',
      pageTitle: 'Streaming Chat',
      messages: [{ id: 'user-1', role: 'user', text: 'Hello AI' }],
      isStreaming: false,
    };

    const { conversation: conv1 } = await manager.processMutation(initialObs);
    expect(conv1.orderedMessageIds.length).toBe(1);

    // Assistant placeholder INSERT
    const streamInsert: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-stream',
      conversationId: 'chatgpt:conv-stream',
      url: 'https://chatgpt.com/c/conv-stream',
      pageTitle: 'Streaming Chat',
      messages: [
        { id: 'user-1', role: 'user', text: 'Hello AI' },
        { id: 'ai-stream-1', role: 'ai', text: 'Thinking...' },
      ],
      isStreaming: true,
    };

    const { conversation: conv2 } = await manager.processMutation(streamInsert);
    expect(conv2.orderedMessageIds.length).toBe(2);

    // Chunk 1 UPDATE (same messageId)
    const streamChunk1: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-stream',
      conversationId: 'chatgpt:conv-stream',
      url: 'https://chatgpt.com/c/conv-stream',
      pageTitle: 'Streaming Chat',
      messages: [
        { id: 'user-1', role: 'user', text: 'Hello AI' },
        { id: 'ai-stream-1', role: 'ai', text: 'Thinking... Here is the full answer step 1.' },
      ],
      isStreaming: true,
    };

    const { conversation: conv3 } = await manager.processMutation(streamChunk1);
    expect(conv3.orderedMessageIds.length).toBe(2); // MUST REMAIN 2 (NO DUPLICATES)
    expect(conv3.messages['ai-stream-1'].text).toBe('Thinking... Here is the full answer step 1.');

    // Chunk 2 UPDATE (same messageId)
    const streamChunk2: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'conv-stream',
      conversationId: 'chatgpt:conv-stream',
      url: 'https://chatgpt.com/c/conv-stream',
      pageTitle: 'Streaming Chat',
      messages: [
        { id: 'user-1', role: 'user', text: 'Hello AI' },
        {
          id: 'ai-stream-1',
          role: 'ai',
          text: 'Thinking... Here is the full answer step 1. And step 2 completed!',
        },
      ],
      isStreaming: false,
    };

    const { conversation: conv4 } = await manager.processMutation(streamChunk2);
    expect(conv4.orderedMessageIds.length).toBe(2); // MUST STILL BE 2
  });

  it('should isolate mutations of conversation A from conversation B', async () => {
    const obsA: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'chat-A',
      conversationId: 'chatgpt:chat-A',
      url: 'https://chatgpt.com/c/chat-A',
      pageTitle: 'Chat A',
      messages: [{ id: 'msg-A-1', role: 'user', text: 'Prompt A' }],
      isStreaming: false,
    };

    const obsB: DOMObservation = {
      platform: 'chatgpt',
      threadId: 'chat-B',
      conversationId: 'chatgpt:chat-B',
      url: 'https://chatgpt.com/c/chat-B',
      pageTitle: 'Chat B',
      messages: [{ id: 'msg-B-1', role: 'user', text: 'Prompt B' }],
      isStreaming: false,
    };

    const { conversation: convA } = await manager.processMutation(obsA);
    const { conversation: convB } = await manager.processMutation(obsB);

    expect(convA.id).toBe('chatgpt:chat-A');
    expect(convB.id).toBe('chatgpt:chat-B');
    expect(convA.orderedMessageIds).toEqual(['msg-A-1']);
    expect(convB.orderedMessageIds).toEqual(['msg-B-1']);
  });
});
