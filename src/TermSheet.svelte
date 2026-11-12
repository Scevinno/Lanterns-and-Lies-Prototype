<script lang="ts">
  // Half-screen glossary sheet (Nik, 12 Nov): opens when a game word on a role card is tapped.
  import { termById } from "./guide";
  export let id: string | null = null;
  export let onClose: () => void;
  export let guideLinks = true;
  $: term = id ? termById(id) : null;
  const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
</script>

<svelte:window on:keydown={key} />
{#if term}
  <div class="term-scrim" on:click={onClose} aria-hidden="true"></div>
  <div class="term-sheet" role="dialog" aria-modal="true" aria-labelledby="term-title">
    <div class="handle" aria-hidden="true"></div>
    <h2 id="term-title">{term.title}</h2>
    <p>{term.text}</p>
    <div class="term-actions">
      {#if guideLinks}<a class="link" href="#/glossary" on:click={onClose}>All game words</a>{:else}<span></span>{/if}
      <button class="go" on:click={onClose}>Got it</button>
    </div>
  </div>
{/if}
