/**
 * 0121 — VERSIEGELTE SEITEN, die Browserseite.
 *
 * Eine Seite NUR MIT ZUGANG (0051) darf versiegelt werden. Dann liegen beim
 * Dienst Titel, Vorspann, Aussehen (mit den Szenen einer Präsentation), Karte,
 * Wybór, die Anordnung und der Inhalt jedes Bausteins und das Menü nur als
 * Hülle — eine Zeichenkette in den alten Spalten:
 *
 * <code>
 *   rcs1.<Fassung>.<base64url( Kopf · Nonce · AES-GCM( 1 Byte gepackt? · Text ) )>
 * </code>
 *
 * <b>Der Schlüssel der Seite</b> (32 Zufallsbytes, je Fassung einer) entsteht
 * hier und wird verpackt: unter dem jüngsten Epochenschlüssel jedes Bereichs der
 * Seite und unter dem Schlüssel der Rolle, die sie führt. Wer die Seite sehen
 * darf, öffnet ihn auf dem Weg, den er hat — Konto, Link, Platz (`nameKey`);
 * wer sie führt, auch ohne Bereich.
 *
 * <b>Jedes Stück hat sein eigenes Etikett</b> (Kennung der Seite, des
 * Bausteins oder seines Inhalts; die Fassung): der Titel lässt sich nicht an die
 * Stelle des Menüs schieben, die Anordnung eines Bausteins nicht an die eines
 * anderen, und eine alte Hülle geht unter einer neuen Fassung nicht auf.
 *
 * <b>Ein Formular bleibt, wie es ist</b>: seine Einstellungen liest der Dienst
 * (Portal, gesperrte Fragen), seine Fragen und Antworten liegen ohnehin unter
 * dem Schlüssel seines Bereichs. Seine Anordnung auf der Seite wird versiegelt.
 *
 * <b>Gepackt wird vor dem Versiegeln</b> (`deflate-raw`), wo es sich lohnt:
 * JSON wird damit meist kürzer, als es offen war.
 */

import { aad, Field, fromBase64Url, open, seal, toBase64Url, type Aad, type FieldName } from '../core/crypto';
import type { Ring } from '../core/keys';
import { loadPublicKey } from '../areas/area';
import { nameKey, ringOrNull, writeKey } from '../core/names';
import type { MenuItem, PageContent, PagePart } from './page';

/* -- Die Hülle ---------------------------------------------------------------------------------- */

export const SEAL_PREFIX = 'rcs1.';

/**
 * Ist das eine Hülle? Dieselbe Form, die der Dienst prüft (`Page.IsEnvelope`):
 * Kopf (20), Nonce (12), Etikett (16) und das Byte davor sind 49 Byte — in
 * base64url mindestens 66 Zeichen.
 */
export const isEnvelope = (value: unknown): value is string =>
  typeof value === 'string' && /^rcs1\.\d{1,6}\.[A-Za-z0-9_-]{66,}$/.test(value);

/** Eine Hülle des Seitenschlüssels: unter einem Bereich (`a`, Epoche `e`) oder einer Rolle (`r`). */
export interface SealWrap {
  readonly a?: string;
  readonly e?: number;
  readonly r?: string;
  readonly k: string;
}

/** Was der Dienst über eine versiegelte Seite sagt: ihre Kennung (sie steht in jedem Etikett), die Fassung, die Hüllen. */
export interface PageSealInfo {
  readonly id: string;
  readonly v: number;
  readonly w: readonly SealWrap[];
}

/** Ein geöffneter Seitenschlüssel. */
export interface PageKey {
  readonly id: string;
  readonly v: number;
  readonly key: Uint8Array;
}

/* -- Die Etiketten -------------------------------------------------------------------------------- */

const pageAad = (objectType: string, objectId: string, field: FieldName, v: number): Aad => aad('page', objectType, objectId, field, v);

