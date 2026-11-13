import {
  LETTER_STATE,
  computeKeyboardStates,
  evaluateForVariant,
  formatShareText,
  getDailyNumber,
  getLocalDateKey,
  selectTargetWord,
  validateGuessForVariant,
} from "./engine.js";
import { getVariant, listVariants } from "./variants.js";
import {
  clearGameState,
  loadGameState,
  loadSettings,
  loadStats,
  recordGameResult,
  saveGameState,
  saveSettings,
} from "./storage.js";

const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["spacer", "a", "s", "d", "f", "g", "h", "j", "k", "l", "spacer"],
  ["enter", "z", "x", "c", "v", "b", "n", "m", "backspace"],
];

const WIN_MESSAGES = [
  "Genius!",
  "Magnificent!",
  "Impressive!",
  "Splendid!",
  "Great!",
  "Phew!",
];

const dom = {
  html: document.documentElement,
  headerTitle: document.getElementById("header-title"),
  headerBadge: document.getElementById("header-badge"),
  board: document.getElementById("board"),
  keyboard: document.getElementById("keyboard"),
  toastContainer: document.getElementById("toast-container"),
  backdrop: document.getElementById("modal-backdrop"),
  modals: {
    help: document.getElementById("modal-help"),
    mode: document.getElementById("modal-mode"),
    stats: document.getElementById("modal-stats"),
    settings: document.getElementById("modal-settings"),
  },
  helpSummary: document.getElementById("help-summary"),
  playModeToggle: document.getElementById("play-mode-toggle"),
  variantList: document.getElementById("variant-list"),
  btnNewPractice: document.getElementById("btn-new-practice"),
  statsTitle: document.getElementById("stats-title"),
  statPlayed: document.getElementById("stat-played"),
  statWinPct: document.getElementById("stat-win-pct"),
  statStreak: document.getElementById("stat-streak"),
  statMaxStreak: document.getElementById("stat-max-streak"),
  guessDist: document.getElementById("guess-dist"),
  statsActions: document.getElementById("stats-actions"),
  btnShare: document.getElementById("btn-share"),
  btnPlayAgain: document.getElementById("btn-play-again"),
  toggleHard: document.getElementById("toggle-hard"),
  toggleDark: document.getElementById("toggle-dark"),
  toggleContrast: document.getElementById("toggle-contrast"),
};

let settings = loadSettings();
let variant = getVariant(settings.variantId);
let gameState = null;
let isAnimating = false;

function init() {
  applyTheme();
  bindEvents();
  renderKeyboard();
  loadOrStartGame();
}

function applyTheme() {
  dom.html.setAttribute("data-theme", settings.theme);
  dom.html.setAttribute("data-contrast", String(settings.highContrast));
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute(
      "content",
      settings.theme === "dark" ? "#121213" : "#ffffff"
    );
  }
  dom.toggleHard.checked = settings.hardMode;
  dom.toggleDark.checked = settings.theme === "dark";
  dom.toggleContrast.checked = settings.highContrast;
}

function loadOrStartGame(forceNewPractice = false) {
  variant = getVariant(settings.variantId);
  const mode = settings.playMode;
  const dateKey = getLocalDateKey();

  let saved = forceNewPractice ? null : loadGameState(variant.id, mode);

  const isDailyStale =
    mode === "daily" && saved && saved.dateKey !== dateKey;

  if (!saved || isDailyStale || saved.wordLength !== variant.wordLength) {
    saved = {
      variantId: variant.id,
      mode,
      dateKey,
      wordLength: variant.wordLength,
      target: selectTargetWord(variant, mode),
      guesses: [],
      evaluations: [],
      currentGuess: "",
      status: "playing", // "playing" | "won" | "lost"
    };
    saveGameState(variant.id, mode, saved);
  }

  gameState = saved;
  updateHeader();
  renderBoard();
  updateKeyboardColors();
}

