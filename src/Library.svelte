<script lang="ts">
  // The role library: search, side tabs, a type menu, and a two-column picture grid.
  // Used from the Role guide and from the in-game Roster, which can open it pre-filtered.
  import { FACTION_CLASS } from "./api";
  import type { Role } from "./richtext";
  export let roles: Role[];
  export let factionFilter = "All";
  export let typeFilter = "All"; // a role type, "All", or "Random" (what a Random roster slot can deal)
  export let search = "";
  export let onOpen: (r: Role) => void;

  // A Random slot deals any non-Power Lanternkeeper, or an evil side's Support and Deceptive roles.
  const randomFits = (r: Role) => (r.faction === "Lanternkeepers" ? r.type !== "Power" : ["Support", "Deceptive"].includes(r.type));
  $: types = [...new Set(roles.filter((r) => factionFilter === "All" || r.faction === factionFilter).map((r) => r.type))];
  $: if (typeFilter !== "All" && typeFilter !== "Random" && !types.includes(typeFilter)) typeFilter = "All";
  $: q = search.trim().toLowerCase();
  $: filtered = roles.filter((r) => (factionFilter === "All" || r.faction === factionFilter) && (typeFilter === "All" || (typeFilter === "Random" ? randomFits(r) : r.type === typeFilter)) && (!q || r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)));
</script>

<input type="search" bind:value={search} placeholder="Search by name or summary" aria-label="Search roles" />
<!-- Filters (Nik, 13 Nov; Creative Coach Idea A): a tab per side, and the role type in a menu. -->
<div class="segf" role="tablist" aria-label="Side">{#each ["All", "Lanternkeepers", "Mafia", "Syndicate", "Unbound"] as f}<button role="tab" aria-selected={factionFilter === f} class:on={factionFilter === f} class={f === "All" ? "" : FACTION_CLASS[f]} on:click={() => (factionFilter = f)}>{f === "Lanternkeepers" ? "Keepers" : f}</button>{/each}</div>
<label class="selwrap"><span>Type</span><select bind:value={typeFilter} class:set={typeFilter !== "All"}>{#each ["All", ...(typeFilter === "Random" ? ["Random"] : []), ...types] as t}<option value={t}>{t === "All" ? "All types" : t === "Random" ? "Random slot" : t}</option>{/each}</select></label>
<p class="dim small">{filtered.length} of {roles.length} roles</p>
<ul class="plain grid">{#each filtered as r (r.id)}<li><button class="tile" on:click={() => onOpen(r)}><img src={import.meta.env.BASE_URL + r.image} alt="" width="272" height="264" loading="lazy" decoding="async" /><b class={FACTION_CLASS[r.faction]}>{r.name}</b><span class="small dim">{r.faction === "Lanternkeepers" ? "Keeper" : r.faction} · {r.type}</span></button></li>{/each}</ul>
{#if !filtered.length}<p class="dim tc">No roles match.</p>{/if}
