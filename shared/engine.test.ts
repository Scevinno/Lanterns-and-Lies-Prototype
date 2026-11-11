import { describe, it, expect } from "vitest";
import { ROLES } from "./roles.ts";
import {
  advance, checkWin, SHOW_ALL_ROLES, cmdCondemn, cmdPause, cmdResume, rosterFor, cmdNight, cmdReveal, cmdVerdict, cmdVote, canChat, createGame, dealDeck, forceAdvance, isUnique, nightPrompt,
  privateView, publicView, PUBLIC_TIMERS, resolveNight, roleDef, seeded, voteTally, type GameState, type Player,
} from "./engine.ts";

const T0 = 1_000_000;
/** A game with chosen roles, at night 1 unless told otherwise. Names are the role's first letters plus seat. */
function game(roles: string[], night = 1, mode: "Syndicate" | "Cartel" = "Syndicate"): GameState {
  const players: Player[] = roles.map((role, seat) => { const d = roleDef(role); const p: Player = { id: "p" + seat, name: "N" + seat, seat, bot: false, alive: true, role, ability: role, faction: d.faction, patrol: [], learned: [] }; if (role === "Rogue") p.bullets = 1; if (role === "Doctor") p.selfHeal = 1; if (role === "Veteran") p.alerts = 2; if (role === "Butcher") p.streak = 0; return p; });
  return { mode, timers: PUBLIC_TIMERS, townChat: true, phase: "night", phaseNo: 2, endsAt: T0, day: night, night, players, votes: {}, verdicts: {}, accused: null, trial: 0, actions: {}, trap: null, commanded: null, quietDays: 0, hadGodfather: roles.includes("Godfather"), winner: null, winners: [], condemned: false };
}
const act = (s: GameState, i: number, ...t: number[]) => { s.actions["p" + i] = { targets: t.map((x) => "p" + x) }; };
const run = (s: GameState) => resolveNight(s, seeded(7));
const dead = (s: GameState, i: number) => !s.players[i].alive;
const said = (m: { channel: string; to?: string; text: string }[], i: number) => m.filter((x) => x.to === "p" + i).map((x) => x.text).join(" | ");

describe("role data", () => {
  it("has all 47 roles with the right factions", () => {
    expect(ROLES.length).toBe(47);
    const c = (f: string) => ROLES.filter((r) => r.faction === f).length;
    expect([c("Lanternkeepers"), c("Syndicate"), c("Cartel"), c("Unbound")]).toEqual([21, 7, 12, 7]);
  });
});

describe("dealing", () => {
  it("obeys the roster, unique roles and the balance band at every size", () => {
    const r = seeded(1);
    for (const mode of ["Syndicate", "Cartel"] as const) for (let size = 8; size <= 15; size++) for (let i = 0; i < 40; i++) {
      const d = dealDeck(size, mode, r); expect(d.length).toBe(size);
      for (const n of d) if (isUnique(n)) expect(d.filter((x) => x === n).length).toBe(1);
      const evil = d.filter((n) => roleDef(n).faction === mode), lk = d.filter((n) => roleDef(n).faction === "Lanternkeepers"), ub = d.filter((n) => roleDef(n).faction === "Unbound");
      expect(evil.filter((n) => roleDef(n).type === "Power").length).toBeLessThanOrEqual(1);
      expect(lk.filter((n) => roleDef(n).type === "Power").length).toBe(1);
      expect(ub.length).toBe(size === 15 ? 2 : 1);
      const sc = (x: string[]) => x.reduce((a, n) => a + roleDef(n).total + 2, 0); const ratio = sc(evil) / sc(lk);
      expect(ratio).toBeGreaterThanOrEqual(0.4); expect(ratio).toBeLessThanOrEqual(0.55);
    }
  });
  it("matches the Cartel table", () => {
    const r = seeded(2); const cnt = (s: number) => dealDeck(s, "Cartel", r).filter((n) => roleDef(n).faction === "Cartel").length;
    expect([8, 9, 10, 11, 12, 13, 14, 15].map(cnt)).toEqual([2, 2, 3, 3, 3, 3, 3, 4]);
  });
});

describe("timer", () => {
  it("does nothing before the deadline and moves exactly once after it", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, name: "N" + i, bot: true }));
    const { state: s } = createGame({ players, mode: "Syndicate", timers: PUBLIC_TIMERS, townChat: true }, seeded(3), T0);
    expect(advance(s, T0 + 29_999, seeded(1))).toEqual([]); expect(s.phase).toBe("reveal");
    advance(s, T0 + 30_000, seeded(1)); expect(s.phase).toBe("night"); expect(s.endsAt).toBe(T0 + 30_000 + 60_000);
    const no = s.phaseNo; advance(s, T0 + 30_001, seeded(1)); expect(s.phaseNo).toBe(no);
  });
  it("a phone that was off for an hour still sees the game moved on by the server", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, name: "N" + i, bot: true }));
    const { state: s } = createGame({ players, mode: "Syndicate", timers: PUBLIC_TIMERS, townChat: true }, seeded(4), T0);
    let t = T0; for (let i = 0; i < 400 && s.phase !== "over"; i++) { t += 5000; advance(s, t, seeded(i)); }
    expect(s.phaseNo).toBeGreaterThan(5);
  });
});

