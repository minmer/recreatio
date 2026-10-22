/**
 * 0109 — „WYBÓR NA STRONIE": EIN EINTRAG AUS EINER BAZA WIEDZY [P07].
 *
 * Eine Seite für alle Postacie (Miejsca, Pojęcia …) statt einer je Eintrag:
 * oben die Auswahl eines Eintrags (◀ ▶ durch die Liste), und die Bausteine
 * „Karta wpisu" ohne eigenen Eintrag zeigen ihn; eine „Tabela wpisów"
 * derselben Bibliothek wählt mit einem Klick.
 *
 * <b>Die Wahl steht in der Adresse</b> (`?wpis=…`, wie bei der Osoba z
 * formularza) — die Seite eines Eintrags lässt sich als Link weitergeben. Die
 * Adresse wird ersetzt, nicht verlängert.
 *
 * 2026-10-22 (Schritt 8) — zur Wahl stehen die Einträge der Baza wiedzy
 * selbst, so wie dieser Leser sie lesen darf (`pageBase.ts`, erst bei Bedarf
 * geladen): eine öffentliche Baza jeder, sonst ihre Mitglieder.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { readEntryQuery, withEntryQuery } from '../forms/entryDesk';
import { PickLibrary } from '../library/LibraryPick';
import type { SubjectDecl, SubjectKind } from '../pages/pageSubject';

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
  const of = said(decl, 'of');
  const [list, setList] = useState<readonly EntityChoice[] | null>(null);
  const [given, choose] = useChosen();

  useEffect(() => {
    if (library === '') { setList([]); return undefined; }
    let alive = true;
    setList(null);
    /* Die Baza erst hier laden — eine Seite ohne diese Wahl trägt Cogita nicht mit. */
    void import('./pageBase')
      .then(({ openPageBase, entityChoices }) => openPageBase(library, false).then((lib) => (lib === null ? [] : entityChoices(lib, of))))
      .then((out) => { if (alive) setList(out); }, () => { if (alive) setList([]); });
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
  if (s.list.length === 0) return <div className="wk-subject-bar"><span className="wk-hint">Brak wpisów do wyboru — baza jest pusta albo nie możesz jej czytać.</span></div>;
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
      <span className="wk-hint">Do wyboru są wpisy tej bazy wiedzy. Widzi je ten, kto może czytać bazę: jeśli jej obszar jest publiczny (a baza otwarta), każdy — wtedy publiczna jest cała baza, także odpowiedzi pytań i szkice. Moduły „Karta wpisu” bez własnego wpisu pokażą wybrany.</span>
    </>
  );
}

export const entitySubjectKind: SubjectKind = {
  kind: 'entity',
  label: 'Wpis z bazy wiedzy',
  use: 'U góry strony wybór jednego wpisu bazy wiedzy (◀ ▶ po liście); moduły „Karta wpisu” bez własnego wpisu pokazują ten. Jedna strona dla wszystkich postaci, miejsc, pojęć. Wpisy widzi ten, kto może czytać bazę (publiczny obszar: każdy).',
  keys: {
    kind: '"entity"',
    library: 'identyfikator bazy wiedzy — jej wpisy są do wyboru',
    of: 'nieobowiązkowo: nazwa rodzaju (np. „Postać”) — tylko wpisy tego rodzaju'
  },
  example: { kind: 'entity', library: '0190a0a0-0000-7000-8000-0000000000bb', of: 'Postać' },
  missing: (decl) => (said(decl, 'library') === '' ? 'Wybierz bazę wiedzy.' : null),
  uses: () => [],
  Provider: EntityProvider,
  Bar: EntityBar,
  Settings: EntitySettings
};
