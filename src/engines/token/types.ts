export interface TokenResult {
  tokens: number;
  confidence: number; // 0.0 (pure guess) to 1.0 (exact calculation)
  provider: string; // e.g., 'tiktoken', 'heuristic-ratio', 'exact-api'
}

export interface ConversationTokenEstimate {
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  remainingContext: number;
  confidence: number;
  messageEstimates: Record<string, TokenResult>;
}

export interface Tokenizer {
  id: string;
  name: string;
  /**
   * Calculates or estimates the tokens for a given string.
   */
  countTokens(text: string): Promise<TokenResult>;
}
