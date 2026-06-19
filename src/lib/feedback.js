// Audio cues, haptic feedback, and screen wake-lock utilities.

let _audioCtx = null;
function audioCtx() {
  if (typeof window === "undefined") return null;
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) _audioCtx = new AC();
  }
  return _audioCtx;
}

function beep(freq = 880, duration = 0.12, type = "sine", gain = 0.08) {
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g); g.connect(ctx.destination);
  const now = ctx.currentTime;
  // Soft attack/release envelope for a warmer, less harsh tone.
  const attack = 0.012;
  const release = Math.min(0.18, duration * 0.6);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(gain, now + attack);
  g.gain.setValueAtTime(gain, now + Math.max(attack, duration - release));
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

// Play a gentle chord (array of frequencies) with a soft envelope.
function chord(freqs, duration = 0.4, type = "sine", gain = 0.05) {
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    const start = now + i * 0.04;
    const attack = 0.02;
    const release = Math.min(0.25, duration * 0.5);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gain, start + attack);
    g.gain.setValueAtTime(gain, start + Math.max(attack, duration - release));
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(g); g.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  });
}

export const CUE = {
  // Soft wood-like tick for countdown.
  tick:    () => beep(1320, 0.05, "triangle", 0.03),
  // Warm two-note rising chime for stage transitions.
  stage:   () => { beep(587, 0.16, "sine", 0.06); setTimeout(() => beep(880, 0.20, "sine", 0.06), 140); },
  // Gentle descending marimba-like tone for time-up.
  timeUp:  () => { beep(523, 0.22, "sine", 0.07); setTimeout(() => beep(392, 0.30, "sine", 0.07), 200); },
  // Bright major-third chime for correct answers.
  correct: () => chord([784, 988, 1319], 0.30, "sine", 0.045),
  // Soft low minor fall for wrong answers.
  wrong:   () => { beep(294, 0.20, "sine", 0.06); setTimeout(() => beep(220, 0.26, "sine", 0.06), 160); },
  // Pleasant ascending arpeggio for session completion.
  done:    () => { chord([523, 659, 784, 1047], 0.55, "sine", 0.05); },
};

export function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported */ }
}

let _wakeLock = null;
export async function acquireWakeLock() {
  try {
    if (navigator.wakeLock) _wakeLock = await navigator.wakeLock.request("screen");
  } catch { /* unsupported or denied */ }
}
export function releaseWakeLock() {
  try { if (_wakeLock?.release) { _wakeLock.release(); _wakeLock = null; } } catch { /* noop */ }
}