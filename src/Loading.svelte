<script lang="ts">
  // Shown for a moment while the app or a game loads. The logo 13 lantern (Nik, 13 Nov), a line, and a small joke from Emberhollow.
  const LINES = [
    "A lantern never lies. The people holding them do.",
    "Count the lanterns. Then count them again.",
    "Someone in Emberhollow is smiling a little too much.",
    "The fog is coming in. So is the Loan Shark.",
    "Trust everyone. Briefly.",
    "The Mayor swears he's the Mayor. They all do.",
    "The Doctor is in. Probably.",
    "Nobody left the docks last night. Nobody admits it, anyway.",
    "Keep your lantern lit and your alibi straight.",
    "Every town has a secret. This one has a few.",
  ];
  const src = `${import.meta.env.BASE_URL}lantern-loading.webp`;
  const line = LINES[Math.floor(Math.random() * LINES.length)];
</script>

<main class="loading" aria-busy="true">
  <img class="lantern" {src} width="68" height="100" alt="" />
  <p class="what">Lighting the lanterns…</p>
  <p class="quote">{line}</p>
</main>
