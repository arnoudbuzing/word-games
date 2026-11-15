import {
  LETTER_STATE,
  PUBLIC_URL,
  calculateDiscoveryScore,
  calculateRoundScore,
  computeKeyboardStates,
  evaluateForVariant,
  formatShareText,
  getDailyNumber,
  getLocalDateKey,
  selectTargetWord,
  validateGuessForVariant,
} from "./engine.js?v=4";
import {
  MAX_MAX_GUESSES,
  MAX_WORD_LENGTH,
  MIN_MAX_GUESSES,
  MIN_WORD_LENGTH,
  createVariant,
} from "./variants.js";
import {
  addScore,
  clearGameState,
  loadGameState,
  loadScore,
  loadSettings,
  loadStats,
  recordGameResult,
  saveGameState,
  saveSettings,
} from "./storage.js?v=4";
import {
  playBackspace,
  playInvalid,
  playKey,
  playLose,
  playModalClose,
  playModalOpen,
  playReveal,
  playScorePenalty,
  playScoreUpdate,
  playUiClick,
  playWin,
  setSoundEnabled,
} from "./sound.js?v=4";
import { launchConfetti } from "./confetti.js";
import { hideEndRoundMascot, showEndRoundMascot } from "./mascot.js?v=5";

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
  "Nice!",
  "Got it!",
  "Close call!",
  "Phew!",
];

const dom = {
  html: document.documentElement,
  btnMenu: document.getElementById("btn-menu"),
  navMenu: document.getElementById("nav-menu"),
  headerTitle: document.getElementById("header-title"),
  headerBadge: document.getElementById("header-badge"),
  scoreDisplay: document.getElementById("score-display"),
  scoreDigits: document.getElementById("score-digits"),
  scoreDelta: document.getElementById("score-delta"),
  board: document.getElementById("board"),
  keyboard: document.getElementById("keyboard"),
  toastContainer: document.getElementById("toast-container"),
  backdrop: document.getElementById("modal-backdrop"),
  modals: {
    help: document.getElementById("modal-help"),
    mode: document.getElementById("modal-mode"),
    stats: document.getElementById("modal-stats"),
    qr: document.getElementById("modal-qr"),
    settings: document.getElementById("modal-settings"),
  },
  helpSummary: document.getElementById("help-summary"),
  playModeToggle: document.getElementById("play-mode-toggle"),
  wordLengthPicker: document.getElementById("word-length-picker"),
  maxGuessesPicker: document.getElementById("max-guesses-picker"),
  btnNewPractice: document.getElementById("btn-new-practice"),
  statsTitle: document.getElementById("stats-title"),
  statPlayed: document.getElementById("stat-played"),
  statWinPct: document.getElementById("stat-win-pct"),
  statStreak: document.getElementById("stat-streak"),
  statMaxStreak: document.getElementById("stat-max-streak"),
  guessDist: document.getElementById("guess-dist"),
  statsActions: document.getElementById("stats-actions"),
  btnShare: document.getElementById("btn-share"),
  btnShareResult: document.getElementById("btn-share-result"),
  btnPlayAgain: document.getElementById("btn-play-again"),
  toggleHard: document.getElementById("toggle-hard"),
  toggleDark: document.getElementById("toggle-dark"),
  toggleSound: document.getElementById("toggle-sound"),
  toggleContrast: document.getElementById("toggle-contrast"),
};

let settings = loadSettings();
let variant = createVariant(settings.wordLength, settings.maxGuesses);
let gameState = null;
let isAnimating = false;
let displayedScore = loadScore().total;

function init() {
  applyTheme();
  bindEvents();
  renderKeyboard();
  renderScoreOdometer(displayedScore, displayedScore, false);
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
  dom.toggleSound.checked = settings.sound;
  dom.toggleContrast.checked = settings.highContrast;
  setSoundEnabled(settings.sound);
}

