<script lang="ts">
  // The Deal on phones (Nik, 26 Nov): the lobby keeps its name list, and when the game starts the cards rise from the
  // bottom of the screen, shuffle top and bottom (the desktop splits left and right) and square into one deck.
  // The flip on the first game screen (DealReveal) then follows on from it.
  import { onDestroy, onMount } from "svelte";
  export let size: number;
  export let partyId: string;
  export let remaining: string;
  export let busy = false;
  export let onCancel: () => void;

  const base = import.meta.env.BASE_URL;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CW = 84, CH = 118;
  let els: HTMLDivElement[] = [], timers: any[] = [], vw = 390, vh = 800;
  const put = (el: HTMLDivElement | undefined, x: number, y: number, rot = 0, ms = 600, extra = "") => {
    if (!el) return; el.style.transitionDuration = (reduce ? 0 : ms) + "ms"; el.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg) ${extra}`;
  };
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, reduce ? 0 : ms));

  onMount(() => {
    vw = innerWidth; vh = innerHeight;
    try { sessionStorage.setItem("lnl-deal:" + partyId, "1"); } catch { /* private mode */ }
    let order = els.filter(Boolean);
    const d = { x: vw / 2 - CW / 2, y: vh * 0.44 - CH / 2 };
    const stack = (ms: number, stagger = 0) => order.forEach((el, k) => { el.style.zIndex = String(k + 1); later(k * stagger, () => put(el, d.x, d.y - k * 0.7, k % 2 ? 0.6 : -0.6, ms)); });
    // 1. the cards rise from the bottom edge, fanned, into one pile
    order.forEach((el, k) => { el.style.zIndex = String(k + 1); put(el, d.x + (k - order.length / 2) * 14, vh + 40, (k - order.length / 2) * 4, 0); });
    order.forEach((el, k) => later(80 + k * 45, () => put(el, d.x + (Math.random() * 12 - 6), d.y - k * 0.7, Math.random() * 12 - 6, 650)));
    // 2. three shuffles, split top and bottom
    for (const t0 of [1300, 2800, 4300]) {
      later(t0, () => {
        const a = order.filter((_, k) => k % 2 === 0), b = order.filter((_, k) => k % 2 === 1);
        a.forEach((el, k) => put(el, d.x, d.y - 100 - k * 0.7, -4, 320));
        b.forEach((el, k) => put(el, d.x, d.y + 100 - k * 0.7, 4, 320));
        order = [...a, ...b].sort(() => Math.random() - 0.5);
      });
      later(t0 + 420, () => stack(240, 40));
    }
    // 3. square the deck, 4. lift the top card
    later(6000, () => stack(450));
    later(7000, () => { const top = order[order.length - 1]; put(top, d.x, d.y - 24 - order.length * 0.7, 0, 500, "scale(1.06)"); });
  });
  onDestroy(() => timers.forEach(clearTimeout));
</script>

<div class="pd" role="dialog" aria-label="The game is starting">
  <div class="pd-bg" style="background-image:url({base}bg/nav.webp)" aria-hidden="true"></div>
  {#each Array(size) as _, i}
    <div class="pd-card" bind:this={els[i]}><img src="{base}lantern-loading.webp" alt="" /></div>
  {/each}
  <div class="pd-foot">
    <p class="pd-count">Starting in {remaining}</p>
    <p class="dim small">The roles are being shuffled.</p>
    <button class="ghost" disabled={busy} on:click={onCancel}>Cancel</button>
  </div>
</div>

<style>
  .pd { position:fixed; inset:0; z-index:60; overflow:hidden; }
  .pd-bg { position:absolute; inset:0; background:center/cover; }
  .pd-bg::after { content:""; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 44%, rgba(8,10,16,.3), rgba(8,10,16,.85)); }
  .pd-card { position:absolute; left:0; top:0; width:84px; height:118px; border-radius:9px; transition-property:transform; transition-timing-function:cubic-bezier(.3,.7,.2,1); will-change:transform;
    background:radial-gradient(circle at 50% 46%, rgba(217,164,65,.22), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 9px), #182033;
    border:2px solid #8a6a2c; box-shadow:inset 0 0 0 3px #182033, inset 0 0 0 4px rgba(217,164,65,.55), 0 6px 14px rgba(0,0,0,.6); transform:translate(-200px,-200px); }
  .pd-card img { position:absolute; left:50%; top:46%; width:38px; transform:translate(-50%,-50%); filter:drop-shadow(0 0 8px rgba(232,181,83,.6)); }
  .pd-foot { position:absolute; left:0; right:0; bottom:max(28px, env(safe-area-inset-bottom)); text-align:center; padding:0 24px; }
  .pd-count { margin:0; font:700 28px "Almendra",Georgia,serif; color:var(--lamp); text-shadow:0 2px 6px #000; }
  .pd-foot button { margin-top:10px; min-width:160px; }
</style>