describe("attacks and defence", () => {
  it("Godfather's order is carried out by the Mobster, who is seen visiting", () => {
    const s = game(["Godfather", "Mobster", "Tracker", "Doctor"]); act(s, 0, 3); act(s, 1, 2); act(s, 2, 1); const m = run(s);
    expect(dead(s, 3)).toBe(true); expect(dead(s, 2)).toBe(false); expect(said(m, 2)).toContain("N3");
  });
  it("Godfather Held: Mobster attacks their own choice", () => {
    const s = game(["Godfather", "Mobster", "Locksmith", "Doctor", "Spy"]); act(s, 0, 3); act(s, 1, 4); act(s, 2, 0); run(s);
    expect(dead(s, 4)).toBe(true); expect(dead(s, 3)).toBe(false);
  });
  it("Godfather acts alone with no Mobster and has Basic Defence against the Rogue", () => {
    const s = game(["Godfather", "Rogue", "Doctor"], 2); act(s, 0, 2); act(s, 1, 0); run(s); expect(dead(s, 2)).toBe(true); expect(dead(s, 0)).toBe(false);
  });
  it("Doctor heals a Basic Attack but not an Unstoppable one", () => {
    const a = game(["Foreman", "Doctor", "Spy"], 1, "Cartel"); act(a, 0, 2); act(a, 1, 2); run(a); expect(dead(a, 2)).toBe(false);
    const b = game(["Tinkerer", "Doctor", "Spy"]); b.players[2].planted = true; act(b, 0, 0); act(b, 1, 2); run(b); expect(dead(b, 2)).toBe(true);
  });
  it("Doctor self-heal works once", () => {
    const s = game(["Foreman", "Doctor"], 1, "Cartel"); s.actions.p1 = { targets: ["p1"] }; run(s); expect(s.players[1].selfHeal).toBe(0);
    s.phase = "night"; expect(nightPrompt(s, s.players[1])!.slots[0].options.some((o) => o.id === "p1")).toBe(false);
  });
  it("Guardsman stops the attack: attacker and Guardsman both die", () => {
    const s = game(["Foreman", "Guardsman", "Spy"], 1, "Cartel"); act(s, 0, 2); act(s, 1, 2); run(s);
    expect(dead(s, 2)).toBe(false); expect(dead(s, 0)).toBe(true); expect(dead(s, 1)).toBe(true);
  });
  it("Guardsman cannot stop Trigger", () => {
    const s = game(["Tinkerer", "Guardsman", "Spy"]); s.players[2].planted = true; act(s, 0, 0); act(s, 1, 2); run(s); expect(dead(s, 2)).toBe(true); expect(dead(s, 1)).toBe(false);
  });
  it("Veteran on Alert kills visitors, and counts them", () => {
    const s = game(["Veteran", "Foreman", "Detective"], 1, "Cartel"); s.actions.p0 = { targets: [], alert: true }; act(s, 1, 0); act(s, 2, 0); const m = run(s);
    expect(dead(s, 1)).toBe(true); expect(dead(s, 2)).toBe(true); expect(dead(s, 0)).toBe(false); expect(said(m, 0)).toContain("killed 2"); expect(s.players[0].alerts).toBe(1);
  });
  it("Veteran Held does not go on Alert", () => {
    const s = game(["Veteran", "Locksmith", "Detective"]); s.actions.p0 = { targets: [], alert: true }; act(s, 1, 0); act(s, 2, 0); run(s); expect(dead(s, 2)).toBe(false); expect(s.players[0].alerts).toBe(2);
  });
  it("Rogue cannot Shoot on the first Night, and killing a Lanternkeeper means guilt", () => {
    const a = game(["Rogue", "Spy"], 1); a.phase = "night"; expect(nightPrompt(a, a.players[0])).toBeNull();
    const s = game(["Rogue", "Spy", "Doctor"], 2); act(s, 0, 1); run(s); expect(dead(s, 1)).toBe(true); expect(s.players[0].guilt).toBe(true);
    s.night = 3; s.actions = {}; run(s); expect(dead(s, 0)).toBe(true);
  });
  it("Butcher: no visit first Night; attacks a Holder even if Held", () => {
    const a = game(["Butcher", "Spy"], 1); expect(nightPrompt(a, a.players[0])).toBeNull();
    const s = game(["Butcher", "Locksmith", "Spy"], 2); act(s, 0, 2); act(s, 1, 0); run(s); expect(dead(s, 1)).toBe(true); expect(dead(s, 2)).toBe(false);
  });
  it("Butcher rampages after two Murders in a row", () => {
    const s = game(["Butcher", "Spy", "Doctor", "Detective"], 3); s.players[0].streak = 2; act(s, 0, 1); act(s, 3, 1); run(s); expect(dead(s, 1)).toBe(true); expect(dead(s, 3)).toBe(true);
  });
  it("Hollowman attacks target and visitors on clear Nights; Doctor who heals their target dies instead", () => {
    const a = game(["Hollowman", "Spy", "Detective"], 1); act(a, 0, 1); act(a, 2, 1); run(a); expect(dead(a, 1)).toBe(true); expect(dead(a, 2)).toBe(true);
    const b = game(["Hollowman", "Spy", "Doctor"], 1); act(b, 0, 1); act(b, 2, 1); run(b); expect(dead(b, 1)).toBe(false); expect(dead(b, 2)).toBe(true);
  });
  it("Hollowman: no attack on a Fog Night; results are random, not flipped", () => {
    const s0 = game(["Hollowman", "Foreman", "Constable"], 2, "Cartel"); expect(nightPrompt(s0, s0.players[0])).toBeNull();
    const seen = new Set<string>(), hollow = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = game(["Hollowman", "Foreman", "Constable"], 2, "Cartel"); act(s, 2, 1); seen.add(said(resolveNight(s, seeded(i)), 2).includes("Evil") ? "Evil" : "Innocent");
      const h = game(["Hollowman", "Foreman", "Constable"], 2, "Cartel"); act(h, 2, 0); hollow.add(said(resolveNight(h, seeded(i)), 2).includes("Evil") ? "Evil" : "Innocent");
    }
    expect([...seen].sort()).toEqual(["Evil", "Innocent"]); expect([...hollow].sort()).toEqual(["Evil", "Innocent"]);
  });
  it("a Forged result is always wrong, even on a Fog Night", () => {
    for (let i = 0; i < 20; i++) { const s = game(["Hollowman", "Foreman", "Constable", "Forger"], 2, "Cartel"); act(s, 2, 1); act(s, 3, 2); expect(said(resolveNight(s, seeded(i)), 2)).toContain("Innocent"); }
  });
  it("Hollowman reads Evil on clear Nights", () => {
    const s = game(["Hollowman", "Constable"], 1); act(s, 1, 0); expect(said(run(s), 1)).toContain("Evil");
    const f = game(["Hollowman", "Constable"], 3); act(f, 1, 0); expect(said(run(f), 1)).toContain("Evil");
  });
  it("Innkeeper gives visitors Basic Defence, unless Held", () => {
    const s = game(["Foreman", "Innkeeper", "Detective"], 1, "Cartel"); act(s, 0, 2); act(s, 2, 1); run(s); expect(dead(s, 2)).toBe(false);
    const h = game(["Foreman", "Innkeeper", "Detective", "Locksmith"], 1, "Cartel"); act(h, 0, 2); act(h, 2, 1); act(h, 3, 1); run(h); expect(dead(h, 2)).toBe(true);
  });
  it("Hunter builds on odd Nights, sets on even; trap kills evil visitors and protects the target", () => {
    const s = game(["Hunter", "Foreman", "Spy"], 1, "Cartel"); run(s); expect(s.players[0].hasTrap).toBe(true);
    s.night = 2; s.phase = "night"; s.actions = {}; act(s, 0, 2); run(s); expect(s.trap?.target).toBe("p2");
    s.night = 3; s.actions = {}; act(s, 1, 2); run(s); expect(dead(s, 1)).toBe(true); expect(dead(s, 2)).toBe(false); expect(s.trap).toBeNull();
  });
});

describe("Holds and redirects", () => {
  it("Hold stops an ability; Hold-immune roles are unaffected", () => {
    const s = game(["Locksmith", "Detective", "Enforcer", "Spy"]); act(s, 0, 1); act(s, 1, 3); act(s, 2, 0); const m = run(s);
    expect(said(m, 1)).not.toContain("role"); expect(said(m, 1)).toContain("Held");
  });
  it("Quartermaster's Hold gives Powerful Defence", () => {
    const s = game(["Quartermaster", "Foreman", "Spy"], 1, "Cartel"); act(s, 0, 2); act(s, 1, 2); run(s); expect(dead(s, 2)).toBe(false);
  });
  it("Ferryman swaps visits; swapped players are told", () => {
    const s = game(["Ferryman", "Foreman", "Spy", "Detective"], 1, "Cartel"); act(s, 0, 2, 3); act(s, 1, 2); const m = run(s);
    expect(dead(s, 3)).toBe(true); expect(dead(s, 2)).toBe(false); expect(said(m, 2)).toContain("swapped");
  });
  it("Ferryman goes first: a Smuggler touching the same player fails", () => {
    const s = game(["Ferryman", "Smuggler", "Foreman", "Spy", "Detective", "Doctor"], 1, "Cartel"); act(s, 0, 3, 4); act(s, 1, 3, 5); act(s, 2, 3); run(s);
    expect(dead(s, 4)).toBe(true); expect(dead(s, 5)).toBe(false);
  });
  it("Swapping a Butcher to their own house makes them attack the swapper", () => {
    const s = game(["Ferryman", "Butcher", "Spy"], 2); act(s, 0, 1, 2); act(s, 1, 2); run(s); expect(dead(s, 0)).toBe(true);
  });
  it("Swaps do not save anyone from Trigger", () => {
    const s = game(["Ferryman", "Tinkerer", "Spy", "Detective"]); s.players[2].planted = true; act(s, 0, 2, 3); act(s, 1, 1); run(s); expect(dead(s, 2)).toBe(true); expect(dead(s, 3)).toBe(false);
  });
  it("Fence sends a visitor to a neighbour; not the Seer", () => {
    const s = game(["Fence", "Detective", "Spy", "Doctor", "Godfather"]); act(s, 0, 1); act(s, 1, 2); const m = run(s); expect(said(m, 1)).toContain("N3");
    const u = game(["Fence", "Seer", "Spy", "Doctor"]); act(u, 0, 1); act(u, 1, 2, 3); expect(said(run(u), 1)).toContain("N2 and N3");
  });
  it("Pawnbroker draws a visit, and not a two-target visitor", () => {
    const s = game(["Pawnbroker", "Hollowman", "Spy"], 1, "Cartel"); act(s, 0, 1); act(s, 1, 2); run(s); expect(dead(s, 2)).toBe(false);
  });
});

