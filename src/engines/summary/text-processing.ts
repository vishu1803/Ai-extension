import { STOP_WORDS } from './stop-words';

/**
 * Splits a text block into individual sentences.
 */
export function splitIntoSentences(text: string): string[] {
  // Simple heuristic: split by ., !, or ? followed by whitespace or EOF, and newlines
  const regex = /[^.!?\n]+[.!?\n]+/g;
  const matches = text.match(regex);
  if (!matches) {
    return [text.trim()].filter((s) => s.length > 0);
  }
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Very basic stemming (simplified Porter stemmer-like)
 * We just handle common suffixes to normalize words like 'running' -> 'run'
 */
function basicStem(word: string): string {
  if (word.length <= 3) return word;

  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';
  }
  if (word.endsWith('es') && word.length > 4) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  if (word.endsWith('ing') && word.length > 5) {
    return word.slice(0, -3);
  }
  if (word.endsWith('ed') && word.length > 4) {
    return word.slice(0, -2);
  }
  return word;
}

/**
 * Tokenizes a sentence into stemmed words, removing stop words and punctuation.
 */
export function tokenizeAndStem(sentence: string): string[] {
  // Remove markdown code blocks completely before tokenizing to avoid noise
  const noCode = sentence.replace(/```[\s\S]*?```/g, '');

  // Extract words (alphanumeric sequences)
  const words = noCode.toLowerCase().match(/[a-z0-9]+/g);
  if (!words) return [];

  return words
    .filter((word) => !STOP_WORDS.has(word) && word.length > 2)
    .map((word) => basicStem(word));
}
