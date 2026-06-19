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
  g.gain.value = gain;
  osc.connect(g); g.connect(ctx.destination);
  const now = ctx.currentTime;
  osc.start(now);
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.stop(now + duration);
}

export const CUE = {
  tick:    () => beep(660, 0.06, "square", 0.04),
  stage:   () => { beep(523, 0.10, "sine", 0.07); setTimeout(() => beep(784, 0.12, "sine", 0.07), 110); },
  timeUp:  () => { beep(440, 0.18, "sawtooth", 0.09); setTimeout(() => beep(330, 0.22, "sawtooth", 0.09), 200); },
  correct: () => { beep(659, 0.08, "sine", 0.06); setTimeout(() => beep(988, 0.12, "sine", 0.06), 90); },
  wrong:   () => { beep(220, 0.18, "sawtooth", 0.08); setTimeout(() => beep(165, 0.22, "sawtooth", 0.08), 180); },
  done:    () => { beep(523, 0.12, "sine", 0.07); setTimeout(() => beep(659, 0.12, "sine", 0.07), 130); setTimeout(() => beep(784, 0.18, "sine", 0.07), 260); },
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