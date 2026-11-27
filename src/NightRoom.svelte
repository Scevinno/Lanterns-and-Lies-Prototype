<script lang="ts">
  // In-person nights (Nik, 26 Nov). Before each Night everyone sees who goes first, then taps once their eyes are closed.
  // During the Night every living player gets a 25-second turn in a random order. Whoever isn't taking their turn sees
  // only this dark screen, so a peek at any phone gives nothing away. Each turn ends with a 5-second call (Nik, 27 Nov):
  // the player who just went sees only the name to call out, and the player called sees a big 5-4-3-2-1.
  import { fmt } from "./api";
  import { unlock } from "./sound";
  export let phase: string;
  export let pub: any;
  export let view: any;
  export let remaining: number;
  export let busy = false;
  export let paused = false;
  export let calling = false;
  export let upNext = false;
  export let onEyes: () => void;
  export let onResume: () => void;

  $: dead = !view.alive;
  const tapEyes = () => { unlock(); onEyes(); };
</script>

<div class="nr" class:dark={phase === "night" || view.eyesClosed || dead} role="dialog" aria-label={phase === "eyes" ? "Close your eyes" : "Eyes closed"}>
  {#if paused}
    <div class="nr-card"><h2>Paused</h2><p>{pub.pausedBy ? `${pub.pausedBy} paused the game.` : "The game is paused."}</p><button class="go wide" disabled={busy} on:click={onResume}>Resume</button></div>
  {:else if calling}
    <div class="nr-call">
      {#if view.nextName}<p class="nr-say">Call out</p><h2 class="nr-name">{view.nextName}</h2>
      {:else}<p class="nr-say">Last turn. Say</p><h2 class="nr-name">Everyone, open your eyes</h2>{/if}
      <p class="nr-then">Then close your eyes.</p>
    </div>
  {:else if upNext}
    <div class="nr-call"><p class="nr-say">Your turn in</p><p class="nr-big" aria-live="assertive">{Math.max(1, remaining)}</p></div>
  {:else if phase === "eyes" && dead}
    <div class="nr-quiet"><h2>Your lantern is out</h2><p>Close your eyes with everyone else.</p></div>
  {:else if phase === "eyes" && view.goesFirst && !view.eyesClosed}
    <div class="nr-card">
      <h2>You go first</h2>
      <p>Wait until everyone has closed their eyes, then tap.</p>
      <p class="nr-count">{pub.eyes?.closed ?? 0} of {pub.eyes?.of ?? 0} ready</p>
      <button class="go big" disabled={busy} on:click={tapEyes}>I'm ready</button>
    </div>
  {:else if phase === "eyes" && view.goesFirst}
    <div class="nr-quiet"><h2>Ready</h2><p>Your turn starts once everyone's eyes are closed.</p><p class="nr-count">{pub.eyes?.closed ?? 0} of {pub.eyes?.of ?? 0} ready</p></div>
  {:else if phase === "eyes" && !view.eyesClosed}
    <div class="nr-card">
      <h2>Close your eyes</h2>
      <p><b>{pub.eyes?.first}</b> goes first.</p>
      <p class="dim">Tap, then close your eyes. Open them only when your name is called.</p>
      <button class="go big" disabled={busy} on:click={tapEyes}>My eyes are closed</button>
    </div>
  {:else}
    <div class="nr-quiet">
      <h2>Eyes closed</h2>
      <p>{dead ? "Your lantern is out. Stay quiet." : "Wait for your name to be called."}</p>
      {#if phase === "eyes"}<p class="nr-count">{pub.eyes?.closed ?? 0} of {pub.eyes?.of ?? 0} ready</p>{/if}
    </div>
  {/if}
  {#if phase === "eyes" && !paused}<p class="nr-foot">The night starts by itself in {fmt(remaining)}.</p>{/if}
</div>

<style>
  .nr { position:fixed; inset:0; z-index:55; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:24px;
    background:radial-gradient(ellipse at 50% 40%, rgba(20,26,40,.92), rgba(6,8,12,.97)); text-align:center; }
  .nr.dark { background:#05070b; }
  .nr-card { width:min(100%, 380px); padding:28px 24px; border-radius:18px; background:linear-gradient(#1a2134, #121726); border:3px solid #8a6a2c;
    box-shadow:inset 0 0 0 5px #141a28, inset 0 0 0 6px rgba(217,164,65,.5), 0 18px 40px rgba(0,0,0,.7); }
  .nr-card h2, .nr-quiet h2 { margin:0 0 10px; font:700 34px "Almendra",Georgia,serif; color:var(--lamp); }
  .nr-card p { margin:0 0 10px; }
  .nr-card .big { width:100%; min-height:64px; font-size:20px; margin-top:10px; }
  .nr-quiet h2 { color:#5e5a50; } .nr-quiet p { color:#5e5a50; margin:0 0 6px; }
  .nr-count { font-size:14px; color:var(--dim); }
  .nr-call { display:flex; flex-direction:column; align-items:center; gap:8px; }
  .nr-say { margin:0; font-size:18px; color:var(--dim); text-transform:uppercase; letter-spacing:.12em; }
  .nr-name { margin:0; font:700 clamp(44px, 11vw, 96px)/1.05 "Almendra",Georgia,serif; color:var(--lamp); overflow-wrap:anywhere; }
  .nr-then { margin:14px 0 0; font-size:15px; color:#5e5a50; }
  .nr-big { margin:0; font:700 clamp(140px, 40vw, 280px)/1 "Almendra",Georgia,serif; color:var(--lamp); font-variant-numeric:tabular-nums; }
  .nr-foot { position:absolute; bottom:max(20px, env(safe-area-inset-bottom)); margin:0; font-size:13px; color:#4d4a42; }
</style>
