/**
 * COGITA — EINE SEITE MIT EINEM BAUSTEIN (COGITA.md §14, [F20, P10]).
 *
 * <b>Ein gemeinsamer Weg, einen Baustein auf eine eigene Seite zu stellen</b>
 * — ein Formular, eine Powtórka, einen Przebieg: der Dienst gibt eine Adresse
 * `c/<kennung>` auf die Rolle dessen, der sie anlegt; der Browser legt den
 * Baustein darauf. Danach ist es eine Seite wie jede andere — er führt sie,
 * kann sie bearbeiten und an eine eigene Adresse hängen.
 *
 * <b>Wer sie liest</b> (2026-10-22, Schritt 8): keine Abschriften mehr. Der
 * Baustein liest die Baza wiedzy selbst (`pageBase.ts`) — ist ihr Bereich
 * öffentlich (und die Baza geöffnet), jeder, sonst ihre Mitglieder, ein
 * Link oder ein Platz. Eine öffentliche Baza ist als GANZE öffentlich.
 */

import { newId } from '../core/ids';
import { COLUMNS, type Breakpoint, type Frame, type Layout } from '../pages/layout';
import { savePage, saveParts, type DraftPart } from '../pages/page';
import { call } from '../core/session';
import { fieldsOf, fieldText, labelOf, valuesOf, type Entity, type MediaRef } from './schema';
import { blocksMarkup, blocksOf } from '../library/comment';
import type { CogitaLibrary } from './store';

/* -- Die Adresse ------------------------------------------------------------------------------ */

export const newAddress = (roleId: string): Promise<{ path: string; roleId: string; claimedAt: string }> =>
  call('/workspace/publish/address', { method: 'POST', body: JSON.stringify({ roleId }) });

export const myAddresses = (): Promise<{ addresses: readonly { path: string; roleId: string; claimedAt: string | null; parts: number }[] }> =>
  call('/workspace/publish/addresses');

/** Dieselbe Anordnung in jeder Grösse — volle Breite, der Reihe nach. */
export function fullWidth(row: number, rowSpan: number): Layout {
  const out: Partial<Record<Breakpoint, Frame>> = {};
  for (const [breakpoint, columns] of Object.entries(COLUMNS)) {
    out[breakpoint as Breakpoint] = { position: { row, col: 1 }, size: { colSpan: columns, rowSpan } };
  }
  return out;
}

export interface PublishedPart {
  readonly kind: string;
  readonly config: Readonly<Record<string, string>>;
  /** Ein vorhandener Baustein (ein Formular) — sonst entsteht einer mit der Stelle. */
  readonly moduleId?: string | null;
  readonly rowSpan?: number;
}

/**
 * EINEN BAUSTEIN DIREKT VERÖFFENTLICHEN — eine neue Adresse, eine Seite mit
 * Titel, der Baustein darauf. Gibt den Pfad zurück (`c/ab3k9x2m`).
 */
export async function publishModule(input: { readonly roleId: string; readonly title: string; readonly lead?: string | null; readonly parts: readonly PublishedPart[] }): Promise<string> {
  const { path } = await newAddress(input.roleId);
  await savePage(path, { title: input.title.trim() || 'Bez tytułu', lead: input.lead?.trim() || null });
  let row = 1;
  const drafts: DraftPart[] = input.parts.map((part) => {
    const span = Math.max(1, Math.min(5, part.rowSpan ?? 5));
    const draft: DraftPart = { id: newId(), moduleId: part.moduleId ?? null, kind: part.kind, layout: fullWidth(row, span), config: { ...part.config } };
    row += span;
    return draft;
  });
  if (drafts.length > 0) await saveParts(path, drafts);
  return path;
}

export const pageUrl = (path: string): string =>
  `${typeof window === 'undefined' ? 'https://recreatio.pl/' : `${window.location.origin}${window.location.pathname}`}#/${path}`;

/** Ein Eintrag, wie ihn ein Przebieg zeigt — sein Etikett und seine Felder in Worten. */
export interface PublicEntity {
  readonly id: string;
  readonly label: string;
  readonly kinds: readonly string[];
  /** Die Kennungen der Arten ('knowledge', 'person', eigene). */
  readonly kindIds: readonly string[];
  readonly fields: readonly { readonly key: string; readonly label: string; readonly text: string; readonly type: string }[];
  readonly media: readonly MediaRef[];
}

export function publicEntity(lib: CogitaLibrary, entity: Entity): PublicEntity {
  const look = lib.look;
  const fields: { key: string; label: string; text: string; type: string }[] = [];
  const media: MediaRef[] = [];
  for (const field of fieldsOf(entity, look)) {
    if (field.type === 'media') {
      for (const v of valuesOf(entity, field)) if (v.value !== null && typeof v.value === 'object' && 'file' in v.value) media.push(v.value as MediaRef);
      continue;
    }
    const text = fieldText(entity, field, look);
    /* 2026-10-22 — die Bausteine eines Komentarza ganz, als Zapis (`blocksMarkup`): ein Ablauf zeigt sie wie einen Text. */
    const shown = field.type === 'markup' ? String((entity.data[field.key] as string | undefined) ?? text)
      : field.type === 'blocks' ? blocksMarkup(blocksOf(entity.data, field.key)) : text;
    if (text !== '') fields.push({ key: field.key, label: field.label, text: shown, type: field.type });
  }
  return { id: entity.id, label: labelOf(entity, look), kinds: entity.kinds.map((k) => lib.kind(k)?.name ?? k), kindIds: [...entity.kinds], fields, media };
}
