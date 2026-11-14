<script lang="ts">
  // One game word: its text, the words it mentions, and the cards it appears on.
  // Phones show it as its own page; desktop shows it in the Guide's right-hand panel (Nik, 14 Nov).
  import { relatedTerms, wordRx, type Term } from "./guide";
  import { FACTION_CLASS } from "./api";
  import type { Role } from "./richtext";
  export let term: Term;
  export let roles: Role[] = [];
  export let onGo: (id: string) => void;
  export let showAll = true;

  // The cards a word links from (ability bullets only, as on the cards), or every role of a type.
  const bullets = (r: Role) => r.ability.split("\n").filter((l) => l.trim().startsWith("•")).join(" ");
  $: rel = relatedTerms(term);
  $: cards = term.type ? roles.filter((r) => r.type === term.type) : term.match.length ? roles.filter((r) => wordRx(term.match).test(bullets(r))) : [];
</script>

<h1 class="ptitle term-title">{term.title}</h1>
<p class="term-text">{term.text}</p>
{#if rel.length}<div class="glabel">Mentioned here</div><div class="rel">{#each rel as x (x.id)}<button on:click={() => onGo(x.id)}>{x.title}</button>{/each}</div>{/if}
{#if cards.length}<div class="glabel">{term.type ? "Roles of this type" : "On these cards"}</div><div class="rel">{#each cards as r (r.id)}<span class={FACTION_CLASS[r.faction]}>{r.name}</span>{/each}</div>{/if}
{#if showAll}<a class="link term-all" href="#/glossary">All game words</a>{/if}
