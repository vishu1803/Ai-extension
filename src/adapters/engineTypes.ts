export type MessageRole = 'user' | 'ai' | 'system';

export interface ChatMessage {
  id: string; // Unique identifier (could be DOM attribute, index, or hash)
  role: MessageRole;
  text: string;
}

export interface ConversationState {
  id: string; // usually the URL pathname
  messages: Map<string, ChatMessage>;
  orderedIds: string[];
}
