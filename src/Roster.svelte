<script lang="ts">
  // The categories dealt for a player count and the party's evil side setting. Faction and category only, never roles.
  // Random stays Random: the evil side is one unnamed line, and counts that depend on which side is dealt show a range.
  import { rosterFor } from "../shared/engine";
  import { FACTION_CLASS } from "./api";
  export let size: number;
  export let mode: "Syndicate" | "Cartel" | "Random";
  /** When set, each line opens the role library filtered to its faction and type ("Random" = what a Random slot deals). */
  export let onPick: ((faction: string, type: string) => void) | null = null;
  type Line = { category: string; min: number; max: number; pick?: [string, string] };
  type Group = { faction: string; cls: string; lines: Line[] };
  const lkName = (c: string) => (c === "Random" ? "Random Lanternkeeper" : `Lanternkeeper ${c}`);

  function build(n: number, m: string): Group[] {
    const modes = m === "Random" ? (["Syndicate", "Cartel"] as const) : ([m] as ("Syndicate" | "Cartel")[]);
    const decks = modes.map((x) => rosterFor(n, x));
    const range = (pick: (d: ReturnType<typeof rosterFor>) => number) => { const v = decks.map(pick); return { min: Math.min(...v), max: Math.max(...v) }; };
    const count = (d: ReturnType<typeof rosterFor>, f: (s: any) => boolean) => d.filter(f).reduce((a, s) => a + s.count, 0);
    const lk: Line[] = ["Power", "Investigative", "Protective", "Killing", "Random"].map((c) => ({ category: lkName(c), pick: ["Lanternkeepers", c] as [string, string], ...range((d) => count(d, (s) => s.faction === "Lanternkeepers" && s.category === c)) })).filter((l) => l.max > 0);
    let evil: Group;
    if (m === "Random") evil = { faction: "Evil side", cls: "lamp", lines: [{ category: "Syndicate or Cartel, not told which", ...range((d) => count(d, (s) => s.faction === "Syndicate" || s.faction === "Cartel")) }] };
    else evil = { faction: m, cls: FACTION_CLASS[m], lines: decks[0].filter((s) => s.faction === m).map((s) => ({ category: s.category === "Random" ? `Random ${m}` : `${m} ${s.category}`, pick: [m, s.category] as [string, string], min: s.count, max: s.count })) };
    const ub: Line[] = ["Chaos", "Killing"].map((c) => ({ category: `Unbound ${c}`, pick: ["Unbound", c] as [string, string], ...range((d) => count(d, (s) => s.faction === "Unbound" && s.category === c)) })).filter((l) => l.max > 0);
    return [{ faction: "Lanternkeepers", cls: FACTION_CLASS.Lanternkeepers, lines: lk }, evil, { faction: "Unbound", cls: FACTION_CLASS.Unbound, lines: ub }];
  }
  $: groups = build(size, mode);
  const n = (l: Line) => (l.min === l.max ? `${l.min}` : `${l.min}–${l.max}`);
  const total = (g: Group) => { const a = g.lines.reduce((x, l) => x + l.min, 0), b = g.lines.reduce((x, l) => x + l.max, 0); return a === b ? `${a}` : `${a}–${b}`; };
</script>

<div class="roster-list">
  {#each groups as g}
    <h3 class={g.cls}>{g.faction} <span class="dim small">{total(g)}</span></h3>
    <ul class="plain">
      {#each g.lines as l}<li class="slot {g.cls === 'lamp' ? '' : g.cls + '-edge'}">{#if onPick && l.pick}<button type="button" class="slotbtn" on:click={() => l.pick && onPick?.(l.pick[0], l.pick[1])}><span class="n">{n(l)}×</span><span class="cat">{l.category}</span><span class="dim small" aria-hidden="true">Roles ›</span></button>{:else}<span class="n">{n(l)}×</span><span class="cat">{l.category}</span>{/if}</li>{/each}
    </ul>
  {/each}
</div>
