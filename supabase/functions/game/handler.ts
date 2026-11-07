// The game server. Every move goes through here; phones are never trusted with the rules or the clock.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { ROLES } from "../../../shared/roles.ts";
import {
  advance, canChat, cmdCondemn, cmdNight, cmdPause, cmdResume, isPaused, cmdReveal, cmdVerdict, cmdVote, createGame, forceAdvance, mathRng, PRIVATE_OPTIONS, privateView, publicView,
  type GameState, type Msg, type Timers,
} from "../../../shared/engine.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify({ ...(body as object), serverNow: Date.now() }), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Oops extends Error {}
const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function userOf(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Oops("Please sign in again.");
  return data.user;
}
const codeChars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => codeChars[Math.floor(Math.random() * codeChars.length)]).join("");
const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);

async function loadParty(id: string) {
  const { data, error } = await db.from("parties").select("*").eq("id", id).single();
  if (error || !data) throw new Oops("Party not found.");
  return data;
}
async function roster(id: string) {
  const { data } = await db.from("party_players").select("*").eq("party_id", id).order("joined_at");
  return data ?? [];
}
async function myPlayer(partyId: string, userId: string) {
  const { data } = await db.from("party_players").select("*").eq("party_id", partyId).eq("user_id", userId).maybeSingle();
  if (!data) throw new Oops("You are not in this party.");
  return data;
}
function secrets(s: GameState, rows: { id: string; user_id: string | null }[]) {
  return rows.map((r) => ({ player_id: r.id, user_id: r.user_id ?? "", view: { ...privateView(s, r.id), over: s.phase === "over" } }));
}
const toRows = (msgs: Msg[]) => msgs.map((m) => ({ channel: m.channel, recipient: m.to ?? "", sender: "Narrator", body: m.text }));

