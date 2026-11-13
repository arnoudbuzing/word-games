/**
 * Rich Web Audio instrument synthesizer for Tilewise.
 * Models marimba, electric piano/kalimba, glockenspiel bells, and brass/pad
 * fanfares with a subtle room-reverb bus — zero external audio files required.
 */

let ctx = null;
let masterBus = null;
let reverbNode = null;
let enabled = true;

// Ascending C major scale for tile reveals
const REVEAL_CORRECT_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
const REVEAL_PRESENT_SCALE = [349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25];

function createRoomImpulse(audio, seconds = 0.55, decay = 3.2) {
  const rate = audio.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = audio.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return impulse;
}

function getAudio() {
  if (!enabled || typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!ctx) {
    ctx = new AudioCtx();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);

    reverbNode = ctx.createConvolver();
    reverbNode.buffer = createRoomImpulse(ctx);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.22;
    reverbNode.connect(wetGain);
    wetGain.connect(comp);

    masterBus = comp;
  }

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return { audio: ctx, dry: masterBus, wet: reverbNode };
}

/**
 * Play a harmonic instrument voice with optional filter envelope and reverb send.
 */
function playInstrument({
  freq,
  duration = 0.25,
  gain = 0.12,
  delay = 0,
  partials = [
    { ratio: 1, amp: 1, type: "triangle" },
    { ratio: 2, amp: 0.3, type: "sine" },
  ],
  attack = 0.006,
  filterFreq = 3600,
  reverbSend = 0.4,
}) {
  const sys = getAudio();
  if (!sys) return;
  const { audio, dry, wet } = sys;
  const start = audio.currentTime + delay;

  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(filterFreq, start);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(250, filterFreq * 0.35),
    start + duration
  );

  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  filter.connect(env);
  env.connect(dry);

  if (reverbSend > 0 && wet) {
    const send = audio.createGain();
    send.gain.value = reverbSend;
    env.connect(send);
    send.connect(wet);
  }

  for (const p of partials) {
    const osc = audio.createOscillator();
    const pGain = audio.createGain();
    osc.type = p.type || "sine";
    osc.frequency.setValueAtTime(freq * p.ratio, start);
    pGain.gain.value = p.amp;
    osc.connect(pGain);
    pGain.connect(filter);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }
}

/**
 * Short filtered noise burst for mallet/wood percussion transients.
 */
function playMalletClick({ freq = 1400, gain = 0.04, duration = 0.025, delay = 0 }) {
  const sys = getAudio();
  if (!sys) return;
  const { audio, dry } = sys;
  const start = audio.currentTime + delay;

  const len = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }

  const src = audio.createBufferSource();
  src.buffer = buf;

  const bp = audio.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(freq, start);
  bp.Q.value = 2.0;

  const env = audio.createGain();
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  src.connect(bp);
  bp.connect(env);
  env.connect(dry);

  src.start(start);
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

// Consistent soft marimba tap on letter entry
export function playKey() {
  playMalletClick({ freq: 1600, gain: 0.032, duration: 0.016 });
  playInstrument({
    freq: 440,
    duration: 0.075,
    gain: 0.08,
    filterFreq: 2000,
    reverbSend: 0.15,
    partials: [
      { ratio: 1, amp: 1, type: "sine" },
      { ratio: 4, amp: 0.14, type: "sine" },
    ],
  });
}

// Lower muted woodblock on backspace
export function playBackspace() {
  playMalletClick({ freq: 950, gain: 0.035, duration: 0.02 });
  playInstrument({
    freq: 220,
    duration: 0.075,
    gain: 0.08,
    filterFreq: 1100,
    reverbSend: 0.15,
    partials: [{ ratio: 1, amp: 1, type: "triangle" }],
  });
}

// Crisp kalimba pluck for UI clicks
export function playUiClick() {
  playInstrument({
    freq: 784,
    duration: 0.08,
    gain: 0.065,
    filterFreq: 2800,
    reverbSend: 0.25,
    partials: [
      { ratio: 1, amp: 1, type: "sine" },
      { ratio: 2, amp: 0.25, type: "triangle" },
    ],
  });
}

// Soft ascending harp pair on modal open
export function playModalOpen() {
  playInstrument({ freq: 523.25, duration: 0.14, gain: 0.06, delay: 0, reverbSend: 0.45 });
  playInstrument({ freq: 659.25, duration: 0.18, gain: 0.065, delay: 0.045, reverbSend: 0.45 });
}

