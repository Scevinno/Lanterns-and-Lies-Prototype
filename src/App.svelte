<script lang="ts">
  import { onDestroy, onMount, tick as svelteTick } from "svelte";
  import { call, fmt, sb, serverNow, shareLink, syncClock, timerLabel, FACTION_CLASS } from "./api";
  import { setRoles, type Role } from "./richtext";
  import { PRIVATE_OPTIONS } from "../shared/engine";
  import RoleCard from "./RoleCard.svelte";
  import Game from "./Game.svelte";
  import NumberStrip from "./NumberStrip.svelte";
  import Roster from "./Roster.svelte";
  import Loading from "./Loading.svelte";
  // Back from a role card returns to where the library was scrolled to (Nik, 12 Nov).
  let libScroll = 0;
  const closeRole = async () => { openRole = null; await svelteTick(); scrollTo(0, libScroll); };
  import Library from "./Library.svelte";
  import Settings from "./Settings.svelte";
  import Friends from "./Friends.svelte";
  import Guide from "./Guide.svelte";

  let session: any = null, ready = false, route = "home", err = "", busy = false;
  let roles: Role[] = [], pendingCode = "";
  // Sign-in
  let mode: "in" | "up" = "in", email = "", password = "", name = "", showPw = false;
  try { email = localStorage.getItem("lnl-email") ?? ""; } catch { /* storage blocked */ }
  // Create
  let size = 8, evil = "Random", inPerson = true, showCreateRoster = false;
  // In a room, phones are only for roles, votes and night choices, so the longer options give people time to talk and move.
  const ROOM_TIMERS = { discussion: 420, vote: 60, defence: 60, verdict: 15, night: 120 }, ONLINE_TIMERS = { discussion: 240, vote: 30, defence: 30, verdict: 15, night: 60 };
  let timers: Record<string, number> = { ...ROOM_TIMERS };
  const setSetting = (v: boolean) => { inPerson = v; timers = { ...(v ? ROOM_TIMERS : ONLINE_TIMERS) }; };
  const SIZES = [8, 9, 10, 11, 12, 13, 14, 15];
  // Rosters screen
  let guideTab: "roles" | "rosters" = "roles", rSize = 8, rMode: "Mafia" | "Syndicate" = "Mafia", typeFilter = "All";
  const TIMER_ROWS: [string, string][] = [["discussion", "Discussion"], ["vote", "Vote"], ["defence", "Defence"], ["verdict", "Verdict"], ["night", "Night"]];
  // Join, party, library
  let code = "", party: any = null, players: any[] = [], qr = "", copied = false, remaining = 0, chan: any = null, clock: any = null;
  let search = "", factionFilter = "All", openRole: Role | null = null, termId = "", cardScroll = 0, games: any[] = [];
  // Friends and invites (Nik, 12 Nov): the count on Home, and the invite list in a lobby.
  let invites = 0, requests = 0, friendList: { name: string; username: string }[] = [], showInvite = false, invited: string[] = [];
  async function loadFriends() { try { const f = await call("friends"); invites = f.invites.length; requests = f.incoming.length; friendList = f.friends; } catch { /* offline */ } }
  async function inviteFriend(u: string) { try { await call("invite", { party: party.id, username: u }); invited = [...invited, u]; } catch (e) { fail(e); } }

  const fail = (e: unknown) => { err = (e as Error).message; setTimeout(() => (err = ""), 4000); };
  const go = (r: string) => { location.hash = "#/" + r; };

  async function route_() {
    const h = location.hash.replace(/^#\/?/, "") || "home";
    if (h.startsWith("join/")) { pendingCode = h.slice(5).toUpperCase(); if (session) { await join(pendingCode); pendingCode = ""; } else route = "home"; return; }
    if (h.startsWith("party/")) { await openParty(h.slice(6)); return; }
    if (h === "rosters") { guideTab = "rosters"; openRole = null; route = "roles"; leaveChannel(); return; }
    if (h.startsWith("term/")) { termId = h.slice(5); route = "term"; leaveChannel(); scrollTo(0, 0); return; }
    if (h === "roles") guideTab = "roles";
    // Coming back from a term page (dragged up from a role card) lands at the same place on the card.
    const fromTerm = route === "term"; route = h; leaveChannel();
    if (fromTerm && h === "roles" && openRole) { await svelteTick(); scrollTo(0, cardScroll); }
    if (h === "games") loadGames();
    if (h === "home" && session) loadFriends();
  }
  async function submitAuth() {
    busy = true; err = "";
    try {
      if (mode === "up") await call("signup", { name, email, password });
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (!error) {
        try { localStorage.setItem("lnl-email", email); } catch { /* storage blocked */ }
        // Ask the browser to save the login (Chrome and Android offer it here; Safari offers it from the form itself).
        try { const PC = (window as any).PasswordCredential; if (PC && navigator.credentials) await navigator.credentials.store(new PC({ id: email, password, name: name || email })); } catch { /* declined or unsupported */ }
      }
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
    leaveChannel(); route = "party"; await Promise.all([syncClock(), loadLobby(id)]);
    if (!party) { fail(new Error("You are not in that party.")); go("play"); return; }
    showInvite = false; invited = []; loadFriends();
    const QRCode = (await import("qrcode")).default; // loaded only when a lobby opens
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

  $: full = party && players.length === party.size;
  // Menu screens get the river port, list screens the quiet river. The game sets its own day or night picture.
  $: inGame = route === "party" && party && party.status !== "lobby" && party.status !== "starting";
  $: bg = !ready || !session || route === "home" || route === "play" ? "menu" : "nav";

  const onHash = () => route_();
  let authSub: any;
  onMount(async () => {
    // Roles come from the last visit at once, then refresh; the session check runs at the same time.
    try { const c = JSON.parse(localStorage.getItem("lnl-roles") ?? "null"); if (c?.length) { roles = c; setRoles(roles); } } catch { /* storage blocked */ }
    const [{ data }, { data: { session: s } }] = await Promise.all([sb.from("roles").select("*").order("id"), sb.auth.getSession()]);
    if (data?.length) { roles = data as Role[]; setRoles(roles); try { localStorage.setItem("lnl-roles", JSON.stringify(data)); } catch { /* storage blocked */ } }
    session = s; ready = true;
    await route_();
    if (session && route === "home") loadFriends();
    window.addEventListener("hashchange", onHash);
    authSub = sb.auth.onAuthStateChange(async (_e, s2) => { const was = session; session = s2; if (!was && s2) { await svelteTick(); route_(); } }).data.subscription;
  });
  onDestroy(() => { window.removeEventListener("hashchange", onHash); authSub?.unsubscribe(); leaveChannel(); });
</script>

{#if !inGame}<div class="backdrop {bg}" style="background-image:url({import.meta.env.BASE_URL}bg/{bg}.webp)" aria-hidden="true"></div>{/if}
{#if !ready}
  <Loading />
{:else if !session}
  <main class="center narrow signin">
    <h1 class="mark">Lanterns<br /><span class="amp">&amp;</span> Lies</h1>
    <p class="dim tc">{pendingCode ? `Sign in to join party ${pendingCode}.` : "A town, a fog, and someone among you who isn't what they seem."}</p>
    <form on:submit|preventDefault={submitAuth} class="stack" method="post" action="#" autocomplete="on">
      {#if mode === "up"}<label>Your name<input bind:value={name} maxlength="20" autocomplete="nickname" required /></label>{/if}
      <label>Email<input type="email" name="email" id="email" bind:value={email} autocomplete={mode === "up" ? "email" : "username"} required /></label>
      <label>Password<span class="pw"><input type={showPw ? "text" : "password"} name="password" id="password" value={password} on:input={(e) => (password = e.currentTarget.value)} autocomplete={mode === "up" ? "new-password" : "current-password"} minlength="8" required /><button type="button" class="eye" aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw} on:click={() => (showPw = !showPw)}>{#if showPw}<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10 10 0 0112 5c5 0 9 4.5 10 7a12 12 0 01-3.2 4.2M6.1 6.1A12 12 0 002 12c1 2.5 5 7 10 7a10 10 0 004.1-.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>{:else}<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>{/if}</button></span></label>
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
    {#if party.status === "lobby"}
      <button class="ghost wide" on:click={() => (showInvite = !showInvite)}>{showInvite ? "Hide friends" : "Invite friends"}</button>
      {#if showInvite}
        {#if !friendList.length}<p class="dim small">No friends yet. Add them from Friends on the home screen.</p>{/if}
        <ul class="plain picker">{#each friendList.filter((f) => !players.some((p) => p.name === f.name && p.user_id)) as f (f.username)}<li class="invite"><span>{f.name} <span class="dim small">@{f.username}</span></span><button class="go" disabled={invited.includes(f.username)} on:click={() => inviteFriend(f.username)}>{invited.includes(f.username) ? "Invited" : "Invite"}</button></li>{/each}</ul>
      {/if}
    {/if}
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
{:else if route === "party"}
  <Loading />
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
      <button type="button" class:on={inPerson} aria-pressed={inPerson} on:click={() => setSetting(true)}><b>In person</b><span class="small">Talk together</span></button>
      <button type="button" class:on={!inPerson} aria-pressed={!inPerson} on:click={() => setSetting(false)}><b>Online</b><span class="small">Talk in chat</span></button>
    </div>
    <ul class="dim small effects">
      {#if inPerson}
        <li>Town chats are off. Only the evil side chats at night.</li>
        <li>Your role stays hidden after the start; tap Role to peek.</li>
        <li>Anyone can pause the game, for a break or a late arrival.</li>
        <li>Everyone gets a screen to tap at night, so nobody gives away that they have no action.</li>
      {:else}
        <li>Town chat is on.</li>
        <li>Your role and your evil side's roles stay visible on the screen.</li>
        <li>The game runs on its timers with no pause.</li>
      {/if}
    </ul>
    <h3>Players</h3>
    <NumberStrip bind:value={size} valid={SIZES} />
    <h3>Evil side</h3>
    <div class="seg">{#each ["Mafia", "Syndicate", "Random"] as m}<button class:on={evil === m} on:click={() => (evil = m)}>{m}</button>{/each}</div>
    <button type="button" class="link" on:click={() => (showCreateRoster = !showCreateRoster)}>{showCreateRoster ? "Hide roster" : `See the roster for ${size} players`}</button>
    {#if showCreateRoster}
      <Roster size={size} mode={evil === "Syndicate" ? "Syndicate" : evil === "Mafia" ? "Mafia" : "Random"} />
    {/if}
    <!-- Both private-party settings choose their timers; Online starts from 4 min, 30 s, 30 s, 15 s, 1 min (Nik, 12 Nov). -->
    {#each TIMER_ROWS as [k, label]}
      <h3>{label}</h3>
      <div class="seg">{#each PRIVATE_OPTIONS[k] as v}<button class:on={timers[k] === v} on:click={() => (timers[k] = v)}>{timerLabel(v)}</button>{/each}</div>
    {/each}
    <button class="go wide create-go" disabled={busy} on:click={create}>Create party</button>
    {#if err}<p class="toast" role="alert">{err}</p>{/if}
  </main>
{:else if route === "guide" || route === "rules" || route === "combat" || route === "glossary" || route === "term"}
  <Guide page={route} {roles} {termId} />
{:else if route === "roles"}
  <main class="narrow">
    <button class="link back" on:click={() => (openRole ? closeRole() : go("guide"))}>Back</button>
    {#if openRole}<RoleCard role={openRole} onOpenTerm={(id) => { cardScroll = scrollY; go("term/" + id); }} />
    {:else}
      <div class="tabs top"><button class:on={guideTab === "roles"} on:click={() => (guideTab = "roles")}>Roles</button><button class:on={guideTab === "rosters"} on:click={() => (guideTab = "rosters")}>Rosters</button></div>
      {#if guideTab === "roles"}
        <Library {roles} bind:factionFilter bind:typeFilter bind:search onOpen={(r) => { libScroll = scrollY; openRole = r; scrollTo(0, 0); }} />
      {:else}
        <h3>Players</h3>
        <NumberStrip bind:value={rSize} valid={SIZES} />
        <h3>Evil side</h3>
        <div class="seg"><button class:on={rMode === "Mafia"} class="f-syn" on:click={() => (rMode = "Mafia")}>Mafia</button><button class:on={rMode === "Syndicate"} class="f-car" on:click={() => (rMode = "Syndicate")}>Syndicate</button></div>
        <Roster size={rSize} mode={rMode} onPick={(f, t) => { factionFilter = f; typeFilter = t; search = ""; guideTab = "roles"; scrollTo(0, 0); }} />
      {/if}
    {/if}
  </main>
{:else if route === "settings"}
  <Settings onBack={() => go("home")} onSignOut={() => go("home")} />
{:else if route === "friends"}
  <Friends onBack={() => go("home")} onJoin={(c) => join(c)} />
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
      <button class="wide" on:click={() => go("guide")}>Guide</button>
      <button class="wide" on:click={() => go("friends")}>Friends{#if invites + requests}<span class="badge" aria-label="{invites + requests} new">{invites + requests}</span>{/if}</button>
      <button class="wide" on:click={() => go("games")}>My games</button>
      <button class="wide weak" on:click={() => go("settings")}>Settings</button>
    </div>
    <p class="dim small tc">Prototype</p>
  </main>
{/if}