function updateHeader() {
  dom.headerTitle.textContent = variant.name;
  const modeLabel = settings.playMode === "daily" ? "Daily" : "Practice";
  dom.headerBadge.textContent = `${variant.shortLabel} · ${modeLabel}`;
  dom.helpSummary.textContent = `Guess the ${variant.wordLength}-letter word in ${variant.maxGuesses} tries.`;
}

function renderBoard() {
  const { wordLength, maxGuesses } = variant;
  dom.board.style.setProperty("--cols", String(wordLength));
  dom.board.style.setProperty("--rows", String(maxGuesses));
  dom.board.innerHTML = "";

  for (let r = 0; r < maxGuesses; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "board-row";
    rowEl.dataset.row = String(r);

    const submittedEval = gameState.evaluations[r];
    const isCurrent = r === gameState.guesses.length && gameState.status === "playing";

    for (let c = 0; c < wordLength; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.col = String(c);

      if (submittedEval) {
        tile.textContent = submittedEval[c].letter;
        tile.dataset.letter = submittedEval[c].letter;
        tile.dataset.state = submittedEval[c].state;
      } else if (isCurrent) {
        const ch = gameState.currentGuess[c] || "";
        tile.textContent = ch;
        tile.dataset.letter = ch;
      } else {
        tile.dataset.letter = "";
      }

      rowEl.appendChild(tile);
    }
    dom.board.appendChild(rowEl);
  }
}

