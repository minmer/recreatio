/**
 * 0133 — DIE BESCHREIBUNG DES DOKUMENTS EINES BEREICHS („recreatio/area"), als
 * Baum (`core/jsonTree.ts`): der Bereich trägt seine Seiten, jede Seite ist das
 * Dokument einer Seite — derselbe Knoten wie im Editor der Seite (`PAGE_JSON`),
 * nur ohne dessen Beispiele zum Einsetzen (die sind Seiten, keine Bereiche).
 *
 * Dazu die Beispiele eines Wydarzenie und einer Grupa — sie lassen sich ohne
 * ein Wort importieren (`scripts/app-duty-check.mjs`) — und der Auftrag für ein
 * Sprachmodell, das aus dem Export des letzten Wydarzenie das nächste schreibt.
 */

import { describe, keyLines, pretty, sectionsOf, sectionText, textNode, type JsonNode } from '../core/jsonTree';
import { DEFAULT_ENTRY } from '../calendar/appointmentsJson';
import { PAGE_JSON } from '../pages/pageJsonText';
import { NEED_PREFIX } from '../pages/pageImageNeeds';
import { AREA_FORMAT, LEVEL_WORD, MAX_LISTINGS, MAX_PAGES, MAX_ROLES, MAX_SUBFORMS } from './areaJson';
import { kindLabel, PROFILE_KINDS, type ProfileKind } from './profile';
import { areaExample, groupExample } from './areaJsonSamples';
import { t } from '../core/i18n';

/* -- Der Baum ohne fremde Beispiele -------------------------------------------------- */

const bare = new Map<string, JsonNode>();

/** Derselbe Knoten (dieselben Sätze, derselbe Schlüssel), nur ohne Beispiele zum Einsetzen — auch darunter. */
function withoutSamples(node: JsonNode): JsonNode {
  const known = bare.get(node.key);
  if (known !== undefined) return known;
  const { samples: _samples, inside, ...rest } = node;
  const copy: JsonNode = { ...rest, ...(inside === undefined ? {} : { inside: () => inside().map(withoutSamples) }) };
  bare.set(node.key, copy);
  return copy;
}

/* -- Die Sätze (Wörter: `areasJsonFormat.*`) ------------------------------------------ */

const INTRO = (): string => t('areasJsonFormat.intro');

const AREA_KEYS = (): string => `${keyLines({
  format: `"${AREA_FORMAT}"`,
  version: '1',
  kind: t('areasJsonFormat.keys.kind', { kinds: PROFILE_KINDS.map((k) => `"${k.kind}" (${k.label})`).join(', ') }),
  name: t('areasJsonFormat.keys.name'),
  category: t('areasJsonFormat.keys.category'),
  address: t('areasJsonFormat.keys.address'),
  publish: t('areasJsonFormat.keys.publish'),
  archive: t('areasJsonFormat.keys.archive'),
  card: t('areasJsonFormat.keys.card'),
  roles: t('areasJsonFormat.keys.roles', { max: MAX_ROLES }),
  appointments: t('areasJsonFormat.keys.appointments'),
  pages: t('areasJsonFormat.keys.pages', { max: MAX_PAGES }),
  subforms: t('areasJsonFormat.keys.subforms', { max: MAX_SUBFORMS }),
  chats: t('areasJsonFormat.keys.chats'),
  listings: t('areasJsonFormat.keys.listings', { max: MAX_LISTINGS })
})}`;

const REFS = (): string => `${t('areasJsonFormat.refs.lead')}
${keyLines({
  '@area': t('areasJsonFormat.refs.area'),
  '@form:strona/moduł': t('areasJsonFormat.refs.form'), // i18n-ignore — die Schreibweise des Verweises
  '@page:klucz': t('areasJsonFormat.refs.page'),
  '@role:klucz': t('areasJsonFormat.refs.role'),
  '@termin': t('areasJsonFormat.refs.item', { entry: `@${DEFAULT_ENTRY}` })
})}
${t('areasJsonFormat.refs.tail')}`;

const ROLES = (): string => `${t('areasJsonFormat.roles.lead')}
${keyLines({
  key: t('areasJsonFormat.roles.key'),
  name: t('areasJsonFormat.roles.name'),
  level: t('areasJsonFormat.roles.level', { levels: Object.entries(LEVEL_WORD).map(([k, v]) => `"${k}" (${v})`).join(', ') }),
  link: t('areasJsonFormat.roles.link')
})}
${t('areasJsonFormat.roles.tail')}`;

const APPOINTMENTS = (): string => `${t('areasJsonFormat.appointments.lead')}
${keyLines({
  key: t('areasJsonFormat.appointments.key'),
  main: t('areasJsonFormat.appointments.main'),
  publish: t('areasJsonFormat.appointments.publish')
})}
${t('areasJsonFormat.appointments.tail')}`;

