<script lang="ts">
  import { abilityHtml, summaryHtml, type Role } from "./richtext";
  import { FACTION_CLASS } from "./api";
  import { isUnique } from "../shared/engine";
  export let role: Role;
  const base = import.meta.env.BASE_URL;
</script>

<div class="rolecard">
  <img src={base + role.image} alt={role.name} width="544" height="528" loading="lazy" />
  <h2 class={FACTION_CLASS[role.faction]}>{role.name}</h2>
  <p class="meta {FACTION_CLASS[role.faction]}">{role.faction} {role.type}</p>
  {#if isUnique(role.name)}<p class="unique-line"><span class="unique" aria-hidden="true">1</span> Unique</p>{/if}
  {#if role.placeholder}<p class="dim small">Placeholder picture</p>{/if}
  <p>{@html summaryHtml(role.summary)}</p>
  <div class="rules">{@html abilityHtml(role.ability, role.faction)}</div>
</div>
