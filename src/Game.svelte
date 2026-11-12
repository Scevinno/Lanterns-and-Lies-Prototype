<script lang="ts">
  import { afterUpdate, onDestroy, onMount, tick as svelteTick } from "svelte";
  import { call, fmt, serverNow, sb, syncClock, FACTION_CLASS } from "./api";
  import { allRoles, roleByName, summaryHtml, type Role } from "./richtext";
  import RoleCard from "./RoleCard.svelte";
  import Roster from "./Roster.svelte";
  import Loading from "./Loading.svelte";
  import Library from "./Library.svelte";
  import { buzz, prefs } from "./prefs";

  export let party: any;
  export let onHome: () => void;

  let view: any = null, messages: any[] = [], remaining = 0, draft = "", tab = "town", showRole = false, err = "", busy = false, online = true;
  let picks: string[] = [], second = "", lastPhase = 0, chatEl: HTMLElement, wake: any = null;
  let rosterView: "roster" | "roles" = "roster", libF = "All", libT = "All", libSearch = "", libRole: Role | null = null;
  // Back from a role card returns to where the library was scrolled to (Nik, 12 Nov).
  let sheetEl: HTMLDivElement | null = null, sheetScroll = 0;
  const closeLibRole = async () => { libRole = null; await svelteTick(); if (sheetEl) sheetEl.scrollTop = sheetScroll; };
  const closeRoster = () => { showRoster = false; rosterView = "roster"; libRole = null; };
  let showRoster = false, decoy = "", hideTimer: any = null, chatOpen = false, seen = 0;
  // Game over (Nik, 8 Nov): the players or the chat fill the screen, one at a time, with Home on both.
  let overTab: "players" | "chat" = "players";
  $: pub = party.public_state;
  $: phase = pub?.phase;
  $: me = view && pub?.players.find((p: any) => p.id === view.player_id);
  $: nameOf = (id: string) => pub?.players.find((p: any) => p.id === id)?.name ?? "";
  $: living = (pub?.players ?? []).filter((p: any) => p.alive);
  $: hasBots = (pub?.players ?? []).some((p: any) => p.bot);
  $: myRole = view && roleByName(view.role);
  $: if (pub && pub.phaseNo !== lastPhase) { if (lastPhase) buzz(); lastPhase = pub.phaseNo; picks = []; second = ""; decoy = ""; chatOpen = false; tab = phase === "night" && view?.channels?.faction ? "faction" : tab === "faction" ? "town" : tab; if (phase === "reveal") showRole = true; else if (showRole && phase !== "reveal") showRole = false; }
  $: if (view?.action && phase === "night" && !picks.length) { picks = [...(view.action.targets ?? [])]; second = view.action.second?.[0] ?? ""; }
  $: visible = messages.filter((m) => (tab === "town" ? m.channel === "town" || m.channel === "private" : tab === "dead" ? m.channel === "dead" : m.channel === view?.faction));
  $: chatChannel = tab === "town" ? "town" : tab === "dead" ? "dead" : "faction";
  $: canType = view?.channels?.[chatChannel] || (phase === "over" && tab === "town");
  $: isEvil = view && (view.faction === "Syndicate" || view.faction === "Cartel");
  $: isDead = view && !view.alive;
  $: inPerson = !!pub?.inPerson;
  $: paused = !!pub?.paused;
  // In person, your role hides itself again after a few seconds, so nobody reads it over your shoulder.
  // Chat fills the screen; it steps aside while you vote or judge, and shares the screen at night if you have a night chat.
  $: layout = showRole ? "role" : phase === "over" ? (overTab === "chat" ? "chat" : "select") : chatOpen || isDead ? "chat" : phase === "vote" || phase === "verdict" ? "select" : phase === "night" ? (view?.channels?.faction || (isEvil && view?.role === "Kingpin") ? "split" : "select") : "chat";
  $: if (layout !== "select") seen = visible.length;
  $: unread = Math.max(0, visible.length - seen);
  $: chipLabel = inPerson && !showRole && phase !== "over" ? "Role" : view?.role;

  const say = (e: unknown) => { err = (e as Error).message; setTimeout(() => (err = ""), 3500); };
  async function act(a: string, b: Record<string, unknown> = {}) { busy = true; try { await call(a, { party: party.id, ...b }); await refresh(); } catch (e) { say(e); } busy = false; }

  async function refresh() {
    const [{ data: p }, { data: v }, { data: me2 }] = await Promise.all([
      sb.from("parties").select("*").eq("id", party.id).single(),
      sb.from("player_secrets").select("player_id,view").eq("party_id", party.id).maybeSingle(),
      sb.from("messages").select("*").eq("party_id", party.id).order("id", { ascending: true }).limit(500),
    ]);
    if (p) party = p;
    if (v) view = { ...v.view, player_id: v.player_id };
    if (me2) messages = me2;
    online = true;
  }

  // Timer. Never counted down locally: it's recalculated from the server's deadline, four times a second.
  let lastNudge = 0;
  function tick() {
    if (!party.ends_at) { remaining = 0; return; }
    const left = new Date(party.ends_at).getTime() - serverNow();
    remaining = Math.max(0, Math.ceil(left / 1000));
    // The server moves the game by itself. A phone that's watching can also nudge it, so it moves the instant time is up.
    if (left <= 0 && Date.now() - lastNudge > 2500) { lastNudge = Date.now(); call("tick", { party: party.id }).then(refresh).catch(() => (online = false)); }
  }
  const keepAwake = async () => { if (!prefs.awake) return; try { if ("wakeLock" in navigator && document.visibilityState === "visible") wake = await (navigator as any).wakeLock.request("screen"); } catch { /* not available */ } };
  async function wakeUp() { if (document.visibilityState !== "visible") return; await Promise.all([syncClock(true), refresh()]); keepAwake(); resubscribe(); tick(); }

  let channel: any;
  function resubscribe() {
    if (channel && channel.state === "joined") return;
    if (channel) sb.removeChannel(channel);
    channel = sb.channel("game-" + party.id)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "parties", filter: `id=eq.${party.id}` }, (e: any) => { party = e.new; tick(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "player_secrets", filter: `party_id=eq.${party.id}` }, (e: any) => { if (e.new?.view) view = { ...e.new.view, player_id: e.new.player_id }; })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `party_id=eq.${party.id}` }, (e: any) => { if (!messages.some((m) => m.id === e.new.id)) messages = [...messages, e.new]; })
      .subscribe();
  }
  let t1: any, t2: any;
  onMount(async () => {
    resubscribe(); await Promise.all([syncClock(), refresh()]); keepAwake();
    t1 = setInterval(tick, 250); t2 = setInterval(() => { if (document.visibilityState === "visible") refresh().catch(() => (online = false)); }, 10000);
    for (const ev of ["visibilitychange", "focus", "pageshow", "online"]) (ev === "visibilitychange" ? document : window).addEventListener(ev, wakeUp);
  });
  onDestroy(() => {
    clearInterval(t1); clearInterval(t2); clearTimeout(hideTimer); if (channel) sb.removeChannel(channel); wake?.release?.();
    for (const ev of ["visibilitychange", "focus", "pageshow", "online"]) (ev === "visibilitychange" ? document : window).removeEventListener(ev, wakeUp);
  });
  let lastLen = 0;
  afterUpdate(() => { if (chatEl && visible.length !== lastLen) { lastLen = visible.length; chatEl.scrollTop = chatEl.scrollHeight; } });

  async function send() { const body = draft.trim(); if (!body) return; draft = ""; try { await call("chat", { party: party.id, channel: chatChannel, body }); } catch (e) { say(e); draft = body; } }
  function choose(slot: number, id: string) {
    const next = [...picks]; next[slot] = id; picks = next;
    const need = view.prompt.slots.length;
    if (picks.filter(Boolean).length === need && (need < 2 || picks[0] !== picks[1])) act("night", { targets: picks, second: second ? [second] : undefined });
  }
  function chooseSecond(id: string) { second = id; if (picks[0]) act("night", { targets: picks, second: [id] }); }
  const title = (ph: string) => ({ reveal: "Your role", discussion: "Discussion", vote: "Vote", defence: "Defence", verdict: "Verdict", night: pub?.fog ? "Fog Night" : "Night", dusk: "Dusk", dawn: "Dawn", over: pub?.winner === "Nobody" ? "Nobody wins" : `${pub?.winner} ${pub?.winner?.startsWith("The ") ? "win" : "wins"}` }[ph] ?? "");
  $: period = phase === "night" ? `Night ${pub?.night}` : phase === "over" ? "Game over" : phase === "reveal" ? "Night 1 is coming" : phase === "dawn" ? `Dawn ${pub?.night}` : `Day ${pub?.day}`;
