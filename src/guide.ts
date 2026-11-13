// Guide content (Creative Coach draft, 12 Nov, for Nik's review). One home for the rules text:
// How to play, Attack & Defence and the Glossary. Role cards link game words here (tap a word, a half sheet opens).

// How to play formatting (Nik, 13 Nov): each section sits in a translucent box; `tone` tints it (night blue, dawn and day amber),
// `kind` lays it out: "steps" puts the text before a colon in a label chip, "order" numbers the lines (a "Name: text" line gets a bold name; a "~ " line is an unnumbered note after the list), "sides" gives each line its faction's edge;
// "modes" makes each "Name: text" line a card, and "> Name: text" lines tiles inside the card above (Setting up).
export interface Section { title: string; body: string[]; tone?: "night" | "dawn" | "day" | "town"; kind?: "steps" | "order" | "sides" | "modes" }

export const HOW_TO_PLAY: Section[] = [
  // Nik's rewording, 13 Nov.
  { title: "The town", tone: "town", body: [
    "Emberhollow is a river-port town where a living fog, the Gloam, rolls in every night. Every house keeps a lantern burning until dawn. A house whose lantern is out by morning has lost someone.",
    "Every game has three sides. The Lanternkeepers are the townsfolk. One evil side hides among them: the Syndicate or the Cartel. The Unbound are drifters with their own aims.",
    "Nobody knows anyone else's role. Evil players know their allies; everyone else has to work it out.",
  ] },
  { title: "Setting up", kind: "modes", body: [
    "Public: A 15-player game open to anyone. Coming after private parties.",
    "Private: 8 to 15 players you invite with a code, link or QR. Whoever creates the party picks the evil side and the timers.",
    "> In person: One room, talking out loud. Phones are for roles, votes and Night choices.",
    "> Online: Everyone talks in the chat.",
  ] },
  { title: "How a game runs", kind: "order", body: [
    "Role: everyone gets 30 seconds to read their role.",
    "Night: players with a Night ability choose their targets. Every even Night is a Fog Night.",
    "Dawn: the narrator says whose lantern went out, and private results arrive.",
    "Day: the town talks, votes and holds Trials, then Dusk falls. The next Night follows.",
    "~ Nights and Days repeat up to Day 7. The game ends as soon as a side has won, or at the end of Day 7.",
  ] },
  { title: "Winning", kind: "sides", body: [
    "Lanternkeepers win when the evil side and every Unbound killer are eliminated.",
    "The evil side (Syndicate or Cartel) wins when every Lanternkeeper and every Unbound killer is gone, or if at least one member is alive at the end of Day 7.",
    "An Unbound killer wins only by being the last one standing before Day 7 ends. If only an Unbound killer is left at the end of Day 7, they win.",
    "Other Unbound roles chase their own goals, and can win alongside anyone.",
    "There is no win by numbers: the game runs until a side is actually gone.",
  ] },
  { title: "Night", tone: "night", body: [
    "Each player with a Night ability chooses their target or targets, or chooses to do nothing.",
    "A Lanternkeeper investigator or Power role who dies that Night learns nothing.",
    "The Syndicate or Cartel has its own chat at Night.",
  ] },
  { title: "Night order", tone: "night", kind: "order", body: [
    "Swaps and Holds",
    "The Unbound",
    "Syndicate or Cartel",
    "Lanternkeeper Killing and Protective roles",
    "Lanternkeeper Investigative, Support and Power roles",
  ] },
  { title: "Dawn", tone: "dawn", body: [
    "The narrator says whose lantern went out. Roles stay hidden until the game ends.",
    "Your private results arrive at dawn: what you learned, whether you were attacked, swapped or Held, and anything else that happened to you.",
  ] },
  { title: "Day", tone: "day", kind: "steps", body: [
    "Discussion: talk it through, out loud in person or in the town chat online.",
    "Vote: votes are public. A majority of living players puts someone on Trial.",
    "Defence: only the accused may speak.",
    "Verdict: everyone else votes Guilty or Innocent. A tie is Innocent. Guilty means execution, and the Day ends.",
    "After an Innocent verdict the town may vote again, up to three Trials a Day.",
    "Dusk: 15 seconds before Night, with the town chat still open online.",
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

// Attack & Defence page (Nik, 13 Nov): the result grid and a table of every role; the special cases live in the Glossary.
export const COMBAT_RULE = "An attack kills only if it is stronger than the defence. Equal means the target survives.";

// Glossary (Nik, 13 Nov): six groups shown as boxes; each term has its own page (#/term/<id>).
// `match` lists the exact words that become tappable in role text (first time each appears on a card).
// `action` terms are tappable only in a card's ability bullets, never in its lore or ability titles.
// `type` terms list every role of that type on their page.
export const TERM_GROUPS = ["Levels", "Night actions", "Attributes", "Nights", "Days", "Role types"] as const;
export interface Term { id: string; title: string; text: string; hint?: string; match: string[]; group: (typeof TERM_GROUPS)[number]; action?: boolean; type?: string }
const T = (group: Term["group"], id: string, title: string, match: string[], text: string, extra: Partial<Term> = {}): Term => ({ group, id, title, match, text, ...extra });
const A = (id: string, title: string, match: string[], text: string) => T("Night actions", id, title, match, text, { action: true });
export const GLOSSARY: Term[] = [
  T("Levels", "light-attack", "Light Attack (I)", ["Light Attack"], "The weakest attack. It kills only a player with no defence."),
  T("Levels", "light-defence", "Light Defence (I)", ["Light Defence"], "The lowest defence. It stops Light Attacks; Heavy and Absolute Attacks still kill."),
  T("Levels", "heavy-attack", "Heavy Attack (II)", ["Heavy Attack"], "Kills a player with no defence or Light Defence."),
  T("Levels", "heavy-defence", "Heavy Defence (II)", ["Heavy Defence"], "Stops Light and Heavy Attacks. Absolute Attacks still kill."),
  T("Levels", "absolute-attack", "Absolute Attack (III)", ["Absolute Attacks", "Absolute Attack"], "The strongest attack: it beats every defence except Absolute. The Assassin's hit, the Rogue's guilt, an unpaid Debt and the Tinkerer's Trigger are Absolute."),
  T("Levels", "absolute-defence", "Absolute Defence (III)", ["Absolute Defence"], "Stops every attack. Only the Hollowman has it, and only on Fog Nights."),

  A("attack", "Attack", ["attack"], "Choosing a player to kill at Night. It kills only if it is stronger than the target's defence. A player who is attacked hears about it at dawn, whether they survive or not; an attacker whose target survives is told it failed."),
  A("hold", "Hold", ["Hold-immune", "Holds", "Hold", "Held"], "A Held player's Night ability doesn't happen, and they are told. The Locksmith, Enforcer and Quartermaster Hold. Hold-immune roles can't be Held, and the player who tried is told it failed."),
  A("heal", "Heal / Protect", ["Healed", "Heal", "protect"], "Giving another player defence for one Night. The Doctor's Heal and the Quartermaster's Hold give Heavy Defence, the Hunter's trap gives its target Heavy Defence, and the Innkeeper gives Light Defence to everyone who visits him. A player keeps only their highest defence; defences don't add up."),
  A("guard", "Guard", ["guarding"], "The Guardsman steps in front of one attack on his target and strikes back: he and the attacker both take a Heavy Attack. He can't stop the Veteran, another Guardsman, an unpaid Debt, the Tinkerer's Trigger or the Assassin."),
  A("trap", "Trap", ["trapped", "traps", "trap"], "The Hunter builds a trap on odd Nights and sets it on a player on even Nights. When anyone visits that player it goes off: Lanternkeepers are Held, and one evil or Unbound Killing visitor takes a Heavy Attack."),
  A("patrol", "Patrol", ["Patrol"], "The Warden gets every Night result their target gets, and learns who killed them if they die. Never the same player more than two Nights in a row."),
  A("alert", "Alert", ["Alerts", "Alert"], "The Veteran's ability, twice a game. On Alert he deals a Heavy Attack to every visitor and has Light Defence."),
  A("astray", "Lead astray", ["led astray", "lead astray"], "The Fence sends a player to a neighbour instead of their chosen target. They aren't told. Some roles can't be led astray."),
  A("swap", "Swap", ["swapped", "swap"], "The Ferryman and the Smuggler swap two players: everyone who visits one of them visits the other instead. Swapped players are told; their visitors are not."),
  A("draw", "Invite / Draw", ["draw"], "The Innkeeper and the Pawnbroker pull one player's visit to themselves: that player's ability lands on them instead of the target, and the player isn't told. Neither can draw a player who visits two targets."),
  A("deal", "Deal Roles", ["Deal Roles", "Dealt"], "The Swindler, once per game: two players outside the Cartel trade roles. Each is told their new role, not who had it. Faction and ability go with the role; Debt, Planted, Framed and Held stay with the player."),
  A("plant", "Plant", ["Planting", "plant", "Plant"], "The Tinkerer hides an explosive in a player's house, and they aren't told. Everyone who visits the Tinkerer is Planted too."),
  A("trigger", "Trigger", ["Trigger"], "The Tinkerer visits himself to set off every explosive: every Planted player takes an Absolute Attack. Swaps don't save them."),
  A("frame", "Frame", ["Frame"], "The Framer chooses a player to look evil to investigators."),
  A("forge", "Forge", ["Forge"], "The Forger visits a player. If they are an investigator, whatever they learn that Night is false."),
  A("investigate", "Investigate", ["Investigate"], "The Detective learns a player's role type."),
  A("watch", "Watch", ["watch"], "The Watchman watches a house and learns everyone who visited it."),
  A("vision", "Vision", ["Vision"], "The Oracle names a player and gets three names, including that player. At least one of the three is on an opposing side."),
  A("search", "Search", ["Search"], "The Constable searches a house and learns whether the player is Evil or Innocent."),
  A("learn", "Learn", ["exact role"], "Some roles learn a player's exact role: the Informant and the Notary from the player they check, the Loan Shark from everyone he visits and everyone who visits him."),
  A("guess", "Guess", ["guess"], "The Assassin is given two roles and guesses each Night which players have them. Naming both on the same Night gives each an Absolute Attack and wins."),
  A("put-debt", "Put in Debt", ["put them in Debt", "put in Debt"], "The Loan Shark visits a player and puts them in Debt. Anyone who visits him while not in Debt is put in Debt too."),
  A("raise", "Raise", ["raises", "raise", "raising"], "The Priest brings one dead Lanternkeeper back, once per game, with their abilities and nothing else from before."),
  A("command", "Command", ["Commanded", "Command"], "The Kingpin chooses a Cartel member, who uses their ability twice that Night on different targets. Not the Foreman or the Swindler."),
  A("recruit", "Recruit", ["Recruiting", "recruited", "recruit"], "Once the Kingpin is the last Cartel member alive, he can turn one player into the Foreman, once per game. It fails on Power roles and Unbound Killing roles."),
  A("passage", "Passage", ["Passage"], "The Harbour Master ships a player out for the Day: they can't vote or be voted for. Only a Judge's Condemn can still reach them."),
  A("guns", "Guns", ["Guns"], "The Harbour Master's even-Night shipment: a Cartel member also deals a Light Attack to the player they visit. If he is the last of the Cartel, he takes the Guns himself."),

  T("Attributes", "evil", "Evil / Innocent", ["look evil", "Evil", "Innocent"], "The Constable's result. Syndicate, Cartel, Unbound killers, the Town Crier and the Assassin read Evil. Framed and Planted players look evil too."),
  T("Attributes", "framed", "Framed", ["Framed"], "Chosen by the Framer. They look evil to the Seer, Detective, Oracle and Constable; the Informant still sees their true role."),
  T("Attributes", "disguised", "Disguised", ["Disguised", "disguise"], "The Tailor dresses a Syndicate member up as another player, so investigators get misleading results until the next Night."),
  T("Attributes", "immune", "Detection Immune", ["Detection Immunity", "Detection Immune"], "Some evil leaders read as Lanternkeepers to the Constable, the Oracle and the Seer. The Detective and the Spy still see through it."),
  T("Attributes", "planted", "Planted", ["Planted"], "Has the Tinkerer's explosive in their house, and isn't told. They look evil to investigators, show as the Tinkerer to the Informant and Notary, and take an Absolute Attack when he Triggers."),
  T("Attributes", "in-debt", "In Debt", ["Collection Night", "in Debt", "Debt"], "Owes the Loan Shark. At the start of the next Night, their Collection Night, they are told, and must visit the Loan Shark to pay; that is their whole action. If they don't, they die at the end of that Night by an Absolute Attack. Every Debt clears if the Loan Shark dies."),
  T("Attributes", "forged", "Forged", ["forged"], "An investigator the Forger visited. Whatever they learn that Night is false, even on a Fog Night."),

  T("Nights", "visit", "Visit", ["visits", "visit"], "Using an ability on another player at Night means visiting them. Some roles see, trap, Plant or attack visitors. A few abilities don't visit, and those cards say so."),
  T("Nights", "clear", "Clear Night", ["Clear Nights", "clear Nights", "Clear Night", "clear Night"], "Every odd Night. While the Hollowman lives, he can attack and has Light Defence."),
  T("Nights", "fog", "Fog Night", ["Fog Nights", "Fog Night", "Fog"], "Every even Night. While the Hollowman lives, every information result is random; he can't attack, but has Absolute Defence."),

  T("Days", "dawn", "Dawn", ["dawn"], "The start of each Day. The narrator says whose lantern went out, and private results arrive."),
  T("Days", "discussion", "Discussion", ["Discussion"], "The first part of the Day: talk it through, out loud in person or in the town chat online."),
  T("Days", "voting", "Voting", ["Voting Phase", "votes", "vote"], "Votes are public. A majority of living players puts someone on Trial, up to three Trials a Day. A Revealed Mayor's vote counts as three; a Paymaster's bribe makes his count two and his target's zero."),
  T("Days", "trial", "Trial", ["voted out", "Trial", "Guilty"], "A majority vote puts a player on Trial. After their defence, the town votes Guilty or Innocent; Guilty means execution. A tie is Innocent."),
  T("Days", "trial-defence", "Trial defence", [], "Only the accused may speak, to argue for their life before the town gives its verdict."),
  T("Days", "condemn", "Condemn", ["Condemn"], "A Revealed Judge can Condemn a player during the vote when nobody is on Trial: they are found Guilty and executed. Condemning a Lanternkeeper costs the Judge their life."),
  T("Days", "reveal", "Reveal", ["Revealed", "Reveal"], "The Mayor and the Judge can Reveal themselves at Night from Night 2. The narrator confirms it at dawn. Revealed players gain power but become easy targets."),
  T("Days", "dusk", "Dusk", ["Dusk"], "A 15-second close to every Day before Night falls."),

  T("Role types", "investigative", "Investigative", ["Investigative role", "investigators", "investigator"], "Lanternkeepers who learn something at Night. Deceptive roles and the Fog can change what they learn.", { type: "Investigative" }),
  T("Role types", "protective", "Protective", ["Protective roles", "Protective role"], "Lanternkeepers who keep other players alive.", { type: "Protective" }),
  T("Role types", "killing", "Killing", ["Killing roles", "Killing role"], "Roles whose ability kills. Unbound Killing roles fight for themselves alone.", { type: "Killing" }),
  T("Role types", "power", "Power", ["Power roles", "Power role"], "Each side's leaders and strongest roles. They are always Unique, and several abilities fail on them.", { type: "Power" }),
  T("Role types", "support", "Support", [], "Roles that help their side without killing or investigating: Holds, swaps, bribes, raising the dead and more.", { type: "Support" }),
  T("Role types", "deceptive", "Deceptive", ["Deceptive roles", "Deceptive"], "Roles that twist information or movement: they change what investigators learn or where people go.", { type: "Deceptive" }),
  T("Role types", "chaos", "Chaos", ["Chaos"], "Unbound roles with their own goals. They can win alongside anyone.", { type: "Chaos" }),
  T("Role types", "unique", "Unique", ["Unique"], "A role that is never dealt twice in one game."),
];

// One-line hint under each word in the Glossary list, short enough for one row on a phone (Nik, 13 Nov).
const HINTS: Record<string, string> = {
  "light-attack": "The weakest attack",
  "light-defence": "Stops Light Attacks",
  "heavy-attack": "Beats no defence and Light Defence",
  "heavy-defence": "Stops Light and Heavy Attacks",
  "absolute-attack": "Beats every defence but Absolute",
  "absolute-defence": "Stops every attack",
  "attack": "Choose a player to kill at Night",
  "hold": "Stops a player's Night ability",
  "heal": "Give a player defence for one Night",
  "guard": "Take an attack and strike back",
  "trap": "Goes off on anyone who visits",
  "patrol": "Get every result your target gets",
  "alert": "Attack everyone who visits the Veteran",
  "astray": "Send a player to a neighbour instead",
  "swap": "Visits to one player go to the other",
  "draw": "Pull a player's visit to yourself",
  "deal": "Two players trade roles",
  "plant": "Hide an explosive in a house",
  "trigger": "Set off every explosive",
  "frame": "Make a player look evil",
  "forge": "Make an investigator's result false",
  "investigate": "Learn a player's role type",
  "watch": "See who visits a house",
  "vision": "Three names, at least one opposed",
  "search": "Learn if a player is Evil or Innocent",
  "learn": "Find out a player's exact role",
  "guess": "Name the Assassin's two targets",
  "put-debt": "Make a player owe the Loan Shark",
  "raise": "Bring a dead Lanternkeeper back",
  "command": "A Cartel member acts twice",
  "recruit": "Turn a player into the Foreman",
  "passage": "Ship a player out for the Day",
  "guns": "A Cartel member also attacks",
  "evil": "The Constable's two results",
  "framed": "Looks evil to investigators",
  "disguised": "Looks like another player",
  "immune": "Reads as a Lanternkeeper",
  "planted": "Has an explosive in their house",
  "in-debt": "Must pay the Loan Shark or die",
  "forged": "Learns something false that Night",
  "visit": "Using an ability on another player",
  "clear": "Odd Nights: the Hollowman attacks",
  "fog": "Even Nights: results are random",
  "dawn": "Deaths announced, results arrive",
  "discussion": "Talk it through",
  "voting": "A majority puts someone on Trial",
  "trial": "The town votes Guilty or Innocent",
  "trial-defence": "Only the accused may speak",
  "condemn": "The Judge executes without a Trial",
  "reveal": "Show your role to gain power",
  "dusk": "15 seconds before Night",
  "investigative": "Learn something at Night",
  "protective": "Keep other players alive",
  "killing": "Their ability kills",
  "power": "Each side's leaders",
  "support": "Help their side in other ways",
  "deceptive": "Twist information or movement",
  "chaos": "Unbound, with their own goals",
  "unique": "Never dealt twice in one game",
};
for (const t of GLOSSARY) t.hint = HINTS[t.id];

/** Every word that should become tappable in role text, longest first so "Heavy Defence" wins over "Defence". */
export const TERM_WORDS: [string, string][] = GLOSSARY.flatMap((t) => t.match.map((m) => [m, t.id] as [string, string])).sort((a, b) => b[0].length - a[0].length);
export const termById = (id: string) => GLOSSARY.find((t) => t.id === id);
/** Matches any of the given words as whole words (case-sensitive, like the card links). */
export const wordRx = (ws: string[]) => new RegExp(`\\b(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`);
/** Other glossary words a term's own text mentions, longest first so "Heavy Attack" wins over "attack". */
export const relatedTerms = (t: Term): Term[] => {
  const ids = new Set<string>(); let rest = t.text;
  for (const [w, id] of TERM_WORDS) { const rx = wordRx([w]); if (rx.test(rest)) { if (id !== t.id) ids.add(id); rest = rest.replace(new RegExp(rx.source, "g"), " "); } }
  return [...ids].map((id) => termById(id)!);
};
/** Terms that link only inside ability bullets (Nik, 13 Nov). */
export const ACTION_TERMS = new Set(GLOSSARY.filter((t) => t.action).map((t) => t.id));
