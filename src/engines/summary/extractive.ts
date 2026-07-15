import { ChatMessage } from '../../adapters/engineTypes';
import { splitIntoSentences, tokenizeAndStem } from './text-processing';

export interface RankedSentence {
  text: string;
  score: number;
  messageId: string;
  role: string;
}

/**
 * Extracts the most important sentences from a conversation using TF-IDF ranking.
 * Also extracts topic labels from the highest-frequency meaningful terms.
 */
export class ExtractiveSummarizer {
  /**
   * Generates a ranked summary of the conversation.
   * @param messages The full conversation history
   * @param maxSentences The maximum number of sentences to return
   * @returns Array of the most important sentences, ordered by score
   */
  public summarize(messages: ChatMessage[], maxSentences: number = 5): RankedSentence[] {
    if (messages.length === 0) return [];

    const allSentences: {
      id: string;
      text: string;
      tokens: string[];
      messageId: string;
      role: string;
    }[] = [];
    const documentFrequencies: Map<string, number> = new Map();
    let totalSentences = 0;

    // Parse all messages into sentences and calculate DF
    // Accept 'user', 'ai', 'assistant' roles — only skip 'system'
    messages.forEach((msg) => {
      if (msg.role === 'system') return;

      const cleanText = this.stripCodeBlocks(msg.text);
      const sentences = splitIntoSentences(cleanText);

      sentences.forEach((sentenceText, idx) => {
        if (sentenceText.length < 12) return;

        const tokens = tokenizeAndStem(sentenceText);
        if (tokens.length < 2) return;

        const id = `${msg.id}-${idx}`;
        allSentences.push({ id, text: sentenceText, tokens, messageId: msg.id, role: msg.role });

        const uniqueTokens = new Set(tokens);
        uniqueTokens.forEach((token) => {
          documentFrequencies.set(token, (documentFrequencies.get(token) || 0) + 1);
        });

        totalSentences++;
      });
    });

    if (allSentences.length === 0) return [];

    // Calculate TF-IDF score for each sentence
    const rankedSentences: RankedSentence[] = allSentences.map((sentence) => {
      let score = 0;

      const termFrequencies: Map<string, number> = new Map();
      sentence.tokens.forEach((token) => {
        termFrequencies.set(token, (termFrequencies.get(token) || 0) + 1);
      });

      termFrequencies.forEach((tf, token) => {
        const df = documentFrequencies.get(token) || 1;
        const idf = Math.log(totalSentences / df) + 1;
        const normalizedTf = tf / sentence.tokens.length;
        score += normalizedTf * idf;
      });

      // Boost user messages (requirements and goals are more important)
      if (sentence.role === 'user') {
        score *= 1.3;
      }

      // Boost sentences that contain decision language
      const lower = sentence.text.toLowerCase();
      if (
        lower.includes('decided') ||
        lower.includes('chose') ||
        lower.includes('will use') ||
        lower.includes('approach')
      ) {
        score *= 1.2;
      }

      // Boost sentences about errors/bugs
      if (lower.includes('error') || lower.includes('bug') || lower.includes('fix')) {
        score *= 1.15;
      }

      return { text: sentence.text, score, messageId: sentence.messageId, role: sentence.role };
    });

    // Sort by score descending
    rankedSentences.sort((a, b) => b.score - a.score);

    // De-duplicate similar sentences
    const finalSentences: RankedSentence[] = [];
    for (const rs of rankedSentences) {
      if (finalSentences.length >= maxSentences) break;

      const isDuplicate = finalSentences.some((fs) => {
        const wordsA = new Set(rs.text.toLowerCase().split(/\s+/));
        const wordsB = new Set(fs.text.toLowerCase().split(/\s+/));
        let intersection = 0;
        wordsA.forEach((w) => {
          if (wordsB.has(w)) intersection++;
        });
        const similarity = intersection / Math.min(wordsA.size, wordsB.size);
        return similarity > 0.55;
      });

      if (!isDuplicate) {
        finalSentences.push(rs);
      }
    }

    return finalSentences;
  }

  /**
   * Extracts topic labels from the conversation by finding the most frequent
   * meaningful terms across all messages (TF-based topic extraction).
   */
  public extractTopics(messages: ChatMessage[], maxTopics: number = 6): string[] {
    if (messages.length === 0) return [];

    const termCounts: Map<string, number> = new Map();

    messages.forEach((msg) => {
      if (msg.role === 'system') return;
      const cleanText = this.stripCodeBlocks(msg.text);
      const tokens = tokenizeAndStem(cleanText);
      tokens.forEach((token) => {
        // Only count terms that are at least 3 chars (skip noise)
        if (token.length >= 3) {
          termCounts.set(token, (termCounts.get(token) || 0) + 1);
        }
      });
    });

    // Sort by frequency, take top N
    const sorted = [...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxTopics * 2); // Get extra candidates to filter from

    // Capitalize first letter for display as tags
    const topics: string[] = [];
    const seen = new Set<string>();

    for (const [term] of sorted) {
      if (topics.length >= maxTopics) break;

      // Skip very generic programming terms that aren't useful as topic labels
      const skipTerms = new Set([
        'function',
        'return',
        'const',
        'import',
        'export',
        'class',
        'interface',
        'type',
        'string',
        'number',
        'boolean',
        'null',
        'undefined',
        'true',
        'false',
        'object',
        'array',
        'value',
        'data',
        'file',
        'code',
        'component',
        'state',
        'prop',
        'event',
        'handler',
        'callback',
        'async',
        'await',
        'promise',
        'error',
        'result',
        'item',
        'list',
        'index',
        'name',
        'text',
        'content',
        'message',
        'param',
        'arg',
      ]);
      if (skipTerms.has(term)) continue;

      // Don't add near-duplicates (stemming artifacts)
      const base = term.slice(0, 4);
      if (seen.has(base)) continue;
      seen.add(base);

      // Capitalize for display
      const label = term.charAt(0).toUpperCase() + term.slice(1);
      topics.push(label);
    }

    return topics;
  }

  /**
   * Strip code blocks from text to avoid noise in TF-IDF calculations
   */
  private stripCodeBlocks(text: string): string {
    return text.replace(/```[\s\S]*?```/g, '[code block]').replace(/`[^`]+`/g, '');
  }
}
