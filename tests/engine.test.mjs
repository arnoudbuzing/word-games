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
} from "../src/engine.js";
import { getVariant, listVariants } from "../src/variants.js";

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

test("variants registry supports 5-letter and 6-letter modes", () => {
  const variants = listVariants();
  assert.ok(variants.length >= 2);

  const v5 = getVariant("classic-5");
  assert.equal(v5.wordLength, 5);
  assert.ok(v5.answers.length > 1000);
  assert.ok(v5.validGuesses.has("crane"));
  assert.ok(v5.validGuesses.has("books"));

  const v6 = getVariant("six-letter");
  assert.equal(v6.wordLength, 6);
  assert.ok(v6.answers.length >= 400);
  assert.ok(v6.validGuesses.has("planet"));

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
  assert.match(text, /Wordle #42 2\/6/);
  assert.match(text, /🟩🟩🟩🟩🟩/);
});
