<script lang="ts">
  // Settings (Nik, 12 Nov; draft on page 9 of the navigation brief). Email changes and password resets wait for the domain.
  import { onMount } from "svelte";
  import { call, sb } from "./api";
  import { prefs, canBuzz, buzz, pushState, pushOn, pushOff, pushSupported, needsHomeScreen } from "./prefs";
  export let onBack: () => void;
  export let onSignOut: () => void;

  let view: "list" | "profile" | "password" | "delete" = "list";
  let me = { name: "", username: "", email: "", verified: false }, name = "", username = "";
  let pw = "", pw2 = "", showPw = false, busy = false, msg = "", err = "", sure = false;
  let buzzOn = prefs.buzz, awakeOn = prefs.awake, push: "on" | "off" | "blocked" | "unsupported" = "off";

  const flash = (m: string) => { msg = m; err = ""; setTimeout(() => (msg = ""), 3000); };
  const fail = (e: unknown) => { err = (e as Error).message; msg = ""; setTimeout(() => (err = ""), 5000); };
  const mask = (e: string) => { const [u, d] = e.split("@"); return u ? `${u[0]}${"•".repeat(Math.max(1, u.length - 1))}@${d}` : e; };

  onMount(async () => {
    try { me = await call("me"); name = me.name; username = me.username; } catch (e) { fail(e); }
    push = await pushState().catch(() => "unsupported" as const);
  });

  async function saveProfile() {
    busy = true;
    try { await call("updateProfile", { name, username }); await sb.auth.refreshSession(); me = { ...me, name: name.trim(), username: username.trim().toLowerCase().replace(/^@/, "") }; view = "list"; flash("Saved."); } catch (e) { fail(e); }
    busy = false;
  }
  async function savePassword() {
    if (pw.length < 8) return fail(new Error("Passwords need at least 8 characters."));
    if (pw !== pw2) return fail(new Error("The two passwords don't match."));
    busy = true;
    const { error } = await sb.auth.updateUser({ password: pw });
    busy = false;
    if (error) return fail(new Error(error.message));
    pw = pw2 = ""; view = "list"; flash("Password changed.");
  }
  async function deleteAccount() {
    busy = true;
    try { await call("deleteAccount"); await sb.auth.signOut(); onSignOut(); } catch (e) { fail(e); }
    busy = false;
  }
  const toggleBuzz = () => { buzzOn = !buzzOn; prefs.buzz = buzzOn; if (buzzOn) buzz(); };
  const toggleAwake = () => { awakeOn = !awakeOn; prefs.awake = awakeOn; };
  async function togglePush() {
    busy = true;
    try {
      if (push === "on") { await pushOff(); push = "off"; flash("Notifications off."); }
      else { await pushOn(); push = "on"; await call("pushTest").catch(() => {}); flash("Notifications on. A test one is on its way."); }
    } catch (e) { fail(e); push = await pushState().catch(() => "unsupported" as const); }
    busy = false;
  }
</script>

