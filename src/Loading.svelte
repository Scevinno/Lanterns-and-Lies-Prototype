<script lang="ts">
  // Shown for a moment while the app or a game loads. A lantern, a line, and a small joke from Emberhollow.
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
  const line = LINES[Math.floor(Math.random() * LINES.length)];
</script>

<main class="loading" aria-busy="true">
  <svg class="lantern" viewBox="0 0 48 64" width="56" height="75" aria-hidden="true">
    <path d="M18 6h12M24 2v4M14 12h20l-3 6H17z" fill="none" stroke="#A9A497" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="15" y="18" width="18" height="30" rx="4" fill="none" stroke="#A9A497" stroke-width="2" />
    <ellipse class="flame" cx="24" cy="34" rx="5" ry="8" fill="#E8B553" />
    <path d="M13 52h22" stroke="#A9A497" stroke-width="2" stroke-linecap="round" />
  </svg>
  <p class="what">Lighting the lanterns…</p>
  <p class="quote">{line}</p>
</main>
