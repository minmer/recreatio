/**
 * Z BAZY WIEDZY (2026-10-22, Schritt 11) — im Text oder im Plan eines Kazanie
 * auf einen Eintrag einer Baza wiedzy zeigen (ein Słowo eines Słownik:
 * `[[house|@id]]`, ein Link, nie eine Fussnote) oder einen Widok einbetten
 * (`![@widok]`: was er jetzt wählt, „wszystkie psalmy jutrzni niedzielnej").
 *
 * Gesucht wird in den Bazy wiedzy, die dieses Konto liest — ihre Einträge mit
 * ihrem Namen aus den Daten, ihre Widoki mit ihrem Namen. Wer den Text liest,
 * sieht den Eintrag nur, wenn er die Baza lesen darf (sonst
 * „[odwołanie niedostępne]").
 */

import { useEffect, useMemo, useState } from 'react';

import { useMe, useWho } from '../core/me';
import { libraryKindOf, loadLibraries, openLibraries } from './library';
import { entryTitle } from './libraryKinds';
import { storeOf, type LibraryStore } from './libraryStore';
import { Loading } from '../ui/Loading';
import { useT } from '../core/i18n';

interface Found {
  readonly id: string;
  readonly label: string;
  readonly base: string;
  readonly view: boolean;
}

const fold = (s: string): string => s.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[̀-ͯ]/g, '');

export function BasePicker({ onLink, onEmbed, onClose }: {
  onLink: (id: string, label: string) => void;
  onEmbed: (viewId: string) => void;
  onClose: () => void;
}) {
  const me = useMe(useWho());
  const [query, setQuery] = useState('');
  const t = useT();
  const [bases, setBases] = useState<readonly { name: string; store: LibraryStore }[] | null>(null);
  useEffect(() => {
    if (me == null) return undefined;
    let alive = true;
    void loadLibraries().then((r) => openLibraries(me.ring, r.libraries)).then(async (rows) => {
      const list = rows.filter((row) => libraryKindOf(row) === 'knowledge').map((row) => ({ name: row.name, store: storeOf(me.ring, row) }));
      await Promise.all(list.map((one) => one.store.sync().catch(() => undefined)));
      if (alive) setBases(list);
    }, () => { if (alive) setBases([]); });
    return () => { alive = false; };
  }, [me]);

  const found = useMemo((): Found[] => {
    if (bases === null) return [];
    const words = fold(query).split(/\s+/).filter(Boolean);
    const out: Found[] = [];
    for (const { name, store } of bases) {
      for (const e of store.all()) {
        if (e.kind !== 'entity' && e.kind !== 'view') continue;
        const label = entryTitle(e, store);
        if (words.length > 0 && !words.every((w) => fold(label).includes(w))) continue;
        out.push({ id: e.id, label, base: name, view: e.kind === 'view' });
        if (out.length >= 40) return out;
      }
    }
    return out;
  }, [bases, query]);

  return (
    <div className="lib-cite-picker" role="dialog" aria-label={t('library.basePick.label')}>
      <div className="lib-cite-head">
        <strong>{t('library.basePick.title')}</strong>
        <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.close')}</button>
      </div>
      <input type="search" value={query} autoFocus placeholder={t('library.basePick.searchPlaceholder')} aria-label={t('library.basePick.search')} onChange={(e) => setQuery(e.target.value)} />
      {bases === null ? <Loading lines={1} /> : found.length === 0 ? <p className="lib-meta">{bases.length === 0 ? t('library.basePick.none') : t('library.kindList.noMatch')}</p> : (
        <ul className="lib-cite-results">
          {found.slice(0, 12).map((f) => (
            <li key={f.id}>
              <button type="button" className="lib-row" onClick={() => (f.view ? onEmbed(f.id) : onLink(f.id, f.label))}>
                <span className="lib-row-title">{f.label}</span>
                <span className="lib-row-meta">{f.base}{f.view ? t('library.basePick.view') : t('library.basePick.link')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
