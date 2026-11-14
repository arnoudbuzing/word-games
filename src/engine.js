/**
 * Pure, variant-agnostic Wordle-style game engine.
 * Designed so variants can customize word length, max guesses,
 * validation rules, and evaluation rules.
 */

export const LETTER_STATE = Object.freeze({
  EMPTY: "empty",
  ABSENT: "absent",
  PRESENT: "present",
  CORRECT: "correct",
});

const STATE_PRIORITY = {
  [LETTER_STATE.EMPTY]: 0,
  [LETTER_STATE.ABSENT]: 1,
  [LETTER_STATE.PRESENT]: 2,
  [LETTER_STATE.CORRECT]: 3,
};

const EPOCH_UTC_MS = Date.UTC(2026, 0, 1);
const MS_PER_DAY = 86_400_000;

/**
 * Format a Date as local YYYY-MM-DD.
 */
export function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get the 1-based puzzle number since 2026-01-01 (local calendar day).
 */
export function getDailyNumber(date = new Date()) {
  const localMidnightUtc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  return Math.floor((localMidnightUtc - EPOCH_UTC_MS) / MS_PER_DAY) + 1;
}

/**
 * Deterministic pseudo-random index for a given date and variant salt.
 * Uses a simple 32-bit hash (Mulberry32-style mixing) so consecutive days
 * don't walk alphabetically through the word list.
 */
export function getDailyIndex(poolLength, date = new Date(), salt = 0) {
  if (poolLength <= 0) {
    throw new Error("Answer pool must not be empty");
  }
  const day = getDailyNumber(date);
  let x = (day * 0x9e3779b1 + salt * 0x85ebca6b) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x % poolLength;
}

/**
 * Standard two-pass Wordle evaluation.
 * Pass 1: mark exact matches ("correct") and count remaining target letters.
 * Pass 2: mark misplaced letters ("present") up to remaining counts, else "absent".
 *
 * @param {string} guess - Lowercase guess string.
 * @param {string} target - Lowercase target string.
 * @returns {Array<{ letter: string, state: string }>}
 */