/** Runs one step against the latest state, retrying if another phone or the clock got there first. */
async function turn(partyId: string, step: (s: GameState) => Msg[]) {
  for (let i = 0; i < 8; i++) {
    const party = await loadParty(partyId);
    const { data: gs } = await db.from("game_state").select("state").eq("party_id", partyId).single();
    if (!gs) throw new Oops("The game has not started.");
    const s = gs.state as GameState; const before = s.phaseNo;
    const msgs = step(s); const rows = await roster(partyId);
    const events = s.phaseNo !== before ? [{ phase_no: s.phaseNo, kind: "phase", data: { phase: s.phase, day: s.day, night: s.night } }] : [];
    if (s.phase === "over" && party.status !== "finished") events.push({ phase_no: s.phaseNo, kind: "over", data: { winner: s.winner, winners: s.winners, players: s.players.map((p) => ({ name: p.name, role: p.role, alive: p.alive })) } as never });
    const patch = { phase: s.phase, phase_no: s.phaseNo, ends_at: isPaused(s) ? null : iso(s.endsAt), public_state: publicView(s), status: s.phase === "over" ? "finished" : "playing" };
    const { data: ok, error } = await db.rpc("apply_turn", { p_party: partyId, p_version: party.version, p_patch: patch, p_state: s, p_secrets: secrets(s, rows), p_msgs: toRows(msgs), p_events: events });
    if (error) throw error;
    if (ok) return;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  throw new Oops("The game is busy. Try again.");
}
async function beginGame(party: Record<string, any>) {
  const rows = await roster(party.id);
  if (rows.length !== party.size) { await db.rpc("apply_turn", { p_party: party.id, p_version: party.version, p_patch: { status: "lobby", ends_at: null }, p_state: null, p_secrets: [], p_msgs: [], p_events: [] }); return; }
  const mode = party.mode === "Random" ? (Math.random() < 0.5 ? "Syndicate" : "Cartel") : party.mode;
  const { state: s, msgs } = createGame({ players: rows.map((r) => ({ id: r.id, name: r.name, bot: r.is_bot })), mode, timers: party.timers as Timers, townChat: party.town_chat, inPerson: !!party.in_person }, mathRng, Date.now());
  const patch = { phase: s.phase, phase_no: s.phaseNo, ends_at: iso(s.endsAt), public_state: publicView(s), status: "playing" };
  const events = [{ phase_no: s.phaseNo, kind: "start", data: { mode, size: party.size, players: s.players.map((p) => ({ name: p.name, role: p.role })) } }];
  await db.rpc("apply_turn", { p_party: party.id, p_version: party.version, p_patch: patch, p_state: s, p_secrets: secrets(s, rows), p_msgs: toRows(msgs), p_events: events });
}
function validTimers(t: Record<string, number>): Timers {
  const out = {} as Timers;
  for (const k of Object.keys(PRIVATE_OPTIONS) as (keyof Timers)[]) { if (!PRIVATE_OPTIONS[k].includes(Number(t?.[k]))) throw new Oops("That timer is not available."); out[k] = Number(t[k]); }
  return out;
}

const actions: Record<string, (b: any, req: Request) => Promise<unknown>> = {
  async seed() {
    const { error } = await db.from("roles").upsert(ROLES.map(({ id, name, faction, type, summary, ability, knowledge, killing, gameplay, drawback, total, image, placeholder }) => ({ id, name, faction, type, summary, ability, knowledge, killing, gameplay, drawback, total, image, placeholder })));
    if (error) throw error; return { roles: ROLES.length };
  },
  // Prototype sign-up: creates a confirmed account, so trials don't depend on email delivery.
  async signup(b) {
    const name = clean(b.name, 20), email = clean(b.email, 120).toLowerCase(), password = String(b.password ?? "");
    if (name.length < 2) throw new Oops("Choose a name of at least 2 characters."); if (!email.includes("@")) throw new Oops("Enter a valid email."); if (password.length < 8) throw new Oops("Passwords need at least 8 characters.");
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
    if (error) throw new Oops(/already|registered|exists/i.test(error.message) ? "That email already has an account. Sign in instead." : error.message);
    await db.from("profiles").insert({ id: data.user.id, display_name: name }); return { ok: true };
  },
  async tick(b) {
    const party = await loadParty(b.party); const end = party.ends_at ? new Date(party.ends_at).getTime() : Infinity;
    if (Date.now() < end) return { waiting: true };
    if (party.status === "starting") { await beginGame(party); return { started: true }; }
    if (party.status === "playing") await turn(party.id, (s) => advance(s, Date.now(), mathRng));
    return { ok: true };
  },
  async createParty(b, req) {
    const u = await userOf(req); const size = Number(b.size); if (!(size >= 8 && size <= 15)) throw new Oops("Choose 8 to 15 players.");
    if (!["Syndicate", "Cartel", "Random"].includes(b.mode)) throw new Oops("Choose an evil side.");
    const { data: prof } = await db.from("profiles").select("display_name").eq("id", u.id).maybeSingle();
    const name = prof?.display_name ?? clean(u.user_metadata?.display_name, 20) ?? "Player";
    for (let i = 0; i < 6; i++) {
      const { data, error } = await db.from("parties").insert({ code: newCode(), created_by: u.id, size, mode: b.mode, timers: validTimers(b.timers), in_person: b.inPerson === true, town_chat: b.inPerson !== true }).select().single();
      if (error) continue;
      await db.from("party_players").insert({ party_id: data.id, user_id: u.id, name }); return { id: data.id, code: data.code };
    }
    throw new Oops("Could not create the party.");
  },
  async joinParty(b, req) {
    const u = await userOf(req); const code = clean(b.code, 8).toUpperCase();
    const { data: party } = await db.from("parties").select("*").eq("code", code).maybeSingle(); if (!party) throw new Oops("No party with that code.");
    const { data: mine } = await db.from("party_players").select("id").eq("party_id", party.id).eq("user_id", u.id).maybeSingle();
    if (mine) return { id: party.id, code };
    if (party.status !== "lobby") throw new Oops("That game has already started.");
    if ((await roster(party.id)).length >= party.size) throw new Oops("That party is full.");
    const { data: prof } = await db.from("profiles").select("display_name").eq("id", u.id).maybeSingle();
    await db.from("party_players").insert({ party_id: party.id, user_id: u.id, name: prof?.display_name ?? "Player" }); return { id: party.id, code };
  },
  async leaveParty(b, req) {
    const u = await userOf(req); const party = await loadParty(b.party);
    if (party.status === "playing") return { ok: true };
    if (party.status === "starting") await db.rpc("apply_turn", { p_party: party.id, p_version: party.version, p_patch: { status: "lobby", ends_at: null }, p_state: null, p_secrets: [], p_msgs: [], p_events: [] });
    await db.from("party_players").delete().eq("party_id", party.id).eq("user_id", u.id); return { ok: true };
  },
  // Prototype only: empty seats can be filled so one person can try a whole game.
  async addBots(b, req) {
    const u = await userOf(req); await myPlayer(b.party, u.id); const party = await loadParty(b.party); if (party.status !== "lobby") throw new Oops("The game has started.");
    const rows = await roster(party.id); const free = party.size - rows.length; if (free <= 0) return { ok: true };
    const n = rows.filter((r) => r.is_bot).length; const names = ["Agnes", "Bram", "Clara", "Dorn", "Elsie", "Finn", "Greta", "Hugo", "Ida", "Jonas", "Kit", "Lotte", "Milo", "Nell"];
    await db.from("party_players").insert(Array.from({ length: free }, (_, i) => ({ party_id: party.id, name: `${names[(n + i) % names.length]} (test)`, is_bot: true }))); return { ok: true };
  },
  async startGame(b, req) {
    const u = await userOf(req); await myPlayer(b.party, u.id); const party = await loadParty(b.party);
    if (party.status !== "lobby") throw new Oops("The game is already starting.");
    if ((await roster(party.id)).length !== party.size) throw new Oops(`The party needs ${party.size} players.`);
    await db.rpc("apply_turn", { p_party: party.id, p_version: party.version, p_patch: { status: "starting", ends_at: iso(Date.now() + 10_000) }, p_state: null, p_secrets: [], p_msgs: [], p_events: [] }); return { ok: true };
  },
  async cancelStart(b, req) {
    const u = await userOf(req); await myPlayer(b.party, u.id); const party = await loadParty(b.party);
    if (party.status === "starting") await db.rpc("apply_turn", { p_party: party.id, p_version: party.version, p_patch: { status: "lobby", ends_at: null }, p_state: null, p_secrets: [], p_msgs: [], p_events: [] }); return { ok: true };
  },
  async vote(b, req) { const u = await userOf(req); const me = await myPlayer(b.party, u.id); await turn(b.party, (s) => cmdVote(s, me.id, b.target ?? null, Date.now())); return { ok: true }; },
  async verdict(b, req) { const u = await userOf(req); const me = await myPlayer(b.party, u.id); await turn(b.party, (s) => { cmdVerdict(s, me.id, b.choice === "guilty" ? "guilty" : "innocent"); return []; }); return { ok: true }; },
  async night(b, req) { const u = await userOf(req); const me = await myPlayer(b.party, u.id); await turn(b.party, (s) => { cmdNight(s, me.id, { targets: Array.isArray(b.targets) ? b.targets : [], alert: !!b.alert, second: Array.isArray(b.second) ? b.second : undefined }, Date.now()); return []; }); return { ok: true }; },
  async reveal(b, req) { const u = await userOf(req); const me = await myPlayer(b.party, u.id); await turn(b.party, (s) => cmdReveal(s, me.id)); return { ok: true }; },
  async pause(b, req) { const u = await userOf(req); const me = await myPlayer(b.party, u.id); await turn(b.party, (s) => cmdPause(s, me.id, Date.now())); return { ok: true }; },
  async resume(b, req) { const u = await userOf(req); const me = await myPlayer(b.party, u.id); await turn(b.party, (s) => cmdResume(s, me.id, Date.now())); return { ok: true }; },
  async condemn(b, req) { const u = await userOf(req); const me = await myPlayer(b.party, u.id); await turn(b.party, (s) => cmdCondemn(s, me.id, b.target, Date.now(), mathRng)); return { ok: true }; },
  async skip(b, req) {
    const u = await userOf(req); await myPlayer(b.party, u.id);
    if (!(await roster(b.party)).some((r) => r.is_bot)) throw new Oops("Skipping is only for test games.");
    await turn(b.party, (s) => (isPaused(s) ? [] : forceAdvance(s, Date.now(), mathRng))); return { ok: true };
  },
  async chat(b, req) {
    const u = await userOf(req); const me = await myPlayer(b.party, u.id); const body = clean(b.body, 300); if (!body) return { ok: true };
    const { data: gs } = await db.from("game_state").select("state").eq("party_id", b.party).single(); const s = gs?.state as GameState; if (!s) throw new Oops("The game has not started.");
    const want = b.channel as string; if (!["town", "faction", "dead"].includes(want)) throw new Oops("Unknown chat.");
    if (!canChat(s, me.id, want)) throw new Oops("You cannot use this chat right now.");
    const p = s.players.find((x) => x.id === me.id)!;
    const channel = s.phase === "over" ? "town" : want === "faction" ? p.faction : want;
    const sender = want === "faction" && p.role === "Kingpin" ? "The Kingpin" : p.name;
    const { error } = await db.from("messages").insert({ party_id: b.party, channel, sender, body }); if (error) throw error; return { ok: true };
  },
};

export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json(); const fn = actions[b.action];
    if (!fn) return reply({ error: "Unknown action." }, 400);
    return reply(await fn(b, req));
  } catch (e) {
    const known = e instanceof Oops || (e instanceof Error && !/supabase|postgres|fetch/i.test(e.message));
    if (!known) console.error(e);
    return reply({ error: known ? (e as Error).message : "Something went wrong. Try again." }, 400);
  }
}
