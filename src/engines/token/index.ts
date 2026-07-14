import { ChatMessage } from '../../adapters/engineTypes';
import { Tokenizer, TokenResult, ConversationTokenEstimate } from './types';
import { tiktokenTokenizer } from './tokenizers/tiktoken';
import { claudeHeuristicTokenizer, geminiHeuristicTokenizer } from './tokenizers/ratio';

export class TokenEngine {
  private activeTokenizer: Tokenizer;
  private maxContext: number;

  /**
   * Initializes the TokenEngine with the appropriate tokenizer based on the platform.
   * @param platformId The platform string (e.g. 'chatgpt', 'claude')
   * @param maxContext The context window limit for this model (e.g., 128000)
   */
  constructor(platformId: string, maxContext: number = 128000) {
    this.maxContext = maxContext;
    this.activeTokenizer = this.selectTokenizer(platformId);
  }

  private selectTokenizer(platformId: string): Tokenizer {
    // Modular selection of tokenizers based on platform
    switch (platformId) {
      case 'chatgpt':
        return tiktokenTokenizer;
      case 'claude':
        return claudeHeuristicTokenizer; // Future: Support exact API for Anthropic
      case 'gemini':
        return geminiHeuristicTokenizer;
      default:
        // Default to a 4-char heuristic for unknown platforms
        return geminiHeuristicTokenizer; 
    }
  }

  /**
   * Estimates tokens for a single message string.
   */
  public async estimateMessage(text: string): Promise<TokenResult> {
    return this.activeTokenizer.countTokens(text);
  }

  /**
   * Estimates tokens for an entire conversation, returning live metrics and remaining context.
   */
  public async estimateConversation(messages: ChatMessage[]): Promise<ConversationTokenEstimate> {
    let totalTokens = 0;
    let averageConfidence = 0;
    const messageEstimates: Record<string, TokenResult> = {};

    // Process all messages
    for (const msg of messages) {
      // In a real optimized system, we would cache these results by msg.id + msg.text hash.
      const result = await this.estimateMessage(msg.text);
      messageEstimates[msg.id] = result;
      totalTokens += result.tokens;
      averageConfidence += result.confidence;
    }

    if (messages.length > 0) {
      averageConfidence = averageConfidence / messages.length;
    } else {
      averageConfidence = 1.0;
    }

    const remainingContext = Math.max(0, this.maxContext - totalTokens);

    return {
      totalTokens,
      remainingContext,
      confidence: averageConfidence,
      messageEstimates
    };
  }
}
