<script lang="ts">
  // Half-screen glossary sheet (Nik, 12 Nov): opens when a game word on a role card is tapped.
  // Draggable by the top strip (Nik, 13 Nov): pull down to close (same as Got it); pull up to open the word's own page.
  // Inside a game there are no links out, so pulling up only springs back.
  import { termById } from "./guide";
  export let id: string | null = null;
  export let onClose: () => void;
  export let guideLinks = true;
  /** Opens the full term page; without it, pulling up springs back. */
  export let onExpand: ((id: string) => void) | null = null;
  $: term = id ? termById(id) : null;
  $: canExpand = guideLinks && !!onExpand;
  const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };

  const OPEN_AT = 70; // px dragged before release counts
  let dy = 0, startY = 0, startT = 0, dragging = false;
  function down(e: PointerEvent) { dragging = true; startY = e.clientY; startT = e.timeStamp; dy = 0; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const d = e.clientY - startY;
    dy = d > 0 ? d : canExpand ? d : d / 4; // upward pull resists when there is nowhere to go
  }
  function up(e: PointerEvent) {
    if (!dragging) return; dragging = false;
    const fast = Math.abs(dy) > 25 && e.timeStamp - startT < 250; // a quick flick counts too
    if (dy > OPEN_AT || (fast && dy > 0)) { dy = 0; onClose(); }
    else if (canExpand && (dy < -OPEN_AT || (fast && dy < 0)) && id) { const t = id; dy = 0; onClose(); onExpand?.(t); }
    else dy = 0;
  }
  // Pulling down slides the sheet away; pulling up grows it toward full screen.
  $: sheetStyle = dy > 0 ? `transform:translateY(${dy}px)` : dy < 0 ? `max-height:calc(50dvh + ${-dy}px); min-height:calc(30dvh + ${-dy}px)` : "";
</script>

<svelte:window on:keydown={key} />
{#if term}
  <div class="term-scrim" on:click={onClose} aria-hidden="true"></div>
  <div class="term-sheet" class:dragging role="dialog" aria-modal="true" aria-labelledby="term-title" style={sheetStyle}>
    <div class="grab" on:pointerdown={down} on:pointermove={move} on:pointerup={up} on:pointercancel={up} aria-hidden="true"><div class="handle"></div></div>
    <h2 id="term-title">{term.title}</h2>
    <p>{term.text}</p>
    {#if term.points}<ul class="term-points">{#each term.points as x}<li>{x}</li>{/each}</ul>{/if}
    <div class="term-actions">
      {#if guideLinks}<a class="link" href="#/glossary" on:click={onClose}>All game words</a>{:else}<span></span>{/if}
      <button class="go" on:click={onClose}>Got it</button>
    </div>
  </div>
{/if}
