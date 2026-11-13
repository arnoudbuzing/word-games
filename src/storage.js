const PREFIX = "wordgames.v1.";

const DEFAULT_SETTINGS = {
  theme: "dark",
  highContrast: false,
  hardMode: false,
  wordLength: 5,
  maxGuesses: 6,
  playMode: "daily",
};

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
}

export function saveSettings(settings) {
  writeJson("settings", settings);
}

export function loadGameState(variantId, mode) {
  return readJson(`state.${variantId}.${mode}`, null);
}

export function saveGameState(variantId, mode, state) {
  writeJson(`state.${variantId}.${mode}`, state);
}

export function clearGameState(variantId, mode) {
  try {
    window.localStorage.removeItem(PREFIX + `state.${variantId}.${mode}`);
  } catch {
    // Ignore
  }
}

export function loadStats(variantId, maxGuesses) {
  const emptyDist = Array.from({ length: maxGuesses }, () => 0);
  const stored = readJson(`stats.${variantId}`, null);
  if (!stored) {
    return {
      played: 0,
      won: 0,
      currentStreak: 0,
      maxStreak: 0,
      distribution: emptyDist,
    };
  }
  const dist = Array.from(
    { length: maxGuesses },
    (_, i) => stored.distribution?.[i] || 0
  );
  return {
    played: stored.played || 0,
    won: stored.won || 0,
    currentStreak: stored.currentStreak || 0,
    maxStreak: stored.maxStreak || 0,
    distribution: dist,
  };
}

export function recordGameResult(variantId, maxGuesses, won, guessCount) {
  const stats = loadStats(variantId, maxGuesses);
  stats.played += 1;
  if (won) {
    stats.won += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    if (guessCount >= 1 && guessCount <= maxGuesses) {
      stats.distribution[guessCount - 1] += 1;
    }
  } else {
    stats.currentStreak = 0;
  }
  writeJson(`stats.${variantId}`, stats);
  return stats;
}
