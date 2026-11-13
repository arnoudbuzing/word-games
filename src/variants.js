import { WORDS_4_ANSWERS, WORDS_4_VALID } from "./data/words-4.js";
import { WORDS_5_ANSWERS, WORDS_5_VALID } from "./data/words-5.js";
import { WORDS_6_ANSWERS, WORDS_6_VALID } from "./data/words-6.js";
import { WORDS_7_ANSWERS, WORDS_7_VALID } from "./data/words-7.js";

export const MIN_WORD_LENGTH = 4;
export const MAX_WORD_LENGTH = 7;
export const MIN_MAX_GUESSES = 4;
export const MAX_MAX_GUESSES = 9;

export const DEFAULT_WORD_LENGTH = 5;
export const DEFAULT_MAX_GUESSES = 6;

const WORD_BANKS = {
  4: { answers: WORDS_4_ANSWERS, validGuesses: WORDS_4_VALID, dailySalt: 404 },
  5: { answers: WORDS_5_ANSWERS, validGuesses: WORDS_5_VALID, dailySalt: 101 },
  6: { answers: WORDS_6_ANSWERS, validGuesses: WORDS_6_VALID, dailySalt: 202 },
  7: { answers: WORDS_7_ANSWERS, validGuesses: WORDS_7_VALID, dailySalt: 707 },
};

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Create a variant configuration for any supported wordLength (4–7)
 * and maxGuesses (4–9).
 *
 * Future rule variations can still override `validateGuess` or `evaluateGuess`
 * on the returned object.
 */
export function createVariant(
  wordLength = DEFAULT_WORD_LENGTH,
  maxGuesses = DEFAULT_MAX_GUESSES
) {
  const len = clampInt(
    wordLength,
    MIN_WORD_LENGTH,
    MAX_WORD_LENGTH,
    DEFAULT_WORD_LENGTH
  );
  const guesses = clampInt(
    maxGuesses,
    MIN_MAX_GUESSES,
    MAX_MAX_GUESSES,
    DEFAULT_MAX_GUESSES
  );
  const bank = WORD_BANKS[len];

  return {
    id: `w${len}-g${guesses}`,
    name: len === 5 && guesses === 6 ? "Wordle" : `Wordle ${len}×${guesses}`,
    shortLabel: `${len}×${guesses}`,
    description: `${len}-letter word in ${guesses} guesses.`,
    wordLength: len,
    maxGuesses: guesses,
    dailySalt: bank.dailySalt + guesses,
    hardModeSupported: true,
    allowAnyWord: false,
    answers: bank.answers,
    validGuesses: bank.validGuesses,
  };
}

export const VARIANTS = [
  createVariant(4, 6),
  createVariant(5, 6),
  createVariant(6, 6),
  createVariant(7, 6),
];

export function getVariant(id) {
  if (id === "classic-5") return createVariant(5, 6);
  if (id === "six-letter") return createVariant(6, 6);
  const match = /^w(\d+)-g(\d+)$/.exec(String(id || ""));
  if (match) {
    return createVariant(match[1], match[2]);
  }
  return createVariant(DEFAULT_WORD_LENGTH, DEFAULT_MAX_GUESSES);
}

export function listVariants() {
  return VARIANTS;
}
