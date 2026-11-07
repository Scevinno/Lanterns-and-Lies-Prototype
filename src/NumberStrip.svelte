<script lang="ts">
  // A horizontal, scrollable line of numbers. Valid ones are marked with a lantern dot and can be chosen;
  // the rest are shown dimmed so you can see where the range starts and ends.
  import { onMount } from "svelte";
  export let value: number;
  export let valid: number[];
  export let from = 3, to = 20;
  export let label = "Players";
  const nums = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  let strip: HTMLElement, settleTimer: any, autoUntil = 0;

  // Scrolling we start ourselves (after a tap) must not be read as a swipe, or it can land on a neighbour.
  function centre(n: number, smooth = true) {
    const el = strip?.querySelector(`[data-n="${n}"]`) as HTMLElement | null;
    if (!el) return;
    const left = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2;
    if (Math.abs(strip.scrollLeft - left) < 2) return;
    autoUntil = Date.now() + 700; clearTimeout(settleTimer);
    strip.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
  }
  function pick(n: number) { if (!valid.includes(n)) return; value = n; centre(n); }
  // After a swipe stops, take the nearest valid number to the middle.
  function onScroll() {
    if (Date.now() < autoUntil) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      const mid = strip.scrollLeft + strip.clientWidth / 2; let best = value, dist = Infinity;
      for (const n of valid) { const el = strip.querySelector(`[data-n="${n}"]`) as HTMLElement; const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - mid); if (d < dist) { dist = d; best = n; } }
      if (best !== value) value = best;
      centre(best);
    }, 140);
  }
  onMount(() => centre(value, false));
  function key(e: KeyboardEvent) {
    const i = valid.indexOf(value);
    if (e.key === "ArrowRight" && i < valid.length - 1) { pick(valid[i + 1]); e.preventDefault(); }
    if (e.key === "ArrowLeft" && i > 0) { pick(valid[i - 1]); e.preventDefault(); }
  }
</script>

<div class="numstrip" role="slider" tabindex="0" aria-label={label} aria-valuemin={valid[0]} aria-valuemax={valid[valid.length - 1]} aria-valuenow={value} on:keydown={key}>
  <div class="track" bind:this={strip} on:scroll={onScroll}>
    {#each nums as n}
      <button type="button" tabindex="-1" data-n={n} class:ok={valid.includes(n)} class:on={n === value} disabled={!valid.includes(n)} on:click={() => pick(n)}>
        <span>{n}</span>{#if valid.includes(n)}<i aria-hidden="true"></i>{/if}
      </button>
    {/each}
  </div>
  <p class="dim small tc">{valid[0]} to {valid[valid.length - 1]} players. Swipe or tap.</p>
</div>