export const sealAad = {
  key: (slugId: string, v: number) => pageAad('page_key', slugId, Field.PageKey, v),
  keyForRole: (slugId: string, v: number) => pageAad('page_key_role', slugId, Field.PageKey, v),
  title: (slugId: string, v: number) => pageAad('title', slugId, Field.PageTitle, v),
  lead: (slugId: string, v: number) => pageAad('lead', slugId, Field.PageLead, v),
  look: (slugId: string, v: number) => pageAad('look', slugId, Field.PageLook, v),
  logic: (slugId: string, v: number) => pageAad('logic', slugId, Field.PageLogic, v),
  subject: (slugId: string, v: number) => pageAad('subject', slugId, Field.PageSubject, v),
  menu: (slugId: string, v: number) => pageAad('menu', slugId, Field.PageMenu, v),
  layout: (partId: string, v: number) => pageAad('part_layout', partId, Field.PagePartLayout, v),
  /** Der Inhalt gehört dem BAUSTEIN (0036) — seine Kennung, sonst die der Stelle. */
  config: (part: Pick<PagePart, 'id' | 'moduleId'>, v: number) => pageAad('module_config', part.moduleId ?? part.id, Field.PageModuleConfig, v)
};

/* -- Packen ------------------------------------------------------------------------------------- */

const utf8 = new TextEncoder();

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const flowing = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(flowing).arrayBuffer());
}

/** Ein Byte davor: 0 — so, wie es ist; 1 — gepackt (`deflate-raw`). Kurzes lohnt das Packen nicht. */
async function pack(text: string): Promise<Uint8Array> {
  const raw = utf8.encode(text);
  if (raw.length >= 160 && typeof CompressionStream !== 'undefined') {
    try {
      const packed = await through(raw, new CompressionStream('deflate-raw'));
      if (packed.length + 16 < raw.length) {
        const out = new Uint8Array(packed.length + 1);
        out[0] = 1;
        out.set(packed, 1);
        return out;
      }
    } catch { /* dann eben ungepackt */ }
  }
  const out = new Uint8Array(raw.length + 1);
  out[0] = 0;
  out.set(raw, 1);
  return out;
}

async function unpack(bytes: Uint8Array): Promise<string> {
  if (bytes.length === 0) return '';
  const body = bytes.slice(1);
  if (bytes[0] === 1) return new TextDecoder().decode(await through(body, new DecompressionStream('deflate-raw')));
  return new TextDecoder().decode(body);
}

/* -- Versiegeln und Öffnen ---------------------------------------------------------------------- */

/** Einen Text unter dem Seitenschlüssel versiegeln — mit seinem Etikett. */
export async function sealPiece(key: PageKey, a: Aad, text: string): Promise<string> {
  return `${SEAL_PREFIX}${key.v}.${toBase64Url(await seal(key.key, a, await pack(text)))}`;
}

/** Eine Hülle öffnen — oder `null` (falscher Schlüssel, falsches Etikett, kaputt). */
export async function openPiece(key: PageKey, a: Aad, envelope: string): Promise<string | null> {
  if (!isEnvelope(envelope)) return null;
  const rest = envelope.slice(SEAL_PREFIX.length);
  const dot = rest.indexOf('.');
  if (Number(rest.slice(0, dot)) !== key.v) return null;
  try {
    return await unpack(await open(key.key, a, fromBase64Url(rest.slice(dot + 1))));
  } catch {
    return null;
  }
}

/** Offen bleibt offen, versiegelt wird geöffnet — was nicht aufgeht, ist `null`. */
const openMaybe = async (key: PageKey, a: Aad, value: string | null | undefined): Promise<string | null> =>
  value == null ? null : isEnvelope(value) ? openPiece(key, a, value) : value;

/* -- Der Schlüssel der Seite ---------------------------------------------------------------------- */

const opened = new Map<string, Promise<PageKey | null>>();

/** Bei der Abmeldung: die Schlüssel des einen gehören nicht in die Seiten des nächsten. */
export function forgetPageKeys(): void {
  opened.clear();
}

