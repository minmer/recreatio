/**
 * 2026-10-22 — DER BAUSTEIN „TEKST" MIT VERWEISEN. Dieselben Zeilen wie ohne
 * (`ui/richText.tsx`: `## ` Zwischenüberschrift, `# ` grosse, `> ` leise
 * Zeile, eine Zeile nur aus Links als Reihe), dazu, was die Texte der
 * Bibliothek können: ein Werk, ein Zitat, eine Person (`[@klucz, s. 12]`)
 * werden eine Fussnote unter dem Baustein; ein eigener Eintrag (`[@klucz]` auf
 * einen Text, einen Komentarz, ein Thema) und `[[Wort|@klucz]]` ein Link, der
 * den Eintrag unter dem Text öffnet; `^[…]` eine Fussnote ohne Quelle.
 *
 * Nachgeschlagen wird in der Bibliothek des Bausteins, so wie DIESER Leser sie
 * lesen darf (`usePageLibrary`): was er nicht lesen darf, heisst
 * „[odwołanie niedostępne]" (eine Fussnote „[brak źródła]") — nie mehr.
 */

import { useMemo, useState } from 'react';

import type { LibEntry, Lookup } from './libraryKinds';
import { parseInline, type Block } from './libraryMarkup';
import { usePageLibrary } from './libraryOpen';
import { OpenedEntry } from './LibraryText';
import { countNotes, Inlines, MarkupLinks, NoteList, type MarkupLinkTo } from './markupView';
import { lineKind, linkRow } from '../ui/richText';

/** Ohne Bibliothek (oder bevor sie offen ist): nichts aufzuschlagen. */
const NOTHING: Lookup = { get: () => undefined, byKey: () => undefined };

export function LibraryLines({ library, lines, prefix }: { library: string; lines: readonly string[]; prefix: string }) {
  const { store, revision } = usePageLibrary(library === '' ? null : library);
  const look: Lookup = store ?? NOTHING;
  const [opened, setOpened] = useState<LibEntry | null>(null);

  /* Gelesen EINMAL: die Fussnoten hängen an genau diesen Bäumen (Zählen und Zeichnen sehen dieselben). */
  const parsed = useMemo(() => lines.map((line) => {
    const { kind, text } = lineKind(line);
    return { kind, text, block: { t: 'p', c: parseInline(text) } as const satisfies Block };
  }), [lines]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notes = useMemo(() => countNotes([parsed.filter((p) => p.kind !== 'links').map((p) => p.block)], look), [parsed, look, revision]);
  const links = useMemo<MarkupLinkTo>(() => ({ open: (e) => setOpened(e) }), []);

  return (
    <MarkupLinks.Provider value={links}>
      {parsed.map((p, i) => {
        const inner = <Inlines list={p.block.c} notes={notes} prefix={prefix} look={look} />;
        switch (p.kind) {
          case 'gap': return null;
          case 'sub': return <h3 key={i} className="wk-card-sub">{inner}</h3>;
          case 'lead': return <p key={i} className="wk-card-lead">{inner}</p>;
          case 'quiet': return <p key={i} className="wk-card-quiet">{inner}</p>;
          case 'links': return <p key={i} className="wk-card-links">{linkRow(p.text)}</p>;
          default: return <p key={i} className="wk-card-text">{inner}</p>;
        }
      })}
      <NoteList notes={notes} prefix={prefix} />
      {opened !== null && (
        <OpenedEntry entry={opened} look={look} prefix={`${prefix}o${opened.id.slice(0, 8)}-`} onClose={() => setOpened(null)} />
      )}
    </MarkupLinks.Provider>
  );
}
