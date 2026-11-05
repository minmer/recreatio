/**
 * EIN EREIGNIS AUS DEM ALTBESTAND HERÜBERHOLEN (0063).
 *
 * Die Ereignisseiten des Altbestands liessen sich als EIN JSON-Dokument
 * beschreiben (`legacy/pages/events/admin/jsonDictionary.ts`): das Ereignis,
 * seine Seiten, auf jeder Seite die Teile mit `config` und `layers`. Genau
 * dieses Dokument nimmt der Editor der Slajdy hier an — und weil die Bausteine
 * der Ereignisseiten ihre Gestalt wörtlich behalten haben (`event/kit.tsx`),
 * wird ein Teil zum Baustein, ohne dass etwas übersetzt werden muss:
 *
 * <code>
 *   title                    → Tytuł (hero)
 *   shortinfos, plan, map,
 *   costs, faq, people,
 *   files, gallery           → dieselbe Art
 *   text                     → Tekst (Absätze, Punkte, Notiz als Zeilen)
 *   contact                  → Kontakt (Telefon, E-Mail, Organisator)
 *   form, registration,
 *   card, roster, checklist,
 *   topics, meme             → ausgelassen, mit Hinweis, was es hier stattdessen gibt
 * </code>
 *
 * Die Hintergründe (`layers`) und das Menü (`menuLabel`) werden zum Slajd des
 * Bausteins, das Thema des Ereignisses (`theme`) auf Wunsch zum Thema der
 * Seite.
 *
 * 0064 — die Oberfläche dafür ist das JSON-Fach der Seite (`PageJsonPanel.tsx`,
 * `pageJson.ts`): es erkennt ein Dokument des Altbestands und reicht es hierher.
 * Für ein Sprachmodell gibt es dort die Beschreibung des NEUEN Formats — sie
 * kann mehr (Menü, Karte, Formulare mit Fragen) und läuft mit den Bausteinen mit.
 */

import { asArray, asOptionalText, asRecord, asStringList, asText } from '../event/kit';
import { newId } from '../../core/ids';
import { BREAKPOINTS, COLUMNS, firstFreeCell, snapColSpan, snapRowSpan, type Layout } from '../layout';
import type { DraftPart } from '../page';
import { partOf } from '../parts/registry';
import { DEFAULT_THEMES, readLayers, type Theme } from './slideLook';
import { t } from '../../core/i18n';

/** Arten, die ihr `config` unverändert als `json` tragen. */
const VERBATIM: Readonly<Record<string, string>> = {
  title: 'hero',
  hero: 'hero',
  shortinfos: 'shortinfos',
  plan: 'plan',
  map: 'map',
  costs: 'costs',
  faq: 'faq',
  people: 'people',
  files: 'files',
  gallery: 'gallery'
};

/** Was es für das, was nicht herüberkommt, im Neubau gibt. */
const INSTEAD: Readonly<Record<string, string>> = {
  form: 'pagesSlides.legacy.instead.form',
  registration: 'pagesSlides.legacy.instead.registration',
  card: 'pagesSlides.legacy.instead.card',
  roster: 'pagesSlides.legacy.instead.roster',
  checklist: 'pagesSlides.legacy.instead.checklist',
  topics: 'pagesSlides.legacy.instead.topics',
  meme: 'pagesSlides.legacy.instead.meme'
};

export interface LegacyPage {
  readonly index: number;
  readonly label: string;
  readonly parts: readonly unknown[];
}

export interface Imported {
  readonly parts: DraftPart[];
  readonly theme: Theme | null;
  readonly title: string | null;
  readonly lead: string | null;
  readonly warnings: string[];
}

/** Die Seiten des Dokuments — oder eine, wenn es nur Teile sind (`{ parts }` oder eine Liste). */
export function legacyPages(doc: unknown): LegacyPage[] {
  if (Array.isArray(doc)) return [{ index: 0, label: t('pagesSlides.legacy.parts'), parts: doc }];
  const root = asRecord(doc);
  if (Array.isArray(root.parts)) return [{ index: 0, label: asText(root.title, t('pagesSlides.legacy.parts')), parts: root.parts }];
  return asArray(root.pages).map((page, index) => {
    const one = asRecord(page);
    const name = asText(one.menuLabel) || asText(one.title) || t('pagesSlides.legacy.page', { n: index + 1 });
    return { index, label: asText(one.kind) === 'internal' ? t('pagesSlides.legacy.internal', { name }) : name, parts: asArray(one.parts) };
  });
}

