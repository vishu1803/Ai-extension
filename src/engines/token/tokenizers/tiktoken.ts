import { getEncoding } from 'js-tiktoken';
import { Tokenizer, TokenResult } from '../types';

// Lazily load the encoding so it doesn't block startup
let encoder: ReturnType<typeof getEncoding> | null = null;

export const tiktokenTokenizer: Tokenizer = {
  id: 'tiktoken-o200k',
  name: 'OpenAI o200k_base (Exact)',

  async countTokens(text: string): Promise<TokenResult> {
    if (!encoder) {
      // o200k_base is the encoding used by GPT-4o
      encoder = getEncoding('o200k_base');
    }

    const tokens = encoder.encode(text).length;

    return {
      tokens,
      confidence: 1.0, // We are 100% confident for OpenAI models using this encoding
      provider: 'tiktoken',
    };
  },
};