</script>

{#if !pub || !view}
  <Loading />
{:else}
<div class="backdrop {phase === 'night' ? 'night' : 'day'}" style="background-image:url({import.meta.env.BASE_URL}bg/{phase === 'night' ? 'night' : 'day'}.webp)" aria-hidden="true"></div>
<main class="game l-{layout}">
  <header class="bar">
    <span class="dim">{period}</span>
    <button class="chip {inPerson && !showRole ? '' : FACTION_CLASS[view.faction]}" aria-label={inPerson && !showRole ? "Show my role" : "Hide my role"} on:click={() => (showRole = !showRole)}>{chipLabel}</button>
    {#if pub.setup}<button class="icon" aria-label="Roster for this game" on:click={() => (showRoster = true)}>Roster</button>{/if}
    {#if inPerson && phase !== "over"}<button class="icon" aria-label={paused ? "Resume the game" : "Pause the game"} disabled={busy} on:click={() => act(paused ? "resume" : "pause")}>{paused ? "▶" : "❚❚"}</button>{/if}
    <span class="timer" class:low={remaining <= 10 && phase !== 'over' && !paused} role="timer">{phase === "over" ? "" : paused ? fmt(Math.ceil((pub.pausedLeft ?? 0) / 1000)) : fmt(remaining)}</span>
  </header>
  {#if !online}<p class="banner">Reconnecting. The game carries on without you.</p>{/if}
  <h1 class="ptitle">{title(phase)}</h1>

  <section class="panel">
    {#if chatOpen}
      <button class="ghost wide" on:click={() => (chatOpen = false)}>Back to {phase === "night" ? "your choice" : phase === "verdict" ? "the verdict" : "voting"}</button>
    {:else if showRole && myRole}
      <RoleCard role={myRole} />
      {#if view.ability !== view.role}<p class="dim">You now have the ability of the {view.ability}.</p>{/if}
      {#if view.target}<div class="side"><h3 class="f-ub">Your target</h3><ul class="plain"><li><b>{view.target.name}</b><span class="dim">{view.target.alive ? "Get them voted out" : "Dead"}</span></li></ul></div>{/if}
      {#if view.contract}<div class="side"><h3 class="f-ub">Your contract</h3><ul class="plain">{#each view.contract as c}<li><b class={FACTION_CLASS[roleByName(c)?.faction ?? ""]}>{c}</b><span class="dim">{roleByName(c)?.faction ?? ""}</span></li>{/each}</ul><p class="dim small">Visit both on the same Night to win.</p></div>{/if}
      {#if view.allies.length}<div class="side"><h3 class={FACTION_CLASS[view.faction]}>Your side</h3><ul class="plain">{#each view.allies as a}<li><b>{a.name}</b>{#if a.role}<span class={FACTION_CLASS[view.faction]}>{a.role}</span>{/if}</li>{/each}</ul></div>{/if}
      {#if phase !== "reveal"}<button class="ghost backgame" on:click={() => (showRole = false)}>Back to the game</button>{/if}
    {:else if phase === "over"}
      {#if overTab === "players"}
        <ul class="plain roster">{#each pub.players as p}<li class:gone={!p.alive}><span>{p.name}{#if p.won}<b class="lamp won">won</b>{/if}</span><span class={FACTION_CLASS[roleByName(p.finalRole)?.faction ?? ""]}>{p.finalRole}</span></li>{/each}</ul>
      {/if}
    {:else if isDead}
      <p class="dim">Your lantern is out. {inPerson ? "Stay quiet and watch the town." : "You can read the town and talk with the dead."}</p>
    {:else if phase === "vote"}
      {#if view.canVote}<p class="dim">Trial {pub.trial} of {pub.maxTrials}. {pub.needed} votes needed.</p>{:else}<p class="dim">You cannot vote today.</p>{/if}
      <ul class="plain picker">{#each living as p}
        <li><button class:sel={view.myVote === p.id} disabled={busy || !view.canVote || p.shipped || p.id === view.player_id} on:click={() => act("vote", { target: view.myVote === p.id ? null : p.id })}><span>{p.name}{#if p.id === view.player_id}<span class="dim tag">(you)</span>{/if}{#if p.revealedRole || p.finalRole}<span class="dim tag">{p.revealedRole ?? p.finalRole}</span>{/if}{#if p.shipped}<span class="dim tag">sent away</span>{/if}</span><span class="count">{pub.tally[p.id] ?? 0}</span></button></li>
      {/each}</ul>
      {#if view.canCondemn}<details><summary>Condemn a player</summary><ul class="plain picker">{#each living as p}{#if p.id !== view.player_id}<li><button on:click={() => act("condemn", { target: p.id })}>{p.name}</button></li>{/if}{/each}</ul></details>{/if}
    {:else if phase === "defence"}
      <p class="big">{nameOf(pub.accused)} {pub.accused === view.player_id ? "(you)" : ""} is on trial.</p><p class="dim">{pub.accused === view.player_id ? "Only you can type. Make your case." : "Only the accused can type."}</p>
    {:else if phase === "verdict"}
      <p class="big">{nameOf(pub.accused)}</p>
      {#if view.canVerdict}<div class="pair"><button class:sel={view.myVerdict === "guilty"} disabled={busy} on:click={() => act("verdict", { choice: "guilty" })}>Guilty</button><button class:sel={view.myVerdict === "innocent"} disabled={busy} on:click={() => act("verdict", { choice: "innocent" })}>Innocent</button></div>
      {:else}<p class="dim">The town decides.</p>{/if}
    {:else if phase === "night"}
      {#if view.prompt}
        <p>{view.prompt.label}</p>
        {#if view.prompt.toggle}
          <button class:sel={view.action?.alert} class="wide" disabled={busy} on:click={() => act("night", { targets: [], alert: !view.action?.alert })}>{view.action?.alert ? (view.prompt.toggleOn ?? "Chosen") : view.prompt.toggle}</button>
        {:else}
          {#each view.prompt.slots as slot, i}
            {#if view.prompt.slots.length > 1}<h3>{slot.label}</h3>{/if}
            <ul class="plain picker">{#each slot.options as o}<li><button class:sel={picks[i] === o.id} disabled={busy} on:click={() => choose(i, o.id)}>{o.name}</button></li>{/each}</ul>
          {/each}
          {#if view.commanded && view.prompt.slots.length === 1}
            <h3>The Kingpin commands a second target</h3>
            <ul class="plain picker">{#each view.prompt.slots[0].options as o}{#if o.id !== picks[0]}<li><button class:sel={second === o.id} disabled={busy} on:click={() => chooseSecond(o.id)}>{o.name}</button></li>{/if}{/each}</ul>
          {/if}
          {#if view.action}<button class="ghost" disabled={busy} on:click={() => { picks = []; second = ""; act("night", { targets: [] }); }}>Clear my choice</button>{/if}
        {/if}
      {:else if inPerson}
        <p class="dim small">You have no action tonight. Tap a name anyway, so nobody in the room can tell. Nothing is sent.</p>
        <ul class="plain picker">{#each living as p}{#if p.id !== view.player_id}<li><button class:sel={decoy === p.id} on:click={() => (decoy = p.id)}>{p.name}</button></li>{/if}{/each}</ul>
      {:else}<p class="dim">You have nothing to do tonight.</p>{/if}
    {:else if phase === "dawn"}
      <p class="dim">The sun comes up over the river.</p>
    {:else if phase === "discussion"}
      <details class="who"><summary>Players ({living.length} alive)</summary><ul class="plain roster small">{#each pub.players as p}<li class:gone={!p.alive}><span>{p.name}</span><span class="dim">{#if p.revealedRole || p.finalRole}{p.revealedRole ?? p.finalRole}{:else if !p.alive}dead{:else if p.shipped}sent away{/if}</span></li>{/each}</ul></details>
    {/if}
    {#if view.canReveal && !showRole}<button class="ghost" disabled={busy} on:click={() => act("reveal")}>Reveal yourself as the {view.role}</button>{/if}
  </section>

  {#if layout === "select" && phase !== "over"}<button class="chatpeek" on:click={() => (chatOpen = true)}>Show chat{unread ? ` · ${unread} new` : ""}</button>{/if}
  <section class="chat">
    {#if (isEvil && phase === "night") || (isDead && !inPerson)}
      <div class="tabs">
        <button class:on={tab === "town"} on:click={() => (tab = "town")}>Town</button>
        {#if isEvil && phase === "night"}<button class:on={tab === "faction"} on:click={() => (tab = "faction")}>{view.faction}</button>{/if}
        {#if isDead && !inPerson}<button class:on={tab === "dead"} on:click={() => (tab = "dead")}>The dead</button>{/if}
      </div>
    {/if}
    <div class="log" bind:this={chatEl} aria-live="polite">
      {#each visible as m (m.id)}
        <p class:narr={m.sender === "Narrator" && m.channel !== "private"} class:priv={m.channel === "private"}>{#if m.sender !== "Narrator"}<b>{m.sender}:</b> {/if}{@html summaryHtml(m.body)}</p>
      {/each}
    </div>
    {#if canType}
      <form class="send" on:submit|preventDefault={send}><input bind:value={draft} maxlength="300" placeholder={tab === "town" ? "Type to the town" : tab === "dead" ? "Type to the dead" : "Type to your side"} aria-label="Message" /><button class="go" type="submit">Send</button></form>
    {:else if tab === "faction" && view.role === "Kingpin"}<p class="dim small pad">You can read your side's chat, but you cannot write in it.</p>
    {:else if !pub.townChat && tab === "town" && phase !== "night"}<p class="dim small pad">Town chat is off. Talk out loud.</p>{/if}
  </section>
  <!-- Game over (Nik, 10 Nov): Chat/Players and Home sit in their own bar at the bottom, spaced away from the list. -->
  {#if phase === "over" && !showRole}
    <div class="pair overbar">
      {#if overTab === "players"}<button class="ghost" on:click={() => (overTab = "chat")}>Chat</button>{:else}<button class="ghost" on:click={() => (overTab = "players")}>Players</button>{/if}
      <button class="go" on:click={onHome}>Home</button>
    </div>
  {/if}

  {#if paused}
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Game paused">
      <div class="sheet tc">
        <h2>Paused</h2>
        <p class="dim">{pub.pausedBy ?? "Someone"} paused the game. {fmt(Math.ceil((pub.pausedLeft ?? 0) / 1000))} left in this phase.</p>
        <p class="dim small">Votes, night choices and the evil side's chat wait until the game resumes. Anyone can resume it.</p>
        <button class="go wide" disabled={busy} on:click={() => act("resume")}>Resume</button>
      </div>
    </div>
  {/if}
  {#if showRoster}
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Roster">
      <div class="sheet scroll" bind:this={sheetEl}>
        {#if !libRole}<h2>{rosterView === "roles" ? "Roles" : "Roster"}</h2>{/if}
        {#if libRole}
          <button class="link back" on:click={closeLibRole}>Back</button><RoleCard role={libRole} />
        {:else if rosterView === "roles"}
          <button class="link back" on:click={() => (rosterView = "roster")}>Back to the roster</button>
          <Library roles={allRoles()} bind:factionFilter={libF} bind:typeFilter={libT} bind:search={libSearch} onOpen={(r) => { sheetScroll = sheetEl?.scrollTop ?? 0; libRole = r; if (sheetEl) sheetEl.scrollTop = 0; }} />
        {:else}
          <p class="dim small">{pub.size} players · evil side: {pub.setup}. Tap a line to see its roles.</p>
          <Roster size={pub.size} mode={pub.setup} onPick={(f, t) => { libF = f; libT = t; libSearch = ""; rosterView = "roles"; }} />
        {/if}
        <button class="wide" on:click={closeRoster}>Close</button>
      </div>
    </div>
  {/if}
  {#if hasBots && phase !== "over"}<button class="skip" disabled={busy} on:click={() => act("skip")}>Skip this phase (test games only)</button>{/if}
  {#if err}<p class="toast" role="alert">{err}</p>{/if}
</main>
{/if}