describe("investigations", () => {
  it("Constable: immune roles read Innocent, Framed reads Evil, Martyr and Outcast Innocent", () => {
    const c = (role: string, framed = false) => { const s = game(["Constable", role, "Framer", "Spy"]); act(s, 0, 1); if (framed) act(s, 2, 1); return said(run(s), 0); };
    expect(c("Godfather")).toContain("Innocent"); expect(c("Kingpin")).toContain("Innocent"); expect(c("Harbour Master")).toContain("Innocent"); expect(c("Loan Shark")).toContain("Innocent");
    expect(c("Mobster")).toContain("Evil"); expect(c("Spy", true)).toContain("Evil"); expect(c("Martyr")).toContain("Innocent"); expect(c("Outcast")).toContain("Innocent");
    expect(c("Assassin")).toContain("Evil"); expect(c("Town Crier")).toContain("Evil");
  });
  it("Detective reads the role type; Framed appears Deceptive, Planted appears Killing; Godfather is not immune", () => {
    const d = (role: string, set?: (s: GameState) => void) => { const s = game(["Detective", role, "Framer"]); act(s, 0, 1); set?.(s); return said(run(s), 0); };
    expect(d("Godfather")).toContain("Power"); expect(d("Doctor", (s) => act(s, 2, 1))).toContain("Deceptive"); expect(d("Doctor", (s) => { s.players[1].planted = true; })).toContain("Killing");
  });
  it("Tailor's disguise fools the Constable and Watchman", () => {
    const s = game(["Tailor", "Mobster", "Constable", "Spy", "Doctor", "Watchman"]); act(s, 0, 1, 3); act(s, 1, 4); act(s, 2, 1); act(s, 5, 4); const m = run(s);
    expect(said(m, 2)).toContain("Innocent"); expect(said(m, 5)).toContain("N3");
  });
  it("Notary and Informant see a Planted player as the Tinkerer", () => {
    const s = game(["Notary", "Spy"], 1, "Cartel"); s.players[1].planted = true; act(s, 0, 1); expect(said(run(s), 0)).toContain("Tinkerer");
  });
  it("Forger makes an investigator's result false, including Watchman names", () => {
    const s = game(["Forger", "Constable", "Mobster"], 1, "Cartel"); act(s, 0, 1); act(s, 1, 2); expect(said(run(s), 1)).toContain("Innocent");
    const w = game(["Forger", "Watchman", "Doctor", "Spy"], 1, "Cartel"); act(w, 0, 1); act(w, 1, 2); act(w, 2, 3); expect(said(run(w), 1)).not.toContain("nobody");
  });
  it("Oracle's three names always include the target", () => {
    const s = game(["Oracle", "Spy", "Mobster", "Doctor", "Innkeeper"]); act(s, 0, 1); expect(said(run(s), 0)).toContain("N1");
  });
  it("Oracle is told when no other Lanternkeepers remain", () => {
    const s = game(["Oracle", "Mobster", "Godfather"]); act(s, 0, 1); expect(said(run(s), 0)).toContain("no longer");
  });
  it("Seer: Lanternkeepers and Outcast are friends; an Unbound killer is an enemy; Godfather reads as a friend", () => {
    const f = (a: string, b: string) => { const s = game(["Seer", a, b]); act(s, 0, 1, 2); return said(run(s), 0); };
    expect(f("Spy", "Outcast")).toContain("friends"); expect(f("Spy", "Butcher")).toContain("enemies"); expect(f("Spy", "Godfather")).toContain("friends"); expect(f("Mobster", "Fence")).toContain("friends");
  });
  it("Spy sees who evil visited; Archivist learns a new role each Night", () => {
    const s = game(["Spy", "Foreman", "Doctor", "Archivist"], 1, "Cartel"); act(s, 1, 2); const m = run(s); expect(said(m, 0)).toContain("The evil side visited: N2."); expect(said(m, 3)).toContain("living role");
  });
  it("Watchman sees visitors; Tracker sees the visit", () => {
    const s = game(["Watchman", "Tracker", "Foreman", "Spy"], 1, "Cartel"); act(s, 0, 3); act(s, 1, 2); act(s, 2, 3); const m = run(s); expect(said(m, 0)).toContain("N2"); expect(said(m, 1)).toContain("N3");
  });
  it("Warden receives the target's result", () => {
    const s = game(["Warden", "Detective", "Foreman", "Spy"], 1, "Cartel"); act(s, 0, 1); act(s, 1, 2); const m = run(s); expect(said(m, 0)).toContain("Your target's result");
  });
  it("Warden learns the killer, but no result from a target killed tonight", () => {
    const s = game(["Warden", "Detective", "Foreman", "Spy"], 1, "Cartel"); act(s, 0, 1); act(s, 1, 2); act(s, 2, 1); const m = run(s); expect(said(m, 0)).not.toContain("Your target's result"); expect(said(m, 0)).toContain("killed by N2");
  });
  it("Warden cannot Patrol the same player three Nights in a row", () => {
    const s = game(["Warden", "Spy", "Doctor"]); s.players[0].patrol = ["p1", "p1"]; expect(nightPrompt(s, s.players[0])!.slots[0].options.some((o) => o.id === "p1")).toBe(false);
  });
});

describe("Cartel", () => {
  it("Loan Shark: Debt, Collection Night, paying clears it, not paying kills", () => {
    const s = game(["Loan Shark", "Spy", "Doctor"], 1, "Cartel"); act(s, 0, 1); run(s); expect(s.players[1].debt).toBe(true);
    s.players[1].collection = true; s.players[1].debtNotified = true; s.night = 2; s.actions = {}; s.actions.p1 = { targets: ["p2"] }; run(s); expect(dead(s, 1)).toBe(true);
    const p = game(["Loan Shark", "Spy", "Doctor"], 2, "Cartel"); p.players[1].debt = true; p.players[1].collection = true; p.actions.p1 = { targets: ["p0"] }; run(p); expect(dead(p, 1)).toBe(false); expect(p.players[1].debt).toBe(false);
  });
  it("Loan Shark learns the role of a visit and visitors are put in Debt", () => {
    const s = game(["Loan Shark", "Spy", "Detective"], 1, "Cartel"); act(s, 0, 1); act(s, 2, 0); const m = run(s); expect(said(m, 0)).toContain("Spy"); expect(said(m, 0)).toContain("Detective"); expect(s.players[2].debt).toBe(true);
  });
  it("A dead Loan Shark clears every Debt", () => {
    const s = game(["Loan Shark", "Spy", "Rogue"], 2, "Cartel"); s.players[1].debt = true; act(s, 2, 0); run(s); expect(dead(s, 0)).toBe(true); expect(s.players[1].debt).toBe(false);
  });
  it("Kingpin commands a member to act twice, cannot command the Foreman, and has Powerful Defence while others live", () => {
    const s = game(["Kingpin", "Framer", "Spy", "Doctor", "Foreman"], 1, "Cartel"); s.players[1].faction = "Cartel";
    expect(nightPrompt(s, s.players[0])!.slots[0].options.some((o) => o.id === "p4")).toBe(false);
    cmdNight(s, "p0", { targets: ["p1"] }, T0); expect(privateView(s, "p1").commanded).toBe(true);
    s.actions.p1 = { targets: ["p2"], second: ["p3"] }; run(s); expect(s.players[2].framed).toBe(true); expect(s.players[3].framed).toBe(true);
  });
  it("Kingpin alone recruits a Foreman; a Power role fails", () => {
    const s = game(["Kingpin", "Spy", "Doctor"], 1, "Cartel"); act(s, 0, 1); run(s); expect(s.players[1].role).toBe("Foreman"); expect(s.players[1].faction).toBe("Cartel");
    const f = game(["Kingpin", "Mayor", "Doctor"], 1, "Cartel"); act(f, 0, 1); run(f); expect(f.players[1].role).toBe("Mayor");
  });
  it("Harbour Master: Passage on odd Nights blocks voting; Guns on even Nights", () => {
    const s = game(["Harbour Master", "Spy", "Doctor", "Detective"], 1, "Cartel"); act(s, 0, 1); run(s); expect(s.players[1].shipped).toBe(true);
    s.phase = "vote"; s.alive; expect(() => cmdVote(s, "p1", "p2", T0)).toThrow(); expect(() => cmdVote(s, "p2", "p1", T0)).toThrow();
    const g = game(["Harbour Master", "Forger", "Spy", "Doctor"], 2, "Cartel"); act(g, 0, 1); act(g, 1, 2); run(g); expect(dead(g, 2)).toBe(true);
  });
  it("Paymaster's bribe: their vote counts two, the bribed zero; fails on Power", () => {
    const s = game(["Paymaster", "Spy", "Doctor", "Detective", "Medium", "Seer"], 1, "Cartel"); act(s, 0, 1); run(s); s.phase = "vote"; s.votes = { p0: "p2", p1: "p2" }; expect(voteTally(s).p2).toBe(2);
    const f = game(["Paymaster", "Mayor"], 1, "Cartel"); act(f, 0, 1); run(f); expect(f.players[1].bribed).toBeFalsy();
  });
  it("Swindler swaps roles, faction goes with the role, statuses stay", () => {
    const s = game(["Swindler", "Spy", "Outcast", "Doctor"], 1, "Cartel"); s.players[1].debt = true; act(s, 0, 1, 2); run(s);
    expect(s.players[1].role).toBe("Outcast"); expect(s.players[1].faction).toBe("Unbound"); expect(s.players[2].role).toBe("Spy"); expect(s.players[2].faction).toBe("Lanternkeepers"); expect(s.players[1].debt).toBe(true);
  });
  it("Coroner learns the dead role and uses its ability; the Priest raising them stops it", () => {
    const s = game(["Coroner", "Doctor", "Foreman", "Spy", "Priest"], 2, "Cartel"); s.players[2].alive = false; s.actions.p0 = { targets: ["p2", "p3"] }; const m = run(s); expect(said(m, 0)).toContain("Foreman"); expect(dead(s, 3)).toBe(true);
    const q = game(["Coroner", "Doctor", "Foreman", "Spy", "Priest"], 2, "Cartel"); q.players[2].alive = false; q.actions.p0 = { targets: ["p2", "p3"] }; act(q, 4, 2); const mq = run(q); expect(dead(q, 3)).toBe(true); expect(dead(q, 2)).toBe(true); expect(said(mq, 4)).toContain("failed");
    const z = game(["Coroner", "Doctor", "Rogue", "Spy", "Priest"], 2, "Cartel"); z.players[2].alive = false; z.actions.p0 = { targets: ["p2", "p3"] }; act(z, 4, 2); const mz = run(z); expect(dead(z, 3)).toBe(false); expect(dead(z, 2)).toBe(false); expect(said(mz, 0)).toContain("failed");
  });
  it("Foreman succession: a random Cartel member, never the Kingpin", () => {
    const s = game(["Foreman", "Kingpin", "Forger", "Rogue"], 2, "Cartel"); act(s, 3, 0); run(s); expect(s.players[2].role).toBe("Foreman"); expect(s.players[1].role).toBe("Kingpin");
  });
});

