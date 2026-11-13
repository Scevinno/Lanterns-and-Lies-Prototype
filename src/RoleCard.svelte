<script lang="ts">
  import { abilityHtml, summaryHtml, type Role } from "./richtext";
  import { FACTION_CLASS } from "./api";
  import { isUnique } from "../shared/engine";
  import TermSheet from "./TermSheet.svelte";
  export let role: Role;
  /** Off inside a game, so a link never takes a player out of it. */
  export let guideLinks = true;
  /** Opens a game word's own page when its sheet is pulled up (Nik, 13 Nov). Not given inside a game. */
  export let onOpenTerm: ((id: string) => void) | null = null;
  const base = import.meta.env.BASE_URL;
  // Roman numerals beside the level as a quick visual cue (Nik, 12 Nov).
  const NUM: Record<string, string> = { Light: "I", Heavy: "II", Absolute: "III" };
  // Game words in the card text open a half-screen explanation (Nik, 12 Nov). Each word is tappable once per card.
  let term: string | null = null;
  $: seen = (role, new Set<string>());
  $: lore = summaryHtml(role.summary, seen);
  $: rules = abilityHtml(role.ability, role.faction, seen);
  const tap = (e: MouseEvent) => { const t = (e.target as HTMLElement).closest(".term") as HTMLElement | null; if (t) term = t.dataset.term ?? null; };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="rolecard" on:click={tap}>
  <img src={base + role.image} alt={role.name} width="544" height="528" loading="lazy" />
  <h2 class={FACTION_CLASS[role.faction]}>{role.name}</h2>
  <p class="meta {FACTION_CLASS[role.faction]}">{role.faction} {role.type}</p>
  {#if isUnique(role.name)}<p class="unique-line"><span class="unique" aria-hidden="true">1</span> Unique</p>{/if}
  {#if role.placeholder}<p class="dim small">Placeholder picture</p>{/if}
  <p class="lore">{@html lore}</p>
  <div class="rules">{@html rules}</div>
  <!-- Attack and Defence (Nik, 12 Nov): the highest level, own or given; one format on every card. -->
  <div class="stats">
    {#each [["Attack", role.attack], ["Defence", role.defence]] as [label, v]}
      {@const given = (v ?? "").endsWith("(given)")}
      {@const lvl = (v ?? "None").replace(" (given)", "")}
      <div class="stat" class:none={!v || v === "None"}><span class="stat-label">{label}</span><b>{lvl}{#if NUM[lvl]} <span class="stat-num">{NUM[lvl]}</span>{/if}</b>{#if given}<span class="stat-note">given to others</span>{/if}</div>
    {/each}
  </div>
  {#if guideLinks}<a class="link stats-link" href="#/combat">How Attack and Defence work</a>{/if}
</div>
<TermSheet id={term} {guideLinks} onExpand={onOpenTerm} onClose={() => (term = null)} />
