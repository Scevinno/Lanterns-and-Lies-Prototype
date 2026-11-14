import { FACTION_CLASS } from "./api";
import { TERM_WORDS, ACTION_TERMS } from "./guide";

export interface Role { id: number; name: string; faction: string; type: string; summary: string; ability: string; image: string; placeholder: boolean; attack?: string; defence?: string }
let roles: Role[] = [];
let pattern: RegExp | null = null;
const words = new Map<string, string>();
// Game words from the Glossary (Nik, 12 Nov): tapping one on a card opens a half-screen explanation.
const terms = new Map<string, string>(TERM_WORDS);
const LEVEL_NUM: Record<string, string> = { light: "I", heavy: "II", absolute: "III" };
const rx = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function setRoles(r: Role[]) {
  roles = r; words.clear();
  for (const x of r) words.set(x.name, FACTION_CLASS[x.faction]);
  for (const [w, c] of [["Lanternkeepers", "f-lk"], ["Lanternkeeper", "f-lk"], ["Mafia", "f-syn"], ["Syndicate", "f-car"], ["Unbound", "f-ub"]]) words.set(w, c);
  const all = [...new Set([...words.keys(), ...terms.keys()])].sort((a, b) => b.length - a.length).map(rx).join("|");
  pattern = new RegExp(`\\b(${all})\\b`, "g");
}
export const roleByName = (n: string) => roles.find((r) => r.name === n);
export const allRoles = () => roles;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Role and faction names in their colour. Each glossary word becomes a button the first time it appears on a card;
// without a `seen` set (chat, results) words stay plain text.
// Game words link only inside ability bullets; the lore line has none (Nik, 13 Nov).
const paint = (s: string, seen?: Set<string>, bullet = false) => (pattern ? esc(s).replace(pattern, (m) => {
  if (words.has(m)) return `<span class="${words.get(m)}">${m}</span>`;
  const id = terms.get(m);
  // Levels carry their numeral wherever they appear: "Light Attack (I)" (Nik, 13 Nov).
  const n = id ? LEVEL_NUM[id.split("-")[0]] : undefined; const w = n && /(Attack|Defence)s?$/.test(m) ? `${m} <span class="lvn">(${n})</span>` : m;
  if (!id || !seen || seen.has(id) || (!bullet && ACTION_TERMS.has(id))) return w;
  seen.add(id); return `<button type="button" class="term" data-term="${id}">${w}</button>`;
}) : esc(s));

/** Same treatment as the old library: role and faction names in their colour, power names in the role's colour, rules as a list. */
export function abilityHtml(text: string, faction: string, seen: Set<string> = new Set()): string {
  let out = "", open = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith("•")) { if (!open) { out += "<ul>"; open = true; } out += `<li>${paint(line.slice(1).trim(), seen, true)}</li>`; }
    else { if (open) { out += "</ul>"; open = false; } out += `<p class="power ${FACTION_CLASS[faction]}">${esc(line)}</p>`; }
  }
  return out + (open ? "</ul>" : "");
}
/** Role and faction names in their colour, game words left plain (Guide text). */
export const paintHtml = (s: string) => paint(s);
export const summaryHtml = (s: string, seen?: Set<string>) => paint(s, seen);