function loadOrStartGame(forceNewPractice = false) {
  hideEndRoundMascot();
  variant = createVariant(settings.wordLength, settings.maxGuesses);
  const mode = settings.playMode;
  const dateKey = getLocalDateKey();

  let saved = forceNewPractice ? null : loadGameState(variant.id, mode);

  const isDailyStale =
    mode === "daily" && saved && saved.dateKey !== dateKey;

  if (
    !saved ||
    isDailyStale ||
    saved.wordLength !== variant.wordLength ||
    saved.maxGuesses !== variant.maxGuesses
  ) {
    saved = {
      variantId: variant.id,
      mode,
      dateKey,
      wordLength: variant.wordLength,
      maxGuesses: variant.maxGuesses,
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

function startNewGame() {
  if (settings.playMode !== "practice") {
    settings.playMode = "practice";
    saveSettings(settings);
  }
  clearGameState(variant.id, "practice");
  loadOrStartGame(true);
  playUiClick();
  showToast("New game started");
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
    const isCurrent =
      r === gameState.guesses.length && gameState.status === "playing";

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
  if (!dom.navMenu.classList.contains("hidden")) return;
  if (gameState.status !== "playing") return;

  if (key === "enter") {
    submitCurrentGuess();
    return;
  }

  if (key === "backspace") {
    if (gameState.currentGuess.length > 0) {
      gameState.currentGuess = gameState.currentGuess.slice(0, -1);
      updateCurrentRowUI(-1);
      playBackspace();
    }
    return;
  }

  if (/^[a-z]$/.test(key)) {
    if (gameState.currentGuess.length < variant.wordLength) {
      const idx = gameState.currentGuess.length;
      gameState.currentGuess += key;
      updateCurrentRowUI(idx);
      playKey();
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
    playInvalid();
    showToast(check.message);
    return;
  }

  const rowIndex = gameState.guesses.length;
  const evaluation = evaluateForVariant(guess, gameState.target, variant);
  const discoveryPoints = calculateDiscoveryScore(
    gameState.evaluations,
    evaluation,
    settings.hardMode
  );

  gameState.guesses.push(guess);
  gameState.evaluations.push(evaluation);
  gameState.currentGuess = "";
  gameState.roundScore = (gameState.roundScore || 0) + discoveryPoints;

  const won = evaluation.every((cell) => cell.state === LETTER_STATE.CORRECT);
  const lost = !won && gameState.guesses.length >= variant.maxGuesses;

  if (won) gameState.status = "won";
  else if (lost) gameState.status = "lost";

  const prevScore = displayedScore;
  let roundOutcomePoints = 0;

  if (won || lost) {
    const updatedStats = recordGameResult(
      variant.id,
      variant.maxGuesses,
      won,
      gameState.guesses.length
    );
    roundOutcomePoints = calculateRoundScore({
      wordLength: variant.wordLength,
      maxGuesses: variant.maxGuesses,
      guessesUsed: gameState.guesses.length,
      currentStreak: won ? Math.max(0, updatedStats.currentStreak - 1) : 0,
      hardMode: settings.hardMode,
      won,
    });
    gameState.roundScore += roundOutcomePoints;
  }

  saveGameState(variant.id, settings.playMode, gameState);

  const earnedThisTurn = discoveryPoints + roundOutcomePoints;
  const nextScoreTotal =
    earnedThisTurn !== 0
      ? addScore(earnedThisTurn, Math.max(0, gameState.roundScore)).total
      : displayedScore;

  animateRowReveal(rowIndex, evaluation, () => {
    updateKeyboardColors();
    if (won) {
      bounceRow(rowIndex);
      playWin();
      launchConfetti();
      showEndRoundMascot({
        won: true,
        points: Math.max(0, gameState.roundScore || 0),
      });
      if (nextScoreTotal !== prevScore) {
        setTimeout(() => {
          renderScoreOdometer(prevScore, nextScoreTotal, true);
          displayedScore = nextScoreTotal;
          if (nextScoreTotal > prevScore) {
            playScoreUpdate({ ticks: 8, chime: true });
          } else {
            playScorePenalty();
          }
        }, 380);
      }
      const msg =
        WIN_MESSAGES[Math.min(rowIndex, WIN_MESSAGES.length - 1)];
      showToast(msg, 2000);
      setTimeout(() => openModal("stats"), 1450);
    } else {
      if (nextScoreTotal !== prevScore) {
        renderScoreOdometer(prevScore, nextScoreTotal, true);
        displayedScore = nextScoreTotal;
        if (nextScoreTotal > prevScore) {
          playScoreUpdate({ ticks: 4, chime: false });
        } else {
          playScorePenalty();
        }
      }
      if (lost) {
        playLose();
        showEndRoundMascot({ won: false, points: 0 });
        showToast(gameState.target.toUpperCase(), 3500);
        setTimeout(() => openModal("stats"), 1400);
      }
    }
  });
}

function animateRowReveal(rowIndex, evaluation, onComplete) {
  isAnimating = true;
  const rowEl = dom.board.querySelector(`.board-row[data-row="${rowIndex}"]`);
  const tiles = rowEl.querySelectorAll(".tile");
  const stepMs = 200;

  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add("flip");
      setTimeout(() => {
        tile.dataset.state = evaluation[i].state;
        playReveal(evaluation[i].state, i);
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
    setTimeout(() => tile.classList.add("bounce"), i * 70);
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

function toggleNavMenu(forceOpen) {
  const shouldOpen =
    typeof forceOpen === "boolean"
      ? forceOpen
      : dom.navMenu.classList.contains("hidden");
  dom.navMenu.classList.toggle("hidden", !shouldOpen);
  dom.btnMenu.setAttribute("aria-expanded", String(shouldOpen));
}

function openModal(name) {
  toggleNavMenu(false);
  if (name === "stats") renderStatsModal();
  if (name === "mode") renderModeModal();
  if (name === "qr") {
    dom.btnShareResult.classList.toggle("hidden", gameState.status === "playing");
  }

  Object.values(dom.modals).forEach((m) => m.classList.add("hidden"));
  dom.modals[name].classList.remove("hidden");
  dom.backdrop.classList.remove("hidden");
  playModalOpen();
}

function closeModals() {
  if (!dom.backdrop.classList.contains("hidden")) {
    playModalClose();
  }
  dom.backdrop.classList.add("hidden");
  Object.values(dom.modals).forEach((m) => m.classList.add("hidden"));
}

function renderSegmentedNumbers(container, min, max, activeVal, onSelect) {
  container.innerHTML = "";
  for (let n = min; n <= max; n++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `seg-btn${n === activeVal ? " active" : ""}`;
    btn.textContent = String(n);
    btn.addEventListener("click", () => onSelect(n));
    container.appendChild(btn);
  }
}

function renderModeModal() {
  const modeButtons = dom.playModeToggle.querySelectorAll(".seg-btn");
  modeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === settings.playMode);
  });

  renderSegmentedNumbers(
    dom.wordLengthPicker,
    MIN_WORD_LENGTH,
    MAX_WORD_LENGTH,
    settings.wordLength,
    (len) => {
      if (settings.wordLength !== len) {
        playUiClick();
        settings.wordLength = len;
        saveSettings(settings);
        loadOrStartGame();
        renderModeModal();
      }
    }
  );

  renderSegmentedNumbers(
    dom.maxGuessesPicker,
    MIN_MAX_GUESSES,
    MAX_MAX_GUESSES,
    settings.maxGuesses,
    (guesses) => {
      if (settings.maxGuesses !== guesses) {
        playUiClick();
        settings.maxGuesses = guesses;
        saveSettings(settings);
        loadOrStartGame();
        renderModeModal();
      }
    }
  );
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
  dom.btnMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    playUiClick();
    toggleNavMenu();
  });

  document.addEventListener("click", (e) => {
    if (
      !dom.navMenu.classList.contains("hidden") &&
      !dom.navMenu.contains(e.target) &&
      e.target !== dom.btnMenu
    ) {
      toggleNavMenu(false);
    }
  });

  document.getElementById("menu-new-game").addEventListener("click", () => {
    toggleNavMenu(false);
    startNewGame();
  });
  document.getElementById("menu-setup").addEventListener("click", () => openModal("mode"));
  document.getElementById("menu-stats").addEventListener("click", () => openModal("stats"));
  document.getElementById("menu-help").addEventListener("click", () => openModal("help"));
  document.getElementById("menu-qr").addEventListener("click", () => openModal("qr"));
  document.getElementById("menu-settings").addEventListener("click", () => openModal("settings"));

  document.getElementById("btn-copy-link").addEventListener("click", async () => {
    playUiClick();
    try {
      await navigator.clipboard.writeText(PUBLIC_URL);
      showToast("Link copied");
    } catch {
      showToast("Could not copy link");
    }
  });

  document.getElementById("btn-mode").addEventListener("click", () => openModal("mode"));

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
        playUiClick();
        settings.playMode = nextMode;
        saveSettings(settings);
        loadOrStartGame();
        renderModeModal();
      }
    });
  });

  dom.btnNewPractice.addEventListener("click", () => {
    startNewGame();
    closeModals();
  });

  dom.btnPlayAgain.addEventListener("click", () => {
    startNewGame();
    closeModals();
  });

  dom.btnShare.addEventListener("click", () => {
    playUiClick();
    handleShare();
  });

  dom.btnShareResult.addEventListener("click", () => {
    playUiClick();
    handleShare();
  });

  dom.toggleHard.addEventListener("change", () => {
    if (
      dom.toggleHard.checked &&
      gameState.guesses.length > 0 &&
      gameState.status === "playing"
    ) {
      dom.toggleHard.checked = false;
      playInvalid();
      showToast("Hard mode can only be enabled at the start of a round");
      return;
    }
    playUiClick();
    settings.hardMode = dom.toggleHard.checked;
    saveSettings(settings);
  });

  dom.toggleDark.addEventListener("change", () => {
    playUiClick();
    settings.theme = dom.toggleDark.checked ? "dark" : "light";
    saveSettings(settings);
    applyTheme();
  });

  dom.toggleSound.addEventListener("change", () => {
    settings.sound = dom.toggleSound.checked;
    saveSettings(settings);
    setSoundEnabled(settings.sound);
    if (settings.sound) playUiClick();
  });

  dom.toggleContrast.addEventListener("change", () => {
    playUiClick();
    settings.highContrast = dom.toggleContrast.checked;
    saveSettings(settings);
    applyTheme();
  });

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      toggleNavMenu(false);
      closeModals();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "enter" || k === "backspace" || /^[a-z]$/.test(k)) {
      handleInput(k);
    }
  });
}

