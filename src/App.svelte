<script lang="ts">
  import { onDestroy, onMount, tick as svelteTick } from "svelte";
  import QRCode from "qrcode";
  import { call, fmt, sb, serverNow, shareLink, syncClock, timerLabel, FACTION_CLASS } from "./api";
  import { setRoles, type Role } from "./richtext";
  import { PRIVATE_OPTIONS } from "../shared/engine";
  import RoleCard from "./RoleCard.svelte";
  import Game from "./Game.svelte";
  import NumberStrip from "./NumberStrip.svelte";
  import Roster from "./Roster.svelte";

  let session: any = null, ready = false, route = "home", err = "", busy = false;
  let roles: Role[] = [], pendingCode = "";
  // Sign-in
  let mode: "in" | "up" = "in", email = "", password = "", name = "";
  try { email = localStorage.getItem("lnl-email") ?? ""; } catch { /* storage blocked */ }
  // Create
  let size = 8, evil = "Random", inPerson = true, showCreateRoster = false;
  // In a room, phones are only for roles, votes and night choices, so the longer options give people time to talk and move.
  const ROOM_TIMERS = { discussion: 420, vote: 60, defence: 60, verdict: 15, night: 120 }, ONLINE_TIMERS = { discussion: 240, vote: 30, defence: 30, verdict: 15, night: 60 };
  let timers: Record<string, number> = { ...ROOM_TIMERS };
  const setSetting = (v: boolean) => { inPerson = v; timers = { ...(v ? ROOM_TIMERS : ONLINE_TIMERS) }; };
  const SIZES = [8, 9, 10, 11, 12, 13, 14, 15];
  // Rosters screen
  let guideTab: "roles" | "rosters" = "roles", rSize = 8, rMode: "Syndicate" | "Cartel" | "Random" = "Syndicate", typeFilter = "All";
  const TIMER_ROWS: [string, string][] = [["discussion", "Discussion"], ["vote", "Vote"], ["defence", "Defence"], ["verdict", "Verdict"], ["night", "Night"]];
  // Join, party, library
  let code = "", party: any = null, players: any[] = [], qr = "", copied = false, remaining = 0, chan: any = null, clock: any = null;
  let search = "", factionFilter = "All", openRole: Role | null = null, games: any[] = [];

  const fail = (e: unknown) => { err = (e as Error).message; setTimeout(() => (err = ""), 4000); };
  const go = (r: string) => { location.hash = "#/" + r; };

  async function route_() {
    const h = location.hash.replace(/^#\/?/, "") || "home";
    if (h.startsWith("join/")) { pendingCode = h.slice(5).toUpperCase(); if (session) { await join(pendingCode); pendingCode = ""; } else route = "home"; return; }
    if (h.startsWith("party/")) { await openParty(h.slice(6)); return; }
    if (h === "rosters") { guideTab = "rosters"; openRole = null; route = "guide"; leaveChannel(); return; }
    if (h === "guide") guideTab = "roles";
    route = h; leaveChannel();
    if (h === "games") loadGames();
  }
  async function submitAuth() {
    busy = true; err = "";
    try {
      if (mode === "up") await call("signup", { name, email, password });
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (!error) try { localStorage.setItem("lnl-email", email); } catch { /* storage blocked */ }
      if (error) throw new Error(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
    } catch (e) { fail(e); }
    busy = false;
  }
  async function create() {
    busy = true;
    try { const r = await call("createParty", { size, mode: evil, timers, inPerson }); go("party/" + r.id); } catch (e) { fail(e); }
    busy = false;
  }
  async function join(c: string) {
    busy = true;
    try { const r = await call("joinParty", { code: c }); go("party/" + r.id); } catch (e) { fail(e); go("play"); }
    busy = false;
  }
  function leaveChannel() { if (chan) sb.removeChannel(chan); chan = null; clearInterval(clock); party = null; }
  async function loadLobby(id: string) {
    const [{ data: p }, { data: pl }] = await Promise.all([sb.from("parties").select("*").eq("id", id).maybeSingle(), sb.from("party_players").select("*").eq("party_id", id).order("joined_at")]);
    if (p) party = p; players = pl ?? [];
  }
  async function openParty(id: string) {
    leaveChannel(); route = "party"; await syncClock(); await loadLobby(id);
    if (!party) { fail(new Error("You are not in that party.")); go("play"); return; }
    qr = await QRCode.toDataURL(shareLink(party.code), { margin: 1, width: 360, color: { dark: "#14161C", light: "#EDE6D6" } });
    chan = sb.channel("lobby-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "parties", filter: `id=eq.${id}` }, () => loadLobby(id))
      .on("postgres_changes", { event: "*", schema: "public", table: "party_players", filter: `party_id=eq.${id}` }, () => loadLobby(id))
      .subscribe();
    let lastNudge = 0;
    clock = setInterval(() => {
      if (party?.status !== "starting" || !party.ends_at) { if (party?.status === "lobby" && document.visibilityState === "visible" && Date.now() - lastNudge > 8000) { lastNudge = Date.now(); loadLobby(id); } return; }
      const left = new Date(party.ends_at).getTime() - serverNow(); remaining = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0 && Date.now() - lastNudge > 2500) { lastNudge = Date.now(); call("tick", { party: id }).then(() => loadLobby(id)); }
    }, 250);
  }
  const partyAct = async (a: string) => { busy = true; try { await call(a, { party: party.id }); await loadLobby(party.id); } catch (e) { fail(e); } busy = false; };
  async function share() {
    const link = shareLink(party.code);
    try { if (navigator.share) await navigator.share({ title: "Lanterns & Lies", text: `Join my party: ${party.code}`, url: link }); else { await navigator.clipboard.writeText(link); copied = true; setTimeout(() => (copied = false), 2000); } } catch { /* cancelled */ }
  }
  async function loadGames() {
    const { data: mine } = await sb.from("party_players").select("party_id, parties!party_players_party_id_fkey(id, code, status, size, public_state, created_at, finished_at)").eq("user_id", session.user.id).order("joined_at", { ascending: false }).limit(30);
    games = (mine ?? []).map((m: any) => m.parties).filter(Boolean);
  }
  async function signOut() { await sb.auth.signOut(); go("home"); }

  $: full = party && players.length === party.size;
  // Menu screens get the river port, list screens the quiet river. The game sets its own day or night picture.
  $: inGame = route === "party" && party && party.status !== "lobby" && party.status !== "starting";
  $: bg = !ready || !session || route === "home" || route === "play" ? "menu" : "nav";
  $: types = [...new Set(roles.filter((r) => factionFilter === "All" || r.faction === factionFilter).map((r) => r.type))];
  $: if (typeFilter !== "All" && !types.includes(typeFilter)) typeFilter = "All";
  $: q = search.trim().toLowerCase();
  $: filtered = roles.filter((r) => (factionFilter === "All" || r.faction === factionFilter) && (typeFilter === "All" || r.type === typeFilter) && (!q || r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)));

  const onHash = () => route_();
  let authSub: any;
  onMount(async () => {
    const { data } = await sb.from("roles").select("*").order("id"); roles = (data ?? []) as Role[]; setRoles(roles);
    const { data: { session: s } } = await sb.auth.getSession(); session = s; ready = true;
    await route_();
    window.addEventListener("hashchange", onHash);
    authSub = sb.auth.onAuthStateChange(async (_e, s2) => { const was = session; session = s2; if (!was && s2) { await svelteTick(); route_(); } }).data.subscription;
  });
  onDestroy(() => { window.removeEventListener("hashchange", onHash); authSub?.unsubscribe(); leaveChannel(); });
</script>

{#if !inGame}<div class="backdrop {bg}" style="background-image:url({import.meta.env.BASE_URL}bg/{bg}.webp)" aria-hidden="true"></div>{/if}
{#if !ready}
  <main class="center"><p class="dim">Lighting the lanterns...</p></main>
{:else if !session}
  <main class="center narrow signin">
    <h1 class="mark">Lanterns<br /><span class="amp">&amp;</span> Lies</h1>
    <p class="dim tc">{pendingCode ? `Sign in to join party ${pendingCode}.` : "A town, a fog, and someone among you who isn't what they seem."}</p>
    <form on:submit|preventDefault={submitAuth} class="stack">
      {#if mode === "up"}<label>Your name<input bind:value={name} maxlength="20" autocomplete="nickname" required /></label>{/if}
      <label>Email<input type="email" bind:value={email} autocomplete="email" required /></label>
      <label>Password<input type="password" bind:value={password} autocomplete={mode === "up" ? "new-password" : "current-password"} minlength="8" required /></label>
      <button class="go" disabled={busy}>{mode === "up" ? "Create account" : "Sign in"}</button>
    </form>
    <button class="link" on:click={() => (mode = mode === "up" ? "in" : "up")}>{mode === "up" ? "I already have an account" : "Create an account"}</button>
  </main>
{:else if route === "party" && party && party.status !== "lobby" && party.status !== "starting"}
  {#key party.id}<Game party={party} onHome={() => go("home")} />{/key}
{:else if route === "party" && party}
  <main class="narrow">
    <h1 class="ptitle">Private party</h1>
    <p class="code" aria-label="Party code">{party.code}</p>
    {#if qr}<img class="qr" src={qr} alt="QR code to join this party" width="180" height="180" />{/if}
    <button class="ghost wide" on:click={share}>{copied ? "Link copied" : "Share link"}</button>
    <p class="row"><b>Players</b><span>{players.length} of {party.size}</span></p>
    <ul class="plain roster">{#each players as p}<li><span>{p.name}</span></li>{/each}</ul>
    <p class="dim small">Discussion {timerLabel(party.timers.discussion)}, Vote {timerLabel(party.timers.vote)}, Defence {timerLabel(party.timers.defence)}, Verdict {timerLabel(party.timers.verdict)}, Night {timerLabel(party.timers.night)}. Evil side: {party.mode}. {party.in_person ? "In person: only the evil side's night chat, roles hidden, pause on." : "Online: town chat on."}</p>
    {#if party.status === "starting"}
      <p class="big tc">Starting in {fmt(remaining)}</p>
      <button class="ghost wide" disabled={busy} on:click={() => partyAct("cancelStart")}>Cancel</button>
    {:else}
      {#if !full}<button class="ghost wide" disabled={busy} on:click={() => partyAct("addBots")}>Fill empty seats with test players</button>{/if}
      <button class="go wide" disabled={busy || !full} on:click={() => partyAct("startGame")}>{full ? "Start" : `Start (needs ${party.size})`}</button>
    {/if}
    <button class="link" on:click={async () => { await partyAct("leaveParty"); go("home"); }}>Leave party</button>
    {#if err}<p class="toast" role="alert">{err}</p>{/if}
  </main>
{:else if route === "play"}
  <main class="narrow">
    <button class="link back" on:click={() => go("home")}>Back</button>
    <h1 class="ptitle">Play</h1>
    <div class="stack">
      <button class="wide" disabled title="Public games come after private parties">Public game<br /><span class="dim small">15 players. Coming after private parties.</span></button>
      <button class="go wide" on:click={() => go("create")}>Create private party<br /><span class="small">Get a code to share</span></button>
    </div>
    <h3>Join a private party</h3>
    <form class="send" on:submit|preventDefault={() => join(code)}><input bind:value={code} maxlength="6" placeholder="Party code" aria-label="Party code" autocapitalize="characters" autocomplete="off" /><button class="go" disabled={busy || code.length < 6}>Join</button></form>
    <p class="dim small">To join by QR, scan it with your phone's camera.</p>
    {#if err}<p class="toast" role="alert">{err}</p>{/if}
  </main>
{:else if route === "create"}
  <main class="narrow">
    <button class="link back" on:click={() => go("play")}>Back</button>
    <h1 class="ptitle">Create private party</h1>
    <h3>Where are you playing?</h3>
    <div class="setting">
      <button type="button" class:on={inPerson} aria-pressed={inPerson} on:click={() => setSetting(true)}><b>In person</b><span class="small">One room, talking out loud</span></button>
      <button type="button" class:on={!inPerson} aria-pressed={!inPerson} on:click={() => setSetting(false)}><b>Online</b><span class="small">Apart, talking in chat</span></button>
    </div>
    <ul class="dim small effects">
      {#if inPerson}
        <li>Town and dead chats are off: talk out loud. Only the evil side chats, at night.</li>
        <li>Your role stays hidden after the start. Tap Role to peek; it hides again by itself.</li>
        <li>Anyone can pause the game, for a break or a late arrival.</li>
        <li>Everyone gets a screen to tap at night, so nobody gives away that they have no action.</li>
        <li>Phones buzz when the phase changes. Longer timers are set by default.</li>
      {:else}
        <li>Town chat is on and is how the town talks.</li>
        <li>Your role stays on screen. No pause: the game runs on its timers.</li>
      {/if}
    </ul>
    <h3>Players</h3>
    <NumberStrip bind:value={size} valid={SIZES} />
    <h3>Evil side</h3>
    <div class="seg">{#each ["Syndicate", "Cartel", "Random"] as m}<button class:on={evil === m} on:click={() => (evil = m)}>{m}</button>{/each}</div>
    <button type="button" class="link" on:click={() => (showCreateRoster = !showCreateRoster)}>{showCreateRoster ? "Hide roster" : `See the roster for ${size} players`}</button>
    {#if showCreateRoster}
      <Roster size={size} mode={evil === "Cartel" ? "Cartel" : evil === "Syndicate" ? "Syndicate" : "Random"} />
    {/if}
    {#each TIMER_ROWS as [k, label]}
      <h3>{label}</h3>
      <div class="seg">{#each PRIVATE_OPTIONS[k] as v}<button class:on={timers[k] === v} on:click={() => (timers[k] = v)}>{timerLabel(v)}</button>{/each}</div>
    {/each}
    <button class="go wide" disabled={busy} on:click={create}>Create party</button>
    {#if err}<p class="toast" role="alert">{err}</p>{/if}
  </main>
{:else if route === "guide"}
  <main class="narrow">
    <button class="link back" on:click={() => (openRole ? (openRole = null) : go("home"))}>Back</button>
    {#if openRole}<RoleCard role={openRole} />
    {:else}
      <div class="tabs top"><button class:on={guideTab === "roles"} on:click={() => (guideTab = "roles")}>Roles</button><button class:on={guideTab === "rosters"} on:click={() => (guideTab = "rosters")}>Rosters</button></div>
      {#if guideTab === "roles"}
        <input type="search" bind:value={search} placeholder="Search by name or summary" aria-label="Search roles" />
        <div class="chips" role="group" aria-label="Faction">{#each ["All", "Lanternkeepers", "Syndicate", "Cartel", "Unbound"] as f}<button class:on={factionFilter === f} class={f === "All" ? "" : FACTION_CLASS[f]} on:click={() => (factionFilter = f)}>{f === "Lanternkeepers" ? "Keepers" : f}</button>{/each}</div>
        <div class="chips" role="group" aria-label="Type">{#each ["All", ...types] as t}<button class:on={typeFilter === t} on:click={() => (typeFilter = t)}>{t === "All" ? "All types" : t}</button>{/each}</div>
        <p class="dim small">{filtered.length} of {roles.length} roles</p>
        <ul class="plain grid">{#each filtered as r (r.id)}<li><button class="tile" on:click={() => { openRole = r; scrollTo(0, 0); }}><img src={import.meta.env.BASE_URL + r.image} alt="" width="272" height="264" loading="lazy" decoding="async" /><b class={FACTION_CLASS[r.faction]}>{r.name}</b><span class="small dim">{r.faction === "Lanternkeepers" ? "Keeper" : r.faction} · {r.type}</span></button></li>{/each}</ul>
        {#if !filtered.length}<p class="dim tc">No roles match.</p>{/if}
      {:else}
        <h3>Players</h3>
        <NumberStrip bind:value={rSize} valid={SIZES} />
        <h3>Evil side</h3>
        <div class="seg"><button class:on={rMode === "Syndicate"} class="f-syn" on:click={() => (rMode = "Syndicate")}>Syndicate</button><button class:on={rMode === "Cartel"} class="f-car" on:click={() => (rMode = "Cartel")}>Cartel</button><button class:on={rMode === "Random"} on:click={() => (rMode = "Random")}>Random</button></div>
        <Roster size={rSize} mode={rMode} />
      {/if}
    {/if}
  </main>
{:else if route === "games"}
  <main class="narrow">
    <button class="link back" on:click={() => go("home")}>Back</button>
    <h1 class="ptitle">My games</h1>
    {#if !games.length}<p class="dim">No games yet.</p>{/if}
    <ul class="plain picker">{#each games as g}<li><button on:click={() => go("party/" + g.id)}><span>{g.public_state?.winner ? `${g.public_state.winner} won` : g.status === "lobby" ? "In the lobby" : "In progress"}</span><span class="dim small">{new Date(g.created_at).toLocaleDateString()} · {g.size} players</span></button></li>{/each}</ul>
  </main>
{:else}
  <main class="center narrow home">
    <h1 class="mark">Lanterns<br /><span class="amp">&amp;</span> Lies</h1>
    <p class="dim tc">Signed in as {session.user.user_metadata?.display_name ?? session.user.email}</p>
    <div class="stack">
      <button class="go wide" on:click={() => go("play")}>Play</button>
      <button class="wide" on:click={() => go("guide")}>Role guide</button>
      <button class="wide" on:click={() => go("games")}>My games</button>
      <button class="wide" on:click={signOut}>Sign out</button>
    </div>
    <p class="dim small tc">Prototype</p>
  </main>
{/if}
