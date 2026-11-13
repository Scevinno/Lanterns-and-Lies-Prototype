<script lang="ts">
  // The Guide (Nik, 12 Nov; Creative Coach's Idea 1): one menu under Home for Roles, How to play,
  // Attack & Defence and the Glossary. Roles keeps its own screen (library and rosters).
  import { HOW_TO_PLAY, COMBAT_INTRO, COMBAT_TABLE, COMBAT_RULES, GLOSSARY, termById } from "./guide";
  import { FACTION_CLASS } from "./api";
  import { paintHtml, type Role } from "./richtext";
  export let page: "guide" | "rules" | "combat" | "glossary" | "term";
  /** The term shown on its own page (#/term/<id>): reached by dragging up a term sheet on a role card. */
  export let termId = "";
  $: term = page === "term" ? termById(termId) : null;
  // Back from a term page returns to where it was opened (a role card keeps its place); straight links fall back to the Glossary.
  const back = () => { if (page === "term" && history.length > 1) history.back(); else go(page === "guide" ? "home" : page === "term" ? "glossary" : "guide"); };
  // Winning lines take the edge colour of the side they are about.
  const side = (t: string) => (t.startsWith("Lanternkeepers") ? "lk" : t.startsWith("The evil side") ? "syn" : /^(An|Other) Unbound/.test(t) ? "ub" : "");
  const label = (t: string) => { const i = t.indexOf(": "); if (i <= 0 || i >= 20) return ["", t]; const r = t.slice(i + 2); return [t.slice(0, i), r.charAt(0).toUpperCase() + r.slice(1)]; };
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
  <button class="link back" on:click={back}>Back</button>
  {#if page === "guide"}
    <h1 class="ptitle">Guide</h1>
    {#each ROWS as r}
      <button class="line guide-row" on:click={() => go(r.to)}><span><b>{r.title}</b><br /><span class="dim small">{r.sub}</span></span><span class="dim">›</span></button>
    {/each}
  {:else if page === "rules"}
    <h1 class="ptitle">How to play</h1>
    {#each HOW_TO_PLAY as s}
      <section class="htp {s.tone ?? ''}">
        <h3>{s.title}</h3>
        {#if s.kind === "order"}
          <ol class="order">{#each s.body as p}<li><span>{@html paintHtml(p)}</span></li>{/each}</ol>
        {:else if s.kind === "steps"}
          <ul class="plain steps">{#each s.body.map(label) as [l, t]}<li class:note={!l}>{#if l}<span class="step">{l}</span>{/if}<span>{@html paintHtml(t)}</span></li>{/each}</ul>
        {:else if s.kind === "sides"}
          <ul class="plain sides">{#each s.body as p}<li class={"s-" + (side(p) || "none")}>{@html paintHtml(p)}</li>{/each}</ul>
        {:else}
          {#each s.body as p}<p>{@html paintHtml(p)}</p>{/each}
        {/if}
      </section>
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
  {:else if page === "term"}
    {#if term}
      <h1 class="ptitle term-title">{term.title}</h1>
      <p class="term-text">{term.text}</p>
      <a class="link term-all" href="#/glossary">All game words</a>
    {:else}<p class="dim tc">That game word isn't in the Glossary.</p>{/if}
  {:else}
    <h1 class="ptitle">Glossary</h1>
    <dl class="glossary">
      {#each glossary as t (t.id)}<dt id={"g-" + t.id}>{t.title}</dt><dd>{t.text}</dd>{/each}
    </dl>
  {/if}
</main>