/** Das Thema des Ereignisses — dieselben fünf Farben wie das Thema der Slajdy. */
function themeOf(doc: unknown): Theme | null {
  const theme = asRecord(asRecord(doc).theme);
  const mode = asText(theme.mode);
  if (mode !== 'dark' && mode !== 'light') return null;
  const color = (key: string) => (/^#[0-9a-f]{6}$/i.test(asText(theme[key])) ? asText(theme[key]) : DEFAULT_THEMES[mode][key as 'accent']);
  return { mode, accent: color('accent'), ink: color('ink'), ground: color('ground'), muted: color('muted') };
}

/** `config` darf als Objekt oder (Export des Altbestands) als `configJson`-Zeichenkette kommen. */
function configOf(part: Record<string, unknown>): unknown {
  if (typeof part.configJson === 'string') {
    try { return JSON.parse(part.configJson) as unknown; } catch { return null; }
  }
  return part.config ?? null;
}

function layersOf(part: Record<string, unknown>): unknown {
  if (typeof part.layersJson === 'string') {
    try { return JSON.parse(part.layersJson) as unknown; } catch { return []; }
  }
  return part.layers ?? [];
}

/** Ein Teil des Altbestands als Tafel eines Bausteins — oder `null`, mit dem Grund. */
function rawOf(kind: string, part: Record<string, unknown>): { kind: string; raw: Record<string, string> } | string {
  const title = asOptionalText(part.title) ?? '';
  const intro = asOptionalText(part.intro) ?? '';
  const config = configOf(part);

  const target = VERBATIM[kind];
  if (target !== undefined) {
    const raw: Record<string, string> = { json: JSON.stringify(config ?? {}) };
    if (title !== '') raw.title = title;
    if (intro !== '') raw.intro = intro;
    return { kind: target, raw };
  }

  if (kind === 'text') {
    const one = asRecord(config);
    const body = [
      ...(intro !== '' ? [intro] : []),
      ...asStringList(one.paragraphs),
      ...asStringList(one.bullets).map((line) => `• ${line}`),
      ...(asOptionalText(one.note) !== null ? [asOptionalText(one.note) as string] : [])
    ];
    return { kind: 'text', raw: { title, body: body.join('\n') } };
  }

  if (kind === 'contact') {
    const one = asRecord(config);
    const channels = asArray(one.channels).map(asRecord);
    const find = (test: (value: string, href: string) => boolean) =>
      channels.map((c) => ({ value: asText(c.value).trim(), href: asText(c.href).trim() })).find((c) => c.value !== '' && test(c.value, c.href))?.value ?? '';
    return {
      kind: 'contact',
      raw: {
        address: asOptionalText(one.organizer) ?? '',
        phone: find((value, href) => href.startsWith('tel:') || /^\+?[\d\s()-]{7,}$/.test(value)),
        email: find((value, href) => href.startsWith('mailto:') || /@/.test(value))
      }
    };
  }

  return INSTEAD[kind] !== undefined ? t(INSTEAD[kind]) : t('pagesSlides.legacy.unknownKind', { kind });
}

/**
 * DIE TEILE EINER SEITE ALS BAUSTEINE — hinter die schon vorhandenen gestellt,
 * jeder mit seinem Platz im Raster (für die Seite mit Modulen) und seinem
 * Slajd (Name, Hintergründe).
 */
export function importLegacy(doc: unknown, pageIndex: number, existing: readonly DraftPart[]): Imported {
  const page = legacyPages(doc)[pageIndex];
  const warnings: string[] = [];
  const made: DraftPart[] = [];
  const root = asRecord(doc);

  for (const [index, entry] of (page?.parts ?? []).entries()) {
    const part = asRecord(entry);
    const kind = asText(part.kind).trim();
    const label = asOptionalText(part.menuLabel) ?? asOptionalText(part.title) ?? kind;

    if (part.isVisible === false) { warnings.push(t('pagesSlides.legacy.hidden', { label })); }

    const mapped = rawOf(kind, part);
    if (typeof mapped === 'string') { warnings.push(t('pagesSlides.legacy.skipped', { n: index + 1, label, why: mapped })); continue; }

    const def = partOf(mapped.kind);
    const layout: Record<string, unknown> = {};
    for (const bp of BREAKPOINTS) {
      const cols = COLUMNS[bp];
      const size = { colSpan: snapColSpan(def?.box.colSpan ?? 6, cols), rowSpan: snapRowSpan(def?.box.rowSpan ?? 3) };
      layout[bp] = { position: firstFreeCell([...existing, ...made], size, cols, bp), size };
    }
    layout.slide = { label, layers: readLayers(layersOf(part)) };
    made.push({ id: newId(), moduleId: null, kind: mapped.kind, layout: layout as Layout, config: mapped.raw });
  }

  return {
    parts: made,
    theme: themeOf(doc),
    title: asOptionalText(root.title),
    lead: asOptionalText(root.subtitle) ?? asOptionalText(root.summary),
    warnings
  };
}
