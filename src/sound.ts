// A soft two-note chime for "your turn" in in-person nights (Nik, 26 Nov). Browsers only allow sound after a tap,
// so unlock() is called from the "eyes closed" button; until then chime() stays silent.
import { prefs } from "./prefs";

let ctx: AudioContext | null = null;
export function unlock() {
  try { ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); } catch { /* no audio */ }
}
export function chime() {
  if (!ctx || !prefs.buzz) return;
  const t = ctx.currentTime;
  for (const [f, at] of [[660, 0], [880, 0.18]] as const) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(0.18, t + at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.5);
    o.start(t + at); o.stop(t + at + 0.55);
  }
}
