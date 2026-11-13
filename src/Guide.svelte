<script lang="ts">
  // The Guide (Nik, 12 Nov; Creative Coach's Idea 1): one menu under Home for Roles, How to play,
  // Attack & Defence and the Glossary. Roles keeps its own screen (library and rosters).
  import { HOW_TO_PLAY, COMBAT_RULE, GLOSSARY, TERM_GROUPS, termById, wordRx, relatedTerms, type Term } from "./guide";
  import { FACTION_CLASS } from "./api";
  import { paintHtml, type Role } from "./richtext";
  export let page: "guide" | "rules" | "combat" | "glossary" | "term";
  /** The term shown on its own page (#/term/<id>): from the Glossary, or by dragging up a term sheet on a role card. */
  export let termId = "";
  export let roles: Role[] = [];
  $: term = page === "term" ? termById(termId) : null;
  const go = (r: string) => { location.hash = "#/" + r; scrollTo(0, 0); };
  // Back from a term page returns to where it was opened (a role card keeps its place); straight links fall back to the Glossary.
  const back = () => { if (page === "term" && history.length > 1) history.back(); else go(page === "guide" ? "home" : page === "term" ? "glossary" : "guide"); };
  // Winning lines take the edge colour of the side they are about.
  const side = (t: string) => (t.startsWith("Lanternkeepers") ? "lk" : t.startsWith("The evil side") ? "syn" : /^(An|Other) Unbound/.test(t) ? "ub" : "");
  // Setting up (Nik, 13 Nov): "Name: text" is a mode card; "> Name: text" is a tile inside the card above it.
  type Mode = { name: string; text: string; subs: { name: string; text: string }[] };
  const modes = (lines: string[]) => { const out: Mode[] = []; for (const l of lines) { const sub = l.startsWith("> "); const [name, text] = label(sub ? l.slice(2) : l); if (sub && out.length) out[out.length - 1].subs.push({ name, text }); else out.push({ name, text, subs: [] }); } return out; };
  const label = (t: string) => { const i = t.indexOf(": "); if (i <= 0 || i >= 20) return ["", t]; const r = t.slice(i + 2); return [t.slice(0, i), r.charAt(0).toUpperCase() + r.slice(1)]; };

  // Level badges (Creative Coach design, Nik's pick 13 Nov): 0 none, 1 Light, 2 Heavy, 3 Absolute; dashed when given to others.
  const RN = ["–", "I", "II", "III"], LNAME = ["None", "Light", "Heavy", "Absolute"];
  const lv = (v?: string) => Math.max(0, LNAME.indexOf((v ?? "None").replace(" (given)", "")));
  const badge = (k: "a" | "d", n: number, given = false, mark = "") => `<span class="bd ${k}${n}${given ? " given" : ""}" title="${LNAME[n]}${given ? ", given to others" : ""}">${RN[n]}${mark ? `<span class="mk">${mark}</span>` : ""}</span>`;
  // The role data holds only the highest level; the Hollowman's Absolute Defence is on Fog Nights only (his card says so).
  const FOG_ONLY = new Set(["Hollowman"]);
  const roleBadge = (r: Role, k: "a" | "d") => { const v = k === "a" ? r.attack : r.defence; return badge(k, lv(v), (v ?? "").includes("given"), k === "d" && FOG_ONLY.has(r.name) ? "☾" : ""); };
  const SIDES = ["Lanternkeepers", "Syndicate", "Cartel", "Unbound"];

  // Term page: the cards a word links from (ability bullets only, as on the cards), or every role of a type.
  const bullets = (r: Role) => r.ability.split("\n").filter((l) => l.trim().startsWith("•")).join(" ");
  const onCards = (t: Term) => (t.type ? roles.filter((r) => r.type === t.type) : t.match.length ? roles.filter((r) => wordRx(t.match).test(bullets(r))) : []);

  // Glossary search, and the one-line hint under each word (its own short line in guide.ts).
  let q = "";
  const matches = (t: Term, s: string) => { const x = s.trim().toLowerCase(); return !x || t.title.toLowerCase().includes(x) || t.text.toLowerCase().includes(x); };
  const hint = (t: Term) => t.hint ?? t.text;

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
        {:else if s.kind === "modes"}
          <div class="modes">{#each modes(s.body) as m}<div class="mode"><b class="mode-name">{m.name}</b><p>{m.text}</p>{#if m.subs.length}<div class="submodes">{#each m.subs as x}<div class="submode"><b>{x.name}</b><p>{x.text}</p></div>{/each}</div>{/if}</div>{/each}</div>
        {:else if s.kind === "sides"}
          <ul class="plain sides">{#each s.body as p}<li class={"s-" + (side(p) || "none")}>{@html paintHtml(p)}</li>{/each}</ul>
        {:else}
          {#each s.body as p}<p>{@html paintHtml(p)}</p>{/each}
        {/if}
      </section>
    {/each}
  {:else if page === "combat"}
    <!-- Attack & Defence (Nik, 13 Nov): the result grid and one table of every role, no prose. -->
    <h1 class="ptitle">Attack &amp; Defence</h1>
    <p class="rule1">{COMBAT_RULE}</p>
    <table class="mx">
      <tr><th class="rowh"></th>{#each [0, 1, 2, 3] as d}<th>{@html badge("d", d)}<small>{d ? LNAME[d] : "No defence"}</small></th>{/each}</tr>
      {#each [1, 2, 3] as a}<tr><th class="rowh">{@html badge("a", a)}<small>{LNAME[a]}</small></th>{#each [0, 1, 2, 3] as d}<td class:die={a > d} class:live={a <= d} class:eq={a === d}>{a > d ? "✕" : "✓"}</td>{/each}</tr>{/each}
    </table>
    <div class="mxkey"><span><b class="k-die">✕</b> dies</span><span><b class="k-live">✓</b> survives</span><span><b class="lamp">=</b> equal: survives</span></div>
    <h3>Who has what</h3>
    <div class="legend">
      <span>{@html badge("a", 1)}{@html badge("a", 2)}{@html badge("a", 3)} Attack</span>
      <span>{@html badge("d", 1)}{@html badge("d", 2)}{@html badge("d", 3)} Defence</span>
      <span>{@html badge("d", 0)} none</span>
      <span>{@html badge("d", 2, true)} given to others</span>
      <span>{@html badge("d", 3, false, "☾")} Fog Nights only</span>
    </div>
    <div class="thead"><span>Role</span><span>Attack</span><span>Defence</span></div>
    {#each SIDES as f}
      {@const fl = roles.filter((r) => r.faction === f)}
      <div class="fh {FACTION_CLASS[f]}">{f}<em>{fl.length}</em></div>
      {#each fl as r (r.id)}<div class="trow"><span class="nm {FACTION_CLASS[f]}">{r.name}</span><span>{@html roleBadge(r, "a")}</span><span>{@html roleBadge(r, "d")}</span></div>{/each}
    {/each}
  {:else if page === "term"}
    {#if term}
      {@const rel = relatedTerms(term)}
      {@const cards = onCards(term)}
      <h1 class="ptitle term-title">{term.title}</h1>
      <p class="term-text">{term.text}</p>
      {#if rel.length}<div class="glabel">Mentioned here</div><div class="rel">{#each rel as x (x.id)}<button on:click={() => go("term/" + x.id)}>{x.title}</button>{/each}</div>{/if}
      {#if cards.length}<div class="glabel">{term.type ? "Roles of this type" : "On these cards"}</div><div class="rel">{#each cards as r (r.id)}<span class={FACTION_CLASS[r.faction]}>{r.name}</span>{/each}</div>{/if}
      <a class="link term-all" href="#/glossary">All game words</a>
    {:else}<p class="dim tc">That game word isn't in the Glossary.</p>{/if}
  {:else}
    <!-- Glossary (Nik, 13 Nov): Variant A's search and one box per row with a one-line hint, under Variant B's group headings. -->
    <h1 class="ptitle">Glossary</h1>
    <input type="search" bind:value={q} placeholder="Search game words" aria-label="Search game words" />
    {#each TERM_GROUPS as g}
      {@const ts = GLOSSARY.filter((t) => t.group === g && matches(t, q))}
      {#if ts.length}
        <div class="ghead">{g}</div>
        {#each ts as t (t.id)}<button class="gbox" on:click={() => go("term/" + t.id)}><span class="gt"><b>{t.title}</b><span class="hint">{hint(t)}</span></span><span class="arr" aria-hidden="true">›</span></button>{/each}
      {/if}
    {/each}
    {#if !GLOSSARY.some((t) => matches(t, q))}<p class="dim tc">No words match.</p>{/if}
  {/if}
</main>
