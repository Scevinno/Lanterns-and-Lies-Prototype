// Guide content (Creative Coach draft, 12 Nov, for Nik's review). One home for the rules text:
// How to play, Attack & Defence and the Glossary. Role cards link game words here (tap a word, a half sheet opens).

export interface Section { title: string; body: string[] }
export interface Term { id: string; title: string; text: string; match: string[] }

export const HOW_TO_PLAY: Section[] = [
  { title: "The town", body: [
    "Emberhollow is a river-port town where a living fog, the Gloam, rolls in every night. Every house keeps a lantern burning until dawn. A house whose lantern is out by morning has lost someone.",
    "Every game has three sides. The Lanternkeepers are the townsfolk. One evil side hides among them: the Syndicate or the Cartel, never both. The Unbound are drifters with their own aims.",
    "Nobody knows anyone else's role. Evil players know their allies; everyone else has to work it out.",
  ] },
  { title: "Setting up", body: [
    "Private parties have 8 to 15 players. Whoever creates the party picks In person (one room, talking out loud) or Online (talking in chat), the evil side (Syndicate, Cartel or Random) and the timers.",
    "Share the code, link or QR. When the party is full, anyone can press Start, and anyone can cancel the 10-second countdown.",
    "The roster for each player count says how many roles of each kind are dealt, never which ones. A Unique role is never dealt twice in one game.",
  ] },
  { title: "How a game runs", body: [
    "Everyone gets 30 seconds to read their role. Then Night 1 falls, followed by Day 1, Night 2, Day 2, and so on up to Day 7.",
    "Every even Night (2, 4, 6) is a Fog Night. The narrator announces it at nightfall.",
    "The game ends as soon as a side has won, or at the end of Day 7.",
  ] },
  { title: "Night", body: [
    "Each player with a Night ability chooses a target, or chooses to do nothing. Everyone gets a screen to tap, so nobody gives away that they have no action.",
    "Abilities resolve in a fixed order: swaps and Holds first, then the Unbound, the evil side, Lanternkeeper Killing and Protective roles, then Lanternkeeper Investigative and Power roles, then Support.",
    "A Lanternkeeper investigator or Power role who dies that Night learns nothing.",
    "In an online game, the evil side has its own chat at Night.",
  ] },
  { title: "Dawn", body: [
    "The narrator says whose lantern went out. Roles stay hidden until the game ends.",
    "Your private results arrive at dawn: what you learned, whether you were attacked, swapped or Held, and anything else that happened to you.",
  ] },
  { title: "Day", body: [
    "Discussion: talk it through. In person, out loud; online, in the town chat.",
    "Vote: votes are public. A majority of living players puts someone on Trial. The Mayor's vote counts as three once Revealed, and a Paymaster's bribe moves votes.",
    "Defence: only the accused may speak.",
    "Verdict: everyone else votes Guilty or Innocent. A tie is Innocent. Guilty means execution, and the Day ends.",
    "After an Innocent verdict the town may vote again, up to three Trials a Day. A Judge's Condemn also ends the Day.",
    "Dusk: 15 seconds before Night, with the town chat still open online.",
  ] },
  { title: "Winning", body: [
    "Lanternkeepers win when the evil side and every Unbound killer are gone.",
    "The evil side wins when every Lanternkeeper and every Unbound killer is gone, or if it is still alive at the end of Day 7.",
    "An Unbound killer wins only by being the last one standing before Day 7 ends. If only an Unbound killer is left at the end of Day 7, nobody wins.",
    "Other Unbound roles chase their own goals, and can win alongside anyone.",
    "There is no win by numbers: the game runs until a side is actually gone.",
  ] },
  { title: "Results and the narrator", body: [
    "Every result is private. What you share, and whether you tell the truth, is up to you.",
    "Deceptive roles can change what investigators see.",
    "On a Fog Night, while the Hollowman lives, every information result is random: it may be right or wrong.",
    "A result always names the player you chose, even if a swap or a redirect sent you somewhere else.",
  ] },
  { title: "Chats", body: [
    "Online: the town chat is open in the Day and at Dusk. The evil side has its own chat at Night, and the dead talk among themselves.",
    "In person: only the evil side's Night chat is on. Everything else is said out loud.",
    "Anyone in an in-person party can pause the game, for a break or a late arrival.",
  ] },
];

