<script lang="ts">
  // Friends and invites (Nik, 12 Nov): add by username, accept requests, see invites to private parties.
  import { onMount } from "svelte";
  import { call } from "./api";
  export let onBack: () => void;
  export let onJoin: (code: string) => void;

  type F = { name: string; username: string };
  let data: { username: string; friends: F[]; incoming: F[]; outgoing: F[]; invites: { id: number; code: string; from: string }[] } | null = null;
  let add = "", busy = false, msg = "", err = "", confirmRemove = "";
  const flash = (m: string) => { msg = m; err = ""; setTimeout(() => (msg = ""), 3000); };
  const fail = (e: unknown) => { err = (e as Error).message; setTimeout(() => (err = ""), 4000); };
  async function load() { try { data = await call("friends"); } catch (e) { fail(e); } }
  async function act(a: string, body: Record<string, unknown>, done?: string) {
    busy = true;
    try { await call(a, body); await load(); if (done) flash(done); } catch (e) { fail(e); }
    busy = false;
  }
  onMount(load);
</script>

<main class="narrow">
  <button class="link back" on:click={onBack}>Back</button>
  <h1 class="ptitle">Friends</h1>
  {#if !data}<p class="dim">Loading…</p>
  {:else}
    <p class="dim small">Your username is <b>@{data.username}</b>. Friends add you with it.</p>

    {#if data.invites.length}
      <h3>Invites</h3>
      <ul class="plain picker">{#each data.invites as i (i.id)}<li class="invite"><span>{i.from} invited you · {i.code}</span><span class="btns"><button class="go" on:click={() => onJoin(i.code)}>Join</button><button class="weak" disabled={busy} on:click={() => act("dismissInvite", { id: i.id })}>Dismiss</button></span></li>{/each}</ul>
    {/if}

    <h3>Add a friend</h3>
    <form class="send" on:submit|preventDefault={() => act("friendRequest", { username: add }, "Request sent.").then(() => (add = ""))}>
      <input bind:value={add} placeholder="@username" aria-label="Friend's username" autocapitalize="none" autocomplete="off" spellcheck="false" maxlength="21" />
      <button class="go" disabled={busy || add.replace("@", "").length < 3}>Add</button>
    </form>

    {#if data.incoming.length}
      <h3>Requests</h3>
      <ul class="plain picker">{#each data.incoming as f (f.username)}<li class="invite"><span>{f.name} <span class="dim small">@{f.username}</span></span><span class="btns"><button class="go" disabled={busy} on:click={() => act("friendRespond", { username: f.username, accept: true }, `${f.name} added.`)}>Accept</button><button class="weak" disabled={busy} on:click={() => act("friendRespond", { username: f.username, accept: false })}>Decline</button></span></li>{/each}</ul>
    {/if}

    <h3>Friends</h3>
    {#if !data.friends.length}<p class="dim small">No friends yet. Add someone by their username.</p>{/if}
    <ul class="plain picker">{#each data.friends as f (f.username)}<li class="invite"><span>{f.name} <span class="dim small">@{f.username}</span></span>
      {#if confirmRemove === f.username}<span class="btns"><button class="danger" disabled={busy} on:click={() => act("unfriend", { username: f.username }).then(() => (confirmRemove = ""))}>Remove</button><button class="weak" on:click={() => (confirmRemove = "")}>Keep</button></span>
      {:else}<button class="weak" on:click={() => (confirmRemove = f.username)}>Remove</button>{/if}
    </li>{/each}</ul>

    {#if data.outgoing.length}
      <h3>Waiting for an answer</h3>
      <ul class="plain picker">{#each data.outgoing as f (f.username)}<li class="invite"><span>{f.name} <span class="dim small">@{f.username}</span></span><button class="weak" disabled={busy} on:click={() => act("unfriend", { username: f.username })}>Cancel</button></li>{/each}</ul>
    {/if}
  {/if}
  {#if msg}<p class="toast ok" role="status">{msg}</p>{/if}
  {#if err}<p class="toast" role="alert">{err}</p>{/if}
</main>
