// Settings kept on this phone (Nik, 12 Nov): buzz on each phase, keep the screen awake. Both on by default.
import { call } from "./api";

const get = (k: string, d: boolean) => { try { const v = localStorage.getItem("lnl-" + k); return v === null ? d : v === "1"; } catch { return d; } };
const set = (k: string, v: boolean) => { try { localStorage.setItem("lnl-" + k, v ? "1" : "0"); } catch { /* storage blocked */ } };

export const prefs = {
  get buzz() { return get("buzz", true); }, set buzz(v: boolean) { set("buzz", v); },
  get awake() { return get("awake", true); }, set awake(v: boolean) { set("awake", v); },
};

// Phones without a vibration motor (and every iPhone) simply ignore this.
export const canBuzz = () => typeof navigator !== "undefined" && "vibrate" in navigator;
export function buzz(ms: number | number[] = 180) { if (!prefs.buzz) return; try { navigator.vibrate?.(ms); } catch { /* not supported */ } }

// Push notifications. The game server hands out its public key; the private one never leaves the database.
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
// iPhones only allow push once the site is added to the Home Screen.
export const needsHomeScreen = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as any).standalone;

const key = (b64: string) => { const p = "=".repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

export async function pushState(): Promise<"on" | "off" | "blocked" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}
export async function pushOn() {
  const perm = await Notification.requestPermission(); if (perm !== "granted") throw new Error("Notifications are blocked for this site. Allow them in your browser settings.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key((await call("pushKey")).key) }));
  await call("pushSubscribe", { sub: sub.toJSON() });
}
export async function pushOff() {
  const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription();
  if (sub) { await call("pushUnsubscribe", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
}
