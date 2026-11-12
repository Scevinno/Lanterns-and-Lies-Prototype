<script lang="ts">
  // The Guide (Nik, 12 Nov; Creative Coach's Idea 1): one menu under Home for Roles, How to play,
  // Attack & Defence and the Glossary. Roles keeps its own screen (library and rosters).
  import { HOW_TO_PLAY, COMBAT_INTRO, COMBAT_TABLE, COMBAT_RULES, GLOSSARY } from "./guide";
  import { FACTION_CLASS } from "./api";
  import type { Role } from "./richtext";
  export let page: "guide" | "rules" | "combat" | "glossary";
  export let roles: Role[] = [];
  const go = (r: string) => { location.hash = "#/" + r; scrollTo(0, 0); };
  const NUM: Record<string, string> = { Light: "I", Heavy: "II", Absolute: "III" };
  const lvl = (v?: string) => (v ?? "None").replace(" (given)", "");
  $: fighters = roles.filter((r) => (r.attack && r.attack !== "None") || (r.defence && r.defence !== "None"));
  $: glossary = [...GLOSSARY].sort((a, b) => a.title.localeCompare(b.title));
  const ROWS = [
    { to: "roles", title: "Roles", sub: "Every role, and the roster for each player count" },
    { to: "rules", title: "How to play", sub: "A game from start to end" },
    { to: "combat", title: "Attack & Defence", sub: "Light, Heavy, Absolute, and who has what" },
    { to: "glossary", title: "Glossary", sub: "Every game word explained" },
  ];
</script>

<main class="narrow guide">
  <button class="link back" on:click={() => go(page === "guide" ? "home" : "guide")}>Back</button>
  {#if page === "guide"}
    <h1 class="ptitle">Guide</h1>
    {#each ROWS as r}
      <button class="line guide-row" on:click={() => go(r.to)}><span><b>{r.title}</b><br /><span class="dim small">{r.sub}</span></span><span class="dim">›</span></button>
    {/each}
  {:else if page === "rules"}
    <h1 class="ptitle">How to play</h1>
    {#each HOW_TO_PLAY as s}
      <h3>{s.title}</h3>
      {#each s.body as p}<p>{p}</p>{/each}
    {/each}
  {:else if page === "combat"}
    <h1 class="ptitle">Attack &amp; Defence</h1>
    {#each COMBAT_INTRO as p}<p>{p}</p>{/each}
    <table class="combat">
      {#each COMBAT_TABLE as row, i}
        <tr>{#each row as c, j}{#if i === 0 || j === 0}<th>{c}</th>{:else}<td class:dies={c === "Dies"}>{c}</td>{/if}{/each}</tr>
      {/each}
    </table>
    {#each COMBAT_RULES as s}
      <h3>{s.title}</h3>
      {#each s.body as p}<p>{p}</p>{/each}
    {/each}
    <h3>Who has what</h3>
    <p class="dim small">The highest level each role can reach. "Given" means the role gives that defence to someone else.</p>
    <ul class="plain who">
      {#each fighters as r}
        <li><span class={FACTION_CLASS[r.faction]}>{r.name}</span>
          <span class="dim small">Attack {lvl(r.attack)}{NUM[lvl(r.attack)] ? " " + NUM[lvl(r.attack)] : ""} · Defence {lvl(r.defence)}{NUM[lvl(r.defence)] ? " " + NUM[lvl(r.defence)] : ""}{(r.defence ?? "").includes("given") ? " (given)" : ""}</span></li>
      {/each}
    </ul>
  {:else}
    <h1 class="ptitle">Glossary</h1>
    <dl class="glossary">
      {#each glossary as t (t.id)}<dt id={"g-" + t.id}>{t.title}</dt><dd>{t.text}</dd>{/each}
    </dl>
  {/if}
</main>