export const COMBAT_INTRO: string[] = [
  "Every attack and every defence has a level: Light (I), Heavy (II) or Absolute (III).",
  "An attack kills only if it is stronger than the target's defence. If they are equal, the target survives.",
  "A player with no defence dies to any attack.",
];
export const COMBAT_TABLE: [string, string, string, string, string][] = [
  ["", "No defence", "Light", "Heavy", "Absolute"],
  ["Light attack", "Dies", "Survives", "Survives", "Survives"],
  ["Heavy attack", "Dies", "Dies", "Survives", "Survives"],
  ["Absolute attack", "Dies", "Dies", "Dies", "Survives"],
];
export const COMBAT_RULES: Section[] = [
  { title: "Own defence and given defence", body: [
    "Some roles always have a defence of their own, shown on their card.",
    "Others give defence to someone else for one Night: the Doctor's Heal (Heavy), the Quartermaster's Hold (Heavy), the Hunter's trap (Heavy, to its target), the Innkeeper's shelter (Light, to everyone who visits him).",
    "A player keeps the highest defence they have that Night; defences don't add up.",
  ] },
  { title: "Protection that fights back", body: [
    "The Guardsman doesn't give defence. He steps in front of one attack and strikes back: he and the attacker both take a Heavy Attack.",
    "He can't stop the Veteran, another Guardsman, an unpaid Debt, the Tinkerer's Trigger or the Assassin.",
  ] },
  { title: "Attacks that can't be stopped", body: [
    "Absolute attacks beat every defence except Absolute: the Assassin's hit, the Rogue's guilt, an unpaid Debt and the Tinkerer's Trigger.",
    "The Hollowman's clear-Night attack hits his target and everyone who visits them. A Doctor who Heals his target dies instead of them.",
  ] },
  { title: "What you're told", body: [
    "If you are attacked you hear about it at dawn, whether you survive or not.",
    "A Doctor or Guardsman whose protection saved someone is told so.",
    "An attacker whose target survives hears that their ability failed.",
  ] },
];