export function evaluateGuess(guess, target) {
  const g = guess.toLowerCase();
  const t = target.toLowerCase();
  const len = t.length;

  if (g.length !== len) {
    throw new Error(`Guess length (${g.length}) must match target (${len})`);
  }

  const result = new Array(len);
  const remaining = Object.create(null);

  for (let i = 0; i < len; i++) {
    if (g[i] === t[i]) {
      result[i] = { letter: g[i], state: LETTER_STATE.CORRECT };
    } else {
      remaining[t[i]] = (remaining[t[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < len; i++) {
    if (result[i]) continue;
    const ch = g[i];
    if (remaining[ch] > 0) {
      result[i] = { letter: ch, state: LETTER_STATE.PRESENT };
      remaining[ch] -= 1;
    } else {
      result[i] = { letter: ch, state: LETTER_STATE.ABSENT };
    }
  }

  return result;
}

/**
 * Validate Hard Mode constraints against previous evaluations:
 * - Every "correct" letter must remain in the same position.
 * - Every letter revealed as "correct" or "present" in a previous row
 *   must appear at least as many times in the new guess.
 *
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateHardMode(guess, previousEvaluations) {
  const g = guess.toLowerCase();

  for (const row of previousEvaluations) {
    const requiredCounts = Object.create(null);

    for (let i = 0; i < row.length; i++) {
      const { letter, state } = row[i];
      if (state === LETTER_STATE.CORRECT) {
        if (g[i] !== letter) {
          return {
            ok: false,
            message: `${ordinal(i + 1)} letter must be ${letter.toUpperCase()}`,
          };
        }
        requiredCounts[letter] = (requiredCounts[letter] || 0) + 1;
      } else if (state === LETTER_STATE.PRESENT) {
        requiredCounts[letter] = (requiredCounts[letter] || 0) + 1;
      }
    }

    const guessCounts = Object.create(null);
    for (const ch of g) {
      guessCounts[ch] = (guessCounts[ch] || 0) + 1;
    }

    for (const [letter, count] of Object.entries(requiredCounts)) {
      if ((guessCounts[letter] || 0) < count) {
        return {
          ok: false,
          message: `Guess must contain ${letter.toUpperCase()}`,
        };
      }
    }
  }

  return { ok: true };
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Compute highest-priority state per letter for the on-screen keyboard.
 */
export function computeKeyboardStates(evaluations) {
  const map = Object.create(null);
  for (const row of evaluations) {
    for (const { letter, state } of row) {
      const prev = map[letter];
      if (!prev || STATE_PRIORITY[state] > STATE_PRIORITY[prev]) {
        map[letter] = state;
      }
    }
  }
  return map;
}

/**
 * Default guess validation for a variant.
 * Variants can override `validateGuess(guess, context)` for custom rules.
 */
export function validateGuessForVariant(guess, variant, context) {
  const g = guess.toLowerCase();
  if (g.length !== variant.wordLength) {
    return { ok: false, message: "Not enough letters" };
  }

  if (typeof variant.validateGuess === "function") {
    const custom = variant.validateGuess(g, context);
    if (custom && !custom.ok) return custom;
  } else if (!variant.allowAnyWord && !variant.validGuesses.has(g)) {
    return { ok: false, message: "Not in word list" };
  }

  if (context.hardMode && variant.hardModeSupported !== false) {
    const hardCheck = validateHardMode(g, context.evaluations);
    if (!hardCheck.ok) return hardCheck;
  }

  return { ok: true };
}

export const PUBLIC_URL = "https://arnoudbuzing.github.io/word-games/";

/**
 * Format shareable emoji grid text.
 */
export function formatShareText({
  variant,
  puzzleNumber,
  mode,
  evaluations,
  won,
  highContrast = false,
  url = PUBLIC_URL,
}) {
  const score = won ? String(evaluations.length) : "X";
  const label =
    mode === "daily" ? `${variant.name} #${puzzleNumber}` : `${variant.name} (Practice)`;
  const header = `${label} ${score}/${variant.maxGuesses}`;

  const correctSquare = "🟦";
  const presentSquare = "🟧";
  const gray = "⬛";

  const grid = evaluations
    .map((row) =>
      row
        .map((cell) => {
          if (cell.state === LETTER_STATE.CORRECT) return correctSquare;
          if (cell.state === LETTER_STATE.PRESENT) return presentSquare;
          return gray;
        })
        .join("")
    )
    .join("\n");

  return url ? `${header}\n\n${grid}\n\n${url}` : `${header}\n\n${grid}`;
}

/**
 * Pick a target word for either "daily" or "practice" mode.
 */
export function selectTargetWord(variant, mode = "daily", date = new Date()) {
  const pool = variant.answers;
  if (mode === "daily") {
    const idx = getDailyIndex(pool.length, date, variant.dailySalt || 0);
    return pool[idx];
  }
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

/**
 * Evaluate a submitted guess using the variant's evaluator (or default).
 */
export function evaluateForVariant(guess, target, variant) {
  if (typeof variant.evaluateGuess === "function") {
    return variant.evaluateGuess(guess, target);
  }
  return evaluateGuess(guess, target);
}

/**
 * Compute integer points earned for a completed round.
 * Returns a negative penalty (-wordLength * 10) on a loss.
 */
export function calculateRoundScore({
  wordLength,
  maxGuesses,
  guessesUsed,
  currentStreak = 0,
  hardMode = false,
  won = true,
}) {
  if (!won) return -(wordLength * 10);

  const base = wordLength * 20;
  const efficiency = Math.max(0, 7 - guessesUsed) * 20;
  const tightGrid = Math.max(0, 6 - maxGuesses) * 15;
  const streakBonus = Math.min(Math.max(0, currentStreak), 10) * 10;
  const multiplier = hardMode ? 1.25 : 1;

  return Math.round((base + efficiency + tightGrid + streakBonus) * multiplier);
}

/**
 * Compute net integer points for a guess:
 * - +10 for each newly locked-in green position
 * - +5 for each newly discovered yellow letter
 * - -5 for each letter used that is already known not to be in the word
 * Already-known green/yellow positions and letters award 0 so points cannot be farmed.
 */
export function calculateDiscoveryScore(
  previousEvaluations,
  currentEvaluation,
  hardMode = false
) {
  const knownGreenPositions = new Set();
  const knownLetters = new Set();
  const seenAbsent = new Set();

  for (const row of previousEvaluations) {
    for (let i = 0; i < row.length; i++) {
      const { letter, state } = row[i];
      if (state === LETTER_STATE.CORRECT) {
        knownGreenPositions.add(i);
        knownLetters.add(letter);
      } else if (state === LETTER_STATE.PRESENT) {
        knownLetters.add(letter);
      } else if (state === LETTER_STATE.ABSENT) {
        seenAbsent.add(letter);
      }
    }
  }

  const knownAbsentLetters = new Set();
  for (const letter of seenAbsent) {
    if (!knownLetters.has(letter)) {
      knownAbsentLetters.add(letter);
    }
  }

  let points = 0;
  let penalty = 0;
  for (let i = 0; i < currentEvaluation.length; i++) {
    const { letter, state } = currentEvaluation[i];
    if (knownAbsentLetters.has(letter)) {
      penalty += 5;
    }
    if (state === LETTER_STATE.CORRECT) {
      if (!knownGreenPositions.has(i)) {
        points += 10;
        knownGreenPositions.add(i);
      }
      knownLetters.add(letter);
    } else if (state === LETTER_STATE.PRESENT) {
      if (!knownLetters.has(letter)) {
        points += 5;
        knownLetters.add(letter);
      }
    }
  }

  const multiplier = hardMode ? 1.25 : 1;
  return Math.round(points * multiplier) - penalty;
}
