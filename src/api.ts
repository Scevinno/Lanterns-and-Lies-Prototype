import { createClient } from "@supabase/supabase-js";

// Publishable values: safe in a web app, because the database's access rules decide what each player can read.
export const SUPABASE_URL = "https://iwqowwucksvbdcarxykr.supabase.co";
const PUBLISHABLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cW93d3Vja3N2YmRjYXJ4eWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDA1ODIsImV4cCI6MjEwNzgxNjU4Mn0.DIJ4HmYqJXQAaAqGltqtKNEv-QP3uyEY0upvuTnPqBU";
export const sb = createClient(SUPABASE_URL, PUBLISHABLE);

export async function call(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/game`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: PUBLISHABLE, Authorization: `Bearer ${session?.access_token ?? PUBLISHABLE}` },
    body: JSON.stringify({ action, ...body }),
  });
  const json = await res.json().catch(() => ({ error: "No connection." }));
  if (!res.ok || json.error) throw new Error(json.error ?? "Something went wrong.");
  return json;
}

// ---- The clock ----
// The phone's clock is only used to measure how far it is from the server's. The countdown is always
// "deadline minus server time now", never a number being ticked down, so a phone that sleeps can't drift.
let offset = 0;
export const serverNow = () => Date.now() + offset;
export async function syncClock() {
  let bestRtt = Infinity;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const { data, error } = await sb.rpc("server_time");
    const t1 = Date.now();
    if (error || !data) continue;
    if (t1 - t0 < bestRtt) { bestRtt = t1 - t0; offset = new Date(data as string).getTime() - (t0 + t1) / 2; }
  }
}

export const shareLink = (code: string) => `${location.origin}${import.meta.env.BASE_URL}#/join/${code}`;
export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
export const timerLabel = (s: number) => (s >= 60 ? `${s / 60} min` : `${s} s`);
export const FACTION_CLASS: Record<string, string> = { Lanternkeepers: "f-lk", Syndicate: "f-syn", Cartel: "f-car", Unbound: "f-ub" };
