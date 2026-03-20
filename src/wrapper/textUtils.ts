/**
 * Text utilities for skill routing — tokenization, bigram generation,
 * and Dice coefficient for fuzzy string matching.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "be", "was", "are",
  "this", "that", "these", "those", "i", "we", "you", "they", "he",
  "she", "my", "our", "your", "its", "do", "does", "did", "has", "have",
  "had", "will", "would", "can", "could", "should", "may", "might",
  "not", "no", "so", "if", "then", "than", "very", "just", "about",
  "also", "been", "being", "into", "more", "some", "such", "what",
  "which", "who", "how", "when", "where", "all", "each", "every",
  "both", "few", "most", "other", "up", "out", "any", "only",
]);

/**
 * Tokenize a string into lowercase keywords, removing stop words
 * and stripping trailing 's' for basic stemming.
 */
export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  return [...new Set(words.map(stemLight))];
}

/**
 * Light stemming: strip trailing 's', 'ing', 'tion', 'ment' for basic normalization.
 */
function stemLight(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("tion")) return word.slice(0, -4);
  if (word.endsWith("ment")) return word.slice(0, -4);
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/**
 * Generate character bigrams from a string.
 */
export function bigrams(text: string): Set<string> {
  const lower = text.toLowerCase().replace(/\s+/g, " ").trim();
  const result = new Set<string>();
  for (let i = 0; i < lower.length - 1; i++) {
    result.add(lower.slice(i, i + 2));
  }
  return result;
}

/**
 * Dice coefficient between two strings (0.0–1.0).
 * Uses character bigrams for fuzzy matching.
 */
export function diceCoefficient(a: string, b: string): number {
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);

  if (bigramsA.size === 0 && bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Check if message contains a trigger phrase as a substring (case-insensitive).
 * Returns 1.0 for exact substring match, or the Dice coefficient if >= threshold.
 */
export function bestTriggerMatch(
  message: string,
  triggers: string[],
  diceThreshold = 0.6,
): number {
  const msgLower = message.toLowerCase();
  let best = 0;

  for (const trigger of triggers) {
    const tLower = trigger.toLowerCase();
    if (msgLower.includes(tLower)) {
      return 1.0; // exact substring match — can't do better
    }
    const dice = diceCoefficient(msgLower, tLower);
    if (dice > best) best = dice;
  }

  return best >= diceThreshold ? best : best * 0.5; // penalize below threshold
}

/**
 * Keyword overlap score: |intersection| / |skillKeywords|, capped at 1.0.
 */
export function keywordOverlap(
  messageTokens: string[],
  skillKeywords: string[],
): number {
  if (skillKeywords.length === 0) return 0;

  const messageSet = new Set(messageTokens);
  let hits = 0;
  for (const kw of skillKeywords) {
    if (messageSet.has(kw)) hits++;
  }

  return Math.min(hits / skillKeywords.length, 1.0);
}

/**
 * Check if any anti-keywords appear in the message tokens.
 * Returns 0.0 (penalized) if any match, 1.0 (no penalty) otherwise.
 */
export function antiKeywordPenalty(
  messageTokens: string[],
  antiKeywords: string[],
): number {
  if (antiKeywords.length === 0) return 1.0;

  const messageSet = new Set(messageTokens);
  for (const anti of antiKeywords) {
    if (messageSet.has(anti)) return 0.0;
  }

  return 1.0;
}