function renderKeyboard() {
  dom.keyboard.innerHTML = "";
  for (const row of KEYBOARD_ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "kb-row";

    for (const key of row) {
      if (key === "spacer") {
        const spacer = document.createElement("div");
        spacer.className = "kb-spacer";
        rowEl.appendChild(spacer);
        continue;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.dataset.key = key;

      if (key === "enter") {
        btn.classList.add("key-wide");
        btn.textContent = "Enter";
        btn.setAttribute("aria-label", "Submit guess");
      } else if (key === "backspace") {
        btn.classList.add("key-wide");
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>`;
        btn.setAttribute("aria-label", "Backspace");
      } else {
        btn.textContent = key;
      }

      btn.addEventListener("click", () => handleInput(key));
      rowEl.appendChild(btn);
    }

    dom.keyboard.appendChild(rowEl);
  }
}

function updateKeyboardColors() {
  const states = computeKeyboardStates(gameState.evaluations);
  const keys = dom.keyboard.querySelectorAll(".key[data-key]");
  for (const btn of keys) {
    const k = btn.dataset.key;
    if (k === "enter" || k === "backspace") continue;
    if (states[k]) {
      btn.dataset.state = states[k];
    } else {
      delete btn.dataset.state;
    }
  }
}

function handleInput(key) {
  if (isAnimating) return;
  if (!dom.backdrop.classList.contains("hidden")) return;
  if (gameState.status !== "playing") return;

  if (key === "enter") {
    submitCurrentGuess();
    return;
  }

  if (key === "backspace") {
    if (gameState.currentGuess.length > 0) {
      gameState.currentGuess = gameState.currentGuess.slice(0, -1);
      updateCurrentRowUI(-1);
    }
    return;
  }

  if (/^[a-z]$/.test(key)) {
    if (gameState.currentGuess.length < variant.wordLength) {
      const idx = gameState.currentGuess.length;
      gameState.currentGuess += key;
      updateCurrentRowUI(idx);
    }
  }
}

function updateCurrentRowUI(popIndex) {
  const rowIndex = gameState.guesses.length;
  const rowEl = dom.board.querySelector(`.board-row[data-row="${rowIndex}"]`);
  if (!rowEl) return;

  const tiles = rowEl.querySelectorAll(".tile");
  tiles.forEach((tile, i) => {
    const ch = gameState.currentGuess[i] || "";
    tile.textContent = ch;
    tile.dataset.letter = ch;
    if (i === popIndex) {
      tile.classList.remove("pop");
      void tile.offsetWidth;
      tile.classList.add("pop");
    }
  });
}

function submitCurrentGuess() {
  const guess = gameState.currentGuess.toLowerCase();
  const check = validateGuessForVariant(guess, variant, {
    hardMode: settings.hardMode,
    evaluations: gameState.evaluations,
  });

  if (!check.ok) {
    shakeCurrentRow();
    showToast(check.message);
    return;
  }

  const rowIndex = gameState.guesses.length;
  const evaluation = evaluateForVariant(guess, gameState.target, variant);

  gameState.guesses.push(guess);
  gameState.evaluations.push(evaluation);
  gameState.currentGuess = "";

  const won = evaluation.every((cell) => cell.state === LETTER_STATE.CORRECT);
  const lost = !won && gameState.guesses.length >= variant.maxGuesses;

  if (won) gameState.status = "won";
  else if (lost) gameState.status = "lost";

  saveGameState(variant.id, settings.playMode, gameState);

  if (won || lost) {
    recordGameResult(
      variant.id,
      variant.maxGuesses,
      won,
      gameState.guesses.length
    );
  }

  animateRowReveal(rowIndex, evaluation, () => {
    updateKeyboardColors();
    if (won) {
      bounceRow(rowIndex);
      const msg = WIN_MESSAGES[Math.min(rowIndex, WIN_MESSAGES.length - 1)];
      showToast(msg, 2000);
      setTimeout(() => openModal("stats"), 1100);
    } else if (lost) {
      showToast(gameState.target.toUpperCase(), 3500);
      setTimeout(() => openModal("stats"), 1400);
    }
  });
}

function animateRowReveal(rowIndex, evaluation, onComplete) {
  isAnimating = true;
  const rowEl = dom.board.querySelector(`.board-row[data-row="${rowIndex}"]`);
  const tiles = rowEl.querySelectorAll(".tile");
  const stepMs = 240;

  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add("flip");
      setTimeout(() => {
        tile.dataset.state = evaluation[i].state;
      }, 220);
    }, i * stepMs);
  });

  const totalMs = (tiles.length - 1) * stepMs + 500;
  setTimeout(() => {
    isAnimating = false;
    onComplete();
  }, totalMs);
}

function shakeCurrentRow() {
  const rowIndex = gameState.guesses.length;
  const rowEl = dom.board.querySelector(`.board-row[data-row="${rowIndex}"]`);
  if (!rowEl) return;
  rowEl.classList.remove("shake");
  void rowEl.offsetWidth;
  rowEl.classList.add("shake");
}

function bounceRow(rowIndex) {
  const rowEl = dom.board.querySelector(`.board-row[data-row="${rowIndex}"]`);
  if (!rowEl) return;
  const tiles = rowEl.querySelectorAll(".tile");
  tiles.forEach((tile, i) => {
    setTimeout(() => tile.classList.add("bounce"), i * 80);
  });
}

function showToast(message, duration = 1600) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, duration);
}

function openModal(name) {
  if (name === "stats") renderStatsModal();
  if (name === "mode") renderModeModal();

  Object.values(dom.modals).forEach((m) => m.classList.add("hidden"));
  dom.modals[name].classList.remove("hidden");
  dom.backdrop.classList.remove("hidden");
}

function closeModals() {
  dom.backdrop.classList.add("hidden");
  Object.values(dom.modals).forEach((m) => m.classList.add("hidden"));
}

function renderModeModal() {
  const modeButtons = dom.playModeToggle.querySelectorAll(".seg-btn");
  modeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === settings.playMode);
  });

  dom.btnNewPractice.classList.toggle(
    "hidden",
    settings.playMode !== "practice"
  );

  dom.variantList.innerHTML = "";
  for (const v of listVariants()) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `variant-card${v.id === variant.id ? " active" : ""}`;
    card.innerHTML = `
      <div>
        <div class="variant-name">${v.name}</div>
        <div class="variant-desc">${v.description}</div>
      </div>
      <span class="variant-pill">${v.shortLabel}</span>
    `;
    card.addEventListener("click", () => {
      if (settings.variantId !== v.id) {
        settings.variantId = v.id;
        saveSettings(settings);
        loadOrStartGame();
        renderModeModal();
      }
      closeModals();
    });
    dom.variantList.appendChild(card);
  }
}

function renderStatsModal() {
  const stats = loadStats(variant.id, variant.maxGuesses);
  dom.statsTitle.textContent = `${variant.name} Stats`;
  dom.statPlayed.textContent = String(stats.played);
  const winPct =
    stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  dom.statWinPct.textContent = String(winPct);
  dom.statStreak.textContent = String(stats.currentStreak);
  dom.statMaxStreak.textContent = String(stats.maxStreak);

  const maxCount = Math.max(1, ...stats.distribution);
  const lastGuessCount =
    gameState.status === "won" ? gameState.guesses.length : -1;

  dom.guessDist.innerHTML = "";
  stats.distribution.forEach((count, idx) => {
    const row = document.createElement("div");
    row.className = "dist-row";
    const widthPct = Math.max(7, Math.round((count / maxCount) * 100));
    const isHighlight = idx + 1 === lastGuessCount;

    row.innerHTML = `
      <span class="dist-label">${idx + 1}</span>
      <div class="dist-bar${isHighlight ? " highlight" : ""}" style="width: ${widthPct}%">${count}</div>
    `;
    dom.guessDist.appendChild(row);
  });

  const finished = gameState.status !== "playing";
  dom.statsActions.classList.toggle("hidden", !finished);
  dom.btnPlayAgain.classList.toggle("hidden", settings.playMode !== "practice");
}

async function handleShare() {
  const text = formatShareText({
    variant,
    puzzleNumber: getDailyNumber(),
    mode: settings.playMode,
    evaluations: gameState.evaluations,
    won: gameState.status === "won",
    highContrast: settings.highContrast,
  });

  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // Fall back to clipboard if user cancels or share fails
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied results to clipboard");
  } catch {
    showToast("Could not copy results");
  }
}

function bindEvents() {
  document.getElementById("btn-help").addEventListener("click", () => openModal("help"));
  document.getElementById("btn-mode").addEventListener("click", () => openModal("mode"));
  document.getElementById("btn-stats").addEventListener("click", () => openModal("stats"));
  document.getElementById("btn-settings").addEventListener("click", () => openModal("settings"));

  dom.backdrop.addEventListener("click", (e) => {
    if (e.target === dom.backdrop) closeModals();
  });
  document.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", closeModals);
  });

  dom.playModeToggle.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextMode = btn.dataset.mode;
      if (settings.playMode !== nextMode) {
        settings.playMode = nextMode;
        saveSettings(settings);
        loadOrStartGame();
        renderModeModal();
      }
    });
  });

  dom.btnNewPractice.addEventListener("click", () => {
    clearGameState(variant.id, "practice");
    loadOrStartGame(true);
    closeModals();
  });

  dom.btnPlayAgain.addEventListener("click", () => {
    clearGameState(variant.id, "practice");
    loadOrStartGame(true);
    closeModals();
  });

  dom.btnShare.addEventListener("click", handleShare);

  dom.toggleHard.addEventListener("change", () => {
    if (dom.toggleHard.checked && gameState.guesses.length > 0 && gameState.status === "playing") {
      dom.toggleHard.checked = false;
      showToast("Hard mode can only be enabled at the start of a round");
      return;
    }
    settings.hardMode = dom.toggleHard.checked;
    saveSettings(settings);
  });

  dom.toggleDark.addEventListener("change", () => {
    settings.theme = dom.toggleDark.checked ? "dark" : "light";
    saveSettings(settings);
    applyTheme();
  });

  dom.toggleContrast.addEventListener("change", () => {
    settings.highContrast = dom.toggleContrast.checked;
    saveSettings(settings);
    applyTheme();
  });

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      closeModals();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "enter" || k === "backspace" || /^[a-z]$/.test(k)) {
      handleInput(k);
    }
  });
}

init();
