<script lang="ts">
  import { abilityHtml, summaryHtml, type Role } from "./richtext";
  import { FACTION_CLASS } from "./api";
  import { isUnique } from "../shared/engine";
  export let role: Role;
  const base = import.meta.env.BASE_URL;
  // Roman numerals beside the level as a quick visual cue (Nik, 12 Nov).
  const NUM: Record<string, string> = { Light: "I", Heavy: "II", Absolute: "III" };
</script>

<div class="rolecard">
  <img src={base + role.image} alt={role.name} width="544" height="528" loading="lazy" />
  <h2 class={FACTION_CLASS[role.faction]}>{role.name}</h2>
  <p class="meta {FACTION_CLASS[role.faction]}">{role.faction} {role.type}</p>
  {#if isUnique(role.name)}<p class="unique-line"><span class="unique" aria-hidden="true">1</span> Unique</p>{/if}
  {#if role.placeholder}<p class="dim small">Placeholder picture</p>{/if}
  <p>{@html summaryHtml(role.summary)}</p>
  <div class="rules">{@html abilityHtml(role.ability, role.faction)}</div>
  <!-- Attack and Defence (Nik, 12 Nov): the highest level, own or given; one format on every card. -->
  <div class="stats">
    {#each [["Attack", role.attack], ["Defence", role.defence]] as [label, v]}
      {@const given = (v ?? "").endsWith("(given)")}
      {@const lvl = (v ?? "None").replace(" (given)", "")}
      <div class="stat" class:none={!v || v === "None"}><span class="stat-label">{label}</span><b>{lvl}{#if NUM[lvl]} <span class="stat-num">{NUM[lvl]}</span>{/if}</b>{#if given}<span class="stat-note">given to others</span>{/if}</div>
    {/each}
  </div>
</div>
