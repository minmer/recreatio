/**
 * 2026-11-22 (Homer-Einheit) — DER ABSCHNITT EINER LEKTÜRE-FRAGE, aus der Bibliothek geholt: das Werk über die Quellen der
 * Baza (`lib.markupLook`), sonst über jede offene Bibliothek dieses Tabs (`workLook`); die Stelle wie „Czytaj tekst"
 * (`placeFor` → ein Teil → die Blöcke der Stelle). Dann Zeilen, lokal von 1 an gezählt (`passageLinesOf`). Der Słowniczek
 * der Baza (Rodzaje mit Feldern `glossary`) unterstreicht seine Wörter; ein Tippen zeigt die Bedeutung.
 */

import { useContext, useEffect, useMemo, useState } from 'react';

import type { Lookup } from '../../library/libraryKinds';
import { loadedStores } from '../../library/libraryStore';
import { parsePlace } from '../../library/locations';
import { openPart, placeFor } from '../../library/sourceFind';
import { findBlocks, labelBlocks, placeOptions, readPart } from '../../library/sourceText';
import { looksLikeLabel } from '../../library/textLabels';
import { CogitaContext } from '../ui';
import type { CogitaLibrary } from '../store';
import { glossaryEntry, glossaryPieces, passageLinesOf, type GlossaryEntry, type PassageRef } from './readingSpec';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const refMatches = (data: Record<string, unknown>, name: string): boolean => {
  const want = name.replace(/^@/, '').toLowerCase();
  const own = typeof data._ref === 'string' && data._ref.toLowerCase() === want;
  return own || (Array.isArray(data._refs) && data._refs.some((r) => typeof r === 'string' && r.toLowerCase() === want));
};

/** Das Werk einer Stelle: eine Kennung, ein Schlüssel, oder ein bleibender Name — gesucht in der Baza, ihren Quellen, den offenen Bibliotheken. */
export function resolveWork(look: Lookup | undefined, raw: string): string {
  if (look?.get(raw) !== undefined) return raw;
  const byKey = look?.byKey(raw) ?? look?.byKey(raw.replace(/^@/, ''));
  if (byKey !== undefined) return byKey.id;
  for (const store of loadedStores()) if (store.own(raw) !== undefined) return raw;
  if (raw.startsWith('@')) {
    const hit = look?.readable?.().find((e) => refMatches(e.data as Record<string, unknown>, raw))
      ?? loadedStores().flatMap((s) => s.all()).find((e) => refMatches(e.data as Record<string, unknown>, raw));
    if (hit !== undefined) return hit.id;
  }
  return raw;
}

export type PassageState =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly lines: readonly string[]; readonly workId: string };

/** Die Zeilen eines Abschnitts — geladen, wenn die Frage erscheint. */
export function usePassage(passage: PassageRef): PassageState {
  const ctx = useContext(CogitaContext);
  const look = ctx?.lib.markupLook;
  const [state, setState] = useState<PassageState>({ status: 'loading' });
  const revision = look?.revision ?? 0;
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    void (async () => {
      const workId = resolveWork(look, passage.work);
      const link = placeFor(look, workId, passage.locator);
      if (link === null || link.status !== 'found' || link.part === undefined || link.text === undefined) { if (alive) setState({ status: 'missing' }); return; }
      const entry = await openPart(look, link.part.id);
      if (entry === null) { if (alive) setState({ status: 'missing' }); return; }
      const blocks = readPart(entry.data).blocks;
      const manifest = link.text.manifest;
      const byLabel = link.locator !== '' && looksLikeLabel(link.locator) ? labelBlocks(blocks, link.locator) : [];
      const byPlace = link.locator === '' || byLabel.length > 0 ? [] : findBlocks(blocks, parsePlace(link.locator, manifest.scheme, placeOptions(manifest.edition)), manifest.scheme, manifest.edition);
      const hit = link.locator === '' ? blocks.map((_, i) => i) : byLabel.length > 0 ? byLabel : byPlace;
      const lines = passageLinesOf(blocks, hit);
      if (alive) setState(lines.length === 0 ? { status: 'missing' } : { status: 'ready', lines, workId: link.workId });
    })().catch(() => { if (alive) setState({ status: 'missing' }); });
    return () => { alive = false; };
  }, [passage.work, passage.locator, revision]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** Der Słowniczek der Baza: jeder Eintrag eines Rodzaj mit Feldern `glossary` (Wort, Formen, Bedeutung, Werk). */
export function glossaryOfLibrary(lib: CogitaLibrary): GlossaryEntry[] {
  const out: GlossaryEntry[] = [];
  const unwrap = (v: unknown): unknown => (Array.isArray(v) ? v.map(unwrap) : isObject(v) && 'value' in v ? v.value : v);
  for (const kind of lib.kinds) {
    const roles = kind.fields.filter((f) => f.glossary !== undefined);
    if (!roles.some((f) => f.glossary === 'word') || !roles.some((f) => f.glossary === 'meaning')) continue;
    for (const e of lib.material(kind.id)) {
      const values: Record<string, unknown> = {};
      for (const f of roles) values[f.glossary!] = unwrap(e.data[f.key]);
      const entry = glossaryEntry(e.id, values);
      if (entry !== null) out.push(entry);
    }
  }
  return out;
}

/** Der Słowniczek, einmal je Stand der Baza. */
export function useGlossary(): readonly GlossaryEntry[] {
  const ctx = useContext(CogitaContext);
  const lib = ctx?.lib;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (lib === undefined ? [] : glossaryOfLibrary(lib)), [lib, lib?.revision]);
}

/** Eine Zeile mit ihren unterstrichenen Wörtern; ein Tippen auf ein Wort sagt `onWord`. */
export function GlossLine({ text, glossary, workId, onWord }: { text: string; glossary: readonly GlossaryEntry[]; workId: string; onWord: (e: GlossaryEntry) => void }) {
  const pieces = useMemo(() => glossaryPieces(text, glossary, workId), [text, glossary, workId]);
  return (
    <>
      {pieces.map((p, i) => (p.entry === undefined ? <span key={i}>{p.text}</span> : (
        <button key={i} type="button" className="cg-gloss-word" data-gloss={p.entry.id}
          onClick={(ev) => { ev.stopPropagation(); onWord(p.entry!); }}>{p.text}</button>
      )))}
    </>
  );
}
