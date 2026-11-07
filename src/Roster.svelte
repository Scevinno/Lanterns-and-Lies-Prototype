<script lang="ts">
  // Which categories are dealt for a player count and evil side. Tap a line to see the roles that can fill it.
  import { rosterFor } from "../shared/engine";
  import { FACTION_CLASS } from "./api";
  export let size: number;
  export let mode: "Syndicate" | "Cartel";
  export let onRole: ((name: string) => void) | null = null;
  let open = "";
  $: slots = rosterFor(size, mode);
  $: groups = ["Lanternkeepers", mode, "Unbound"].map((f) => ({ faction: f, slots: slots.filter((s) => s.faction === f) })).filter((g) => g.slots.length);
  const label = (f: string, c: string) => (c === "Random" ? `Random ${f === "Lanternkeepers" ? "Lanternkeeper" : f}` : `${f === "Lanternkeepers" ? "Lanternkeeper" : f} ${c}`);
</script>

<div class="roster-list">
  {#each groups as g}
    <h3 class={FACTION_CLASS[g.faction]}>{g.faction} <span class="dim small">{g.slots.reduce((a, s) => a + s.count, 0)}</span></h3>
    <ul class="plain">
      {#each g.slots as s}
        {@const k = g.faction + s.category}
        <li class="slot {FACTION_CLASS[g.faction]}-edge">
          <button type="button" aria-expanded={open === k} on:click={() => (open = open === k ? "" : k)}>
            <span class="n">{s.count}×</span><span class="cat">{label(g.faction, s.category)}</span><span class="dim small">{open === k ? "Hide" : "Roles"}</span>
          </button>
          {#if open === k}
            <p class="pool small">{#each s.roles as r, i}{#if onRole}<button type="button" class="rolelink" on:click={() => onRole?.(r)}>{r}</button>{:else}<span>{r}</span>{/if}{i < s.roles.length - 1 ? " · " : ""}{/each}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/each}
  <p class="dim small">Random slots never deal a Power role. One evil side plays per game.</p>
</div>
