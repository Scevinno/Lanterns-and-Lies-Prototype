import { FACTION_CLASS } from "./api";

export interface Role { id: number; name: string; faction: string; type: string; summary: string; ability: string; image: string; placeholder: boolean }
let roles: Role[] = [];
let pattern: RegExp | null = null;
const words = new Map<string, string>();
export function setRoles(r: Role[]) {
  roles = r; words.clear();
  for (const x of r) words.set(x.name, FACTION_CLASS[x.faction]);
  for (const [w, c] of [["Lanternkeepers", "f-lk"], ["Lanternkeeper", "f-lk"], ["Syndicate", "f-syn"], ["Cartel", "f-car"], ["Unbound", "f-ub"]]) words.set(w, c);
  const names = [...words.keys()].sort((a, b) => b.length - a.length).join("|");
  pattern = new RegExp(`\\b(${names})\\b`, "g");
}
export const roleByName = (n: string) => roles.find((r) => r.name === n);
export const allRoles = () => roles;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paint = (s: string) => (pattern ? esc(s).replace(pattern, (m) => `<span class="${words.get(m)}">${m}</span>`) : esc(s));

/** Same treatment as the old library: role and faction names in their colour, power names in the role's colour, rules as a list. */
export function abilityHtml(text: string, faction: string): string {
  let out = "", open = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith("•")) { if (!open) { out += "<ul>"; open = true; } out += `<li>${paint(line.slice(1).trim())}</li>`; }
    else { if (open) { out += "</ul>"; open = false; } out += `<p class="power ${FACTION_CLASS[faction]}">${esc(line)}</p>`; }
  }
  return out + (open ? "</ul>" : "");
}
export const summaryHtml = (s: string) => paint(s);
