import test from "node:test";
import assert from "node:assert/strict";
import {
  LETTER_STATE,
  evaluateGuess,
  validateHardMode,
  computeKeyboardStates,
  getDailyIndex,
  getDailyNumber,
  getLocalDateKey,
  validateGuessForVariant,
  formatShareText,
  calculateRoundScore,
  calculateDiscoveryScore,
} from "../src/engine.js";
import { createVariant, getVariant, listVariants } from "../src/variants.js";

test("evaluateGuess handles exact, present, absent, and duplicate letters", () => {
  // Target: ABBEY, Guess: KEBAB ->
  // K: absent, E: present, B: correct (pos 2), A: present, B: present (only 2 B's in ABBEY, one at pos 1, one at pos 2)
  const res = evaluateGuess("kebab", "abbey");
  assert.deepEqual(
    res.map((r) => r.state),
    [
      LETTER_STATE.ABSENT,
      LETTER_STATE.PRESENT,
      LETTER_STATE.CORRECT,
      LETTER_STATE.PRESENT,
      LETTER_STATE.PRESENT,
    ]
  );

  // Target: CRANE, Guess: EERIE ->
  // E(0): absent (since E(4) is exact match!), E(1): absent, R(2): present, I(3): absent, E(4): correct
  const res2 = evaluateGuess("eerie", "crane");
  assert.deepEqual(
    res2.map((r) => r.state),
    [
      LETTER_STATE.ABSENT,
      LETTER_STATE.ABSENT,
      LETTER_STATE.PRESENT,
      LETTER_STATE.ABSENT,
      LETTER_STATE.CORRECT,
    ]
  );

  // Target: SPEED, Guess: CREEP ->
  // C: absent, R: absent, E(2): correct, E(3): correct, P: present
  const res3 = evaluateGuess("creep", "speed");
  assert.deepEqual(
    res3.map((r) => r.state),
    [
      LETTER_STATE.ABSENT,
      LETTER_STATE.ABSENT,
      LETTER_STATE.CORRECT,
      LETTER_STATE.CORRECT,
      LETTER_STATE.PRESENT,
    ]
  );
});

test("validateHardMode enforces green positions and yellow/green counts", () => {
  const prev = [evaluateGuess("crane", "slate")];
  // C: absent, R: absent, A: correct (pos 2), N: absent, E: correct (pos 4)
  assert.equal(validateHardMode("plate", prev).ok, true);
  const badPos = validateHardMode("stone", prev);
  assert.equal(badPos.ok, false);
  assert.match(badPos.message, /3rd letter must be A/);

  const prevYellow = [evaluateGuess("arise", "crane")];
  // A: present, R: correct (pos 1), I: absent, S: absent, E: correct (pos 4)
  const missingA = validateHardMode("broke", prevYellow);
  assert.equal(missingA.ok, false);
  assert.match(missingA.message, /must contain A/);
});

test("computeKeyboardStates keeps highest priority state per letter", () => {
  const evals = [
    evaluateGuess("arise", "crane"),
    evaluateGuess("crane", "crane"),
  ];
  const kb = computeKeyboardStates(evals);
  assert.equal(kb.c, LETTER_STATE.CORRECT);
  assert.equal(kb.r, LETTER_STATE.CORRECT);
  assert.equal(kb.a, LETTER_STATE.CORRECT);
  assert.equal(kb.n, LETTER_STATE.CORRECT);
  assert.equal(kb.e, LETTER_STATE.CORRECT);
  assert.equal(kb.i, LETTER_STATE.ABSENT);
  assert.equal(kb.s, LETTER_STATE.ABSENT);
});

test("daily index and date key are deterministic", () => {
  const d1 = new Date(2026, 10, 13, 8, 0, 0);
  const d2 = new Date(2026, 10, 13, 23, 59, 59);
  const d3 = new Date(2026, 10, 14, 0, 1, 0);

  assert.equal(getLocalDateKey(d1), "2026-11-13");
  assert.equal(getDailyNumber(d1), getDailyNumber(d2));
  assert.equal(getDailyNumber(d3), getDailyNumber(d1) + 1);
  assert.equal(getDailyIndex(2000, d1, 101), getDailyIndex(2000, d2, 101));
});