// Glossary. `match` lists the exact words that become tappable in role text (first time each appears on a card).
export const GLOSSARY: Term[] = [
  { id: "light", title: "Light (I)", match: ["Light Attack", "Light Defence"], text: "The lowest attack and defence level. A Light attack kills only players with no defence." },
  { id: "heavy", title: "Heavy (II)", match: ["Heavy Attack", "Heavy Defence"], text: "The middle level. A Heavy attack beats Light defence; Heavy defence stops Light and Heavy attacks." },
  { id: "absolute", title: "Absolute (III)", match: ["Absolute Attack", "Absolute Defence", "Absolute Attacks"], text: "The highest level. An Absolute attack beats every defence except Absolute; Absolute defence stops every attack." },
  { id: "visit", title: "Visit", match: ["visits", "visit"], text: "Using an ability on another player at Night means visiting them. Some roles see, trap, Plant or attack visitors. A few abilities don't visit, and those cards say so." },
  { id: "hold", title: "Hold / Held", match: ["Hold-immune", "Holds", "Hold", "Held"], text: "A Held player's Night ability doesn't happen, and they are told. The Locksmith, Enforcer and Quartermaster Hold. Hold-immune roles can't be Held, and the player who tried is told it failed." },
  { id: "swap", title: "Swap", match: ["swapped", "swap"], text: "The Ferryman and the Smuggler swap two players: everyone who visits one of them visits the other instead. Swapped players are told; their visitors are not." },
  { id: "astray", title: "Led astray", match: ["led astray", "lead astray"], text: "The Fence sends a player to a neighbour instead of their chosen target. They aren't told. Some roles can't be led astray." },
  { id: "planted", title: "Planted / Trigger", match: ["Planted", "Trigger", "Plant"], text: "The Tinkerer Plants explosives in houses; Planted players aren't told and look evil to investigators. When he Triggers, every Planted player takes an Absolute Attack." },
  { id: "framed", title: "Framed", match: ["Framed", "Frame"], text: "The Framer makes a player look evil to the Seer, Detective, Oracle and Constable." },
  { id: "disguised", title: "Disguised", match: ["Disguised", "disguise"], text: "The Tailor dresses a Syndicate member up as another player, so investigators get misleading results until the next Night." },
  { id: "debt", title: "Debt / Collection Night", match: ["Collection Night", "Debt"], text: "The Loan Shark puts players in Debt. The next Night is their Collection Night: they must visit the Loan Shark to pay, or die at the end of the Night. Every Debt clears if the Loan Shark dies." },
  { id: "reveal", title: "Reveal", match: ["Revealed", "Reveal"], text: "The Mayor and the Judge can Reveal themselves at Night from Night 2. The narrator confirms it at dawn. Revealed players gain power but become easy targets." },
  { id: "condemn", title: "Condemn", match: ["Condemn"], text: "A Revealed Judge can Condemn a player during the vote when nobody is on Trial: they are found Guilty and executed. Condemning a Lanternkeeper costs the Judge their life." },
  { id: "trial", title: "Trial / voted out", match: ["voted out", "Trial", "Guilty"], text: "A majority vote puts a player on Trial. After their defence, the town votes Guilty or Innocent; Guilty means execution. A tie is Innocent." },
  { id: "fog", title: "Fog Night", match: ["Fog Nights", "Fog Night", "Fog"], text: "Every even Night. While the Hollowman lives, every information result on a Fog Night is random. The Hollowman can't attack then, but has Absolute Defence." },
  { id: "clear", title: "Clear Night", match: ["Clear Nights", "clear Nights", "Clear Night", "clear Night"], text: "Every odd Night (1, 3, 5, 7). The Hollowman attacks on Clear Nights." },
  { id: "evil", title: "Evil / Innocent", match: ["look evil", "Evil", "Innocent"], text: "The Constable's result. Syndicate, Cartel, Unbound killers, the Town Crier and the Assassin read Evil. Framed and Planted players look evil too." },
  { id: "immunity", title: "Detection Immunity", match: ["Detection Immunity"], text: "Some evil leaders read as Lanternkeepers to the Constable, the Oracle and the Seer. The Detective and the Spy still see through it." },
  { id: "heal", title: "Heal", match: ["Healed", "Heal"], text: "The Doctor's protection: Heavy Defence for one Night. It can't stop Absolute attacks." },
  { id: "alert", title: "Alert", match: ["Alerts", "Alert"], text: "The Veteran's ability, twice a game. On Alert he deals a Heavy Attack to every visitor and has Light Defence." },
  { id: "deceptive", title: "Deceptive roles", match: ["Deceptive roles", "Deceptive"], text: "Roles that twist information or movement: they can change what investigators learn or where people go." },
  { id: "investigative", title: "Investigative roles", match: ["Investigative role", "investigators", "investigator"], text: "Roles that learn something at Night. Their results can be changed by Deceptive roles and by the Fog." },
  { id: "power", title: "Power roles", match: ["Power role", "Power roles"], text: "Each side's leaders and strongest roles. They are always Unique, and several abilities fail on them." },
  { id: "unique", title: "Unique", match: ["Unique"], text: "A role that is never dealt twice in one game." },
  { id: "passage", title: "Passage", match: ["Passage"], text: "The Harbour Master ships a player out for the Day: they can't vote or be voted for. Only a Judge's Condemn can still reach them." },
  { id: "dusk", title: "Dusk", match: ["Dusk"], text: "A 15-second close to every Day before Night falls." },
];

/** Every word that should become tappable in role text, longest first so "Heavy Defence" wins over "Defence". */
export const TERM_WORDS: [string, string][] = GLOSSARY.flatMap((t) => t.match.map((m) => [m, t.id] as [string, string])).sort((a, b) => b[0].length - a[0].length);
export const termById = (id: string) => GLOSSARY.find((t) => t.id === id);
