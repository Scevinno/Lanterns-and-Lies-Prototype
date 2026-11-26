<script lang="ts">
  // The Deal, part 2 (Nik, 26 Nov): the deck from the lobby sits in the middle, the top card turns over to show your role,
  // and the harbour fades into the game's day picture. Plays once, on desktop, after this tab watched the lobby shuffle.
  import { onDestroy, onMount } from "svelte";
  import type { Role } from "./richtext";
  export let role: Role;
  export let onDone: () => void;

  const base = import.meta.env.BASE_URL;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stage = 0; // 0 deck, 1 town fading + card turning, 2 name shown, 3 fading out
  const timers: any[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, reduce ? Math.min(ms, 300) : ms));
  onMount(() => { at(150, () => (stage = 1)); at(1300, () => (stage = 2)); at(4200, () => (stage = 3)); at(5000, onDone); });
  onDestroy(() => timers.forEach(clearTimeout));
  const skip = () => { timers.forEach(clearTimeout); stage = 3; setTimeout(onDone, 500); };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="dr" class:out={stage === 3} on:click={skip} aria-live="polite">
  <div class="dr-bg" class:fade={stage >= 1} style="background-image:url({base}bg/nav-wide.webp)" aria-hidden="true"></div>
  <div class="dr-deck">
    {#each [0, 1, 2, 3, 4] as k}<div class="dr-under" class:drop={stage >= 1} style="--k:{k}"></div>{/each}
    <div class="dr-card" class:turned={stage >= 1}>
      <div class="dr-flip">
        <div class="dr-face dr-back"><img src="{base}lantern-loading.webp" alt="" /></div>
        <div class="dr-face dr-front"><img src={base + role.image} alt={role.name} /></div>
      </div>
    </div>
  </div>
  <div class="dr-text" class:on={stage >= 2}><h2>You are the {role.name}</h2><p>Read your role. Night 1 is coming.</p></div>
</div>

<style>
  .dr { position:fixed; inset:0; z-index:60; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; transition:opacity .8s ease; }
  .dr.out { opacity:0; pointer-events:none; }
  .dr-bg { position:absolute; inset:0; background:center/cover; transition:opacity 2.6s ease; }
  .dr-bg::after { content:""; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 56%, rgba(30,26,20,0), rgba(8,10,16,.55) 60%, rgba(8,10,16,.8)); }
  .dr-bg.fade { opacity:0; }
  .dr-deck { position:relative; width:104px; height:146px; }
  .dr-under, .dr-card { position:absolute; inset:0; }
  .dr-under { border-radius:10px; background:#182033; border:2px solid #8a6a2c; box-shadow:0 6px 14px rgba(0,0,0,.6); transform:translateY(calc(var(--k) * -0.8px)); transition:transform .9s ease, opacity .9s ease; }
  .dr-under.drop { transform:translateY(260px); opacity:0; }
  .dr-card { perspective:900px; transform:translateY(-30px) scale(1.06); transition:transform 1s cubic-bezier(.4,.1,.2,1); z-index:2; }
  .dr-card.turned { transform:translateY(-40px) scale(2.25); }
  .dr-flip { position:absolute; inset:0; transform-style:preserve-3d; transition:transform .95s cubic-bezier(.4,.1,.2,1) .25s; }
  .dr-card.turned .dr-flip { transform:rotateY(180deg); }
  .dr-face { position:absolute; inset:0; border-radius:10px; backface-visibility:hidden; -webkit-backface-visibility:hidden; overflow:hidden; }
  .dr-back { background:radial-gradient(circle at 50% 46%, rgba(217,164,65,.22), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 9px), #182033;
    border:2px solid #8a6a2c; box-shadow:inset 0 0 0 4px #182033, inset 0 0 0 5px rgba(217,164,65,.55), 0 6px 14px rgba(0,0,0,.6); }
  .dr-back img { position:absolute; left:50%; top:46%; width:46px; transform:translate(-50%,-50%); filter:drop-shadow(0 0 10px rgba(232,181,83,.6)); }
  .dr-front { transform:rotateY(180deg); background:#141a28; border:2px solid #8a6a2c; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 30px rgba(0,0,0,.7); }
  .dr-front img { width:94%; height:auto; }
  .dr-text { position:relative; margin-top:190px; text-align:center; opacity:0; transition:opacity .8s ease; }
  .dr-text.on { opacity:1; }
  .dr-text h2 { margin:0; font:700 34px "Almendra",Georgia,serif; text-shadow:0 2px 8px #000; }
  .dr-text p { margin:6px 0 0; display:inline-block; padding:4px 14px; border-radius:999px; background:rgba(14,18,28,.7); border:1px solid rgba(160,180,215,.16); color:var(--lamp); }
  @media (prefers-reduced-motion: reduce) { .dr-bg, .dr-under, .dr-card, .dr-flip { transition-duration:.01s !important; } }
</style>