/**
 * Woher die Schlüssel kommen — gewöhnlich aus diesem Browser (`nameKey`: Platz,
 * Link, Konto, jawny Bereich; der Bund des Kontos). Ein Prüflauf ohne Dienst
 * reicht eigene herein.
 */
export interface KeySource {
  readonly areaKey?: (areaId: string, epoch: number) => Promise<Uint8Array | undefined>;
  readonly ring?: Pick<Ring, 'has' | 'keyOf'> | null;
}

/** Den Seitenschlüssel öffnen — auf jedem Weg, den dieser Browser hat. `null`: keiner passt. */
export function openPageKey(info: PageSealInfo, options: { readonly retry?: boolean; readonly keys?: KeySource } = {}): Promise<PageKey | null> {
  const id = `${info.id}:${info.v}:${info.w.map((one) => one.k.slice(0, 12)).join(',')}`;
  const known = options.keys === undefined ? opened.get(id) : undefined;
  if (known !== undefined && options.retry !== true) return known;

  const areaKeyOf = options.keys?.areaKey ?? nameKey;

  const found = (async (): Promise<PageKey | null> => {
    /* Erst die Bereiche (Konto, Link, Platz), dann die führende Rolle. */
    for (const wrap of info.w) {
      if (wrap.a === undefined || wrap.e === undefined) continue;
      try {
        const areaKey = await areaKeyOf(wrap.a, wrap.e);
        if (areaKey === undefined) continue;
        return { id: info.id, v: info.v, key: await open(areaKey, sealAad.key(info.id, info.v), fromBase64Url(wrap.k)) };
      } catch { /* der nächste */ }
    }

    const ring = options.keys !== undefined ? options.keys.ring ?? null : await ringOrNull().catch(() => null);
    for (const wrap of info.w) {
      if (wrap.r === undefined || ring === null || !ring.has(wrap.r)) continue;
      try {
        return { id: info.id, v: info.v, key: await open(ring.keyOf(wrap.r), sealAad.keyForRole(info.id, info.v), fromBase64Url(wrap.k)) };
      } catch { /* der nächste */ }
    }
    return null;
  })();

  if (options.keys !== undefined) return found;
  opened.set(id, found);
  /* Ein „keiner" wird nicht behalten: gleich kommt vielleicht ein Platz, ein Link oder eine Anmeldung. */
  void found.then((k) => { if (k === null && opened.get(id) === found) opened.delete(id); });
  return found;
}

/**
 * EIN NEUER SCHLÜSSEL für die Seite: verpackt für jeden ihrer Bereiche, dessen
 * jüngste Epoche dieser Bund hält, und für die Rolle, die sie führt.
 * `missing`: Bereiche, für die es nicht ging (ihre Leute öffnen die Seite erst,
 * wenn jemand mit ihrem Schlüssel neu versiegelt).
 */
export async function newPageKey(slugId: string, version: number, areas: readonly string[], ownerRoleId: string | null, ring: Pick<Ring, 'has' | 'keyOf'>,
  newest: (areaId: string) => Promise<{ epoch: number; key: Uint8Array }> = (areaId) => writeKey(areaId, { ring: ring as Ring })
): Promise<{
  readonly key: PageKey;
  readonly wraps: readonly SealWrap[];
  readonly missing: readonly string[];
}> {
  const key: PageKey = { id: slugId, v: version, key: crypto.getRandomValues(new Uint8Array(32)) };
  const wraps: SealWrap[] = [];
  const missing: string[] = [];

  for (const areaId of areas) {
    try {
      const area = await newest(areaId);
      wraps.push({ a: areaId, e: area.epoch, k: toBase64Url(await seal(area.key, sealAad.key(slugId, version), key.key)) });
    } catch {
      missing.push(areaId);
    }
  }

  if (ownerRoleId !== null && ring.has(ownerRoleId)) {
    wraps.push({ r: ownerRoleId, k: toBase64Url(await seal(ring.keyOf(ownerRoleId), sealAad.keyForRole(slugId, version), key.key)) });
  }

  return { key, wraps, missing };
}

