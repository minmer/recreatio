/**
 * 0109 — „WYBÓR NA STRONIE": EIN EINTRAG AUS EINER BAZA WIEDZY [P07].
 *
 * Eine Seite für alle Postacie (Miejsca, Pojęcia …) statt einer je Eintrag:
 * oben die Auswahl eines veröffentlichten Eintrags (◀ ▶ durch die Liste), und
 * die Bausteine „Karta wpisu" ohne eigenen Eintrag zeigen ihn; eine „Tabela
 * wpisów" derselben Bibliothek wählt mit einem Klick.
 *
 * <b>Die Wahl steht in der Adresse</b> (`?wpis=…`, wie bei der Osoba z
 * formularza) — die Seite eines Eintrags lässt sich als Link weitergeben. Die
 * Adresse wird ersetzt, nicht verlängert. Kein Schlüssel: nur, was
 * veröffentlicht ist.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { readEntryQuery, withEntryQuery } from '../entryDesk';
import { summaryOf } from '../library';
import { PickLibrary } from '../LibraryPick';
import type { SubjectDecl, SubjectKind } from '../pageSubject';
import { ENTITY_BUNDLE, publishedAll, titleOf } from './published';

const said = (decl: SubjectDecl, key: string): string => {
  const v = decl[key];
  return typeof v === 'string' ? v.trim() : '';
};

export interface EntityChoice {
  readonly id: string;
  readonly label: string;
  readonly kinds: readonly string[];
}

export interface EntitySubject {
  readonly library: string;
  /** `null`: wird geholt. */
  readonly list: readonly EntityChoice[] | null;
  readonly chosen: string | null;
  readonly choose: (id: string | null) => void;
}

const EntityContext = createContext<EntitySubject | null>(null);

/** Was die Seite oben gewählt hat — `null`: sie wählt keinen Eintrag. */
export const useEntitySubject = (): EntitySubject | null => useContext(EntityContext);

