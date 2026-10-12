// Small synthesized sound effects via the Web Audio API — no audio assets
// to host, works offline, tiny bundle cost. Each is a short envelope over
// one or two oscillators.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType = "sine", gain = 0.08) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + startOffset;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playTick() {
  tone(520, 0, 0.05, "square", 0.04);
}

export function playAccept() {
  tone(520, 0, 0.12, "sine");
  tone(780, 0.08, 0.18, "sine");
}

export function playSkip() {
  tone(420, 0, 0.09, "triangle", 0.06);
  tone(300, 0.06, 0.1, "triangle", 0.06);
}

export function playWin() {
  [520, 660, 880, 1040].forEach((f, i) => tone(f, i * 0.09, 0.22, "sine", 0.07));
}

export function playLose() {
  [420, 360, 300].forEach((f, i) => tone(f, i * 0.12, 0.3, "sawtooth", 0.05));
}

export function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // ignore — not every device/browser supports it
  }
}