function createOdometerStrip(startDigit) {
  const col = document.createElement("span");
  col.className = "odometer-digit";

  const strip = document.createElement("span");
  strip.className = "odometer-strip";

  for (let pass = 0; pass < 2; pass++) {
    for (let d = 0; d <= 9; d++) {
      const cell = document.createElement("span");
      cell.className = "odometer-num";
      cell.textContent = String(d);
      strip.appendChild(cell);
    }
  }

  strip.style.transition = "none";
  strip.style.transform = `translateY(-${startDigit * 1.25}em)`;
  col.appendChild(strip);
  return { col, strip };
}

function renderScoreOdometer(fromScore, toScore, animate = false) {
  if (!dom.scoreDisplay || !dom.scoreDigits) return;

  const safeFrom = Math.max(0, Math.round(fromScore));
  const safeTo = Math.max(0, Math.round(toScore));
  dom.scoreDisplay.setAttribute("aria-label", `Score: ${safeTo}`);

  const toStr = String(safeTo);
  const fromStr = String(safeFrom).padStart(toStr.length, "0").slice(-toStr.length);
  const digitsCount = toStr.length;
  const isDecrease = safeTo < safeFrom;

  dom.scoreDigits.innerHTML = "";
  const strips = [];

  for (let i = 0; i < digitsCount; i++) {
    const rawStart = animate ? Number(fromStr[i]) : Number(toStr[i]);
    const endDigit = Number(toStr[i]);
    const placeValue = Math.pow(10, digitsCount - 1 - indexOrZero(i));
    const delta = Math.abs(safeTo - safeFrom);
    const shouldSpinFull = delta >= placeValue && endDigit === rawStart;

    let initialIdx = rawStart;
    let targetIdx = endDigit;

    if (animate && safeTo !== safeFrom) {
      if (isDecrease) {
        if (endDigit > rawStart || shouldSpinFull) {
          initialIdx = 10 + rawStart;
        }
        targetIdx = endDigit;
      } else {
        if (endDigit < rawStart || shouldSpinFull) {
          targetIdx = 10 + endDigit;
        }
      }
    }

    const { strip } = createOdometerStrip(initialIdx);
    dom.scoreDigits.appendChild(strip.parentElement);
    strips.push({ strip, initialIdx, targetIdx, endDigit, index: i });
  }

  if (!animate || safeTo === safeFrom) return;

  const delta = safeTo - safeFrom;
  if (dom.scoreDelta) {
    dom.scoreDelta.textContent = delta > 0 ? `+${delta}` : String(delta);
    dom.scoreDelta.classList.toggle("negative", delta < 0);
    dom.scoreDelta.classList.remove("active");
    void dom.scoreDelta.offsetWidth;
    dom.scoreDelta.classList.add("active");
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const { strip, initialIdx, targetIdx, endDigit, index } of strips) {
        if (targetIdx === initialIdx) continue;

        const durationMs = 640 + (digitsCount - 1 - index) * 70;
        const delayMs = index * 45;
        strip.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`;
        strip.style.transform = `translateY(-${targetIdx * 1.25}em)`;

        if (targetIdx >= 10) {
          strip.addEventListener(
            "transitionend",
            () => {
              strip.style.transition = "none";
              strip.style.transform = `translateY(-${endDigit * 1.25}em)`;
            },
            { once: true }
          );
        }
      }
    });
  });
}

function indexOrZero(i) {
  return i;
}

init();