/** `?wpis=…` lesen und (ersetzend) schreiben — die übrigen Schlüssel der Raute bleiben. */
function useChosen(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(() => readEntryQuery(window.location.hash).id);
  useEffect(() => {
    const onHash = () => setId(readEntryQuery(window.location.hash).id);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const choose = useCallback((next: string | null) => {
    setId(next);
    const hash = withEntryQuery(window.location.hash, { ...readEntryQuery(window.location.hash), id: next });
    if (hash !== window.location.hash) window.history.replaceState(window.history.state, '', hash);
  }, []);
  return [id, choose];
}

function EntityProvider({ decl, children }: { decl: SubjectDecl; path: string; children: ReactNode }) {
  const library = said(decl, 'library');
  const of = said(decl, 'of').toLocaleLowerCase('pl-PL');
  const [list, setList] = useState<readonly EntityChoice[] | null>(null);
  const [given, choose] = useChosen();

  useEffect(() => {
    if (library === '') { setList([]); return undefined; }
    let alive = true;
    setList(null);
    void publishedAll(library, { kind: 'entity', order: 'sort' }, 1000).then((items) => {
      const out: EntityChoice[] = [];
      for (const item of items) {
        const s = summaryOf(item);
        if (s.format !== ENTITY_BUNDLE) continue;
        const kinds = Array.isArray(s.kinds) ? s.kinds.filter((k): k is string => typeof k === 'string') : [];
        if (of !== '' && !kinds.some((k) => k.toLocaleLowerCase('pl-PL') === of)) continue;
        out.push({ id: item.entryId, label: titleOf(item), kinds });
      }
      out.sort((a, b) => a.label.localeCompare(b.label, 'pl'));
      if (alive) setList(out);
    }, () => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [library, of]);

  /* Einer allein ist gewählt, ohne Liste; ein fremder (aus einem alten Link) nicht. */
  const chosen = list === null ? given : list.some((e) => e.id === given) ? given : list.length === 1 ? list[0].id : null;
  const value = useMemo<EntitySubject>(() => ({ library, list, chosen, choose }), [library, list, chosen, choose]);
  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>;
}

/** Oben auf der Seite: welcher Eintrag, ◀ ▶ durch die Liste, wievielter. */
function EntityBar() {
  const s = useEntitySubject();
  if (s === null) return null;
  if (s.list === null) return <div className="wk-subject-bar is-waiting"><span className="wk-hint">Wczytywanie wpisów…</span></div>;
  if (s.list.length === 0) return <div className="wk-subject-bar"><span className="wk-hint">W tej bazie wiedzy nie ma jeszcze opublikowanych wpisów.</span></div>;
  const at = s.list.findIndex((e) => e.id === s.chosen);
  const prev = at > 0 ? s.list[at - 1] : null;
  const next = at < 0 ? s.list[0] : at < s.list.length - 1 ? s.list[at + 1] : null;
  return (
    <div className="wk-subject">
      <div className="wk-subject-bar" role="navigation" aria-label="Wybór wpisu">
        <span className="wk-subject-nav">
          <button type="button" className="wk-subject-step" disabled={prev === null} aria-label={prev === null ? 'Poprzedni wpis' : `Poprzedni: ${prev.label}`}
            title={prev?.label} onClick={() => prev !== null && s.choose(prev.id)}>◀</button>
          {s.list.length === 1 ? <strong className="wk-subject-name">{s.list[0].label}</strong> : (
            <select className="wk-subject-pick" value={s.chosen ?? ''} aria-label="Wpis" onChange={(e) => s.choose(e.target.value === '' ? null : e.target.value)}>
              <option value="">— wybierz wpis —</option>
              {s.list.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          )}
          <button type="button" className="wk-subject-step" disabled={next === null} aria-label={next === null ? 'Następny wpis' : `Następny: ${next.label}`}
            title={next?.label} onClick={() => next !== null && s.choose(next.id)}>▶</button>
        </span>
        <span className="wk-subject-at">{at >= 0 ? `${at + 1} z ${s.list.length}` : `${s.list.length} wpisów`}</span>
      </div>
    </div>
  );
}

function EntitySettings({ decl, busy, onChange }: { decl: SubjectDecl; busy: boolean; onChange: (next: SubjectDecl) => void }) {
  return (
    <>
      <div className="wk-field">
        <span>Baza wiedzy</span>
        <PickLibrary kind="knowledge" value={said(decl, 'library')} busy={busy} onPick={(library) => onChange({ ...decl, library })} />
      </div>
      <label className="wk-field">
        <span>Tylko rodzaj (nieobowiązkowo)</span>
        <input value={typeof decl.of === 'string' ? decl.of : ''} disabled={busy} placeholder="np. Postać" onChange={(e) => onChange({ ...decl, of: e.target.value })} />
      </label>
      <span className="wk-hint">Do wyboru są wpisy opublikowane w bazie wiedzy (wpis → „Na stronie” → Opublikuj). Moduły „Karta wpisu” bez własnego wpisu pokażą wybrany.</span>
    </>
  );
}

export const entitySubjectKind: SubjectKind = {
  kind: 'entity',
  label: 'Wpis z bazy wiedzy',
  use: 'U góry strony wybór jednego opublikowanego wpisu bazy wiedzy (◀ ▶ po liście); moduły „Karta wpisu” bez własnego wpisu pokazują ten. Jedna strona dla wszystkich postaci, miejsc, pojęć.',
  keys: {
    kind: '"entity"',
    library: 'identyfikator bazy wiedzy — czyje opublikowane wpisy są do wyboru',
    of: 'nieobowiązkowo: nazwa rodzaju (np. „Postać”) — tylko wpisy tego rodzaju'
  },
  example: { kind: 'entity', library: '0190a0a0-0000-7000-8000-0000000000bb', of: 'Postać' },
  missing: (decl) => (said(decl, 'library') === '' ? 'Wybierz bazę wiedzy.' : null),
  uses: () => [],
  Provider: EntityProvider,
  Bar: EntityBar,
  Settings: EntitySettings
};