describe("Syndicate succession and others", () => {
  it("Mobster becomes Godfather when the Godfather dies", () => {
    const s = game(["Godfather", "Mobster", "Veteran"], 2); s.players[0].role = "Godfather"; act(s, 0, 2); s.actions.p2 = { targets: [], alert: true }; s.players[0].alive = false; run(s); expect(s.players[1].role).toBe("Godfather");
  });
  it("Priest raises the dead; Rogue returns with one bullet", () => {
    const s = game(["Priest", "Rogue", "Spy"], 2); s.players[1].alive = false; s.players[1].bullets = 0; act(s, 0, 1); run(s); expect(dead(s, 1)).toBe(false); expect(s.players[1].bullets).toBe(1);
  });
  it("Medium becomes the channelled role; fails on Power", () => {
    const s = game(["Medium", "Doctor", "Spy"], 2); s.players[1].alive = false; act(s, 0, 1); run(s); expect(s.players[0].ability).toBe("Doctor"); expect(s.players[0].role).toBe("Doctor"); expect(s.players[0].selfHeal).toBe(1);
    const f = game(["Medium", "Mayor", "Spy"], 2); f.players[1].alive = false; act(f, 0, 1); run(f); expect(f.players[0].ability).toBe("Medium");
  });
  it("Assassin wins by naming both contract targets", () => {
    const s = game(["Assassin", "Spy", "Mobster", "Doctor"]); s.players[0].contract = ["Spy", "Mobster"]; act(s, 0, 1, 2); run(s); expect(dead(s, 1)).toBe(true); expect(dead(s, 2)).toBe(true); expect(s.players[0].won).toBe(true);
    const w = game(["Assassin", "Spy", "Mobster", "Doctor"]); w.players[0].contract = ["Spy", "Mobster"]; act(w, 0, 3, 2); run(w); expect(dead(w, 3)).toBe(false);
  });
  it("Tinkerer: Planted visitors, learns visitors, Trigger", () => {
    const s = game(["Tinkerer", "Detective", "Spy"]); act(s, 1, 0); act(s, 0, 2); const m = run(s); expect(s.players[1].planted).toBe(true); expect(s.players[2].planted).toBe(true); expect(said(m, 0)).toContain("N1");
    s.actions = {}; act(s, 0, 0); run(s); expect(dead(s, 1)).toBe(true); expect(dead(s, 2)).toBe(true);
  });
});

describe("day flow", () => {
  const day = () => { const s = game(["Mayor", "Judge", "Mobster", "Godfather", "Martyr", "Doctor", "Spy", "Seer"], 2); s.phase = "vote"; s.day = 2; s.endsAt = T0 + 30_000; s.trial = 1; return s; };
  it("a bribed player still votes but counts 0; the Paymaster counts 2; the chat line names no weight", () => {
    const s = game(["Paymaster", "Doctor", "Spy", "Detective", "Mobster"], 2, "Cartel"); s.phase = "vote"; s.day = 2; s.trial = 1; s.endsAt = T0 + 30_000;
    s.players[1].bribed = true; s.players[1].bribedBy = "p0";
    const line = cmdVote(s, "p1", "p3", T0); expect(line[0].text).toBe("N1 voted for N3."); expect(voteTally(s).p3).toBe(0);
    cmdVote(s, "p0", "p2", T0); expect(voteTally(s).p2).toBe(2); expect(privateView(s, "p1").canVote).toBe(true);
  });
  it("no majority when the vote closes ends the Day", () => {
    const s = day(); const m = forceAdvance(s, T0 + 30_000, seeded(1)); expect(s.phase).toBe("dusk"); expect(m.some((x) => x.text.includes("No majority. The Day ends."))).toBe(true); forceAdvance(s, s.endsAt, seeded(1)); expect(s.phase).toBe("night");
  });
  it("an innocent verdict leads to another trial, up to 3", () => {
    const s = day(); s.phase = "verdict"; s.accused = "p6"; cmdVerdict(s, "p0", "innocent"); forceAdvance(s, T0, seeded(1)); expect(s.phase).toBe("vote"); expect(s.trial).toBe(2);
    const t = day(); t.trial = 3; t.phase = "verdict"; t.accused = "p6"; cmdVerdict(t, "p0", "innocent"); forceAdvance(t, T0, seeded(1)); expect(t.phase).toBe("dusk");
  });
  it("votes are public: a chat line for each vote, change and withdrawal, and who voted for whom in the public view", () => {
    const s = day(); expect(cmdVote(s, "p0", "p2", T0)[0].text).toBe("N0 voted for N2."); expect(publicView(s).votes).toEqual({ p0: "p2" });
    expect(cmdVote(s, "p0", "p2", T0)).toEqual([]); expect(cmdVote(s, "p0", "p3", T0)[0].text).toBe("N0 changed their vote to N3."); expect(cmdVote(s, "p0", null, T0)[0].text).toBe("N0 withdrew their vote.");
    expect(cmdVote(s, "p0", null, T0)).toEqual([]);
  });
  it("verdicts are anonymous during the stage, then every choice is shown at once", () => {
    const s = day(); s.phase = "verdict"; s.accused = "p2"; cmdVerdict(s, "p0", "guilty"); cmdVerdict(s, "p1", "innocent");
    const during = JSON.stringify(publicView(s)); expect(during).not.toContain("guilty"); expect(during).not.toContain("innocent"); expect(privateView(s, "p1").myVerdict).toBe("innocent");
    const m = forceAdvance(s, T0, seeded(1)).map((x) => x.text);
    expect(m).toContain("N0 voted guilty."); expect(m).toContain("N1 voted innocent."); expect(m).toContain("N3 did not vote."); expect(m.join()).not.toContain("N2 voted");
  });
  it("a majority puts a player on trial at once", () => {
    const s = day(); for (const v of ["p0", "p1", "p3", "p5"]) cmdVote(s, v, "p2", T0); expect(s.phase).toBe("vote"); cmdVote(s, "p6", "p2", T0); expect(s.phase).toBe("defence"); expect(s.accused).toBe("p2");
  });
  it("Revealed Mayor's vote counts as 3; Reveal is no longer a Day action", () => {
    const s = day(); s.day = 2; expect(() => cmdReveal(s, "p0")).toThrow(); s.players[0].revealed = true; cmdVote(s, "p0", "p2", T0); expect(voteTally(s).p2).toBe(3);
  });
  it("guilty verdict executes and goes to Night", () => {
    const s = day(); s.phase = "verdict"; s.accused = "p2"; s.endsAt = T0; for (const v of ["p0", "p1", "p3", "p4", "p5"]) cmdVerdict(s, v, "guilty"); cmdVerdict(s, "p6", "innocent"); forceAdvance(s, T0, seeded(1));
    expect(dead(s, 2)).toBe(true); expect(s.phase).toBe("dusk");
  });
  it("innocent goes back to voting, up to 3 trials, then Night", () => {
    const s = day(); s.phase = "verdict"; s.accused = "p2"; cmdVerdict(s, "p0", "innocent"); forceAdvance(s, T0, seeded(1)); expect(s.phase).toBe("vote"); expect(s.trial).toBe(2);
    s.trial = 3; s.phase = "verdict"; s.accused = "p2"; forceAdvance(s, T0, seeded(1)); expect(s.phase).toBe("dusk");
  });
  it("the accused cannot judge themselves", () => { const s = day(); s.phase = "verdict"; s.accused = "p2"; expect(() => cmdVerdict(s, "p2", "innocent")).toThrow(); });
  it("Martyr wins when voted out and is Revealed", () => {
    const s = day(); s.phase = "verdict"; s.accused = "p4"; cmdVerdict(s, "p0", "guilty"); forceAdvance(s, T0, seeded(1)); expect(s.players[4].won).toBe(true); expect(s.players[4].revealed).toBe(true);
  });
  it("Town Crier wins when their target is voted out", () => {
    const s = game(["Town Crier", "Spy", "Doctor", "Mobster", "Godfather", "Seer"], 2); s.players[0].crierTarget = "p1"; s.phase = "verdict"; s.accused = "p1"; cmdVerdict(s, "p2", "guilty"); forceAdvance(s, T0, seeded(1)); expect(s.players[0].won).toBe(true);
  });
  it("Judge: Condemn executes; Condemning a Lanternkeeper kills the Judge", () => {
    const s = day(); s.players[1].revealed = true; cmdCondemn(s, "p1", "p2", T0, seeded(1)); expect(dead(s, 2)).toBe(true);
    const f = day(); f.players[1].revealed = true; cmdCondemn(f, "p1", "p5", T0, seeded(1)); expect(dead(f, 1)).toBe(true); expect(dead(f, 5)).toBe(false);
  });
});