// Soft descending harp pair on modal close
export function playModalClose() {
  playInstrument({ freq: 587.33, duration: 0.12, gain: 0.055, delay: 0, reverbSend: 0.35 });
  playInstrument({ freq: 440.0, duration: 0.15, gain: 0.05, delay: 0.04, reverbSend: 0.35 });
}

// Muted low brass/percussion double thud on invalid word
export function playInvalid() {
  for (let i = 0; i < 2; i++) {
    playInstrument({
      freq: i === 0 ? 155 : 138,
      duration: 0.13,
      gain: 0.09,
      delay: i * 0.11,
      filterFreq: 650,
      reverbSend: 0.15,
      partials: [
        { ratio: 1, amp: 1, type: "sawtooth" },
        { ratio: 0.5, amp: 0.5, type: "triangle" },
      ],
    });
  }
}

// Bell/Rhodes/Felt-piano reveal per tile
export function playReveal(state, colIndex = 0) {
  if (state === "correct") {
    const freq = REVEAL_CORRECT_SCALE[colIndex % REVEAL_CORRECT_SCALE.length];
    playMalletClick({ freq: 2600, gain: 0.03, duration: 0.015 });
    playInstrument({
      freq,
      duration: 0.28,
      gain: 0.11,
      filterFreq: 5200,
      reverbSend: 0.5,
      partials: [
        { ratio: 1, amp: 1, type: "sine" },
        { ratio: 2, amp: 0.35, type: "sine" },
        { ratio: 3, amp: 0.12, type: "triangle" },
      ],
    });
  } else if (state === "present") {
    const freq = REVEAL_PRESENT_SCALE[colIndex % REVEAL_PRESENT_SCALE.length];
    playInstrument({
      freq,
      duration: 0.2,
      gain: 0.09,
      filterFreq: 2200,
      reverbSend: 0.35,
      partials: [
        { ratio: 1, amp: 1, type: "triangle" },
        { ratio: 2, amp: 0.2, type: "sine" },
      ],
    });
  } else {
    playMalletClick({ freq: 650, gain: 0.028, duration: 0.02 });
    playInstrument({
      freq: 196,
      duration: 0.09,
      gain: 0.055,
      filterFreq: 800,
      reverbSend: 0.15,
      partials: [{ ratio: 1, amp: 1, type: "sine" }],
    });
  }
}

// Celebratory brass + glockenspiel fanfare on win
export function playWin() {
  const melody = [
    { freq: 523.25, delay: 0.0, dur: 0.16 },
    { freq: 659.25, delay: 0.09, dur: 0.16 },
    { freq: 783.99, delay: 0.18, dur: 0.16 },
    { freq: 1046.5, delay: 0.28, dur: 0.65 },
  ];

  // Bright glockenspiel / bell lead
  for (const note of melody) {
    playInstrument({
      freq: note.freq,
      duration: note.dur,
      gain: 0.11,
      delay: note.delay,
      filterFreq: 6000,
      reverbSend: 0.6,
      partials: [
        { ratio: 1, amp: 1, type: "sine" },
        { ratio: 2, amp: 0.4, type: "sine" },
        { ratio: 4, amp: 0.15, type: "sine" },
      ],
    });
  }

  // Warm C major 9 brass/pad chord swell on the final hit
  const chord = [261.63, 329.63, 392.0, 587.33];
  for (const freq of chord) {
    playInstrument({
      freq,
      duration: 0.75,
      gain: 0.055,
      delay: 0.28,
      attack: 0.035,
      filterFreq: 1800,
      reverbSend: 0.55,
      partials: [
        { ratio: 1, amp: 1, type: "triangle" },
        { ratio: 2, amp: 0.3, type: "sawtooth" },
      ],
    });
  }
}

// Expressive descending electric-piano cadence on loss
export function playLose() {
  const notes = [349.23, 311.13, 293.66, 261.63];
  notes.forEach((freq, i) => {
    playInstrument({
      freq,
      duration: i === notes.length - 1 ? 0.55 : 0.22,
      gain: 0.08,
      delay: i * 0.14,
      filterFreq: 1600,
      reverbSend: 0.45,
      partials: [
        { ratio: 1, amp: 1, type: "triangle" },
        { ratio: 2, amp: 0.18, type: "sine" },
      ],
    });
  });
}