/**
 * Bereiche, deren Schlüssel JEDER hat (ein jawny Bereich gibt seinen Schlüssel
 * heraus): wer die Seite an einen davon bindet, versiegelt sie vor niemandem.
 */
export async function openAreasAmong(areas: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  for (const areaId of areas) {
    const shown = await loadPublicKey(areaId).catch(() => null);
    if (shown !== null) out.push(areaId);
  }
  return out;
}

/* -- Eine ganze Seite ----------------------------------------------------------------------------- */

/** Wie die Seite beim Dienst liegt — dazu, ob sie versiegelt ist. */
export interface RawPage extends PageContent {
  readonly seal?: PageSealInfo | null;
}

/**
 * EINE GELADENE SEITE ÖFFNEN. Was aufgeht, steht danach offen da, als wäre die
 * Seite nie versiegelt gewesen; `key` ist ihr Schlüssel. Geht der Schlüssel
 * nicht auf, kommt die Seite LEER zurück und mit `locked` — die Oberfläche
 * sagt dann, dass sie versiegelt ist, statt Hüllen anzuzeigen.
 */
export async function openPageContent(raw: RawPage, options: { readonly retry?: boolean; readonly keys?: KeySource } = {}): Promise<{ readonly content: PageContent; readonly key: PageKey | null }> {
  const info = raw.seal;
  if (info == null) return { content: raw, key: null };

  const key = await openPageKey(info, options);
  if (key === null) {
    return {
      key: null,
      content: {
        ...raw,
        title: null, lead: null, logic: null, theme: null, subject: null, menu: null,
        parts: raw.parts.map((part) => ({ ...part, layout: '{}', config: part.kind === 'form' && !isEnvelope(part.config) ? part.config : null })),
        locked: true
      }
    };
  }

  const parts = await Promise.all(raw.parts.map(async (part): Promise<PagePart> => ({
    ...part,
    layout: (await openMaybe(key, sealAad.layout(part.id, key.v), part.layout)) ?? '{}',
    config: await openMaybe(key, sealAad.config(part, key.v), part.config)
  })));

  let menu = raw.menu ?? null;
  if (menu !== null && typeof (menu.items as unknown) === 'string') {
    const text = await openPiece(key, sealAad.menu(key.id, key.v), menu.items as unknown as string);
    menu = { ...menu, items: readMenuItems(text) };
  }

  return {
    key,
    content: {
      ...raw,
      title: await openMaybe(key, sealAad.title(key.id, key.v), raw.title),
      lead: await openMaybe(key, sealAad.lead(key.id, key.v), raw.lead),
      theme: await openMaybe(key, sealAad.look(key.id, key.v), raw.theme),
      logic: await openMaybe(key, sealAad.logic(key.id, key.v), raw.logic),
      subject: await openMaybe(key, sealAad.subject(key.id, key.v), raw.subject),
      parts,
      menu
    }
  };
}

/** Die Einträge eines geöffneten Menüs — duldsam: was kein Liste ist, ist kein Menü. */
export function readMenuItems(text: string | null): readonly MenuItem[] {
  if (text === null) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as MenuItem[]) : [];
  } catch {
    return [];
  }
}

/** Ein Titel aus einer Liste (Twoje strony) — offen, oder geöffnet, oder `null`. */
export async function openSealedTitle(title: string | null, info: PageSealInfo | null | undefined): Promise<string | null> {
  if (title === null || !isEnvelope(title) || info == null) return title !== null && isEnvelope(title) ? null : title;
  const key = await openPageKey(info);
  return key === null ? null : openPiece(key, sealAad.title(key.id, key.v), title);
}

/** Ein Wybór aus einer Liste — offen, oder geöffnet, oder `null`. */
export async function openSealedSubject(subject: string | null | undefined, info: PageSealInfo | null | undefined): Promise<string | null> {
  if (subject == null) return null;
  if (!isEnvelope(subject)) return subject;
  if (info == null) return null;
  const key = await openPageKey(info);
  return key === null ? null : openPiece(key, sealAad.subject(key.id, key.v), subject);
}