describe("win conditions and chat", () => {
  const w = (roles: string[], mode: "Syndicate" | "Cartel" = "Syndicate") => { const s = game(roles, 2, mode); return checkWin(s) ? s.winner : null; };
  it("declares the right winner", () => {
    expect(w(["Spy", "Doctor"])).toBe("The Lanternkeepers"); expect(w(["Mobster", "Spy"])).toBeNull(); expect(w(["Mobster", "Godfather"])).toBe("The Syndicate"); expect(w(["Foreman", "Forger"], "Cartel")).toBe("The Cartel"); expect(w(["Butcher"])).toBe("Butcher");
    expect(w(["Butcher", "Spy"])).toBeNull(); expect(w(["Mobster", "Spy", "Doctor"])).toBeNull(); expect(w(["Butcher", "Spy", "Doctor"])).toBeNull();
  });
  const endDay = (roles: string[], d: number, mode: "Syndicate" | "Cartel" = "Syndicate") => { const s = game(roles, d, mode); s.phase = "vote"; s.day = d; s.trial = 1; s.endsAt = T0; return s; };
  it("day cap: evil and an Unbound killer both alive at the end of Day 7 means evil only", () => {
    const s = endDay(["Mobster", "Butcher", "Spy", "Doctor"], 7); forceAdvance(s, T0, seeded(1)); forceAdvance(s, s.endsAt, seeded(1)); expect(s.winner).toBe("The Syndicate"); expect(s.winners).toEqual(["p0"]);
  });
  it("quiet days alone no longer end the game", () => { const s = game(["Mobster", "Spy", "Doctor", "Seer"], 2); s.quietDays = 5; expect(checkWin(s)).toBe(false); });
  it("day cap: a living evil side wins at the end of Day 7, and not before", () => {
    const six = endDay(["Mobster", "Spy", "Doctor", "Seer"], 6); forceAdvance(six, T0, seeded(1)); expect(six.phase).toBe("dusk"); forceAdvance(six, six.endsAt, seeded(1)); expect(six.phase).toBe("night");
    const n7 = game(["Mobster", "Spy", "Doctor", "Seer"], 7); n7.endsAt = T0; forceAdvance(n7, T0, seeded(1)); expect(n7.phase).toBe("dawn");
    const s = endDay(["Mobster", "Spy", "Doctor", "Seer"], 7); forceAdvance(s, T0, seeded(1)); expect(s.phase).toBe("dusk"); const m = forceAdvance(s, s.endsAt, seeded(1));
    expect(s.phase).toBe("over"); expect(s.winner).toBe("The Syndicate"); expect(s.winners).toEqual(["p0"]); expect(m.some((x) => x.text.includes("Seven days"))).toBe(true);
    const c = endDay(["Foreman", "Spy", "Doctor", "Seer"], 7, "Cartel"); forceAdvance(c, T0, seeded(1)); forceAdvance(c, c.endsAt, seeded(1)); expect(c.winner).toBe("The Cartel");
  });
  it("the game opens with a 30-second reveal, then Night 1, then Day 1", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, name: "N" + i, bot: false }));
    const { state: s } = createGame({ players, mode: "Syndicate", timers: PUBLIC_TIMERS, townChat: true }, seeded(2), T0);
    expect(s.endsAt).toBe(T0 + 30_000); forceAdvance(s, s.endsAt, seeded(2)); expect(s.phase).toBe("night"); expect(s.night).toBe(1);
    forceAdvance(s, s.endsAt, seeded(2)); forceAdvance(s, s.endsAt, seeded(2)); expect(s.phase).toBe("discussion"); expect(s.day).toBe(1);
  });
  it("the Swindler moves the Town Crier's target and the Assassin's contract with the role", () => {
    const s = game(["Swindler", "Town Crier", "Spy", "Doctor"], 1, "Cartel"); s.players[1].crierTarget = "p3"; act(s, 0, 1, 2);
    run(s); expect(s.players[2].role).toBe("Town Crier"); expect(s.players[2].crierTarget).toBe("p3");
  });
  it("killing the last evil player on Night 7 still wins it for the Lanternkeepers", () => {
    const s = game(["Mobster", "Rogue", "Doctor"], 7); act(s, 1, 0); forceAdvance(s, T0, seeded(1)); expect(s.winner).toBe("The Lanternkeepers");
  });
  it("day cap: with no evil left, an Unbound killer still alive means nobody wins", () => {
    const s = endDay(["Butcher", "Spy", "Doctor", "Seer"], 7); forceAdvance(s, T0, seeded(1)); forceAdvance(s, s.endsAt, seeded(1)); expect(s.phase).toBe("over"); expect(s.winner).toBe("Nobody");
  });
  it("a Surviving Outcast wins alongside", () => { const s = game(["Outcast", "Spy"], 2); checkWin(s); expect(s.winners).toContain("p0"); });
  it("limits who can chat", () => {
    const s = game(["Mobster", "Spy", "Doctor"], 2); expect(canChat(s, "p0", "faction")).toBe(true); expect(canChat(s, "p1", "faction")).toBe(false); expect(canChat(s, "p1", "town")).toBe(false);
    s.phase = "defence"; s.accused = "p1"; expect(canChat(s, "p1", "town")).toBe(true); expect(canChat(s, "p2", "town")).toBe(false);
    s.phase = "discussion"; s.townChat = false; expect(canChat(s, "p1", "town")).toBe(false);
    s.players[2].alive = false; expect(canChat(s, "p2", "dead")).toBe(true); expect(canChat(s, "p2", "town")).toBe(false);
  });
  it("views do not leak hidden roles", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, name: "N" + i, bot: false }));
    const { state: s } = createGame({ players, mode: "Syndicate", timers: PUBLIC_TIMERS, townChat: true }, seeded(5), T0);
    if (!SHOW_ALL_ROLES) { const v = JSON.stringify(publicView(s)); for (const p of s.players) expect(v).not.toContain(`"${p.role}"`); }
    const kp = game(["Kingpin", "Forger", "Spy"], 1, "Cartel"); expect(privateView(kp, "p1").allies.length).toBe(0); expect(privateView(kp, "p0").allies[0].role).toBe("Forger");
  });
});

