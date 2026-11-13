import { WORDS_5_ANSWERS, WORDS_5_VALID } from "./data/words-5.js";
import { WORDS_6_ANSWERS, WORDS_6_VALID } from "./data/words-6.js";

/**
 * Registry of game variants.
 *
 * To add a new variation (e.g., 6-letter, 7-guess, or custom rules):
 * 1. Add an entry to VARIANTS below.
 * 2. Optionally provide custom `validateGuess(guess, context)` or
 *    `evaluateGuess(guess, target)` hooks.
 */
export const VARIANTS = [
  {
    id: "classic-5",
    name: "Wordle",
    shortLabel: "5×6",
    description: "Classic 5-letter word in 6 guesses.",
    wordLength: 5,
    maxGuesses: 6,
    dailySalt: 101,
    hardModeSupported: true,
    allowAnyWord: false,
    answers: WORDS_5_ANSWERS,
    validGuesses: WORDS_5_VALID,
  },
  {
    id: "six-letter",
    name: "Wordle 6",
    shortLabel: "6×6",
    description: "6-letter word in 6 guesses.",
    wordLength: 6,
    maxGuesses: 6,
    dailySalt: 202,
    hardModeSupported: true,
    allowAnyWord: false,
    answers: WORDS_6_ANSWERS,
    validGuesses: WORDS_6_VALID,
  },
];

export const DEFAULT_VARIANT_ID = "classic-5";

export function getVariant(id) {
  return VARIANTS.find((v) => v.id === id) || VARIANTS[0];
}

export function listVariants() {
  return VARIANTS;
}
