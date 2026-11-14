<script context="module" lang="ts">
  // The Guide's sections, shared by the Guide landing list and the desktop side menu.
  export const GUIDE_ROWS = [
    { to: "roles", title: "Roles", sub: "Every role, and the roster for each player count" },
    { to: "rules", title: "How to play", sub: "A game from start to end" },
    { to: "combat", title: "Attack & Defence", sub: "Light, Heavy, Absolute, and who has what" },
    { to: "glossary", title: "Glossary", sub: "Every game word explained" },
  ];
</script>

<script lang="ts">
  // Desktop Guide side menu (Nik, 14 Nov): stays in place on every Guide page, Roles included.
  export let at: string;
  const go = (r: string) => { location.hash = "#/" + r; scrollTo(0, 0); };
</script>

<nav class="gside" aria-label="Guide">{#each GUIDE_ROWS as r}<button class:on={at === r.to || (r.to === "glossary" && at === "term")} on:click={() => go(r.to)}>{r.title}</button>{/each}</nav>
