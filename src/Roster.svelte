<script lang="ts">
  // Which categories are dealt for a player count and evil side. Faction and category only, never the roles inside them.
  import { rosterFor } from "../shared/engine";
  import { FACTION_CLASS } from "./api";
  export let size: number;
  export let mode: "Syndicate" | "Cartel";
  $: slots = rosterFor(size, mode);
  $: groups = ["Lanternkeepers", mode, "Unbound"].map((f) => ({ faction: f, slots: slots.filter((s) => s.faction === f) })).filter((g) => g.slots.length);
  const label = (f: string, c: string) => (c === "Random" ? `Random ${f === "Lanternkeepers" ? "Lanternkeeper" : f}` : `${f === "Lanternkeepers" ? "Lanternkeeper" : f} ${c}`);
</script>

<div class="roster-list">
  {#each groups as g}
    <h3 class={FACTION_CLASS[g.faction]}>{g.faction} <span class="dim small">{g.slots.reduce((a, s) => a + s.count, 0)}</span></h3>
    <ul class="plain">
      {#each g.slots as s}<li class="slot {FACTION_CLASS[g.faction]}-edge"><span class="n">{s.count}×</span><span class="cat">{label(g.faction, s.category)}</span></li>{/each}
    </ul>
  {/each}
</div>