<main class="narrow settings">
  {#if view === "list"}
    <button class="link back" on:click={onBack}>Back</button>
    <h1 class="ptitle">Settings</h1>

    <h3 class="group">Profile</h3>
    <button class="line" on:click={() => (view = "profile")}><span>Name</span><span class="dim">{me.name || "…"} ›</span></button>
    <button class="line" on:click={() => (view = "profile")}><span>Username</span><span class="dim">@{me.username || "…"} ›</span></button>

    <h3 class="group">Account</h3>
    <div class="line static"><span>Email</span><span class="dim">{me.email ? mask(me.email) : "…"}{me.verified ? " · Verified" : ""}</span></div>
    <button class="line" on:click={() => (view = "password")}><span>Password</span><span class="dim">Change ›</span></button>
    <p class="dim small">Changing your email, and resetting a forgotten password, come once the game has its own domain.</p>

    <h3 class="group">In the game</h3>
    <button class="line" role="switch" aria-checked={buzzOn} on:click={toggleBuzz}><span>Buzz on each phase{#if !canBuzz()}<br /><span class="dim small">This phone can't buzz.</span>{/if}</span><span class="toggle" class:on={buzzOn}></span></button>
    <button class="line" role="switch" aria-checked={awakeOn} on:click={toggleAwake}><span>Keep the screen awake</span><span class="toggle" class:on={awakeOn}></span></button>
    <button class="line" role="switch" aria-checked={push === "on"} disabled={busy || push === "unsupported" || push === "blocked"} on:click={togglePush}>
      <span>Notifications<br /><span class="dim small">
        {#if push === "unsupported"}{needsHomeScreen() ? "On iPhone, add the game to your Home Screen first (Share, then Add to Home Screen)." : "This browser can't show notifications."}
        {:else if push === "blocked"}Blocked for this site. Allow them in your browser's settings.
        {:else}When a game starts, at each Night and vote, and for friend requests and invites.{/if}
      </span></span><span class="toggle" class:on={push === "on"}></span>
    </button>
    {#if needsHomeScreen() && pushSupported()}<p class="dim small">On iPhone, notifications only work from the Home Screen icon.</p>{/if}

    <div class="stack end">
      <button class="wide weak" on:click={async () => { await sb.auth.signOut(); onSignOut(); }}>Sign out</button>
      <button class="wide danger" on:click={() => { sure = false; view = "delete"; }}>Delete my account</button>
    </div>
  {:else if view === "profile"}
    <button class="link back" on:click={() => (view = "list")}>Back</button>
    <h1 class="ptitle">Your name</h1>
    <form class="stack" on:submit|preventDefault={saveProfile}>
      <label>Name<input bind:value={name} minlength="2" maxlength="20" autocomplete="nickname" required /></label>
      <p class="dim small">2 to 20 characters. Shown to other players in games.</p>
      <label>Username<span class="at"><span>@</span><input bind:value={username} maxlength="20" autocapitalize="none" autocomplete="username" spellcheck="false" pattern={"[A-Za-z0-9_@]{3,21}"} required /></span></label>
      <p class="dim small">Unique. Letters, numbers and underscores. Friends find you by it.</p>
      <p class="dim small">A game you're in keeps the name you joined with. The change shows from your next game.</p>
      <button class="go" disabled={busy}>Save</button>
    </form>
  {:else if view === "password"}
    <button class="link back" on:click={() => (view = "list")}>Back</button>
    <h1 class="ptitle">Change password</h1>
    <form class="stack" on:submit|preventDefault={savePassword}>
      <input type="text" autocomplete="username" value={me.email} hidden readonly />
      <label>New password<input type={showPw ? "text" : "password"} value={pw} on:input={(e) => (pw = e.currentTarget.value)} minlength="8" autocomplete="new-password" required /></label>
      <label>New password again<input type={showPw ? "text" : "password"} value={pw2} on:input={(e) => (pw2 = e.currentTarget.value)} minlength="8" autocomplete="new-password" required /></label>
      <label class="check"><input type="checkbox" bind:checked={showPw} /> Show passwords</label>
      <button class="go" disabled={busy}>Change password</button>
    </form>
  {:else}
    <button class="link back" on:click={() => (view = "list")}>Back</button>
    <h1 class="ptitle">Delete my account</h1>
    <p>Your account, name, username, friends and notifications are removed. Games you played stay in other players' history, under "Deleted player".</p>
    <p><b>This can't be undone.</b></p>
    <label class="check"><input type="checkbox" bind:checked={sure} /> I understand</label>
    <button class="wide danger" disabled={busy || !sure} on:click={deleteAccount}>Delete my account</button>
  {/if}
  {#if msg}<p class="toast ok" role="status">{msg}</p>{/if}
  {#if err}<p class="toast" role="alert">{err}</p>{/if}
</main>
