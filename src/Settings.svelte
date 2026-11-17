<script lang="ts">
  // Settings (Nik, 12 Nov; draft on page 9 of the navigation brief). Email changes (17 Nov): the current password, then a code sent to the new address.
  import { onMount } from "svelte";
  import { call, sb } from "./api";
  import { prefs, canBuzz, buzz, pushState, pushOn, pushOff, pushSupported, needsHomeScreen } from "./prefs";
  export let onBack: () => void;
  export let onSignOut: () => void;

  let view: "list" | "profile" | "password" | "email" | "emailcode" | "delete" = "list";
  let newEmail = "", curPw = "", otp = "";
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
  async function startEmailChange() {
    const to = newEmail.trim().toLowerCase();
    if (to === me.email) return fail(new Error("That's already your email."));
    busy = true;
    try {
      // The password is checked first, so a phone left signed in can't move the account to another email.
      const { error: pwErr } = await sb.auth.signInWithPassword({ email: me.email, password: curPw });
      if (pwErr) throw new Error("That password isn't right.");
      const { error } = await sb.auth.updateUser({ email: to });
      if (error) throw new Error(/already|registered|exists/i.test(error.message) ? "That email already has an account." : /seconds|rate limit/i.test(error.message) ? "Wait a minute before asking for another code." : error.message);
      newEmail = to; curPw = ""; otp = ""; view = "emailcode";
    } catch (e) { fail(e); }
    busy = false;
  }
  async function confirmEmailChange() {
    busy = true;
    const { error } = await sb.auth.verifyOtp({ email: newEmail, token: otp.replace(/\s/g, ""), type: "email_change" });
    busy = false;
    if (error) return fail(new Error("That code is wrong or has expired."));
    try { localStorage.setItem("lnl-email", newEmail); } catch { /* storage blocked */ }
    me = { ...me, email: newEmail, verified: true }; newEmail = ""; view = "list"; flash("Email changed.");
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
    <button class="line" on:click={() => { newEmail = ""; curPw = ""; view = "email"; }}><span>Email</span><span class="dim">{me.email ? mask(me.email) : "…"}{me.verified ? " · Verified" : ""} ›</span></button>
    <button class="line" on:click={() => (view = "password")}><span>Password</span><span class="dim">Change ›</span></button>

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
  {:else if view === "email"}
    <button class="link back" on:click={() => (view = "list")}>Back</button>
    <h1 class="ptitle">Change email</h1>
    <form class="stack" on:submit|preventDefault={startEmailChange}>
      <input type="text" autocomplete="username" value={me.email} hidden readonly />
      <label>New email<input type="email" bind:value={newEmail} autocomplete="email" maxlength="120" required /></label>
      <label>Your password<input type={showPw ? "text" : "password"} value={curPw} on:input={(e) => (curPw = e.currentTarget.value)} autocomplete="current-password" required /></label>
      <label class="check"><input type="checkbox" bind:checked={showPw} /> Show password</label>
      <p class="dim small">We'll send a code to the new email. Your email changes once you enter it.</p>
      <button class="go" disabled={busy}>Send code</button>
    </form>
  {:else if view === "emailcode"}
    <button class="link back" on:click={() => (view = "email")}>Back</button>
    <h1 class="ptitle">Enter the code</h1>
    <p class="dim">We sent a code to {newEmail}. Can't see it? Check your spam folder.</p>
    <form class="stack" on:submit|preventDefault={confirmEmailChange}>
      <label>Code<input class="otp" bind:value={otp} inputmode="numeric" autocomplete="one-time-code" pattern={"[0-9 ]{6,12}"} maxlength="12" required /></label>
      <button class="go" disabled={busy}>Change email</button>
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
