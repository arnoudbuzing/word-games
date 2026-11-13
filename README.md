# Word Games

A mobile-friendly, zero-build Wordle-style word game designed to be easily extended with new variants (different word lengths, guess counts, or custom rules).

## Features

- **Mobile-first UI**: Fits within `100dvh` without scrolling, large touch-friendly QWERTY keyboard, physical keyboard support, and smooth tile animations.
- **Daily & Practice Modes**: Deterministic daily puzzle per variant, plus unlimited practice mode.
- **Built-in Variants**:
  - **Wordle (`classic-5`)**: 5-letter word in 6 guesses.
  - **Wordle 6 (`six-letter`)**: 6-letter word in 6 guesses.
- **Settings & Stats**: Dark/Light theme, High Contrast (colorblind-friendly) mode, Hard Mode, per-variant streak/distribution stats, and emoji grid sharing.

## Local Development

Serve the repository over HTTP (ES modules require an HTTP server rather than `file://`):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Run unit tests with Node:

```bash
node --test tests/engine.test.mjs
```

## Adding a New Variant or Custom Rules

Variants are defined declaratively in `src/variants.js`. To add a new variation:

1. Add an entry to `VARIANTS` with `id`, `name`, `wordLength`, `maxGuesses`, `answers`, and `validGuesses`.
2. Optionally override `validateGuess(guess, context)` or `evaluateGuess(guess, target)` on the variant object to customize game rules.
