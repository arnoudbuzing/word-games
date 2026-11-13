/**
 * Zero-dependency Web Audio API sound synthesizer for Tilewise.
 * Initializes lazily on the first user gesture for mobile browser compatibility.
 */

let ctx = null;
let enabled = true;

function getContext() {
  if (!enabled) return null;
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) {
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function playTone({
  freq = 440,
  endFreq = null,
  duration = 0.08,
  type = "sine",
  gain = 0.08,
  delay = 0,
}) {
  const audio = getContext();
  if (!audio) return;

  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq !== null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFreq),
      start + duration
    );
  }

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp);
  amp.connect(audio.destination);

  osc.start(start);
  osc.stop(start + duration + 0.01);
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

export function playKey() {
  playTone({ freq: 520, endFreq: 600, duration: 0.045, type: "triangle", gain: 0.06 });
}

export function playBackspace() {
  playTone({ freq: 340, endFreq: 240, duration: 0.05, type: "triangle", gain: 0.055 });
}

export function playUiClick() {
  playTone({ freq: 640, endFreq: 500, duration: 0.04, type: "sine", gain: 0.05 });
}

export function playModalOpen() {
  playTone({ freq: 420, endFreq: 580, duration: 0.07, type: "sine", gain: 0.05 });
}

export function playModalClose() {
  playTone({ freq: 520, endFreq: 380, duration: 0.06, type: "sine", gain: 0.045 });
}

export function playInvalid() {
  playTone({ freq: 180, endFreq: 130, duration: 0.09, type: "sawtooth", gain: 0.05, delay: 0 });
  playTone({ freq: 160, endFreq: 115, duration: 0.11, type: "sawtooth", gain: 0.05, delay: 0.1 });
}

export function playReveal(state, colIndex = 0) {
  const step = colIndex * 28;
  if (state === "correct") {
    playTone({ freq: 587 + step, endFreq: 659 + step, duration: 0.11, type: "triangle", gain: 0.08 });
  } else if (state === "present") {
    playTone({ freq: 440 + step * 0.6, duration: 0.09, type: "sine", gain: 0.065 });
  } else {
    playTone({ freq: 240, endFreq: 200, duration: 0.07, type: "sine", gain: 0.045 });
  }
}

export function playWin() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    playTone({
      freq,
      duration: i === notes.length - 1 ? 0.28 : 0.12,
      type: "triangle",
      gain: 0.085,
      delay: i * 0.09,
    });
  });
}

export function playLose() {
  const notes = [349.23, 311.13, 277.18, 246.94];
  notes.forEach((freq, i) => {
    playTone({
      freq,
      duration: i === notes.length - 1 ? 0.28 : 0.14,
      type: "sine",
      gain: 0.065,
      delay: i * 0.11,
    });
  });
}