describe("night Reveal and Hold-immune swappers", () => {
  const reveal = (s: GameState, i: number) => { s.actions["p" + i] = { targets: [], alert: true }; };
  it("the Mayor Reveals at dawn from Night 2, not on Night 1", () => {
    expect(nightPrompt(game(["Mayor", "Mobster", "Spy"], 1), game(["Mayor", "Mobster", "Spy"], 1).players[0])).toBe(null);
    const s = game(["Mayor", "Mobster", "Spy"], 2); expect(nightPrompt(s, s.players[0])!.toggle).toBeTruthy();
    reveal(s, 0); const m = run(s); expect(s.players[0].revealed).toBe(true); expect(m.some((x) => x.channel === "town" && x.text.includes("Revealed"))).toBe(true);
  });
  it("a Held Mayor does not Reveal", () => {
    const s = game(["Mayor", "Enforcer", "Spy"], 2); reveal(s, 0); act(s, 1, 0); run(s); expect(s.players[0].revealed).toBeFalsy();
  });
  it("a Mayor killed that night does not Reveal", () => {
    const s = game(["Mayor", "Mobster", "Spy"], 2); reveal(s, 0); act(s, 1, 0); run(s); expect(dead(s, 0)).toBe(true); expect(s.players[0].revealed).toBeFalsy();
  });
  it("a Held Ferryman still swaps", () => {
    const s = game(["Ferryman", "Locksmith", "Foreman", "Spy", "Detective"], 1, "Cartel"); act(s, 0, 3, 4); act(s, 1, 0); act(s, 2, 3); run(s);
    expect(dead(s, 4)).toBe(true); expect(dead(s, 3)).toBe(false);
  });
});

describe("Town Crier and the Swindler", () => {
  it("the target handed the Town Crier role becomes the Martyr at once", () => {
    const s = game(["Swindler", "Town Crier", "Spy", "Doctor"], 1, "Cartel"); s.players[1].crierTarget = "p2"; act(s, 0, 1, 2);
    run(s); expect(s.players[2].role).toBe("Martyr"); expect(s.players[1].role).toBe("Spy");
  });
  it("swapping the target's role keeps the same person as the target", () => {
    const s = game(["Swindler", "Town Crier", "Spy", "Doctor"], 1, "Cartel"); s.players[0].crierTarget = undefined; s.players[1].crierTarget = "p2"; act(s, 0, 2, 3);
    run(s); expect(s.players[1].crierTarget).toBe("p2"); expect(s.players[2].role).toBe("Doctor");
  });
});

describe("No parity win (8 Nov)", () => {
  it("evil wins only once every Lanternkeeper and Unbound killer is gone", () => {
    const g = (roles: string[]) => { const s = game(roles, 2); checkWin(s); return s.winner; };
    expect(g(["Mobster", "Godfather", "Spy"])).toBeNull();
    expect(g(["Mobster", "Godfather", "Butcher"])).toBeNull();
    expect(g(["Mobster", "Godfather", "Outcast"])).toBe("The Syndicate");
  });
});

describe("Narrator feedback, round 2 (8 Nov)", () => {
  it("a Rogue who kills a Lanternkeeper is told their regret comes next night", () => {
    const s = game(["Rogue", "Spy", "Mobster", "Doctor"], 2); act(s, 0, 1); const m = run(s); expect(dead(s, 1)).toBe(true); expect(said(m, 0)).toContain("regret");
    const e = game(["Rogue", "Spy", "Mobster", "Doctor"], 2); act(e, 0, 2); expect(said(run(e), 0)).not.toContain("regret");
  });
  it("a shipped player is told privately", () => {
    const s = game(["Harbour Master", "Spy", "Doctor"], 1, "Cartel"); act(s, 0, 1); expect(said(run(s), 1)).toContain("sent away on a ship");
  });
  it("the Town Crier and Assassin hear at dawn while their targets live", () => {
    const s = game(["Town Crier", "Assassin", "Spy", "Mobster", "Doctor"], 2); s.players[0].crierTarget = "p2"; s.players[1].contract = ["Spy", "Mobster"];
    const m = run(s); expect(said(m, 0)).toContain("Your target still lives."); expect(said(m, 1)).toContain("Your targets still live.");
    const k = game(["Assassin", "Spy", "Mobster", "Doctor"], 2); k.players[0].contract = ["Spy", "Mobster"]; act(k, 2, 1); expect(said(run(k), 0)).toContain("One of your targets still lives.");
  });
  it("the Hunter hears the trap is ready on the night it can be set", () => {
    const s = game(["Hunter", "Spy", "Mobster", "Doctor"], 1); s.phase = "dusk"; s.day = 1; s.endsAt = T0; s.players[0].hasTrap = true;
    const m = forceAdvance(s, T0, seeded(1)); expect(s.night).toBe(2); expect(said(m, 0)).toContain("trap is ready");
  });
});

describe("Narrator feedback (8 Nov)", () => {
  it("the Priest fails on a dead evil player: no second Godfather", () => {
    const s = game(["Priest", "Godfather", "Mobster", "Spy", "Doctor"], 2); s.players[1].alive = false; act(s, 0, 1);
    const m = run(s); expect(dead(s, 1)).toBe(true); expect(said(m, 0)).toContain("failed"); expect(s.players[0].priestUsed).toBeFalsy();
  });
  it("Doctor and Guardsman get the same protection line; the target hears only that they were attacked", () => {
    const d = game(["Doctor", "Spy", "Mobster", "Seer"]); act(d, 0, 1); act(d, 2, 1); const md = run(d);
    expect(dead(d, 1)).toBe(false); expect(said(md, 0)).toContain("You protected your target"); expect(said(md, 1)).toContain("attacked tonight, but you survived"); expect(said(md, 2)).toContain("failed");
    const b = game(["Guardsman", "Spy", "Mobster", "Seer"]); act(b, 0, 1); act(b, 2, 1); const mb = run(b);
    expect(dead(b, 1)).toBe(false); expect(said(mb, 0)).toContain("You protected your target"); expect(said(mb, 1)).toContain("attacked tonight, but you survived"); expect(said(mb, 1)).not.toContain("protected");
  });
  it("a Warden copies the protection line", () => {
    const s = game(["Doctor", "Spy", "Mobster", "Warden"]); act(s, 0, 1); act(s, 2, 1); act(s, 3, 0); expect(said(run(s), 3)).toContain("You protected your target");
  });
  it("no protection line when nobody attacked the target", () => {
    const s = game(["Doctor", "Spy", "Mobster", "Seer"]); act(s, 0, 1); act(s, 2, 3); const m = run(s); expect(said(m, 0)).not.toContain("protected"); expect(said(m, 3)).toContain("Your lantern has gone out");
  });
  it("a Held killer attacks nobody, so nobody hears of an attack", () => {
    const s = game(["Locksmith", "Spy", "Mobster", "Seer"]); act(s, 0, 2); act(s, 2, 1); const m = run(s); expect(said(m, 1)).not.toContain("attacked"); expect(dead(s, 1)).toBe(false);
  });
  it("an attack on stronger defence fails, and the Godfather who ordered it hears too", () => {
    const s = game(["Godfather", "Mobster", "Butcher", "Spy"], 2); act(s, 0, 2); const m = run(s);
    expect(dead(s, 2)).toBe(false); expect(said(m, 0)).toContain("failed"); expect(said(m, 1)).toContain("failed"); expect(said(m, 2)).toContain("survived");
  });
  it("a Hold on a Hold-immune player fails, and they hear someone tried", () => {
    const s = game(["Locksmith", "Enforcer", "Spy"], 1); act(s, 0, 1); const m = run(s); expect(said(m, 0)).toContain("failed"); expect(said(m, 1)).toContain("tried to Hold you");
  });
  it("paying the Loan Shark is confirmed", () => {
    const s = game(["Loan Shark", "Spy", "Doctor"], 2, "Cartel"); s.players[1].debt = true; s.players[1].collection = true; act(s, 1, 0);
    const m = run(s); expect(said(m, 1)).toContain("You paid your Debt"); expect(dead(s, 1)).toBe(false);
  });
  it("the Kingpin's command is told to the member at once, and so is its withdrawal", () => {
    const s = game(["Kingpin", "Forger", "Paymaster", "Spy"], 1, "Cartel");
    const a = cmdNight(s, "p0", { targets: ["p1"] }, T0); expect(a.find((x) => x.to === "p1")?.text).toContain("commands you");
    const b = cmdNight(s, "p0", { targets: ["p2"] }, T0); expect(b.find((x) => x.to === "p1")?.text).toContain("withdrawn"); expect(b.find((x) => x.to === "p2")?.text).toContain("commands you");
    expect(cmdNight(s, "p0", { targets: ["p2"] }, T0)).toEqual([]);
    const c = cmdNight(s, "p0", { targets: [] }, T0); expect(c.find((x) => x.to === "p2")?.text).toContain("withdrawn");
  });
  it("evil killers are not offered known allies; the hidden Kingpin stays on the list", () => {
    const s = game(["Foreman", "Kingpin", "Forger", "Spy", "Loan Shark", "Harbour Master"], 2, "Cartel");
    expect(nightPrompt(s, s.players[0])!.slots[0].options.map((o) => o.id)).toEqual(["p1", "p3"]);
    expect(nightPrompt(s, s.players[4])!.slots[0].options.map((o) => o.id)).toEqual(["p1", "p3"]);
    expect(nightPrompt(s, s.players[5])!.slots[0].options.map((o) => o.id)).not.toContain("p1");
  });
});

