<script lang="ts">
  // The Deal, part 2 (Nik, 26 Nov): the deck from the lobby sits in the middle, the top card turns over to show your role,
  // and the lobby picture fades into the game's day picture. Desktop and phone alike, once per tab that saw the shuffle.
  // The card is laid out like a playing card (Nik, 26 Nov): name at the top, the character in its faction ring, and the
  // one-line rule underneath (the same line as the in-game roster). After 15 seconds it hides itself and the usual role
  // screen, with the full card, takes the rest of the 30-second reveal (Nik, 26 Nov).
  import { onDestroy, onMount } from "svelte";
  import type { Role } from "./richtext";
  import { FACTION_CLASS } from "./api";
  import { SIMPLE } from "./simple";
  export let role: Role;
  export let wide = true;
  export let onDone: () => void;

  const base = import.meta.env.BASE_URL;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fc = FACTION_CLASS[role.faction] ?? "";
  $: line = SIMPLE[role.name]?.line ?? "";

  let stage = 0;      // 0 deck, 1 card turning and growing, 2 caption shown, 3 closing
  let turns = 0;      // 0 back, 1 face up
  const timers: any[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, reduce ? Math.min(ms, 300) : ms));
  onMount(() => {
    at(150, () => { stage = 1; turns = 1; });
    at(1300, () => (stage = 2));
    at(15000, close);
  });
  onDestroy(() => timers.forEach(clearTimeout));
  function close() { timers.forEach(clearTimeout); stage = 3; setTimeout(onDone, 500); }
</script>

<div class="dr" class:out={stage === 3} class:wide aria-live="polite">
  <div class="dr-bg" class:fade={stage >= 1} style="background-image:url({base}bg/nav{wide ? '-wide' : ''}.webp)" aria-hidden="true"></div>
  <div class="dr-deck">
    {#each [0, 1, 2, 3, 4] as k}<div class="dr-under" class:drop={stage >= 1} style="--k:{k}"></div>{/each}
    <div class="dr-card" class:big={stage >= 1}>
      <div class="dr-flip" style="transform:rotateY({turns * 180}deg)">
        <div class="dr-face dr-back">
          <img class="dr-mark" src="{base}lantern-loading.webp" alt="" />
        </div>
        <div class="dr-face dr-front">
          <div class="dr-head"><h3 class={fc}>{role.name}</h3><span class="{fc}">{role.faction} · {role.type}</span></div>
          <div class="dr-art"><img src={base + role.image} alt={role.name} /></div>
          <p class="dr-line">{line}</p>
        </div>
      </div>
    </div>
  </div>
  <div class="dr-text" class:on={stage >= 2}>
    <p class="pill">Your role. Night 1 is coming.</p>
    <button class="link" on:click={close}>See the full card</button>
  </div>
</div>

<style>
  .dr { --w:min(84vw, 340px); --h:calc(var(--w) * 1.47); position:fixed; inset:0; z-index:60; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; transition:opacity .5s ease; }
  .dr.out { opacity:0; pointer-events:none; }
  .dr-bg { position:absolute; inset:0; background:center/cover; transition:opacity 2.6s ease; }
  .dr-bg::after { content:""; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 50%, rgba(8,10,16,.35), rgba(8,10,16,.8)); }
  .dr-bg.fade { opacity:.0; }
  .dr::before { content:""; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, rgba(8,10,16,.15), rgba(8,10,16,.6)); }
  .dr-deck { position:relative; width:var(--w); height:var(--h); }
  .dr-under { position:absolute; left:50%; top:50%; width:104px; height:146px; margin:-73px 0 0 -52px; border-radius:10px; background:#182033; border:2px solid #8a6a2c; box-shadow:0 6px 14px rgba(0,0,0,.6);
    transform:translateY(calc(var(--k) * -0.8px)); transition:transform .9s ease, opacity .9s ease; }
  .dr-under.drop { transform:translateY(300px); opacity:0; }
  .dr-card { position:absolute; inset:0; perspective:1400px;
    transform:translateY(-30px) scale(calc(104 / 340)); transition:transform 1s cubic-bezier(.4,.1,.2,1); z-index:2; }
  .dr-card.big { transform:none; }
  .dr-flip { position:absolute; inset:0; transform-style:preserve-3d; transition:transform .95s cubic-bezier(.4,.1,.2,1) .2s; }
  .dr-face { position:absolute; inset:0; border-radius:16px; backface-visibility:hidden; -webkit-backface-visibility:hidden; overflow:hidden; text-align:left; color:var(--text);
    border:3px solid #8a6a2c; box-shadow:inset 0 0 0 5px #141a28, inset 0 0 0 6px rgba(217,164,65,.55), 0 14px 36px rgba(0,0,0,.75); }
  .dr-back { background:radial-gradient(circle at 50% 46%, rgba(217,164,65,.22), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 9px), #182033; }
  .dr-mark { position:absolute; left:50%; top:46%; width:44%; transform:translate(-50%,-50%); filter:drop-shadow(0 0 18px rgba(232,181,83,.6)); }
  .dr-front { transform:rotateY(180deg); background:linear-gradient(#1a2134, #121726); display:flex; flex-direction:column; padding:14px 14px 12px; gap:8px; }
  .dr-head { text-align:center; }
  .dr-head h3 { margin:0; font:700 calc(var(--w) * .075) "Alegreya SC",Georgia,serif; line-height:1.1; }
  .dr-head span { font-size:13px; opacity:.9; }
  .dr-art img { display:block; width:100%; height:auto; border-radius:10px; }
  .dr-line { flex:1; margin:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:8px 10px; border-radius:10px;
    background:rgba(237,230,214,.07); border:1px solid rgba(217,164,65,.35); font-size:calc(var(--w) * .047); line-height:1.35; }
  .dr-text { position:relative; text-align:center; opacity:0; transition:opacity .8s ease; }
  .dr-text.on { opacity:1; }
  .pill { margin:0; display:inline-block; padding:4px 14px; border-radius:999px; background:rgba(14,18,28,.75); border:1px solid rgba(160,180,215,.16); color:var(--lamp); }
  .dr-text .link { margin:6px auto 0; }
  @media (prefers-reduced-motion: reduce) { .dr-bg, .dr-under, .dr-card, .dr-flip { transition-duration:.01s !important; } }
</style>
