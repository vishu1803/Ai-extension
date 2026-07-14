import { Tokenizer, TokenResult } from '../types';

export class HeuristicRatioTokenizer implements Tokenizer {
  id: string;
  name: string;
  private charsPerToken: number;

  constructor(id: string, name: string, charsPerToken: number = 4) {
    this.id = id;
    this.name = name;
    this.charsPerToken = charsPerToken;
  }

  async countTokens(text: string): Promise<TokenResult> {
    // Basic heuristic: English text is roughly 4 characters per token.
    // Some models (like Claude) might be 3.5, Gemini might be 4.2, etc.
    const tokens = Math.ceil(text.length / this.charsPerToken);
    
    return {
      tokens,
      confidence: 0.6, // Low confidence because it's purely heuristic
      provider: 'heuristic-ratio'
    };
  }
}

// Pre-configured ratios based on observed model behaviors
export const claudeHeuristicTokenizer = new HeuristicRatioTokenizer('claude-heuristic', 'Claude Heuristic Ratio', 3.5);
export const geminiHeuristicTokenizer = new HeuristicRatioTokenizer('gemini-heuristic', 'Gemini Heuristic Ratio', 4.0);