describe("Dusk", () => {
  it("lasts 15 seconds with town chat open, then Night", () => {
    const s = game(["Mayor", "Judge", "Mobster", "Godfather", "Martyr", "Doctor", "Spy", "Seer"], 2); s.phase = "vote"; s.day = 2; s.trial = 1; s.endsAt = T0 + 30_000;
    forceAdvance(s, T0 + 30_000, seeded(1)); expect(s.phase).toBe("dusk"); expect(s.endsAt).toBe(T0 + 30_000 + 15_000);
    expect(canChat(s, "p0", "town")).toBe(true); expect(advance(s, s.endsAt - 1, seeded(1))).toEqual([]); advance(s, s.endsAt, seeded(1)); expect(s.phase).toBe("night");
  });
});

describe("Kingpin chat", () => {
  it("the Kingpin has no night chat; other Cartel members do, and do not see him as an ally", () => {
    const s = game(["Kingpin", "Forger", "Spy"], 1, "Cartel"); expect(canChat(s, "p0", "faction")).toBe(false); expect(canChat(s, "p1", "faction")).toBe(true);
    expect(privateView(s, "p1").allies.map((a) => a.name)).not.toContain("N0"); expect(privateView(s, "p0").channels.faction).toBe(false);
  });
});

describe("Swindler reach", () => {
  it("offers anyone outside the Cartel, plus the unknown Kingpin; a swap touching the Kingpin fails", () => {
    const s = game(["Swindler", "Kingpin", "Foreman", "Spy", "Doctor"], 1, "Cartel"); const ids = nightPrompt(s, s.players[0])!.slots[0].options.map((o) => o.id);
    expect(ids).toEqual(["p1", "p3", "p4"]);
    act(s, 0, 1, 3); const m = run(s); expect(said(m, 0)).toContain("failed"); expect(s.players[1].role).toBe("Kingpin"); expect(s.players[3].role).toBe("Spy");
  });
});

describe("role view extras", () => {
  it("shows the Town Crier's target and the Assassin's contract to them only", () => {
    const s = game(["Town Crier", "Assassin", "Spy", "Mobster"], 1); s.players[0].crierTarget = "p2"; s.players[1].contract = ["Spy", "Mobster"];
    expect(privateView(s, "p0").target).toEqual({ name: "N2", alive: true }); expect(privateView(s, "p1").contract).toEqual(["Spy", "Mobster"]);
    expect(privateView(s, "p2").target).toBeNull(); expect(privateView(s, "p2").contract).toBeNull();
  });
});

describe("7 Nov rulings, part two", () => {
  it("the Medium becomes a dead Lanternkeeper's role with a fresh start", () => {
    const s = game(["Medium", "Rogue", "Mobster", "Spy"], 2); s.players[1].alive = false; s.players[1].bullets = 0; act(s, 0, 1);
    const m = run(s); expect(s.players[0].role).toBe("Rogue"); expect(s.players[0].faction).toBe("Lanternkeepers"); expect(s.players[0].bullets).toBe(1); expect(said(m, 0)).toContain("You are now the Rogue");
  });
  it("the Medium cannot channel a non-Lanternkeeper, and is told", () => {
    const s = game(["Medium", "Mobster", "Godfather", "Spy"], 2); s.players[1].alive = false; act(s, 0, 1);
    const m = run(s); expect(s.players[0].role).toBe("Medium"); expect(said(m, 0)).toContain("failed");
  });
  it("the Kingpin is not offered the Swindler or the Foreman", () => {
    const s = game(["Kingpin", "Swindler", "Foreman", "Forger", "Spy"], 1, "Cartel"); const names = nightPrompt(s, s.players[0])!.slots[0].options.map((o) => o.id);
    expect(names).toEqual(["p3"]);
  });
  it("a Town Crier whose target dies at night becomes the Martyr", () => {
    const s = game(["Town Crier", "Doctor", "Mobster", "Spy"], 1); s.players[0].crierTarget = "p1"; act(s, 2, 1);
    run(s); expect(dead(s, 1)).toBe(true); expect(s.players[0].role).toBe("Martyr");
  });
  it("a raised player comes back clean", () => {
    const s = game(["Priest", "Doctor", "Mobster", "Spy"], 2); const d = s.players[1]; d.alive = false; d.debt = true; d.planted = true; d.framed = true; act(s, 0, 1);
    run(s); expect(d.alive).toBe(true); expect(d.debt || d.planted || d.framed).toBe(false);
  });
});

describe("7 Nov rulings", () => {
  it("the Fence leads a Locksmith astray: the Hold lands on a neighbour, not the Fence", () => {
    // The Locksmith aims at the Fence; the Fence leads him astray, so the Hold falls on the Doctor (the Fence's neighbour) instead.
    const s = game(["Fence", "Locksmith", "Doctor", "Spy", "Mobster"], 1); act(s, 0, 1); act(s, 1, 0); act(s, 2, 3); act(s, 4, 3);
    const m = run(s); expect(said(m, 0)).not.toContain("Held"); expect(said(m, 2)).toContain("Held"); expect(dead(s, 3)).toBe(true);
  });
  it("a Fence held by a different Holder cannot lead astray", () => {
    const s = game(["Fence", "Locksmith", "Doctor", "Spy", "Locksmith"], 1); act(s, 0, 1); act(s, 1, 3); act(s, 4, 0);
    const m = run(s); expect(said(m, 0)).toContain("Held");
  });
  it("the Pawnbroker draws a Hold onto himself", () => {
    const s = game(["Pawnbroker", "Locksmith", "Doctor", "Foreman", "Spy"], 1, "Cartel"); act(s, 0, 1); act(s, 1, 2); act(s, 2, 4); act(s, 3, 4);
    const m = run(s); expect(said(m, 0)).toContain("Held"); expect(said(m, 2)).not.toContain("Held"); expect(dead(s, 4)).toBe(false);
  });
  it("a Held debtor cannot pay and dies", () => {
    const s = game(["Loan Shark", "Doctor", "Locksmith", "Spy"], 2, "Cartel"); s.players[1].debt = true; s.players[1].collection = true;
    s.actions.p1 = { targets: ["p0"] }; act(s, 2, 1); run(s); expect(dead(s, 1)).toBe(true);
  });
  it("a Mayor whose role is swindled tonight does not Reveal", () => {
    const s = game(["Mayor", "Swindler", "Spy", "Doctor"], 2, "Cartel"); s.actions.p0 = { targets: [], alert: true }; act(s, 1, 0, 2);
    run(s); expect(s.players[0].revealed).toBeFalsy(); expect(s.players[0].role).toBe("Spy");
  });
  it("the Swindler fails on a player who dies tonight", () => {
    const s = game(["Swindler", "Mobster", "Spy", "Doctor", "Detective"], 1, "Cartel"); act(s, 0, 2, 3); act(s, 1, 2);
    const m = run(s); expect(said(m, 0)).toContain("failed"); expect(s.players[3].role).toBe("Doctor");
  });
});