test("variants registry supports wordLength 4-7 and maxGuesses 4-9", () => {
  const variants = listVariants();
  assert.ok(variants.length >= 4);

  for (const len of [4, 5, 6, 7]) {
    for (const guesses of [4, 6, 9]) {
      const v = createVariant(len, guesses);
      assert.equal(v.wordLength, len);
      assert.equal(v.maxGuesses, guesses);
      assert.ok(v.answers.length >= 400);
      assert.ok(v.answers.every((w) => w.length === len));
      assert.ok(v.validGuesses.size >= v.answers.length);
    }
  }

  const clampedLow = createVariant(2, 1);
  assert.equal(clampedLow.wordLength, 4);
  assert.equal(clampedLow.maxGuesses, 4);

  const clampedHigh = createVariant(12, 20);
  assert.equal(clampedHigh.wordLength, 7);
  assert.equal(clampedHigh.maxGuesses, 9);

  const v5 = getVariant("classic-5");
  const invalid = validateGuessForVariant("zzzzz", v5, {
    hardMode: false,
    evaluations: [],
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.message, "Not in word list");
});

test("formatShareText produces valid emoji grid", () => {
  const v5 = getVariant("classic-5");
  const evals = [
    evaluateGuess("arise", "crane"),
    evaluateGuess("crane", "crane"),
  ];
  const text = formatShareText({
    variant: v5,
    puzzleNumber: 42,
    mode: "daily",
    evaluations: evals,
    won: true,
    highContrast: false,
  });
  assert.match(text, /Tilewise #42 2\/6/);
  assert.match(text, /🟦🟦🟦🟦🟦/);
  assert.match(text, /https:\/\/arnoudbuzing\.github\.io\/word-games\//);
});

test("calculateRoundScore computes integer scores fairly across variants and modes", () => {
  // Loss applies a negative penalty (-wordLength * 10)
  assert.equal(
    calculateRoundScore({
      wordLength: 5,
      maxGuesses: 6,
      guessesUsed: 6,
      currentStreak: 4,
      hardMode: true,
      won: false,
    }),
    -50
  );

  // Standard 5x6 win in 4 guesses, no streak, normal mode:
  // base (100) + efficiency (60) + tightGrid (0) + streak (0) = 160
  assert.equal(
    calculateRoundScore({
      wordLength: 5,
      maxGuesses: 6,
      guessesUsed: 4,
      currentStreak: 0,
      hardMode: false,
      won: true,
    }),
    160
  );

  // Increasing maxGuesses to 9 does not inflate a 4-guess win
  assert.equal(
    calculateRoundScore({
      wordLength: 5,
      maxGuesses: 9,
      guessesUsed: 4,
      currentStreak: 0,
      hardMode: false,
      won: true,
    }),
    160
  );

  // Tighter grid (4 guesses) + streak (capped at 10) + Hard Mode (1.25x)
  // base (120) + efficiency (100) + tightGrid (30) + streak (100) = 350 * 1.25 = 438
  assert.equal(
    calculateRoundScore({
      wordLength: 6,
      maxGuesses: 4,
      guessesUsed: 2,
      currentStreak: 15,
      hardMode: true,
      won: true,
    }),
    438
  );
});

test("calculateDiscoveryScore awards first-discovery points only once per letter/position", () => {
  // Target: CRANE
  // Guess 1: ARISE -> A(present +5), R(correct +10), I(absent), S(absent), E(correct +10) => 25
  const row1 = evaluateGuess("arise", "crane");
  assert.equal(calculateDiscoveryScore([], row1, false), 25);

  // Guess 2: ARISE again -> I and S are known absent (-5 each = -10), no new discoveries
  assert.equal(calculateDiscoveryScore([row1], row1, false), -10);

  // Guess 2: CRATE -> C(correct +10), R(already green 0), A(already yellow, now green +10), T(new absent 0), E(already green 0) => 20
  const row2 = evaluateGuess("crate", "crane");
  assert.equal(calculateDiscoveryScore([row1], row2, false), 20);

  // Duplicate letter edge case: E(0) absent + E(4) correct in EERIE -> E is NOT known-absent
  const eerieRow = evaluateGuess("eerie", "crane");
  // Guess 2: CRATE uses E(4) -> 0 penalty for E
  assert.equal(calculateDiscoveryScore([eerieRow], row2, false), 30);

  // Hard mode applies 1.25x multiplier to discoveries (25 * 1.25 = 31)
  assert.equal(calculateDiscoveryScore([], row1, true), 31);
});
