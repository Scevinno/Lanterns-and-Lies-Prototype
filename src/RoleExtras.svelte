<script lang="ts">
  // What comes with your role beyond its card: a changed ability, the Executioner's target, the Assassin's contract, your side.
  // Shown under the role card on phones and in the right-hand column on desktop.
  import { FACTION_CLASS } from "./api";
  import { roleByName } from "./richtext";
  export let view: any;
</script>

{#if view.ability !== view.role}<p class="dim">You now have the ability of the {view.ability}.</p>{/if}
{#if view.target}<div class="side"><h3 class="f-ub">Your target</h3><ul class="plain"><li><b>{view.target.name}</b><span class="dim">{view.target.alive ? "Get them voted out" : "Dead"}</span></li></ul></div>{/if}
{#if view.contract}<div class="side"><h3 class="f-ub">{view.markStage === 2 ? "Your second mark" : "Your first mark"}</h3><ul class="plain">{#each view.contract as c}<li><b class={FACTION_CLASS[roleByName(c)?.faction ?? ""]}>{c}</b><span class="dim">{roleByName(c)?.faction ?? ""}</span></li>{/each}</ul><p class="dim small">{view.markStage === 2 ? "When they die, by any hand, you win." : "When they die, by any hand, you get your second mark."}</p></div>{/if}
{#if view.allies.length}<div class="side"><h3 class={FACTION_CLASS[view.faction]}>Your side</h3><ul class="plain">{#each view.allies as a}<li><b>{a.name}</b>{#if a.role}<span class={FACTION_CLASS[view.faction]}>{a.role}</span>{/if}</li>{/each}</ul></div>{/if}
