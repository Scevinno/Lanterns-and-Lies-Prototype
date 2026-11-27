<script lang="ts">
  // The Deal, part 2 (Nik, 26 Nov): the deck from the lobby sits in the middle, the top card turns over to show your role,
  // and the lobby picture fades into the game's day picture. Desktop and phone alike, once per tab that saw the shuffle.
  // The card is laid out like a playing card (Nik, 26 Nov): name at the top, the character in its faction ring, and the
  // one-line rule underneath (the same line as the in-game roster). After 15 seconds it hides itself and the usual role
  // screen, with the full card, takes the rest of the 30-second reveal (Nik, 26 Nov).
  // The front, redesigned (Nik, 27 Nov; design/card-edge-previews.html, option 6): a playing card with the faction's
  // symbol in two corners, the character standing on the card's own stone background (its picture has no frame and fades
  // at the edges), the faction under it and the one-line rule. Both faces have a gold frame 6.75/340 of the card's width.
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
  const FC: Record<string, string> = { Lanternkeepers: "var(--lk)", Mafia: "var(--syn)", Syndicate: "var(--car)", Unbound: "var(--ub)" };
  // Faction symbols, as in the design: a lantern, a flame, an anchor and a crescent moon.
  const ICONS: Record<string, string> = {
    Lanternkeepers: "M9 2h6v2h1a1 1 0 0 1 1 1v1H7V5a1 1 0 0 1 1-1h1V2zm-2 6h10l-1 11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2L7 8zm5 3c-1 1.4-2 2.6-2 4a2 2 0 0 0 4 0c0-1.4-1-2.6-2-4z",
    Mafia: "M12 2c3 3 4 6 4 9a4 4 0 0 1-3 3.9V19h3v2H8v-2h3v-4.1A4 4 0 0 1 8 11c0-3 1-6 4-9z",
    Syndicate: "M12 2a3 3 0 0 1 1 5.8V10h4v2h-4v7.9c2.6-.4 4.6-2.2 5.3-4.6L16 15l3-4 3 4-1.7.3C19.4 19.2 16 22 12 22s-7.4-2.8-8.3-6.7L2 15l3-4 3 4-2.3.3c.7 2.4 2.7 4.2 5.3 4.6V12H7v-2h4V7.8A3 3 0 0 1 12 2zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
    Unbound: "M14.5 2.5A9.5 9.5 0 1 0 21.5 17 8 8 0 0 1 14.5 2.5z",
  };
  const icon = ICONS[role.faction] ?? ICONS.Lanternkeepers;
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
        <div class="dr-face dr-front" style="--fc:{FC[role.faction] ?? 'var(--lamp)'}">
          <svg class="dr-idx tl" viewBox="0 0 24 24" aria-hidden="true"><path d={icon} /></svg>
          <svg class="dr-idx br" viewBox="0 0 24 24" aria-hidden="true"><path d={icon} /></svg>
          <h3>{role.name}</h3>
          <div class="dr-art"><img src={base + role.image} alt={role.name} /></div>
          <p class="dr-fac {fc}">{role.faction}</p>
          <div class="dr-orn" aria-hidden="true"></div>
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
  .dr { --w:min(84vw, 340px); --h:calc(var(--w) * 1.47); --u:calc(var(--w) / 340); position:fixed; inset:0; z-index:60; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; transition:opacity .5s ease; }
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
    border:calc(var(--u) * 6.75) solid #8a6a2c; box-shadow:inset 0 0 0 5px #141a28, inset 0 0 0 6px rgba(217,164,65,.55), 0 14px 36px rgba(0,0,0,.75); }
  .dr-back { background:radial-gradient(circle at 50% 46%, rgba(217,164,65,.22), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 9px), #182033; }
  .dr-mark { position:absolute; left:50%; top:46%; width:44%; transform:translate(-50%,-50%); filter:drop-shadow(0 0 18px rgba(232,181,83,.6)); }
  /* Front (Nik, 27 Nov). Sizes are the 340px design's, scaled by --u so a narrow phone gets the same card, smaller. */
  .dr-front { transform:rotateY(180deg); isolation:isolate;
    background:radial-gradient(ellipse 62% 40% at 50% 33%, color-mix(in srgb, var(--fc) 10%, #2a3442) 0%, #1e2734 48%, #121821 100%); }
  .dr-front::before { content:""; position:absolute; inset:0; z-index:-1; opacity:.55; mix-blend-mode:overlay; pointer-events:none;
    background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
  .dr-idx { position:absolute; width:calc(var(--u) * 20); height:calc(var(--u) * 20); fill:var(--fc); }
  .dr-idx.tl { top:calc(var(--u) * 20); left:calc(var(--u) * 18); }
  .dr-idx.br { bottom:calc(var(--u) * 20); right:calc(var(--u) * 18); transform:rotate(180deg); }
  .dr-front h3 { position:absolute; top:calc(var(--u) * 24); left:calc(var(--u) * 48); right:calc(var(--u) * 48); margin:0; text-align:center;
    font:700 calc(var(--u) * 26)/1.1 "Alegreya SC",Georgia,serif; color:#f1e6cc; }
  .dr-art { position:absolute; left:50%; top:calc(var(--u) * 50); width:calc(var(--u) * 272); height:calc(var(--u) * 272); margin-left:calc(var(--u) * -136);
    -webkit-mask-image:radial-gradient(closest-side, #000 70%, transparent 100%); mask-image:radial-gradient(closest-side, #000 70%, transparent 100%); }
  .dr-art img { display:block; width:100%; height:100%; object-fit:cover; object-position:50% 30%; transform:scale(1.14); }
  .dr-fac { position:absolute; top:calc(var(--u) * 316); left:0; right:0; margin:0; text-align:center; font-size:calc(var(--u) * 13); letter-spacing:.1em; text-transform:uppercase; }
  .dr-orn { position:absolute; top:calc(var(--u) * 338); left:calc(var(--u) * 90); right:calc(var(--u) * 90); height:calc(var(--u) * 10); background:
    radial-gradient(circle, var(--lamp) 0 3px, transparent 3.5px) center/10px 10px no-repeat, linear-gradient(90deg, transparent, rgba(217,164,65,.7), transparent) center/100% 1px no-repeat; }
  .dr-line { position:absolute; left:calc(var(--u) * 46); right:calc(var(--u) * 46); top:calc(var(--u) * 356); bottom:calc(var(--u) * 46); margin:0;
    display:flex; align-items:center; justify-content:center; text-align:center; font-size:calc(var(--u) * 16); line-height:1.38; color:#e6dcc4; }
  .dr-text { position:relative; text-align:center; opacity:0; transition:opacity .8s ease; }
  .dr-text.on { opacity:1; }
  .pill { margin:0; display:inline-block; padding:4px 14px; border-radius:999px; background:rgba(14,18,28,.75); border:1px solid rgba(160,180,215,.16); color:var(--lamp); }
  .dr-text .link { margin:6px auto 0; }
  @media (prefers-reduced-motion: reduce) { .dr-bg, .dr-under, .dr-card, .dr-flip { transition-duration:.01s !important; } }
</style>
