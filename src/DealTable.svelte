<script lang="ts">
  // The Deal (Nik, 26 Nov): the desktop lobby is a card table. Each player who joins gets a face-down card.
  // When the host presses Start, the cards gather, shuffle and square into one deck during the 10-second countdown.
  // The flip that shows your role plays on the game's first screen (DealReveal), because roles are dealt when the countdown ends.
  import { onDestroy, onMount } from "svelte";
  export let size: number;
  export let names: string[];
  export let starting = false;
  export let partyId: string;

  // Rows for every party size (Nik, 26 Nov).
  const LAYOUT: Record<number, number[]> = { 15: [5, 5, 5], 14: [5, 4, 5], 13: [4, 5, 4], 12: [4, 4, 4], 11: [4, 3, 4], 10: [5, 5], 9: [3, 3, 3], 8: [4, 4] };
  const W = 680, H = 670, CW = 104, CH = 146, GX = 26, ROWH = 180, GY = 14, TOP = 96;
  const DECK = { x: W / 2 - CW / 2, y: TOP + (H - TOP) / 2 - CH / 2 };
  const base = import.meta.env.BASE_URL;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const split = (n: number) => { const rows = Math.ceil(n / 5), out: number[] = []; for (let r = 0; r < rows; r++) out.push(Math.floor(n / rows) + (r < n % rows ? 1 : 0)); return out; };
  function layout(rs: number[]) {
    const top = TOP + (3 - rs.length) * (ROWH + GY) / 2, out: { x: number; y: number }[] = [];
    rs.forEach((c, r) => { const w = c * CW + (c - 1) * GX, x0 = W / 2 - w / 2; for (let k = 0; k < c; k++) out.push({ x: x0 + k * (CW + GX), y: top + r * (ROWH + GY) }); });
    return out;
  }
  $: slots = layout(LAYOUT[size] ?? split(size));
  $: seated = names.slice(0, size);
  $: full = seated.length >= size;

  let els: HTMLDivElement[] = [], box: HTMLDivElement, scale = 1, dealing = false, timers: any[] = [], mounted = false, prev = false, ro: ResizeObserver | null = null;
  const tilt = (i: number) => [-3, 2, -1.5, 3, -2.5, 1.5, -1, 2.5, -2, 1, -3, 2, -1.5, 3, -2.5][i % 15];
  function put(el: HTMLDivElement | undefined, x: number, y: number, rot = 0, ms = 600, extra = "") {
    if (!el) return; el.style.transitionDuration = (reduce ? 0 : ms) + "ms"; el.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg) ${extra}`;
  }
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, reduce ? 0 : ms));
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  function seat(ms = 600) {
    clear(); dealing = false;
    els.forEach((el, i) => { if (!el) return; el.style.zIndex = ""; const s = slots[i]; if (s) put(el, s.x, s.y, tilt(i), ms); });
  }
  function shuffle(animate: boolean) {
    clear(); dealing = true;
    try { sessionStorage.setItem("lnl-deal:" + partyId, "1"); } catch { /* private mode */ }
    let order = els.filter(Boolean);
    const stack = (ms: number, stagger = 0) => order.forEach((el, k) => { el.style.zIndex = String(k + 1); later(k * stagger, () => put(el, DECK.x, DECK.y - k * 0.7, k % 2 ? 0.6 : -0.6, ms)); });
    const lift = () => { const top = order[order.length - 1]; put(top, DECK.x, DECK.y - 30 - order.length * 0.7, 0, 500, "scale(1.06)"); };
    if (!animate || reduce) { stack(400); later(450, lift); return; }
    // 1. gather into one pile
    order.forEach((el, k) => { el.style.zIndex = String(k + 1); later(k * 30, () => put(el, DECK.x + (Math.random() * 16 - 8), DECK.y - k * 0.7, Math.random() * 14 - 7, 650)); });
    // 2. three riffle shuffles
    for (const t0 of [1100, 2700, 4300]) {
      later(t0, () => {
        const a = order.filter((_, k) => k % 2 === 0), b = order.filter((_, k) => k % 2 === 1);
        a.forEach((el, k) => put(el, DECK.x - 120, DECK.y - k * 0.7, -7, 320));
        b.forEach((el, k) => put(el, DECK.x + 120, DECK.y - k * 0.7, 7, 320));
        order = [...a, ...b].sort(() => Math.random() - 0.5);
      });
      later(t0 + 420, () => stack(240, 42));
    }
    // 3. square the deck, 4. lift the top card
    later(6100, () => stack(450));
    later(7100, lift);
  }

  // A card deals in from above when its player joins.
  function enter(el: HTMLDivElement, i: number) {
    put(el, W / 2 - CW / 2, -240, -30, 0);
    const go = () => { if (!dealing && slots[i]) put(el, slots[i].x, slots[i].y, tilt(i), 800); };
    if (reduce) go(); else timers.push(setTimeout(() => requestAnimationFrame(go), 40 + (mounted ? 0 : i * 60)));
  }

  $: if (mounted && starting !== prev) { prev = starting; starting ? shuffle(true) : seat(); }

  function fit() { if (box) scale = Math.min(box.clientWidth / W, box.clientHeight / H, 1.15); }
  onMount(() => {
    fit(); ro = new ResizeObserver(fit); ro.observe(box);
    prev = starting;
    if (starting) setTimeout(() => shuffle(false), 60); // opened mid-countdown: show the deck straight away
    setTimeout(() => (mounted = true), 0);
  });
  onDestroy(() => { clear(); ro?.disconnect(); });
</script>

<div class="deal" bind:this={box}>
  <div class="deal-in" style="width:{W}px;height:{H}px;transform:translateX(-50%) scale({scale})">
    <div class="deal-head" class:gone={dealing}>
      <b>Take a seat</b>
      <span>{full ? `All ${size} seats are taken. ${size} roles are shuffled face down.` : `${seated.length} of ${size} here. Roles are dealt face down when the table is full.`}</span>
    </div>
    {#each slots as s, i}
      <div class="dslot" class:gone={dealing} style="left:{s.x}px;top:{s.y}px"></div>
      <div class="dlabel" class:empty={!seated[i]} class:gone={dealing} style="left:{s.x + CW / 2 - 70}px;top:{s.y + CH + 6}px">{seated[i] ?? "empty seat"}</div>
    {/each}
    {#each seated as _, i (i)}
      <div class="dcard" bind:this={els[i]} use:enter={i}><div class="dback"><img src="{base}lantern-loading.webp" alt="" /></div></div>
    {/each}
  </div>
</div>

<style>
  .deal { position:relative; width:100%; height:calc(100dvh - 150px); min-height:480px; }
  .deal-in { position:absolute; left:50%; top:0; transform-origin:top center; }
  .deal-head { position:absolute; left:0; right:0; top:4px; text-align:center; transition:opacity .5s; }
  .deal-head b { display:block; font:700 32px "Almendra",Georgia,serif; text-shadow:0 2px 6px #000; }
  .deal-head span { color:var(--dim); text-shadow:0 1px 3px #000; }
  .dslot { position:absolute; width:104px; height:146px; border:2px dashed rgba(160,180,215,.25); border-radius:10px; transition:opacity .4s; }
  .dlabel { position:absolute; width:140px; text-align:center; font-size:15px; text-shadow:0 1px 3px #000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:opacity .4s; }
  .dlabel.empty { color:#7d7a72; font-style:italic; font-size:14px; }
  .gone { opacity:0; }
  .dcard { position:absolute; left:0; top:0; width:104px; height:146px; transition-property:transform; transition-timing-function:cubic-bezier(.3,.7,.2,1); will-change:transform; }
  .dback { position:absolute; inset:0; border-radius:10px;
    background:radial-gradient(circle at 50% 46%, rgba(217,164,65,.22), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 9px), #182033;
    border:2px solid #8a6a2c; box-shadow:inset 0 0 0 4px #182033, inset 0 0 0 5px rgba(217,164,65,.55), 0 6px 14px rgba(0,0,0,.6); }
  .dback img { position:absolute; left:50%; top:46%; width:46px; transform:translate(-50%,-50%); filter:drop-shadow(0 0 10px rgba(232,181,83,.6)); }
</style>