describe("night order", () => {
  it("a Lanternkeeper investigator killed tonight gets no result", () => {
    const s = game(["Mobster", "Detective", "Spy"], 1); act(s, 0, 1); act(s, 1, 0);
    const m = run(s); expect(dead(s, 1)).toBe(true); expect(said(m, 1)).not.toContain("role.");
  });
  it("a protected investigator still gets the result", () => {
    const s = game(["Mobster", "Detective", "Doctor"], 1); act(s, 0, 1); act(s, 1, 0); act(s, 2, 1);
    const m = run(s); expect(dead(s, 1)).toBe(false); expect(said(m, 1)).toContain("role.");
  });
  it("the evil side still gets its result when killed", () => {
    const s = game(["Notary", "Rogue", "Spy"], 2); act(s, 0, 2); act(s, 1, 0);
    const m = run(s); expect(dead(s, 0)).toBe(true); expect(said(m, 0)).toContain("Spy");
  });
});

describe("in-person pause", () => {
  it("stops the clock, blocks moves and resumes with the time left", () => {
    const s = game(["Mobster", "Doctor", "Spy"], 1); s.inPerson = true; s.endsAt = T0 + 30_000;
    expect(cmdPause(s, "p1", T0)[0].text).toContain("paused");
    expect(advance(s, T0 + 999_999, seeded(1))).toEqual([]); expect(s.phase).toBe("night");
    expect(() => cmdNight(s, "p1", { targets: ["p2"] }, T0)).toThrow("paused");
    expect(canChat(s, "p0", "faction")).toBe(false);
    cmdResume(s, "p2", T0 + 500_000); expect(s.endsAt).toBe(T0 + 530_000); expect(canChat(s, "p0", "faction")).toBe(true);
  });
  it("in person, only the evil side's night chat is open", () => {
    const s = game(["Mobster", "Doctor", "Spy"], 1); s.inPerson = true; s.townChat = false; s.players[2].alive = false;
    expect(canChat(s, "p0", "faction")).toBe(true); expect(canChat(s, "p2", "dead")).toBe(false);
    s.phase = "discussion"; expect(canChat(s, "p1", "town")).toBe(false);
  });
  it("a Random party's public view does not name the evil side", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, name: "N" + i, bot: false }));
    const { state: s } = createGame({ players, mode: "Cartel", timers: PUBLIC_TIMERS, townChat: true, setup: "Random" }, seeded(9), T0);
    const v = publicView(s); expect(v.setup).toBe("Random"); expect(JSON.stringify(v)).not.toContain("Cartel");
  });
  it("is refused in online parties", () => { const s = game(["Mobster", "Doctor"], 1); expect(() => cmdPause(s, "p0", T0)).toThrow(); });
});

describe("roster", () => {
  it("adds up to the player count for both modes", () => {
    for (const mode of ["Syndicate", "Cartel"] as const) for (let n = 8; n <= 15; n++) expect(rosterFor(n, mode).reduce((a, x) => a + x.count, 0)).toBe(n);
  });
});

describe("full games", () => {
  it("3,200 random games at every size finish without errors", () => {
    let unfinished = 0; const winners: Record<string, number> = {};
    for (let i = 0; i < 3200; i++) {
      const size = 8 + (i % 8), mode = i % 16 < 8 ? "Syndicate" : "Cartel" as const, r = seeded(1000 + i);
      const players = Array.from({ length: size }, (_, k) => ({ id: "p" + k, name: "N" + k, bot: true }));
      const { state: s } = createGame({ players, mode: mode as "Syndicate" | "Cartel", timers: PUBLIC_TIMERS, townChat: true }, r, T0);
      let t = T0, n = 0;
      while (s.phase !== "over" && n++ < 1500) { t = s.endsAt; advance(s, t, r); JSON.stringify(publicView(s)); s.players.forEach((p) => privateView(s, p.id)); }
      if (s.phase !== "over") unfinished++; else winners[s.winner!] = (winners[s.winner!] ?? 0) + 1;
    }
    console.log(winners);
    expect(unfinished).toBe(0);
  }, 180000);
});

describe("Spy (Nik, 10 Nov)", () => {
  it("learns which players the evil side visited, not who or how many", () => {
    const s = game(["Godfather", "Mobster", "Doctor", "Spy", "Detective"]); act(s, 0, 2); act(s, 4, 1);
    const m = run(s); expect(said(m, 3)).toContain("The evil side visited: N2.");
    expect(said(m, 3)).not.toContain("N1");
  });
  it("hears nobody on a night without evil visits", () => {
    const s = game(["Godfather", "Doctor", "Spy", "Detective"]); act(s, 3, 1);
    expect(said(run(s), 2)).toContain("The evil side visited: nobody.");
  });
  it("lists each visited player once, in seat order", () => {
    const s = game(["Foreman", "Loan Shark", "Doctor", "Spy", "Detective", "Watchman"], 1, "Cartel"); act(s, 0, 5); act(s, 1, 2);
    expect(said(run(s), 3)).toContain("The evil side visited: N2, N5.");
  });
});

describe("Debt without a living Loan Shark (Nik, 10 Nov)", () => {
  it("a Coroner can borrow a dead Loan Shark; the Debt is void at nightfall", () => {
    const s = game(["Coroner", "Loan Shark", "Oracle", "Doctor"], 2, "Cartel"); s.players[1].alive = false; act(s, 0, 1, 2);
    const m = run(s); expect(said(m, 0)).toContain("N2: Oracle."); expect(said(m, 0)).not.toContain("failed"); expect(s.players[2].debt).toBe(true);
    s.phase = "dusk"; s.endsAt = T0; const n = forceAdvance(s, T0, seeded(1)); expect(said(n, 2)).not.toContain("You owe"); expect(s.players[2].debt).toBe(false);
  });
  it("voids any Debt when Night falls and no Loan Shark lives", () => {
    const s = game(["Foreman", "Loan Shark", "Oracle", "Doctor"], 2, "Cartel"); s.players[1].alive = false; s.players[2].debt = true;
    s.phase = "dusk"; s.endsAt = T0; const m = forceAdvance(s, T0, seeded(1));
    expect(said(m, 2)).not.toContain("You owe"); expect(s.players[2].collection).toBeFalsy(); expect(s.players[2].debt).toBe(false);
  });
});

describe("evil roles and their own side (Nik, 11 Nov)", () => {
  it("Syndicate and Cartel roles are not offered themselves or known allies", () => {
    const s = game(["Framer", "Mobster", "Doctor", "Spy"], 2); s.phase = "night";
    const ids = nightPrompt(s, s.players[0])!.slots[0].options.map((o) => o.id); expect(ids).toEqual(["p2", "p3"]);
    const c = game(["Smuggler", "Notary", "Kingpin", "Doctor"], 3, "Cartel"); c.phase = "night";
    const sm = nightPrompt(c, c.players[0])!.slots[0].options.map((o) => o.id); expect(sm).toEqual(["p2", "p3"]);
  });
  it("the Tailor, Kingpin and Harbour Master Guns still choose their own side", () => {
    const s = game(["Tailor", "Mobster", "Doctor"], 2); s.phase = "night"; expect(nightPrompt(s, s.players[0])!.slots[0].options.map((o) => o.id)).toContain("p1");
  });
});

describe("failed once-per-game uses are kept (Nik, 11 Nov)", () => {
  it("Kingpin, Swindler and Medium keep a use that failed; the Rogue's bullet is spent", () => {
    const k = game(["Kingpin", "Mayor", "Spy"], 2, "Cartel"); act(k, 0, 1); run(k); expect(k.players[0].recruited).toBeFalsy(); expect(k.players[1].role).toBe("Mayor");
    const w = game(["Swindler", "Spy", "Mayor", "Doctor"], 1, "Cartel"); w.players[2].revealed = true; act(w, 0, 1, 2); run(w); expect(w.players[0].swindled).toBeFalsy();
    const m = game(["Medium", "Godfather", "Spy"], 2); m.players[1].alive = false; act(m, 0, 1); run(m); expect(m.players[0].mediumUsed).toBeFalsy(); expect(m.players[0].role).toBe("Medium");
    const r = game(["Rogue", "Godfather", "Spy"], 2); act(r, 0, 1); run(r); expect(r.players[1].alive).toBe(true); expect(r.players[0].bullets).toBe(0);
  });
  it("the Hollowman has Basic Defence on Fog Nights", () => {
    const s = game(["Hollowman", "Mobster", "Spy"], 2); act(s, 1, 0); run(s); expect(s.players[0].alive).toBe(true);
  });
});