const PAGES = (): string => `${t('areasJsonFormat.pages.lead')}
${keyLines({
  key: t('areasJsonFormat.pages.key'),
  path: t('areasJsonFormat.pages.path'),
  main: t('areasJsonFormat.pages.main'),
  after: t('areasJsonFormat.pages.after'),
  access: t('areasJsonFormat.pages.access'),
  owner: t('areasJsonFormat.pages.owner'),
  page: t('areasJsonFormat.pages.page')
})}
${t('areasJsonFormat.pages.modulesLead')}
${keyLines({
  id: t('areasJsonFormat.pages.id'),
  members: t('areasJsonFormat.pages.members'),
  publish: t('areasJsonFormat.pages.publish'),
  answer: t('areasJsonFormat.pages.answer'),
  forms: t('areasJsonFormat.pages.forms')
})}
${t('areasJsonFormat.pages.tail')}`;

const SUBFORMS = (): string => `${t('areasJsonFormat.subforms.lead')}
${keyLines({
  key: t('areasJsonFormat.subforms.key'),
  of: t('areasJsonFormat.subforms.of'),
  name: t('areasJsonFormat.subforms.name'),
  audience: t('areasJsonFormat.subforms.audience'),
  repeat: t('areasJsonFormat.subforms.repeat'),
  publish: t('areasJsonFormat.subforms.publish'),
  questions: t('areasJsonFormat.subforms.questions')
})}`;

/*
   2026-10-30 — WAS DIE APP MIT DEM BEREICH TUT, den der Import anlegt: der Reiter der Art
   (`AreaKindPanel.tsx`: die Karte für jeden Leser, der Rest für den, der führt), die Wizytówka unter dem
   Schlüssel ihres Bereichs (`profile.ts`, `Profiles.cs`), die Karten und Listen (`AreaEvent.cs`,
   `parts/events.tsx`), die Termine (`Agenda.cs`), die Seite danach und das Archiv (`Page.Write.cs`,
   `Profiles.SweepAsync`), wer für die Daten geradesteht (`Form.Submit.cs`, `Chat.List.cs`,
   `Controllers.PageGateAsync`, `areaImport.ts`) und wohin veröffentlicht wird (`areaJson.ts`).
*/
const USAGE = (): string => t('areasJsonFormat.usage');

/* -- Beispiele: `areaJsonSamples.ts` (Daten, wie eine Besitzerin sie schreibt) --------------- */

export { areaExample, groupExample } from './areaJsonSamples';

/* -- Der Baum ---------------------------------------------------------------------------- */

/** 0133 — DER BEREICH ALS JSON: der Baum, aus dem seine Beschreibung entsteht (und die Beispiele zum Einsetzen). */
export const AREA_JSON: JsonNode = {
  key: 'area',
  title: t('areasJsonFormat.title', { format: AREA_FORMAT }),
  text: INTRO,
  inside: () => [
    textNode('area.keys', t('areasJsonFormat.section.keys'), AREA_KEYS),
    textNode('area.usage', t('areasJsonFormat.section.usage'), USAGE),
    textNode('area.refs', t('areasJsonFormat.section.refs'), REFS),
    textNode('area.roles', t('areasJsonFormat.section.roles'), ROLES),
    textNode('area.appointments', t('areasJsonFormat.section.appointments'), APPOINTMENTS),
    textNode('area.pages', t('areasJsonFormat.section.pages'), PAGES, () => [withoutSamples(PAGE_JSON)]),
    textNode('area.subforms', t('areasJsonFormat.section.subforms'), SUBFORMS),
    textNode('area.example', t('areasJsonFormat.section.example'), () => pretty(areaExample())),
    textNode('area.group', t('areasJsonFormat.section.group'), () => pretty(groupExample()))
  ],
  samples: () => [
    { get label() { return t('areasJsonFormat.sample.event'); }, doc: areaExample },
    { get label() { return t('areasJsonFormat.sample.group'); }, doc: groupExample }
  ]
};

export const areaDescription = (): string => describe(AREA_JSON);

/* -- Kürzer für eine KI ------------------------------------------------------------------------ */

/**
 * Lange Abschnitte, die ein Wydarzenie, eine Grupa, eine Parafia selten braucht (die Animation
 * allein ist ein Drittel des Ganzen) — im Auftrag nur, wenn ein Vorbild sie benutzt.
 */
const RARE_KINDS = new Set(['animation', 'lab2d', 'physics', 'particles', 'layers', 'shape', 'question', 'cogita-revision', 'cogita-flow', 'cogita-live', 'knowledge-map', 'topic-explorer']);
const RARE_SECTIONS: Readonly<Record<string, RegExp>> = {
  live: /"live"\s*:/,
  motion: /"motion"\s*:/,
  layers: /"(?:layers|slide)"\s*:/,
  presentation: /"mode"\s*:\s*"presentation"/,
  'page.presentation': /"mode"\s*:\s*"presentation"/
};

