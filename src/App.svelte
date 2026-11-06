<script lang="ts">
  import { onDestroy, onMount, tick as svelteTick } from "svelte";
  import QRCode from "qrcode";
  import { call, fmt, sb, serverNow, shareLink, syncClock, timerLabel, FACTION_CLASS } from "./api";
  import { setRoles, type Role } from "./richtext";
  import { PRIVATE_OPTIONS } from "../shared/engine";
  import RoleCard from "./RoleCard.svelte";
  import Game from "./Game.svelte";

  let session: any = null, ready = false, route = "home", err = "", busy = false;
  let roles: Role[] = [], pendingCode = "";
  // Sign-in
  let mode: "in" | "up" = "in", email = "", password = "", name = "";
  // Create
  let size = 8, evil = "Random", townChat = true;
  let timers: Record<string, number> = { discussion: 240, vote: 30, defence: 30, verdict: 15, night: 60 };
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
    route = h; leaveChannel();
    if (h === "games") loadGames();
  }
  async function submitAuth() {
    busy = true; err = "";
    try {
      if (mode === "up") await call("signup", { name, email, password });
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
    } catch (e) { fail(e); }
    busy = false;
  }
  async function create() {
    busy = true;
    try { const r = await call("createParty", { size, mode: evil, timers, townChat }); go("party/" + r.id); } catch (e) { fail(e); }
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
    const { data: mine } = await sb.from("party_players").select("party_id, parties(id, code, status, size, public_state, created_at, finished_at)").eq("user_id", session.user.id).order("joined_at", { ascending: false }).limit(30);
    games = (mine ?? []).map((m: any) => m.parties).filter(Boolean);
  }
  async function signOut() { await sb.auth.signOut(); go("home"); }

  $: full = party && players.length === party.size;
  $: filtered = roles.filter((r) => (factionFilter === "All" || r.faction === factionFilter) && r.name.toLowerCase().includes(search.toLowerCase()));

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

{#if !ready}
  <main class="center"><p class="dim">Lighting the lanterns...</p></main>
{:else if !session}
  <main class="center narrow">
    <h1 class="mark">Lanterns &amp; Lies</h1>
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
  {#key party.id}<Game party={party} onHome={() => go("home")} onChange={() => {}} />{/key}
{:else if route === "party" && party}
  <main class="narrow">
    <h1 class="ptitle">Private party</h1>
    <p class="code" aria-label="Party code">{party.code}</p>
    {#if qr}<img class="qr" src={qr} alt="QR code to join this party" width="180" height="180" />{/if}
    <button class="ghost wide" on:click={share}>{copied ? "Link copied" : "Share link"}</button>
    <p class="row"><b>Players</b><span>{players.length} of {party.size}</span></p>
    <ul class="plain roster">{#each players as p}<li><span>{p.name}</span></li>{/each}</ul>
    <p class="dim small">Discussion {timerLabel(party.timers.discussion)}, Vote {timerLabel(party.timers.vote)}, Defence {timerLabel(party.timers.defence)}, Verdict {timerLabel(party.timers.verdict)}, Night {timerLabel(party.timers.night)}. Evil side: {party.mode}.{party.town_chat ? "" : " Town chat off."}</p>
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
    <h3>Players</h3>
    <div class="seg">{#each [8, 9, 10, 11, 12, 13, 14, 15] as n}<button class:on={size === n} on:click={() => (size = n)}>{n}</button>{/each}</div>
    <h3>Evil side</h3>
    <div class="seg">{#each ["Syndicate", "Cartel", "Random"] as m}<button class:on={evil === m} on:click={() => (evil = m)}>{m}</button>{/each}</div>
    {#each TIMER_ROWS as [k, label]}
      <h3>{label}</h3>
      <div class="seg">{#each PRIVATE_OPTIONS[k] as v}<button class:on={timers[k] === v} on:click={() => (timers[k] = v)}>{timerLabel(v)}</button>{/each}</div>
    {/each}
    <label class="check"><input type="checkbox" bind:checked={townChat} /> Town chat on <span class="dim small">Turn off if you're all in one room and talking out loud.</span></label>
    <button class="go wide" disabled={busy} on:click={create}>Create party</button>
    {#if err}<p class="toast" role="alert">{err}</p>{/if}
  </main>
{:else if route === "guide"}
  <main class="narrow">
    <button class="link back" on:click={() => (openRole ? (openRole = null) : go("home"))}>Back</button>
    {#if openRole}<RoleCard role={openRole} />
    {:else}
      <h1 class="ptitle">Role guide</h1>
      <input bind:value={search} placeholder="Search roles" aria-label="Search roles" />
      <div class="seg four">{#each ["All", "Lanternkeepers", "Syndicate", "Cartel", "Unbound"] as f}<button class:on={factionFilter === f} class={f === "All" ? "" : FACTION_CLASS[f]} on:click={() => (factionFilter = f)}>{f === "Lanternkeepers" ? "Keepers" : f}</button>{/each}</div>
      <ul class="plain lib">{#each filtered as r (r.id)}<li><button on:click={() => { openRole = r; scrollTo(0, 0); }}><img src={import.meta.env.BASE_URL + r.image} alt="" width="64" height="64" loading="lazy" /><span><b class={FACTION_CLASS[r.faction]}>{r.name}</b><br /><span class="small {FACTION_CLASS[r.faction]}">{r.faction} {r.type}</span></span></button></li>{/each}</ul>
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
    <h1 class="mark">Lanterns &amp; Lies</h1>
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
