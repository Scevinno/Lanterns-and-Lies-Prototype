// Lanterns & Lies rules engine. Pure TypeScript with no dependencies: the server and the tests both run this.
// Rules: "Lanterns and Lies roles.xlsx" and "Lanterns and Lies roster.md". Time only ever comes from `now`.
import { ROLES, type Faction, type RoleDef } from "./roles.ts";

export type Phase = "reveal" | "discussion" | "vote" | "defence" | "verdict" | "night" | "dawn" | "over";
export interface Timers { discussion: number; vote: number; defence: number; verdict: number; night: number }
export const PUBLIC_TIMERS: Timers = { discussion: 240, vote: 30, defence: 30, verdict: 15, night: 60 };
export const PRIVATE_OPTIONS: Record<keyof Timers, number[]> = {
  discussion: [240, 420, 600, 900], vote: [30, 60], defence: [30, 60, 120], verdict: [15, 30], night: [60, 120, 300],
};
// Night comes first (Nik, 7 Nov): reveal, Night 1, Day 1, Night 2, Day 2 ... Night 7, Day 7. The game is decided at the end of Day 7.
export const REVEAL_SECONDS = 30, DAWN_SECONDS = 10, MAX_TRIALS = 3, MAX_DAYS = 7;

export interface Player {
  id: string; name: string; seat: number; bot: boolean; alive: boolean;
  role: string; faction: Faction; ability: string; // ability differs from role once a Medium channels
  framed?: boolean; snuffed?: boolean; disguisedAs?: string; debt?: boolean; collection?: boolean; debtNotified?: boolean;
  bribed?: boolean; bribedBy?: string; shipped?: boolean; revealed?: boolean; bullets?: number; selfHeal?: number; alerts?: number;
  priestUsed?: boolean; mediumUsed?: boolean; swindled?: boolean; recruited?: boolean; hasTrap?: boolean;
  guilt?: boolean; streak?: number; contract?: string[]; extTarget?: string; patrol?: string[]; learned?: string[];
  won?: boolean; wasStartFaction?: Faction; wasRaisedRogue?: boolean; diedDay?: number;
}
export interface Action { targets: string[]; alert?: boolean; second?: string[] }
export interface Msg { channel: "town" | "private"; to?: string; text: string }
export interface GameState {
  mode: "Syndicate" | "Cartel"; timers: Timers; townChat: boolean; phase: Phase; phaseNo: number; endsAt: number;
  day: number; night: number; players: Player[]; votes: Record<string, string>; verdicts: Record<string, "guilty" | "innocent">;
  accused: string | null; trial: number; actions: Record<string, Action>; trap: { hunter: string; target: string } | null;
  commanded: string | null; quietDays: number; hadGodfather: boolean; winner: string | null; winners: string[]; condemned: boolean;
  // In person: everyone is in one room. Town chat is off, roles stay hidden until peeked, and anyone can pause.
  inPerson?: boolean; pausedLeft?: number | null; pausedBy?: string | null;
  // What the party chose. A Random party never learns which evil side was dealt from the roster.
  setup?: "Syndicate" | "Cartel" | "Random";
}
export interface Rng { next(): number }
export const mathRng: Rng = { next: () => Math.random() };
export function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return { next() { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
}
const pick = <T,>(a: T[], r: Rng): T => a[Math.floor(r.next() * a.length)];
const shuffle = <T,>(a: T[], r: Rng): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const roleDef = (n: string): RoleDef => { const d = ROLES.find((x) => x.name === n); if (!d) throw new Error("Unknown role " + n); return d; };

// ---- Dealing: roster.md ----
const SIZES = [8, 9, 10, 11, 12, 13, 14, 15];
const LK = { Power: [1,1,1,1,1,1,1,1], Investigative: [1,2,2,2,2,2,2,2], Protective: [1,1,1,1,1,1,1,1], Killing: [1,1,1,1,1,1,1,1], Random: [1,1,1,2,3,3,4,4] };
const SYN = { Power: [1,1,1,1,1,1,1,1], Killing: [0,0,1,1,1,1,1,1], Random: [1,1,1,1,1,2,2,2] };
const CAR = { Power: [0,0,0,0,0,1,1,1], Killing: [1,1,1,1,1,1,1,1], Random: [1,1,2,2,2,1,1,2] };
/** The categories dealt for a player count and evil side, for the roster screen. Same tables as dealDeck. */
export interface RosterSlot { faction: Faction; category: string; count: number; roles: string[] }
export function rosterFor(size: number, mode: "Syndicate" | "Cartel"): RosterSlot[] {
  const i = SIZES.indexOf(size); if (i < 0) return [];
  const out: RosterSlot[] = [];
  const add = (faction: Faction, category: string, count: number, types: string[]) => { if (count > 0) out.push({ faction, category, count, roles: pool(faction, types) }); };
  const extra = mode === "Cartel" ? SYN.Power[i] + SYN.Killing[i] + SYN.Random[i] - (CAR.Power[i] + CAR.Killing[i] + CAR.Random[i]) : 0;
  for (const cat of ["Power", "Investigative", "Protective", "Killing"] as const) add("Lanternkeepers", cat, LK[cat][i], [cat]);
  if (LK.Random[i] + extra > 0) out.push({ faction: "Lanternkeepers", category: "Random", count: LK.Random[i] + extra, roles: ROLES.filter((x) => x.faction === "Lanternkeepers" && x.type !== "Power").map((x) => x.name) });
  const t = mode === "Syndicate" ? SYN : CAR;
  add(mode, "Power", t.Power[i], ["Power"]); add(mode, "Killing", t.Killing[i], ["Killing"]); add(mode, "Random", t.Random[i], ["Support", "Deceptive"]);
  add("Unbound", "Chaos", 1, ["Chaos"]); add("Unbound", "Killing", size === 15 ? 1 : 0, ["Killing"]);
  return out;
}
const UNIQUE_EXTRA = new Set(["Veteran", "Ferryman", "Priest", "Swindler"]);
export const isUnique = (n: string) => { const r = roleDef(n); return r.type === "Power" || r.type === "Protective" || r.faction === "Unbound" || ((r.faction === "Syndicate" || r.faction === "Cartel") && r.type === "Killing") || UNIQUE_EXTRA.has(n); };
const pool = (f: Faction, types: string[]) => ROLES.filter((r) => r.faction === f && types.includes(r.type)).map((r) => r.name);
const score = (deck: string[]) => deck.reduce((s, n) => s + roleDef(n).total + 2, 0);
function fill(slots: [string, string[]][], r: Rng): string[] | null {
  const used: string[] = [];
  for (const [, choices] of slots) { const c = choices.filter((x) => !(isUnique(x) && used.includes(x))); if (!c.length) return null; used.push(pick(c, r)); }
  return used;
}
export function dealDeck(size: number, mode: "Syndicate" | "Cartel", r: Rng): string[] {
  const i = SIZES.indexOf(size); if (i < 0) throw new Error("Games are for 8 to 15 players.");
  const t = mode === "Syndicate" ? SYN : CAR; const evilSlots: [string, string[]][] = [];
  for (let k = 0; k < t.Power[i]; k++) evilSlots.push(["Power", pool(mode, ["Power"])]);
  for (let k = 0; k < t.Killing[i]; k++) evilSlots.push(["Killing", pool(mode, ["Killing"])]);
  for (let k = 0; k < t.Random[i]; k++) evilSlots.push(["Random", pool(mode, ["Support", "Deceptive"])]);
  const lkRandom = ROLES.filter((x) => x.faction === "Lanternkeepers" && x.type !== "Power").map((x) => x.name);
  const lkSlots: [string, string[]][] = [];
  for (const cat of ["Power", "Investigative", "Protective", "Killing"] as const) for (let k = 0; k < LK[cat][i]; k++) lkSlots.push([cat, pool("Lanternkeepers", [cat])]);
  const extra = mode === "Cartel" ? SYN.Power[i] + SYN.Killing[i] + SYN.Random[i] - (CAR.Power[i] + CAR.Killing[i] + CAR.Random[i]) : 0;
  for (let k = 0; k < LK.Random[i] + extra; k++) lkSlots.push(["Random", lkRandom]);
  for (let e = 0; e < 200; e++) {
    const evil = fill(evilSlots, r); if (!evil) continue; const es = score(evil);
    for (let l = 0; l < 3000; l++) {
      const lk = fill(lkSlots, r); if (!lk) continue; const ratio = es / score(lk);
      if (ratio >= 0.4 && ratio <= 0.55) {
        const ub = [pick(pool("Unbound", ["Chaos"]), r)]; if (size === 15) ub.push(pick(pool("Unbound", ["Killing"]), r));
        return [...lk, ...evil, ...ub];
      }
    }
  }
  throw new Error("No balanced deal found.");
}

export function createGame(input: { players: { id: string; name: string; bot: boolean }[]; mode: "Syndicate" | "Cartel"; timers: Timers; townChat: boolean; inPerson?: boolean; setup?: "Syndicate" | "Cartel" | "Random" }, r: Rng, now: number): { state: GameState; msgs: Msg[] } {
  const deck = shuffle(dealDeck(input.players.length, input.mode, r), r);
  const players: Player[] = input.players.map((p, i) => {
    const d = roleDef(deck[i]);
    const pl: Player = { ...p, seat: i, alive: true, role: d.name, faction: d.faction, ability: d.name, wasStartFaction: d.faction };
    if (d.name === "Rogue") pl.bullets = 1; if (d.name === "Doctor") pl.selfHeal = 1; if (d.name === "Veteran") pl.alerts = 2; if (d.name === "Butcher") pl.streak = 0;
    pl.patrol = []; pl.learned = []; return pl;
  });
  const state: GameState = { mode: input.mode, timers: input.timers, townChat: input.townChat, phase: "reveal", phaseNo: 1, endsAt: now + REVEAL_SECONDS * 1000, day: 0, night: 0, players, votes: {}, verdicts: {}, accused: null, trial: 0, actions: {}, trap: null, commanded: null, quietDays: 0, hadGodfather: deck.includes("Godfather"), winner: null, winners: [], condemned: false, inPerson: !!input.inPerson, pausedLeft: null, pausedBy: null, setup: input.setup ?? input.mode };
  const msgs: Msg[] = [];
  for (const p of players) {
    if (p.role === "Exterminator") { const c = players.filter((x) => x.faction === "Lanternkeepers" && roleDef(x.role).type !== "Power"); const t = pick(c, r); p.extTarget = t.id; msgs.push({ channel: "private", to: p.id, text: `Your target is ${t.name}. You win if they are voted out during the Day.` }); }
    if (p.role === "Assassin") {
      const others = players.filter((x) => x.id !== p.id);
      const a = pick(others.filter((x) => x.faction === "Lanternkeepers"), r), b = pick(others.filter((x) => x.faction === input.mode), r);
      p.contract = [a.role, b.role]; msgs.push({ channel: "private", to: p.id, text: `Your contract names two roles: ${a.role} and ${b.role}.` });
    }
  }
  msgs.push({ channel: "town", text: "A new game begins in Emberhollow. Read your role." });
  return { state, msgs };
}

// ---- Helpers ----
const byId = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;
const alive = (s: GameState) => s.players.filter((p) => p.alive);
const isEvil = (p: Player) => p.faction === "Syndicate" || p.faction === "Cartel";
const isUK = (p: Player) => p.faction === "Unbound" && roleDef(p.role).type === "Killing";
const fogNight = (n: number) => n % 2 === 0;
// The Ferryman and Smuggler are Hold-immune (Nik, 7 Nov): a swap that redirects a Hold onto the swapper could otherwise cancel itself.
const IMMUNE_HOLD = new Set(["Locksmith", "Enforcer", "Quartermaster", "Ferryman", "Smuggler"]);
const IMMUNE_DETECT = new Set(["Godfather", "Kingpin", "Loan Shark", "Harbour Master"]);
const NO_VISIT = new Set(["Innkeeper", "Archivist", "Spy", "Outcast", "Judge", "Mayor", "Martyr", "Exterminator"]);
const NO_ASTRAY = new Set(["Seer", "Ferryman", "Assassin"]);
const HOLDERS = new Set(["Locksmith", "Enforcer", "Quartermaster"]);
const NO_BORROW = new Set(["Swindler", "Smuggler", "Ferryman", "Seer", "Tailor", "Assassin", "Coroner", "Veteran", "Priest", "Medium", "Kingpin", "Hunter", "Spy", "Archivist", "Innkeeper", "Judge", "Mayor", "Exterminator", "Martyr", "Outcast"]);
const baseDefence = (s: GameState, p: Player): number => {
  switch (p.role) {
    case "Godfather": case "Ashkeeper": case "Butcher": case "Exterminator": case "Assassin": case "Outcast": case "Harbour Master": return 1;
    case "Kingpin": return alive(s).some((x) => x.faction === "Cartel" && x.id !== p.id) ? 2 : 0;
    case "Hollowman": return fogNight(s.night) ? 0 : 2;
    default: return 0;
  }
};

export interface Slot { label: string; options: { id: string; name: string }[] }
export interface Prompt { label: string; slots: Slot[]; toggle?: string; toggleOn?: string; second?: boolean }
const opts = (ps: Player[]) => ps.map((p) => ({ id: p.id, name: p.name }));

/** What this player can choose tonight, or null. Candidate lists never reveal hidden roles. */
export function nightPrompt(s: GameState, p: Player): Prompt | null {
  if (!p.alive || s.phase !== "night") return null;
  if (p.collection) return { label: "Pay your Debt: choose who to pay", slots: [{ label: "Pay", options: opts(alive(s).filter((x) => x.id !== p.id)) }] };
  const others = alive(s).filter((x) => x.id !== p.id), all = alive(s), dead = s.players.filter((x) => !x.alive), one = (label: string, c = others): Prompt => ({ label, slots: [{ label: "Target", options: opts(c) }] });
  const prompt = abilityPrompt(s, p, p.ability, others, all, dead, one);
  if (prompt && s.commanded === p.id && prompt.slots.length === 1) prompt.second = true;
  return prompt;
}
function abilityPrompt(s: GameState, p: Player, ab: string, others: Player[], all: Player[], dead: Player[], one: (l: string, c?: Player[]) => Prompt): Prompt | null {
  switch (ab) {
    case "Loan Shark": return one("Put a player in Debt", others.filter((x) => x.faction !== "Cartel"));
    case "Swindler": return p.swindled ? null : { label: "Swap two players' roles (once per game)", slots: [{ label: "First", options: opts(all.filter((x) => !x.revealed)) }, { label: "Second", options: opts(all.filter((x) => !x.revealed)) }] };
    case "Pawnbroker": return one("Draw a visitor to your counter");
    case "Smuggler": case "Ferryman": return { label: "Swap two players", slots: [{ label: "First", options: opts(all) }, { label: "Second", options: opts(all) }] };
    case "Kingpin": { const crew = others.filter((x) => x.faction === "Cartel"); if (crew.length) return one("Command a Cartel member", crew.filter((x) => x.role !== "Foreman" && x.role !== "Swindler")); return p.recruited ? null : one("New crew: recruit a player as the Foreman"); }
    case "Harbour Master": { if (!fogNight(s.night)) return one("Passage: ship a player out for the Day", all); const crew = others.filter((x) => x.faction === "Cartel"); return crew.length ? one("Guns: arm a Cartel member", crew) : one("Guns: attack a player"); }
    case "Quartermaster": return one("Hold a player below deck");
    case "Forger": return one("Forge a player's results");
    case "Coroner": return dead.length ? { label: "Use a dead player's ability on a target", slots: [{ label: "Dead player", options: opts(dead) }, { label: "Target", options: opts(all) }] } : null;
    case "Paymaster": return one("Bribe a player");
    case "Notary": return one("Learn a player's exact role");
    case "Foreman": return one("Attack a player");
    case "Bodyguard": return one("Guard a player", others.filter((x) => !(x.revealed && x.faction === "Lanternkeepers")));
    case "Rogue": return s.night > 1 && (p.bullets ?? 0) > 0 ? one("Shoot a player") : null;
    case "Veteran": return (p.alerts ?? 0) > 0 ? { label: `Go on Alert (${p.alerts} left)`, slots: [], toggle: "Go on Alert", toggleOn: "On Alert tonight" } : null;
    // Reveal is a Night action (Nik, 7 Nov), from Night 2, announced at dawn.
    case "Mayor": case "Judge": return !p.revealed && s.night > 1 ? { label: `Reveal yourself as the ${p.ability}. The town hears it at dawn.`, slots: [], toggle: "Reveal at dawn", toggleOn: "Revealing at dawn" } : null;
    case "Priest": return !p.priestUsed && dead.length ? one("Raise a dead player (once per game)", dead) : null;
    case "Medium": return !p.mediumUsed && dead.length ? one("Channel a dead player (once per game)", dead) : null;
    case "Hunter": return fogNight(s.night) && p.hasTrap ? one("Set your trap on a player") : null;
    case "Doctor": return one("Heal a player", all.filter((x) => !(x.revealed && x.faction === "Lanternkeepers")).filter((x) => x.id !== p.id || (p.selfHeal ?? 0) > 0));
    case "Locksmith": return one("Lock a player in");
    case "Warden": { const last = p.patrol ?? []; const banned = last.length >= 2 && last[last.length - 1] === last[last.length - 2] ? last[last.length - 1] : null; return one("Patrol a player", others.filter((x) => x.id !== banned)); }
    case "Oracle": return one("Include a player in your Vision");
    case "Detective": return one("Investigate a player");
    case "Watchman": return one("Watch a player's house");
    case "Seer": { const c = others.filter((x) => !(x.revealed && x.faction === "Lanternkeepers")); return { label: "Learn whether two players are friends or enemies", slots: [{ label: "First", options: opts(c) }, { label: "Second", options: opts(c) }] }; }
    case "Tracker": return one("Follow a player");
    case "Constable": return one("Search a player's house");
    case "Fence": return one("Lead a player astray");
    case "Enforcer": return one("Hold a player");
    case "Mobster": return one("Choose who to attack", others.filter((x) => x.faction !== "Syndicate"));
    case "Tailor": return { label: "Disguise a Syndicate member", slots: [{ label: "Syndicate member", options: opts(all.filter((x) => x.faction === "Syndicate")) }, { label: "Disguised as", options: opts(s.players.filter((x) => x.faction !== "Syndicate")) }] };
    case "Framer": return one("Frame a player");
    case "Informant": return one("Check a player's exact role");
    case "Godfather": return one("Order a hit", others.filter((x) => x.faction !== "Syndicate"));
    case "Hollowman": return fogNight(s.night) ? null : one("Hollow a house");
    case "Ashkeeper": return { label: "Snuff out a lantern, or choose yourself for Lights out", slots: [{ label: "Target", options: opts(all) }] };
    case "Butcher": return s.night > 1 ? one("Murder a player") : null;
    case "Assassin": { const c = s.players.filter((x) => x.id !== p.id); return { label: "Name the two contract targets", slots: [{ label: "First", options: opts(c) }, { label: "Second", options: opts(c) }] }; }
    default: return null; // Innkeeper, Archivist, Spy, Exterminator, Martyr, Outcast
  }
}

// ---- Appearances ----
const appearsRole = (s: GameState, p: Player): Player => (p.disguisedAs ? byId(s, p.disguisedAs) : p);
function constableEvil(s: GameState, p: Player): boolean {
  if (p.framed || p.snuffed) return true;
  const a = appearsRole(s, p);
  if (a.faction === "Lanternkeepers") return false;
  if (IMMUNE_DETECT.has(a.role)) return false;
  if (a.role === "Martyr" || a.role === "Outcast") return false;
  return true;
}
const detectiveType = (s: GameState, p: Player) => (p.snuffed ? "Killing" : p.framed ? "Deceptive" : roleDef(appearsRole(s, p).role).type);
const exactRole = (p: Player, s: GameState, seesDisguise: boolean) => (p.snuffed ? "Ashkeeper" : seesDisguise ? appearsRole(s, p).role : p.role);
function seerGroup(s: GameState, p: Player): string {
  if (p.framed || p.snuffed) return "evil-look:" + p.id;
  const a = appearsRole(s, p);
  if (a.faction === "Lanternkeepers" || a.role === "Martyr" || a.role === "Outcast" || IMMUNE_DETECT.has(a.role)) return "good";
  if (a.faction === "Syndicate" || a.faction === "Cartel") return a.faction;
  return "enemy:" + p.id;
}

// ---- Night resolution ----
interface Act { actor: string; ab: string; targets: string[]; alert?: boolean; borrowed?: boolean; dead?: boolean }
interface Result { to: string; kind: "text" | "role" | "evil" | "type" | "names" | "count" | "friends"; value?: string | number | boolean | string[]; pre?: string; info: boolean; targetName?: string }

export function resolveNight(s: GameState, r: Rng): Msg[] {
  const msgs: Msg[] = [], say = (to: string, text: string) => msgs.push({ channel: "private", to, text });
  const P = (id: string) => byId(s, id); const living = alive(s);
  const acts: Act[] = []; const held = new Set<string>();
  const debtDue = living.filter((p) => p.collection).map((p) => p.id); const paid = new Set<string>();
  for (const p of living) {
    const a = s.actions[p.id]; if (!a) continue;
    if (p.collection) { if (a.targets[0]) acts.push({ actor: p.id, ab: "Pay", targets: [a.targets[0]] }); continue; }
    const legal = nightPrompt({ ...s, phase: "night" }, p);
    if (!legal) continue;
    if (legal.toggle && a.alert) { acts.push({ actor: p.id, ab: p.ability, targets: [], alert: true }); continue; }
    if (a.targets.length < legal.slots.length || !legal.slots.length) continue;
    const t = a.targets.slice(0, legal.slots.length);
    if (t.some((x, i) => !legal.slots[i].options.some((o) => o.id === x))) continue;
    if (legal.slots.length === 2 && t[0] === t[1]) continue;
    if (p.ability === "Coroner") {
      const d = P(t[0]); const priestSame = living.some((q) => q.ability === "Priest" && s.actions[q.id]?.targets[0] === d.id);
      say(p.id, `${d.name} was the ${d.role}.`);
      if (priestSame) { say(p.id, "The Priest raised that player, so you could not use them."); continue; }
      // The Coroner gives one living target, so only abilities that take exactly that can be borrowed.
      if (NO_BORROW.has(d.ability)) { say(p.id, "That ability cannot be used this way."); continue; }
      acts.push({ actor: p.id, ab: d.ability, targets: [t[1]], borrowed: true }); continue;
    }
    acts.push({ actor: p.id, ab: p.ability, targets: t });
    if (a.second?.[0] && s.commanded === p.id && a.second[0] !== t[0]) acts.push({ actor: p.id, ab: p.ability, targets: [a.second[0]] });
  }
  const has = (ab: string) => acts.filter((a) => a.ab === ab && !a.dead);
  // Hunter builds even when Held or led astray.
  for (const p of living) if (p.ability === "Hunter" && !fogNight(s.night)) p.hasTrap = true;

  // Swaps: the Ferryman first; a Smuggler's swap touching the same player fails. A Held swapper does not swap.
  const prelimHeld = new Set(acts.filter((a) => HOLDERS.has(a.ab)).map((a) => a.targets[0]));
  const swaps: [string, string, string][] = []; const swapped = new Set<string>();
  for (const a of [...has("Ferryman"), ...has("Smuggler")]) {
    if (prelimHeld.has(a.actor) && !IMMUNE_HOLD.has(P(a.actor).role)) continue;
    const [x, y] = a.targets; if (swapped.has(x) || swapped.has(y)) continue;
    swaps.push([x, y, a.actor]); swapped.add(x); swapped.add(y);
    say(x, "You were swapped tonight."); say(y, "You were swapped tonight.");
  }
  const mapSwap = (t: string) => { for (const [x, y] of swaps) { if (t === x) return y; if (t === y) return x; } return t; };
  const selfRedirectSwapper = new Map<string, string>();
  for (const a of acts) {
    if (a.ab === "Ferryman" || a.ab === "Smuggler" || a.ab === "Pay" && false) continue;
    a.targets = a.targets.map((t) => {
      const nt = P(t).alive ? mapSwap(t) : t;
      if (nt === a.actor && nt !== t && (a.ab === "Butcher" || a.ab === "Hollowman")) { const sw = swaps.find(([x, y]) => (x === t && y === nt) || (y === t && x === nt)); if (sw) selfRedirectSwapper.set(a.actor, sw[2]); }
      return nt;
    });
  }

  // Attack queue, filled from here on.
  type Atk = { target: string; level: number; source: string; reason: string; visitor: boolean };
  const atks: Atk[] = []; const attack = (target: string, level: number, source: string, reason: string, visitor = true) => atks.push({ target, level, source, reason, visitor });
  for (const [a, sw] of selfRedirectSwapper) attack(sw, 1, a, "a redirected killer");

  // The Fence and Pawnbroker work on a Holder's visit before the Hold lands (Nik, 7 Nov), unless a different Holder holds them.
  // Fence: the Hold goes to a neighbour instead. Pawnbroker: the Hold lands on the Pawnbroker.
  const neighbourOf = (cur: Player, actor: string, pool: Player[]) => pool.filter((x) => x.id !== cur.id && x.id !== actor).sort((u, v) => ((u.seat - cur.seat + 99) % s.players.length) - ((v.seat - cur.seat + 99) % s.players.length))[0];
  const holderActs = acts.filter((x) => HOLDERS.has(x.ab) && x.targets.length);
  const heldByAnother = (id: string, except: string) => !IMMUNE_HOLD.has(P(id).role) && holderActs.some((h) => h.actor !== except && h.targets[0] === id);
  for (const f of acts.filter((x) => x.ab === "Fence")) {
    const h = holderActs.find((x) => x.actor === f.targets[0]); if (!h || heldByAnother(f.actor, h.actor)) continue;
    const n = neighbourOf(P(h.targets[0]), h.actor, living); if (n) h.targets = [n.id];
  }
  for (const pb of acts.filter((x) => x.ab === "Pawnbroker")) {
    const h = holderActs.find((x) => x.actor === pb.targets[0]); if (!h || heldByAnother(pb.actor, h.actor)) continue;
    h.targets = [pb.actor];
  }

  // Holds.
  for (const a of acts.filter((x) => HOLDERS.has(x.ab))) {
    const t = P(a.targets[0]);
    if (!P(t.id).alive) continue;
    if (t.ability === "Butcher" || (t.ability === "Hollowman" && !fogNight(s.night))) attack(a.actor, t.ability === "Butcher" ? 1 : 2, t.id, "an attack on a Holder");
    if (IMMUNE_HOLD.has(t.role)) continue;
    held.add(t.id);
  }
  const heldNotes = new Set<string>();
  // A Hold stops every visit, including paying a Debt (Nik, 7 Nov): a Held debtor cannot pay and dies.
  const cancelHeld = () => { for (const a of acts) if (!a.dead && held.has(a.actor) && a.ab !== "Hunter-build") { a.dead = true; heldNotes.add(a.actor); } };
  cancelHeld();
  const qmHeld = new Set(acts.filter((a) => a.ab === "Quartermaster" && !a.dead).map((a) => a.targets[0]));

  // Godfather, Mobster: who really visits.
  const gf = has("Godfather")[0], mobLive = living.find((p) => p.ability === "Mobster"), mob = has("Mobster").find((a) => !a.borrowed);
  const hits: Act[] = [];
  const gfP = living.find((p) => p.ability === "Godfather");
  if (gf && !gf.borrowed) {
    if (mobLive && !held.has(mobLive.id)) { if (mob) { mob.targets = [gf.targets[0]]; hits.push(mob); } else { const m: Act = { actor: mobLive.id, ab: "Mobster", targets: [gf.targets[0]] }; acts.push(m); hits.push(m); } gf.dead = true; }
    else hits.push(gf);
  } else if (mob) { hits.push(mob); }
  for (const a of acts) if (a.borrowed && (a.ab === "Godfather" || a.ab === "Mobster")) hits.push(a);
  void gfP;

  // Redirects: Fence, then Pawnbroker. Holders' visits were already resolved above.
  for (const a of has("Fence")) {
    const t = P(a.targets[0]); for (const o of acts) {
      if (o.actor !== t.id || o.dead || NO_ASTRAY.has(o.ab) || o.ab === "Pay" || o.targets.length !== 1 || HOLDERS.has(o.ab)) continue;
      const cur = P(o.targets[0]); const pool = o.ab === "Priest" ? s.players.filter((x) => !x.alive) : living;
      const n = pool.filter((x) => x.id !== cur.id && x.id !== o.actor).sort((u, v) => ((u.seat - cur.seat + 99) % s.players.length) - ((v.seat - cur.seat + 99) % s.players.length))[0];
      if (n) o.targets = [n.id];
    }
  }
  for (const a of has("Pawnbroker")) for (const o of acts) if (o.actor === a.targets[0] && !o.dead && o.targets.length === 1 && !HOLDERS.has(o.ab)) o.targets = [a.actor];

  // Who visits whom.
  const isVisit = (a: Act) => !a.dead && !a.alert && a.targets.length > 0 && !NO_VISIT.has(a.ab);
  const visitTargets = (a: Act) => (a.ab === "Tailor" ? [a.targets[0]] : a.targets);
  const visitors = (id: string, ignore?: string) => acts.filter((a) => isVisit(a) && a.actor !== ignore && visitTargets(a).includes(id)).map((a) => a.actor).filter((v, i, x) => x.indexOf(v) === i);
  const allVisitorsOf = (id: string) => visitors(id).filter((v) => v !== id);

  // Hunter's trap.
  const defenceAdd = new Map<string, number>(); const addDef = (id: string, n: number) => defenceAdd.set(id, Math.max(defenceAdd.get(id) ?? 0, n));
  for (const q of qmHeld) addDef(q, 2);
  if (s.trap && P(s.trap.hunter).alive) {
    const vis = allVisitorsOf(s.trap.target).filter((v) => v !== s.trap!.hunter);
    if (vis.length) {
      const harm = vis.map(P).filter((v) => isEvil(v) || isUK(v)).sort((a, b) => Number(isEvil(b)) - Number(isEvil(a)));
      for (const v of vis.map(P)) if (v.faction === "Lanternkeepers" && !IMMUNE_HOLD.has(v.role)) held.add(v.id);
      cancelHeld();
      if (harm[0]) { attack(harm[0].id, 2, s.trap.hunter, "a trap"); addDef(s.trap.target, 2); }
      say(s.trap.hunter, "Your trap went off."); s.trap = null;
    }
  }
  for (const a of has("Hunter")) { s.trap = { hunter: a.actor, target: a.targets[0] }; P(a.actor).hasTrap = false; }

  // Protection.
  const healers = new Map<string, string[]>();
  const veterans = has("Veteran").filter((a) => a.alert);
  for (const v of veterans) { P(v.actor).alerts = (P(v.actor).alerts ?? 1) - 1; addDef(v.actor, 1); }
  // The Veteran's Powerful Attack can cancel a visitor's ability; only the Ferryman, Smuggler and Hollowman still act.
  const vetVictims = new Set<string>(); const vetVisited = new Map<string, string[]>();
  for (const v of veterans) { const vs = allVisitorsOf(v.actor); vetVisited.set(v.actor, vs); for (const u of vs) { attack(u, 2, v.actor, "the Veteran", false); vetVictims.add(u); } }
  for (const a of has("Doctor")) {
    if (vetVictims.has(a.actor)) continue;
    const t = a.targets[0]; healers.set(t, [...(healers.get(t) ?? []), a.actor]); addDef(t, 2);
    if (t === a.actor) P(a.actor).selfHeal = 0;
  }
  const lethalVet = (id: string) => vetVictims.has(id) && Math.max(baseDefence(s, P(id)), defenceAdd.get(id) ?? 0) < 2;
  for (const a of acts) if (!a.dead && lethalVet(a.actor) && !["Ferryman", "Smuggler", "Hollowman"].includes(a.ab)) a.dead = true;
  for (const inn of living.filter((p) => p.ability === "Innkeeper" && !held.has(p.id))) for (const u of allVisitorsOf(inn.id)) addDef(u, 1);
  const guards = new Map<string, string[]>(); for (const a of has("Bodyguard")) guards.set(a.targets[0], [...(guards.get(a.targets[0]) ?? []), a.actor]);

  // Marks made tonight, before anyone investigates.
  for (const a of has("Framer")) P(a.targets[0]).framed = true;
  for (const a of has("Tailor")) { P(a.targets[0]).disguisedAs = a.targets[1]; }
  const forged = new Set(has("Forger").map((a) => a.targets[0]));
  for (const a of has("Ashkeeper")) if (a.targets[0] !== a.actor) P(a.targets[0]).snuffed = true;
  for (const ash of living.filter((p) => p.ability === "Ashkeeper")) { const vs = allVisitorsOf(ash.id); for (const u of vs) P(u).snuffed = true; if (vs.length) say(ash.id, `Visitors tonight: ${vs.map((u) => P(u).name).join(", ")}.`); }
  const hasLS = (id: string) => has("Pay").some((a) => a.actor === id && P(a.targets[0]).role === "Loan Shark");
  for (const a of has("Pay")) if (hasLS(a.actor)) paid.add(a.actor);
  for (const a of has("Loan Shark")) { const t = P(a.targets[0]); if (t.faction !== "Cartel") t.debt = true; }
  for (const ls of living.filter((p) => p.role === "Loan Shark")) for (const u of allVisitorsOf(ls.id)) { const v = P(u); if (!v.debt && !paid.has(u) && v.faction !== "Cartel") v.debt = true; }
  for (const a of has("Paymaster")) { const t = P(a.targets[0]); if (roleDef(t.role).type !== "Power") { t.bribed = true; t.bribedBy = a.actor; } }
  for (const a of has("Harbour Master")) {
    if (!fogNight(s.night)) { P(a.targets[0]).shipped = true; }
    else {
      const t = P(a.targets[0]);
      if (t.faction === "Cartel" && t.id !== a.actor) { for (const o of acts.filter((x) => x.actor === t.id && isVisit(x))) for (const v of visitTargets(o)) if (v !== t.id) attack(v, 1, t.id, "Guns"); }
      else attack(t.id, 1, a.actor, "Guns");
    }
  }

  // Attacks.
  for (const a of hits) if (!a.dead) attack(a.targets[0], 1, a.actor, a.ab === "Godfather" ? "the Godfather" : "the Syndicate");
  for (const a of has("Foreman")) attack(a.targets[0], 1, a.actor, "the Foreman");
  for (const a of has("Rogue")) { attack(a.targets[0], 1, a.actor, "the Rogue"); if (!a.borrowed) P(a.actor).bullets = 0; }
  for (const p of living) if (p.guilt) { attack(p.id, 3, p.id, "guilt", false); p.guilt = false; }
  const butchers = has("Butcher");
  for (const p of living.filter((q) => q.ability === "Butcher")) { if (!butchers.some((b) => b.actor === p.id)) p.streak = 0; }
  for (const a of butchers) { const b = P(a.actor), t = a.targets[0]; attack(t, 1, a.actor, "the Butcher"); if ((b.streak ?? 0) >= 2) for (const u of allVisitorsOf(t)) if (u !== a.actor) attack(u, 1, a.actor, "the Butcher's Rampage"); }
  for (const a of has("Hollowman")) { const t = a.targets[0]; attack(t, 2, a.actor, "the Hollowman"); for (const u of allVisitorsOf(t)) if (u !== a.actor) attack(u, 2, a.actor, "the Hollowman"); }
  for (const a of has("Assassin")) {
    const me = P(a.actor), roles = a.targets.map((t) => P(t).role).sort(), want = [...(me.contract ?? [])].sort();
    if (me.contract && roles[0] === want[0] && roles[1] === want[1]) { for (const t of a.targets) if (P(t).alive) attack(t, 3, a.actor, "the Assassin", false); me.won = true; say(a.actor, "You found both targets. Your contract is complete."); }
  }
  for (const a of has("Ashkeeper")) if (a.targets[0] === a.actor) for (const p of living) if (p.snuffed) attack(p.id, 3, a.actor, "Lights out", false);
  for (const id of debtDue) if (!paid.has(id)) attack(id, 3, id, "an unpaid Debt", false);
  for (const id of debtDue) { const p = P(id); p.collection = false; if (paid.has(id)) p.debt = false; p.debtNotified = false; }

  // Apply attacks, in order, with Bodyguards and the Doctor-Hollowman rule.
  const queue = [...atks]; const killers = new Map<string, string[]>(); const dying = new Set<string>(); const usedGuard = new Set<string>();
  const NOGUARD = new Set(["the Veteran", "an unpaid Debt", "Lights out", "the Assassin", "guilt", "a trap", "a Bodyguard"]);
  const defenceOf = (id: string) => Math.max(baseDefence(s, P(id)), defenceAdd.get(id) ?? 0);
  while (queue.length) {
    const a = queue.shift()!; if (!P(a.target).alive) continue;
    if (a.reason === "the Hollowman" && (healers.get(a.target) ?? []).length) { for (const d of healers.get(a.target)!) { dying.add(d); killers.set(d, [...(killers.get(d) ?? []), a.source]); } continue; }
    const gs = (guards.get(a.target) ?? []).filter((g) => !usedGuard.has(g));
    if (gs.length && !NOGUARD.has(a.reason) && a.visitor) {
      const g = gs[0]; usedGuard.add(g);
      queue.push({ target: a.source, level: 2, source: g, reason: "a Bodyguard", visitor: false }, { target: g, level: 2, source: a.source, reason: "a Bodyguard", visitor: false });
      say(a.target, "Someone protected you from an attack tonight."); continue;
    }
    if (a.level > defenceOf(a.target)) { dying.add(a.target); killers.set(a.target, [...(killers.get(a.target) ?? []), a.source]); }
    else if (a.level > 0) say(a.target, "You were attacked tonight, but survived.");
    if (a.reason === "the Butcher" && dying.has(a.target)) P(a.source).streak = (P(a.source).streak ?? 0) + 1;
    if (a.reason === "the Rogue" && dying.has(a.target) && P(a.target).faction === "Lanternkeepers") P(a.source).guilt = true;
  }
  for (const v of veterans) { const n = (vetVisited.get(v.actor) ?? []).filter((u) => dying.has(u)).length; say(v.actor, `Your Alert killed ${n} visitor${n === 1 ? "" : "s"}.`); }

  // Investigations. A false result is produced on a Fog Night while the Hollowman lives, and for a Forged investigator.
  const fog = fogNight(s.night) && living.some((p) => p.ability === "Hollowman" && !dying.has(p.id));
  const results: Result[] = [];
  const res = (to: string, kind: Result["kind"], value: Result["value"], pre: string, info = true) => results.push({ to, kind, value, pre, info });
  const names = (ids: string[]) => ids.map((x) => P(x).name);
  for (const a of acts) {
    if (a.dead || !a.targets.length) continue; const t = P(a.targets[0]);
    switch (a.ab) {
      case "Constable": res(a.actor, "evil", constableEvil(s, t), t.name); break;
      case "Detective": res(a.actor, "type", detectiveType(s, t), t.name); break;
      case "Notary": res(a.actor, "role", exactRole(t, s, true), t.name); break;
      case "Informant": res(a.actor, "role", exactRole(t, s, false), t.name); break;
      case "Watchman": { const vs = allVisitorsOf(t.id).filter((v) => v !== a.actor).map((v) => P(v).disguisedAs ?? v); res(a.actor, "names", names(vs), `Visitors to ${t.name}`); break; }
      case "Tracker": { const o = acts.filter((x) => x.actor === t.id && isVisit(x)).flatMap(visitTargets); res(a.actor, "names", names(o), `${t.name} visited`); break; }
      case "Seer": { const [x, y] = a.targets.map(P); res(a.actor, "friends", seerGroup(s, x) === seerGroup(s, y), `${x.name} and ${y.name}`); break; }
      case "Oracle": {
        const good = (p: Player) => !constableEvil(s, p), pool2 = living.filter((p) => p.id !== a.actor && p.id !== t.id);
        const lkAlive = living.some((p) => p.id !== a.actor && p.faction === "Lanternkeepers");
        if (!lkAlive) { res(a.actor, "text", "Your power can no longer be used.", "", false); break; }
        const bad = shuffle(pool2.filter((p) => !good(p)), r), rest = shuffle(pool2.filter((p) => !bad.slice(0, 1).includes(p)), r);
        const trio = [t, ...(good(t) && bad[0] ? [bad[0]] : []), ...rest].slice(0, 3);
        res(a.actor, "names", names(shuffle(trio.map((p) => p.id), r)), "Your Vision shows"); results[results.length - 1].targetName = t.name; break;
      }
      case "Loan Shark": res(a.actor, "role", t.role, t.name); break;
      case "Warden": { const pa = P(a.actor).patrol ?? []; P(a.actor).patrol = [...pa, t.id].slice(-2); break; }
      case "Fence": case "Pawnbroker": break;
      default: break;
    }
  }
  for (const ls of living.filter((p) => p.role === "Loan Shark")) for (const u of allVisitorsOf(ls.id)) res(ls.id, "role", P(u).role, `${P(u).name} visited you:`);
  for (const p of living) {
    if (p.ability === "Spy" && !held.has(p.id)) res(p.id, "count", acts.filter((a) => isVisit(a) && isEvil(P(a.actor)) && !(P(a.actor).disguisedAs && P(P(a.actor).disguisedAs!).faction === "Lanternkeepers")).length, "Evil visits tonight:");
    if (p.ability === "Archivist" && !held.has(p.id)) {
      const roles = [...new Set(living.map((x) => x.role))].filter((x) => !(p.learned ?? []).includes(x) && x !== "Archivist");
      if (roles.length) { const c = pick(roles, r); p.learned = [...(p.learned ?? []), c]; const n = living.filter((x) => x.role === c).length; res(p.id, "role", c + (n > 1 ? ` (${n} alive)` : ""), "A living role:"); }
    }
  }
  const gameRoles = [...new Set(s.players.map((p) => p.role))];
  const allRoles = ROLES.map((x) => x.name), TYPES = ["Investigative", "Protective", "Support", "Killing", "Power", "Deceptive", "Chaos"];
  const falsify = (x: Result): Result => {
    const others = s.players.map((p) => p.name);
    switch (x.kind) {
      case "evil": return { ...x, value: !x.value };
      case "friends": return { ...x, value: !x.value };
      case "type": return { ...x, value: pick(TYPES.filter((t) => t !== x.value), r) };
      case "role": return { ...x, value: pick((gameRoles.length > 1 ? gameRoles : allRoles).filter((t) => t !== x.value), r) };
      case "count": return { ...x, value: Number(x.value) + 1 + Math.floor(r.next() * 2) };
      case "names": { const cur = (x.value as string[]); const n = Math.max(1, cur.length); return { ...x, value: shuffle(others.filter((o) => !cur.includes(o)), r).slice(0, n) }; }
      default: return x;
    }
  };
  // Fog Night (Nik, 7 Nov): results are random, so they may be right or wrong and can't be decoded by flipping them.
  // A Forged result is always wrong (falsify above), Fog or not. Nobody's choices or visits change, only the result text.
  const evilAlive = living.filter(isEvil).length;
  const randomise = (x: Result): Result => {
    const pool = living.filter((p) => p.id !== x.to).map((p) => p.name);
    switch (x.kind) {
      case "evil": case "friends": return { ...x, value: r.next() < 0.5 };
      case "type": return { ...x, value: pick(TYPES, r) };
      case "role": return { ...x, value: pick(gameRoles, r) };
      case "count": return { ...x, value: Math.floor(r.next() * (evilAlive + 1)) };
      case "names": {
        if (x.targetName) return { ...x, value: shuffle([x.targetName, ...shuffle(pool.filter((n) => n !== x.targetName), r).slice(0, 2)], r) };
        return { ...x, value: shuffle(pool, r).slice(0, Math.floor(r.next() * 3)) };
      }
      default: return x;
    }
  };
  const finalResults = results.map((x) => (!x.info ? x : forged.has(x.to) ? falsify(x) : fog ? randomise(x) : x));
  const render = (x: Result) => {
    switch (x.kind) {
      case "evil": return `${x.pre} is ${x.value ? "Evil" : "Innocent"}.`;
      case "type": return `${x.pre} is a ${x.value} role.`;
      case "role": return `${x.pre}: ${x.value}.`.replace("::", ":");
      case "names": return (x.value as string[]).length ? `${x.pre}: ${(x.value as string[]).join(", ")}.` : `${x.pre}: nobody.`;
      case "count": return `${x.pre} ${x.value}.`;
      case "friends": return `${x.pre} are ${x.value ? "friends" : "enemies"}.`;
      default: return String(x.value);
    }
  };
  // Night order (Nik, 7 Nov, after the Town of Salem night order): swaps and Holds, then the Unbound, the evil side,
  // Lanternkeeper Killing and Protective. All of those act even if they die tonight. Lanternkeeper Investigative and
  // Power roles resolve last, once kills are settled, so one who dies tonight learns nothing.
  const silenced = (id: string) => { const p = P(id); const t = roleDef(p.ability).type; return dying.has(id) && p.faction === "Lanternkeepers" && (t === "Investigative" || t === "Power"); };
  const delivered = finalResults.filter((x) => !silenced(x.to));
  for (const x of delivered) say(x.to, render(x));
  for (const a of has("Warden")) {
    const t = a.targets[0]; if (silenced(a.actor)) continue;
    for (const x of delivered) if (x.to === t) say(a.actor, `Your target's result: ${render(x)}`);
    if (dying.has(t)) say(a.actor, `Your target was killed by ${(killers.get(t) ?? []).map((k) => P(k).name).join(", ")}.`);
  }
  for (const id of heldNotes) say(id, "You were Held tonight and could not act.");

  // Deaths and everything that follows them.
  const deadTonight = [...dying];
  for (const id of deadTonight) { const p = P(id); p.alive = false; p.diedDay = s.day; }
  if (deadTonight.some((id) => P(id).role === "Loan Shark")) for (const p of s.players) { p.debt = false; p.collection = false; }
  for (const p of s.players) if (p.ability === "Hunter" && !p.alive && s.trap?.hunter === p.id) s.trap = null;
  // An Exterminator whose target dies in the Night becomes the Martyr (Nik, 7 Nov): they win if they are voted out themselves.
  for (const p of alive(s)) if (p.role === "Exterminator" && p.extTarget && deadTonight.includes(p.extTarget) && !p.won) { setRole(p, "Martyr"); say(p.id, "Your target died in the night. You are now the Martyr: you win if you are voted out."); }
  for (const a of has("Medium")) {
    if (P(a.actor).alive === false) continue; const d = P(a.targets[0]); P(a.actor).mediumUsed = true;
    // The Medium becomes the dead Lanternkeeper's role for the rest of the game, with fresh uses (Nik, 7 Nov).
    // It fails on anyone who was not a Lanternkeeper, so the Medium can never turn evil, and on any Power role.
    const dd = roleDef(d.role), m = P(a.actor);
    if (d.faction !== "Lanternkeepers") say(a.actor, "Channelling failed: they were not a Lanternkeeper.");
    else if (dd.type === "Power") say(a.actor, "Channelling failed: a Power role cannot be channelled.");
    else {
      setRole(m, d.role);
      m.bullets = d.role === "Rogue" ? 1 : undefined; m.alerts = d.role === "Veteran" ? 2 : undefined; m.selfHeal = d.role === "Doctor" ? 1 : undefined;
      m.priestUsed = false; m.mediumUsed = false; m.hasTrap = false; m.patrol = []; m.learned = [];
      say(a.actor, `You are now the ${d.role}.`);
    }
  }
  const raised: string[] = [];
  for (const a of has("Priest")) {
    if (!P(a.actor).alive) continue; P(a.actor).priestUsed = true; const d = P(a.targets[0]);
    if (deadTonight.includes(d.id)) continue;
    d.alive = true; raised.push(d.id); if (d.role === "Rogue") d.bullets = 1;
    // Raised players come back clean (Nik, 7 Nov): no effect from before their death carries over.
    d.debt = false; d.collection = false; d.debtNotified = false; d.snuffed = false; d.framed = false; d.bribed = false; d.bribedBy = undefined; d.shipped = false; d.disguisedAs = undefined; d.guilt = false; if (d.role === "Butcher") d.streak = 0;
    say(d.id, "The Priest has raised you from the dead.");
  }
  const recruitedTonight = new Set<string>();
  for (const a of has("Kingpin")) {
    const me = P(a.actor); if (!me.alive) continue;
    if (!living.some((x) => x.faction === "Cartel" && x.id !== me.id && !deadTonight.includes(x.id)) && !me.recruited && !alive(s).some((x) => x.faction === "Cartel" && x.id !== me.id)) {
      me.recruited = true; const t = P(a.targets[0]); const d = roleDef(t.role);
      if (t.alive && d.type !== "Power" && !(d.faction === "Unbound" && d.type === "Killing")) setRole(t, "Foreman"), recruitedTonight.add(t.id), say(t.id, "You have been recruited. You are now the Foreman."); else say(a.actor, "Your recruit failed.");
    }
  }
  // Swindler (Nik, 7 Nov): fails on a Revealed player, on a player the Kingpin recruited tonight, and on a player who died tonight.
  // It resolves before Reveals, so a Mayor or Judge whose role is swapped tonight does not Reveal.
  const swindledTonight = new Set<string>();
  for (const a of has("Swindler")) {
    P(a.actor).swindled = true; const [x, y] = a.targets.map(P);
    if (x.revealed || y.revealed || !x.alive || !y.alive || recruitedTonight.has(x.id) || recruitedTonight.has(y.id)) { say(a.actor, "Your swap failed."); continue; }
    swindledTonight.add(x.id); swindledTonight.add(y.id);
    { const rx = x.role, ry = y.role; const carry = (p: Player, q: Player) => { const b = p.bullets, h = p.selfHeal, al = p.alerts, pu = p.priestUsed, mu = p.mediumUsed, et = p.extTarget, ct = p.contract, st = p.streak; p.bullets = q.bullets; p.selfHeal = q.selfHeal; p.alerts = q.alerts; p.priestUsed = q.priestUsed; p.mediumUsed = q.mediumUsed; p.extTarget = q.extTarget; p.contract = q.contract; p.streak = q.streak; q.bullets = b; q.selfHeal = h; q.alerts = al; q.priestUsed = pu; q.mediumUsed = mu; q.extTarget = et; q.contract = ct; q.streak = st; }; carry(x, y); setRole(x, ry); setRole(y, rx); say(x.id, `Your role was swapped. You are now the ${ry}.`); say(y.id, `Your role was swapped. You are now the ${rx}.`);
      // Handed the Exterminator role while being its target: become the Martyr at once (Nik, 7 Nov).
      for (const z of [x, y]) if (z.role === "Exterminator" && z.extTarget === z.id) { setRole(z, "Martyr"); say(z.id, "You are your own target. You are now the Martyr: you win if you are voted out."); } }
  }
  // Reveals: not if Held (the act was cancelled), not if the role was swapped tonight, not if dead.
  const revealedTonight: string[] = [];
  for (const a of acts) if (!a.dead && a.alert && (a.ab === "Mayor" || a.ab === "Judge") && P(a.actor).alive && !P(a.actor).revealed && !swindledTonight.has(a.actor)) { P(a.actor).revealed = true; revealedTonight.push(a.actor); }
  succession(s, r, say);
  if (deadTonight.length) {
    for (const id of deadTonight.filter((x) => !P(x).alive)) msgs.push({ channel: "town", text: `${P(id).name}'s lantern went out in the night.` });
    s.quietDays = 0;
  } else { msgs.push({ channel: "town", text: "Every lantern is still burning this morning." }); s.quietDays++; }
  for (const id of raised) msgs.push({ channel: "town", text: `${P(id).name}'s lantern has been relit.` });
  for (const id of revealedTonight) msgs.push({ channel: "town", text: `${P(id).name} has Revealed: they are the ${P(id).role}.` });
  for (const p of s.players) if (p.shipped && p.alive) msgs.push({ channel: "town", text: `${p.name} has been sent away on a ship. They cannot vote or be voted for today.` });
  return msgs;
}
function setRole(p: Player, role: string) { const d = roleDef(role); p.role = role; p.ability = role; p.faction = d.faction; }
function succession(s: GameState, r: Rng, say: (to: string, t: string) => void) {
  const lv = alive(s); const died = (role: string) => s.players.some((p) => !p.alive && p.role === role);
  if (s.mode === "Syndicate") {
    const gf = lv.find((p) => p.role === "Godfather"), mob = lv.find((p) => p.role === "Mobster");
    if (!gf && mob && s.hadGodfather) { setRole(mob, "Godfather"); say(mob.id, "The Godfather is dead. You are now the Godfather."); }
    else if (!gf && !mob && died("Mobster")) { const c = lv.filter((p) => p.faction === "Syndicate"); if (c.length) { const n = pick(c, r); setRole(n, "Mobster"); say(n.id, "You are now the Mobster."); } }
  } else if (!lv.some((p) => p.role === "Foreman") && died("Foreman")) {
    const power = lv.find((p) => p.faction === "Cartel" && roleDef(p.role).type === "Power");
    if (!power || power.role === "Kingpin") { const c = lv.filter((p) => p.faction === "Cartel" && p.role !== "Kingpin"); if (c.length) { const n = pick(c, r); setRole(n, "Foreman"); say(n.id, "You are now the Foreman."); } }
  }
}

// ---- Voting ----
export const voters = (s: GameState) => alive(s).filter((p) => !p.shipped);
export const voteWeight = (s: GameState, p: Player): number => {
  if (p.shipped || !p.alive) return 0;
  if (p.bribed) return 0;
  if (p.role === "Paymaster" && s.players.some((q) => q.bribed && q.bribedBy === p.id && q.alive)) return 2;
  if (p.role === "Mayor" && p.revealed) return 3;
  return 1;
};
export const votesNeeded = (s: GameState) => Math.floor(voters(s).length / 2) + 1;
export function voteTally(s: GameState): Record<string, number> {
  const t: Record<string, number> = {}; for (const [v, target] of Object.entries(s.votes)) { const p = byId(s, v); t[target] = (t[target] ?? 0) + voteWeight(s, p); } return t;
}

// ---- Phase flow ----
function setPhase(s: GameState, ph: Phase, seconds: number, now: number) { s.phase = ph; s.phaseNo++; s.endsAt = now + seconds * 1000; }
export function checkWin(s: GameState): boolean {
  const lv = alive(s); const lk = lv.filter((p) => p.faction === "Lanternkeepers"), ev = lv.filter(isEvil), uk = lv.filter(isUK);
  let w: string | null = null;
  if (!lv.length) w = "Nobody";
  else if (!ev.length && !uk.length) w = "The Lanternkeepers";
  else if (ev.length && !uk.length && ev.length >= lv.length - ev.length) w = s.mode === "Syndicate" ? "The Syndicate" : "The Cartel";
  else if (uk.length === 1 && lv.length === 1) w = uk[0].role; // An Unbound killer wins only by eliminating everyone (Nik, 6 Nov).
  if (!w) return false;
  finish(s, w); return true;
}
function finish(s: GameState, w: string) {
  s.winner = w; s.phase = "over"; s.phaseNo++; s.endsAt = 0;
  const side = w === "The Lanternkeepers" ? "Lanternkeepers" : w === "The Syndicate" ? "Syndicate" : w === "The Cartel" ? "Cartel" : null;
  s.winners = s.players.filter((p) => (side && p.faction === side) || p.won || (p.role === w) || (p.role === "Outcast" && p.alive)).map((p) => p.id);
}
/** Night cap (Nik, 6 Nov): after the last Night, a living evil side wins. With no evil left, nobody does. */
/** At the end of Day 7, after the usual win check: a living evil side wins; otherwise nobody does (a draw). */
function dayCap(s: GameState): Msg[] {
  const evilAlive = alive(s).some(isEvil);
  finish(s, evilAlive ? `The ${s.mode}` : "Nobody");
  return [{ channel: "town", text: evilAlive ? `Seven days have passed, and the ${s.mode} still walks free.` : "Seven days have passed." }, overMsg(s)];
}
function startNight(s: GameState, now: number, r: Rng): Msg[] {
  s.night++; s.actions = {}; s.votes = {}; s.verdicts = {}; s.accused = null; s.trial = 0; s.commanded = null; s.condemned = false;
  const msgs: Msg[] = [];
  for (const p of s.players) { p.framed = false; p.disguisedAs = undefined; p.bribed = false; p.bribedBy = undefined; p.shipped = false; }
  for (const p of alive(s)) if (p.debt && !p.debtNotified) { p.collection = true; p.debtNotified = true; msgs.push({ channel: "private", to: p.id, text: "You owe the Loan Shark. Tonight is your Collection Night: choose who to pay." }); }
  msgs.push({ channel: "town", text: fogNight(s.night) ? `Night ${s.night}: the Gloam rolls in. This is a Fog Night.` : `Night ${s.night}: a clear night falls.` });
  setPhase(s, "night", s.timers.night, now);
  for (const p of alive(s).filter((x) => x.bot)) botNight(s, p, r);
  return msgs;
}
function startVote(s: GameState, now: number): Msg[] {
  s.trial++; s.votes = {}; s.verdicts = {}; s.accused = null;
  setPhase(s, "vote", s.timers.vote, now);
  return [{ channel: "town", text: `Voting ${s.trial} of ${MAX_TRIALS}: ${votesNeeded(s)} votes put a player on trial.` }];
}
function execute(s: GameState, p: Player, verb: string): Msg[] {
  const msgs: Msg[] = [{ channel: "town", text: `${p.name} ${verb}` }]; p.alive = false; p.diedDay = s.day; s.quietDays = 0;
  if (p.role === "Martyr") { p.won = true; p.revealed = true; msgs.push({ channel: "town", text: `${p.name} was the Martyr, and got what they wanted.` }); }
  for (const q of alive(s)) if (q.role === "Exterminator" && q.extTarget === p.id) { q.won = true; msgs.push({ channel: "private", to: q.id, text: "Your target has been voted out. You win." }); }
  if (p.role === "Loan Shark") for (const q of s.players) { q.debt = false; q.collection = false; }
  const say = (to: string, text: string) => msgs.push({ channel: "private", to, text }); succession(s, mathRng, say);
  return msgs;
}
const afterExecutionOrDay = (s: GameState, now: number, r: Rng, msgs: Msg[]) => (checkWin(s) ? [...msgs, overMsg(s)] : s.day >= MAX_DAYS ? [...msgs, ...dayCap(s)] : [...msgs, ...startNight(s, now, r)]);
const overMsg = (s: GameState): Msg => ({ channel: "town", text: s.winner === "Nobody" ? "The town falls silent. Nobody wins." : `${s.winner} ${s.winner?.startsWith("The ") ? "win" : "wins"}.` });

/** Moves the game on when its timer has run out. Safe to call repeatedly: it does nothing before endsAt. */
export function advance(s: GameState, now: number, r: Rng): Msg[] {
  if (s.phase === "over" || s.pausedLeft != null || now < s.endsAt) return [];
  return forceAdvance(s, now, r);
}
export const isPaused = (s: GameState) => s.pausedLeft != null;
const notPaused = (s: GameState) => { if (isPaused(s)) throw new Error("The game is paused."); };
/** In-person parties only. The clock stops with the time left saved; resuming starts it again from there. */
export function cmdPause(s: GameState, id: string, now: number): Msg[] {
  const p = byId(s, id); if (!p) throw new Error("You are not in this game.");
  if (!s.inPerson) throw new Error("Only in-person parties can pause.");
  if (s.phase === "over" || isPaused(s)) return [];
  s.pausedLeft = Math.max(1000, s.endsAt - now); s.pausedBy = p.name;
  return [{ channel: "town", text: `${p.name} paused the game.` }];
}
export function cmdResume(s: GameState, id: string, now: number): Msg[] {
  const p = byId(s, id); if (!p) throw new Error("You are not in this game.");
  if (!isPaused(s) || s.phase === "over") return [];
  s.endsAt = now + (s.pausedLeft as number); s.pausedLeft = null; s.pausedBy = null;
  return [{ channel: "town", text: `${p.name} resumed the game.` }];
}
export function forceAdvance(s: GameState, now: number, r: Rng): Msg[] {
  switch (s.phase) {
    case "reveal": return startNight(s, now, r);
    case "discussion": return startVote(s, now);
    case "vote": {
      const lines: Msg[] = [];
      for (const p of voters(s).filter((x) => x.bot && !s.votes[x.id])) { botVote(s, p, r); if (s.votes[p.id]) lines.push({ channel: "town", text: `${p.name} voted for ${byId(s, s.votes[p.id]).name}.` }); }
      const m = tryTrial(s, now); if (m) return [...lines, ...m];
      // No majority when the vote closes: the Day ends there (Nik, 7 Nov).
      s.quietDays++; return afterExecutionOrDay(s, now, r, [...lines, { channel: "town", text: "No majority. The Day ends." }]);
    }
    case "defence": setPhase(s, "verdict", s.timers.verdict, now); return [{ channel: "town", text: `Decide ${byId(s, s.accused!).name}'s fate: guilty or innocent.` }];
    case "verdict": {
      for (const p of voters(s).filter((x) => x.bot && x.id !== s.accused && !s.verdicts[x.id])) s.verdicts[p.id] = r.next() < 0.5 ? "guilty" : "innocent";
      let g = 0, n = 0; for (const [v, c] of Object.entries(s.verdicts)) { const w = voteWeight(s, byId(s, v)); if (c === "guilty") g += w; else n += w; }
      const a = byId(s, s.accused!);
      // Verdicts stay anonymous during the stage, then everyone's choice is shown at once.
      const shown: Msg[] = voters(s).filter((p) => p.id !== a.id).map((p) => ({ channel: "town", text: s.verdicts[p.id] ? `${p.name} voted ${s.verdicts[p.id]}.` : `${p.name} did not vote.` }));
      if (g > n) return afterExecutionOrDay(s, now, r, [...shown, ...execute(s, a, `was found guilty, ${g} to ${n}, and executed.`)]);
      const m: Msg = { channel: "town", text: `${a.name} was found innocent, ${n} to ${g}.` };
      if (s.trial >= MAX_TRIALS) { s.quietDays++; return afterExecutionOrDay(s, now, r, [...shown, m, { channel: "town", text: "No more trials today." }]); }
      return [...shown, m, ...startVote(s, now)];
    }
    case "night": {
      for (const p of alive(s).filter((x) => x.bot && !s.actions[x.id])) botNight(s, p, r);
      const msgs = resolveNight(s, r); s.actions = {};
      if (checkWin(s)) return [...msgs, overMsg(s)];
      setPhase(s, "dawn", DAWN_SECONDS, now); return msgs;
    }
    case "dawn": s.day++; setPhase(s, "discussion", s.timers.discussion, now);
      return [{ channel: "town", text: `Day ${s.day}.` }, ...(s.day === MAX_DAYS ? [{ channel: "town" as const, text: "This is the last day. If the evil side survives it, they win." }] : [])];
    default: return [];
  }
}
function tryTrial(s: GameState, now: number): Msg[] | null {
  const need = votesNeeded(s); const tally = voteTally(s);
  const top = Object.entries(tally).find(([, n]) => n >= need); if (!top) return null;
  const a = byId(s, top[0]); s.accused = a.id; s.verdicts = {}; setPhase(s, "defence", s.timers.defence, now);
  return [{ channel: "town", text: `${a.name} is on trial. Only they may speak.` }];
}
function botVote(s: GameState, p: Player, r: Rng) {
  const tally = Object.entries(voteTally(s)).sort((a, b) => b[1] - a[1]);
  const c = voters(s).filter((x) => x.id !== p.id); if (!c.length) return;
  if (tally[0] && r.next() < 0.6) s.votes[p.id] = tally[0][0]; else if (r.next() < 0.5) s.votes[p.id] = pick(c, r).id;
}
function botNight(s: GameState, p: Player, r: Rng) {
  const pr = nightPrompt(s, p); if (!pr || r.next() < 0.1) return;
  if (pr.toggle) { if (r.next() < 0.3) s.actions[p.id] = { targets: [], alert: true }; return; }
  const t: string[] = []; for (const sl of pr.slots) { const c = sl.options.filter((o) => !t.includes(o.id)); if (!c.length) return; t.push(pick(c, r).id); }
  s.actions[p.id] = { targets: t };
}

// ---- Player commands. All throw on an illegal move. ----
export function cmdVote(s: GameState, id: string, target: string | null, now: number): Msg[] {
  const p = byId(s, id); notPaused(s); if (s.phase !== "vote") throw new Error("Voting is closed.");
  if (!p.alive || p.shipped) throw new Error("You cannot vote today.");
  const prev = s.votes[id];
  if (target === null) { if (!prev) return []; delete s.votes[id]; return [{ channel: "town", text: `${p.name} withdrew their vote.` }]; }
  const t = byId(s, target); if (!t?.alive || t.id === id || t.shipped) throw new Error("You cannot vote for that player.");
  if (prev === target) return [];
  s.votes[id] = target;
  const line: Msg = { channel: "town", text: prev ? `${p.name} changed their vote to ${t.name}.` : `${p.name} voted for ${t.name}.` };
  return [line, ...(tryTrial(s, now) ?? [])];
}
export function cmdVerdict(s: GameState, id: string, choice: "guilty" | "innocent"): void {
  const p = byId(s, id); notPaused(s); if (s.phase !== "verdict" || !p.alive || p.shipped || s.accused === id) throw new Error("You cannot judge now.");
  s.verdicts[id] = choice;
}
export function cmdNight(s: GameState, id: string, a: Action, _now: number): void {
  const p = byId(s, id); notPaused(s); const pr = nightPrompt(s, p); if (!pr) throw new Error("You have nothing to do tonight.");
  if (pr.toggle) { s.actions[id] = { targets: [], alert: !!a.alert }; return; }
  if (a.targets.length === 0) { delete s.actions[id]; if (p.ability === "Kingpin") s.commanded = null; return; }
  if (a.targets.length !== pr.slots.length) throw new Error("Choose every target.");
  a.targets.forEach((t, i) => { if (!pr.slots[i].options.some((o) => o.id === t)) throw new Error("That target is not allowed."); });
  if (pr.slots.length === 2 && a.targets[0] === a.targets[1]) throw new Error("Choose two different players.");
  s.actions[id] = { targets: a.targets, second: a.second };
  if (p.ability === "Kingpin" && byId(s, a.targets[0]).faction === "Cartel") s.commanded = a.targets[0];
}
/** Reveal moved to the Night (Nik, 7 Nov): the Mayor and Judge choose it in their night prompt. Kept so old clients get a clear answer. */
export function cmdReveal(_s: GameState, _id: string): Msg[] {
  throw new Error("Reveal is chosen at Night now.");
}

export function cmdCondemn(s: GameState, id: string, target: string, now: number, r: Rng): Msg[] {
  const p = byId(s, id), t = byId(s, target); notPaused(s);
  if (p.role !== "Judge" || !p.revealed || !p.alive || s.phase !== "vote" || s.condemned) throw new Error("You cannot Condemn now.");
  if (!t?.alive || t.id === id) throw new Error("You cannot Condemn that player.");
  s.condemned = true;
  if (t.faction === "Lanternkeepers") return afterExecutionOrDay(s, now, r, execute(s, p, `Condemned a Lanternkeeper and was overthrown. ${t.name} is spared.`));
  return afterExecutionOrDay(s, now, r, execute(s, t, "was Condemned by the Judge and executed."));
}
/** Who may post in each chat right now. Same-room parties can have town chat switched off. */
export function canChat(s: GameState, id: string, channel: string): boolean {
  const p = byId(s, id); if (!p) return false;
  if (s.phase === "over") return true;
  if (isPaused(s)) return false;
  if (channel === "dead") return !p.alive && !s.inPerson;
  if (!p.alive) return false;
  if (channel === "town") {
    if (!s.townChat) return false;
    if (s.phase === "defence") return s.accused === id;
    return s.phase === "discussion" || s.phase === "vote" || s.phase === "verdict";
  }
  if (channel === "faction") return s.phase === "night" && isEvil(p);
  return false;
}

// ---- What each player is allowed to see ----
export function publicView(s: GameState) {
  return {
    phase: s.phase, phaseNo: s.phaseNo, day: s.day, night: s.night, endsAt: s.endsAt, accused: s.accused, trial: s.trial, maxTrials: MAX_TRIALS,
    needed: s.phase === "vote" ? votesNeeded(s) : 0, tally: s.phase === "vote" ? voteTally(s) : {}, votes: s.phase === "vote" ? s.votes : {}, verdictsIn: Object.keys(s.verdicts).length,
    townChat: s.townChat, setup: s.setup ?? s.mode, size: s.players.length, inPerson: !!s.inPerson, paused: isPaused(s), pausedLeft: s.pausedLeft ?? null, pausedBy: s.pausedBy ?? null, winner: s.winner, fog: s.phase === "night" ? fogNight(s.night) : false,
    players: s.players.map((p) => ({ id: p.id, name: p.name, seat: p.seat, alive: p.alive, bot: p.bot, shipped: !!p.shipped, revealedRole: p.revealed ? p.role : null, finalRole: s.phase === "over" ? p.role : null, won: s.phase === "over" ? s.winners.includes(p.id) : null })),
  };
}
export function privateView(s: GameState, id: string) {
  const p = byId(s, id); const lv = s.players;
  let allies: { name: string; role?: string }[] = [];
  if (isEvil(p)) {
    const knowsRoles = roleDef(p.role).type === "Power";
    allies = lv.filter((q) => q.faction === p.faction && q.id !== id && (p.role === "Kingpin" || q.role !== "Kingpin")).map((q) => (knowsRoles ? { name: q.name, role: q.role } : { name: q.name }));
  }
  const prompt = s.phase === "night" ? nightPrompt(s, p) : null;
  return {
    role: p.role, faction: p.faction, ability: p.ability, alive: p.alive, allies, prompt, action: s.actions[id] ?? null,
    // Shown with the role, like an evil player's allies: the Exterminator's target and the Assassin's contract.
    target: p.role === "Exterminator" && p.extTarget ? { name: byId(s, p.extTarget).name, alive: byId(s, p.extTarget).alive } : null,
    contract: p.role === "Assassin" && p.contract ? p.contract : null,
    commanded: s.commanded === id, myVote: s.votes[id] ?? null, myVerdict: s.verdicts[id] ?? null,
    canVote: s.phase === "vote" && p.alive && !p.shipped, canVerdict: s.phase === "verdict" && p.alive && !p.shipped && s.accused !== id,
    canReveal: false, // Reveal is a Night action now; see nightPrompt
    canCondemn: p.role === "Judge" && !!p.revealed && p.alive && s.phase === "vote" && !s.condemned,
    channels: { town: canChat(s, id, "town"), faction: canChat(s, id, "faction"), dead: canChat(s, id, "dead") },
  };
}