/** Die Arten der Bausteine auf den Seiten eines Dokuments eines Bereichs. */
export function kindsUsed(doc: unknown): Set<string> {
  const out = new Set<string>();
  const pages = doc !== null && typeof doc === 'object' && Array.isArray((doc as { pages?: unknown }).pages) ? (doc as { pages: unknown[] }).pages : [];
  for (const entry of pages) {
    const page = entry !== null && typeof entry === 'object' ? (entry as { page?: unknown }).page : undefined;
    const modules = page !== null && typeof page === 'object' && Array.isArray((page as { modules?: unknown }).modules) ? (page as { modules: unknown[] }).modules : [];
    for (const m of modules) {
      const kind = m !== null && typeof m === 'object' ? (m as { kind?: unknown }).kind : undefined;
      if (typeof kind === 'string' && kind !== '') out.add(kind);
    }
  }
  return out;
}

/**
 * DIE BESCHREIBUNG FÜR DEN AUFTRAG — ohne die langen, seltenen Abschnitte, die kein Vorbild
 * braucht (`left`: was fehlt, in Worten). Die volle steht neben dem Import.
 */
export function areaDescriptionShort(docs: readonly unknown[]): { text: string; left: string[] } {
  const used = new Set(docs.flatMap((d) => [...kindsUsed(d)]));
  const raw = docs.map((d) => JSON.stringify(d) ?? '').join('\n');
  const left: string[] = [];
  const skipped = new Set<string>();
  const kept = sectionsOf(AREA_JSON).filter((s) => {
    if (s.parent !== null && skipped.has(s.parent)) { skipped.add(s.node.key); return false; }
    const kind = /^part(?:-doc)?:(.+)$/.exec(s.node.key)?.[1];
    const rare = kind !== undefined ? RARE_KINDS.has(kind) && !used.has(kind) : RARE_SECTIONS[s.node.key] !== undefined && !RARE_SECTIONS[s.node.key].test(raw);
    if (!rare) return true;
    skipped.add(s.node.key);
    left.push(kind !== undefined ? `"${kind}"` : s.node.title);
    return false;
  });
  return { text: `${kept.map(sectionText).join('\n\n')}\n`, left };
}

/* -- Der Auftrag für ein Sprachmodell ------------------------------------------------------ */

/**
 * WAS MAN IN DIE EIGENE KI KOPIERT (die App ruft keine KI auf): der Auftrag, die
 * Beschreibung des Formats und — als Vorlage — der Export eines anderen Bereichs
 * (des letzten Wydarzenie) oder der dieses Bereichs.
 */
export function areaPrompt(input: {
  readonly areaName: string;
  readonly kind: ProfileKind | null;
  /** Ein anderer Bereich als Vorlage (das letzte Wydarzenie). */
  readonly template: { readonly name: string; readonly doc: unknown } | null;
  /** Dieser Bereich, wie er gerade ist. */
  readonly current: unknown | null;
  /** Die ganze Beschreibung — sonst ohne die langen, seltenen Abschnitte, die kein Vorbild braucht. */
  readonly full?: boolean;
}): string {
  const short = input.full === true ? null : areaDescriptionShort([input.template?.doc ?? null, input.current].filter((d) => d !== null));
  const what = input.kind === null ? '' : t('areasJsonFormat.prompt.kind', { kind: kindLabel(input.kind).toLowerCase() });
  const task = input.template !== null
    ? t('areasJsonFormat.prompt.fromTemplate', { name: input.template.name })
    : input.current !== null
      ? t('areasJsonFormat.prompt.fromCurrent')
      : t('areasJsonFormat.prompt.fromScratch');
  return [
    t('areasJsonFormat.prompt.head', { format: AREA_FORMAT, name: input.areaName, kind: what }),
    '',
    task,
    '',
    t('areasJsonFormat.prompt.rules', { need: NEED_PREFIX }),
    '',
    t('areasJsonFormat.prompt.hints'),
    '',
    ...(short === null || short.left.length === 0 ? [] : [
      t('areasJsonFormat.prompt.short', { left: short.left.join(', ') }),
      ''
    ]),
    t('areasJsonFormat.prompt.formatHead'),
    short === null ? areaDescription() : short.text,
    ...(input.template !== null
      ? [t('areasJsonFormat.prompt.templateHead'), pretty(input.template.doc)]
      : input.current !== null ? [t('areasJsonFormat.prompt.currentHead'), pretty(input.current)] : [])
  ].join('\n');
}
