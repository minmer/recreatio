/**
 * 0082 — „WYBÓR NA STRONIE": EIN MENSCH AUS EINEM FORMULAR.
 *
 * Eine Seite sagt, wovon sie handelt — hier: von EINEM Menschen, der das
 * Formular ausgefüllt hat. Oben auf der Seite steht dann die Auswahl, und
 * jeder Baustein darunter („Panel osoby") nimmt sie:
 *
 * <code>
 *   niemand im Formular     die Bausteine schweigen (sie sagen nur, warum)
 *   genau einer             er ist gewählt, ohne Liste
 *   mehrere                 eine Auswahl mit ◀ ▶, Position und Filter
 * </code>
 *
 * <b>Die Wahl steht in der Adresse</b> (`?wpis=…`, mit Filter und der Liste,
 * aus der man kam — `entryDesk.ts`). Deshalb führen ◀ ▶ durch dieselbe
 * gefilterte Liste wie die Seite „Lista osób", und „← lista" zurück. Die
 * Adresse wird ERSETZT, nicht verlängert: „zurück" im Browser führt zur Liste,
 * nicht durch jeden Menschen, den man angesehen hat.
 *
 * <b>Lesen kann es nur die Kanzlei</b> — wer den Schlüssel des Amtes hält.
 * Ohne Anmeldung steht oben, dass man sich anmelden muss; ohne Passwort in
 * diesem Tab, das Feld dafür.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { plural } from './ChatKit';
import {
  filterWords, isFiltered, loadEntryDesk, neighbours, NO_FILTER, onDeskChange, pickRows, readEntryQuery,
  STEP_CHOICES, stepKindsOf, entryQueryString, withEntryQuery,
  type DeskRow, type EntryDesk, type EntryFilter, type EntryQuery
} from './entryDesk';
import { PickForm } from './FormPick';
import { PickPage } from './PickPage';
import type { Ring } from './keys';
import { useWho } from './me';
import type { SubjectDecl, SubjectKind } from './pageSubject';
import { keysFor } from './ringOf';
import { pagePath, path as routePath } from './routes';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';

/* -- Was alle brauchen, die die Menschen eines Formulars zeigen -------------------- */

/** Der Schlüsselbund der Kanzlei — `undefined`: wird geholt; `null`: niemand angemeldet oder kein Passwort in diesem Tab. */
export function useOfficeRing(): { who: Who | null | undefined; ring: Ring | null | undefined; retry: () => void } {
  const who = useWho();
  const [ring, setRing] = useState<Ring | null | undefined>(undefined);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (who === undefined) return undefined;
    if (who === null) { setRing(null); return undefined; }
    let alive = true;
    keysFor(who).then((keys) => { if (alive) setRing(keys.ring); }).catch(() => { if (alive) setRing(null); });
    return () => { alive = false; };
  }, [who, round]);

  return { who, ring, retry: useCallback(() => setRound((n) => n + 1), []) };
}

/** Die Menschen eines Formulars — gelesen, und neu gelesen, sobald sich an einem etwas ändert. */
export function useEntryDesk(formId: string, ring: Ring | null | undefined): { desk: EntryDesk | null; failed: string | null } {
  const [desk, setDesk] = useState<EntryDesk | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);

  useEffect(() => (formId === '' ? undefined : onDeskChange(formId, () => setStamp((n) => n + 1))), [formId]);

  useEffect(() => {
    if (ring == null || formId === '') return undefined;
    let alive = true;
    setFailed(null);
    loadEntryDesk(formId, ring)
      .then((found) => { if (alive) setDesk(found.formId === formId ? found : null); })
      .catch((e: unknown) => {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć zgłoszeń tego formularza.');
      });
    return () => { alive = false; };
  }, [formId, ring, stamp]);

  return { desk: desk?.formId === formId ? desk : null, failed };
}

/**
 * Was in der Adresse steht — und es ändern, OHNE einen Schritt in der
 * Geschichte des Browsers (`replaceState`). Ein Link mit einer anderen Wahl
 * auf dieselbe Seite (`hashchange`) gilt auch.
 */
export function useEntryQuery(): [EntryQuery, (next: EntryQuery) => void] {
  const [query, setQuery] = useState<EntryQuery>(() => readEntryQuery(window.location.hash));

  useEffect(() => {
    const onHash = () => setQuery(readEntryQuery(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const write = useCallback((next: EntryQuery) => {
    setQuery(next);
    const hash = withEntryQuery(window.location.hash, next);
    if (hash !== window.location.hash) window.history.replaceState(window.history.state, '', hash);
  }, []);

  return [query, write];
}

/** Die Seite, auf der man gerade steht — für „von welcher Liste" (`?z=`). */
export const herePath = (): string =>
  window.location.hash.replace(/^#\/?/, '').split(/[?&]/)[0].split('/')
    .map((one) => { try { return decodeURIComponent(one); } catch { return one; } })
    .filter((one) => one !== '').join('/');

/** Der Link auf die Seite eines Menschen — mit dem Filter und der Liste, aus der er kommt. */
export const entryHref = (page: string, id: string, filter: EntryFilter, from: string | null): string =>
  `${pagePath(page.replace(/^#?\/*/, ''))}${entryQueryString({ id, filter, from })}`;

/**
 * Warum (noch) nichts dasteht — angemeldet? Passwort? Gelesen? Ein Satz, oder
 * das Feld fürs Passwort; `null`: alles da.
 */
export function OfficeGate({ who, ring, retry, desk, failed, what }: {
  who: Who | null | undefined;
  ring: Ring | null | undefined;
  retry: () => void;
  desk: EntryDesk | null;
  failed: string | null;
  what: string;
}) {
  if (who === undefined || (who !== null && ring === undefined)) return <p className="wk-hint" role="status">Wczytywanie…</p>;
  if (who === null) {
    return (
      <p className="wk-hint">
        {what} widzą tylko koordynatorzy formularza — <a className="wk-link" href={routePath('workspace')}>zaloguj się</a>.
      </p>
    );
  }
  if (ring === null) return <Unlock who={who} why={`Bez hasła w tej karcie nie da się otworzyć zgłoszeń (${what.toLowerCase()}).`} onDone={retry} />;
  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (desk === null) return <p className="wk-hint" role="status">Otwieranie zgłoszeń…</p>;
  return null;
}

/**
 * DER FILTER — dieselben drei Dinge in der Liste und oben auf der Seite eines
 * Menschen: ein Stück Text, ein Schritt, auch die ausgeblendeten.
 */
export function EntryFilterBar({ filter, kinds, onChange }: {
  filter: EntryFilter;
  kinds: readonly (readonly [string, string])[];
  onChange: (next: EntryFilter) => void;
}) {
  return (
    <div className="wk-entry-filter" role="search">
      <input
        type="search" value={filter.q} placeholder="Szukaj: imię, telefon, odpowiedź…" aria-label="Szukaj osoby"
        onChange={(e) => onChange({ ...filter, q: e.target.value })}
      />
      {kinds.length > 0 && (
        <select value={filter.step} aria-label="Filtr kroków" onChange={(e) => onChange({ ...filter, step: e.target.value })}>
          {STEP_CHOICES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          {kinds.map(([key, label]) => <option key={key} value={`todo:${key}`}>brakuje: {label}</option>)}
        </select>
      )}
      <label className="wk-inline">
        <input type="checkbox" checked={filter.hidden} onChange={(e) => onChange({ ...filter, hidden: e.target.checked })} />
        <span>też ukryte</span>
      </label>
      {isFiltered(filter) && (
        <button type="button" className="wk-link-btn" onClick={() => onChange(NO_FILTER)}>Wyczyść</button>
      )}
    </div>
  );
}

/* -- Die Wahl der Seite ------------------------------------------------------------- */

export interface EntrySubject {
  readonly formId: string;
  readonly who: Who | null | undefined;
  readonly ring: Ring | null | undefined;
  readonly retry: () => void;
  readonly desk: EntryDesk | null;
  readonly failed: string | null;

  /** Die Menschen, die der Filter zeigt — in der Reihenfolge der Liste. */
  readonly shown: readonly DeskRow[];

  /** Wer gewählt ist: aus der Adresse, sonst der einzige, den der Filter zeigt. */
  readonly chosen: DeskRow | null;
  readonly filter: EntryFilter;

  /** Die Liste, zu der „← lista" führt — woher man kam, sonst die in der Wahl genannte. */
  readonly list: string | null;
  readonly choose: (id: string | null) => void;
  readonly setFilter: (next: EntryFilter) => void;
}

const EntryContext = createContext<EntrySubject | null>(null);

/** Die Wahl „osoba z formularza" dieser Seite — `null`: die Seite wählt keine. */
export const useEntrySubject = (): EntrySubject | null => useContext(EntryContext);

const formOf = (decl: SubjectDecl): string => (typeof decl.form === 'string' ? decl.form.trim() : '');
const listOf = (decl: SubjectDecl): string | null =>
  typeof decl.list === 'string' && decl.list.trim() !== '' ? decl.list.trim().replace(/^#?\/*/, '') : null;

function EntryProvider({ decl, children }: { decl: SubjectDecl; path: string; children: ReactNode }) {
  const formId = formOf(decl);
  const { who, ring, retry } = useOfficeRing();
  const { desk, failed } = useEntryDesk(formId, ring);
  const [query, write] = useEntryQuery();

  const all = desk?.rows ?? null;
  const shown = useMemo(() => (all === null ? [] : pickRows(all, query.filter)), [all, query.filter]);
  const picked = query.id === null || all === null ? undefined : all.find((r) => r.s.registrationId === query.id);
  const chosen = picked ?? (shown.length === 1 ? shown[0] : null);

  const value = useMemo<EntrySubject>(() => ({
    formId, who, ring, retry, desk, failed: formId === '' ? 'Ta strona wybiera osobę z formularza, ale nie wskazano formularza.' : failed,
    shown, chosen, filter: query.filter,
    list: query.from ?? listOf(decl),
    choose: (id) => write({ ...query, id }),
    setFilter: (filter) => write({ ...query, filter })
  }), [formId, who, ring, retry, desk, failed, shown, chosen, query, write, decl]);

  return <EntryContext.Provider value={value}>{children}</EntryContext.Provider>;
}

/**
 * OBEN AUF DER SEITE: wer gewählt ist, ◀ ▶ durch die Liste, wievielter, der
 * Filter — und zurück zur Liste.
 */
function EntryBar() {
  const e = useEntrySubject();
  const [filtering, setFiltering] = useState(false);
  if (e === null) return null;

  const gate = OfficeGate({ who: e.who, ring: e.ring, retry: e.retry, desk: e.desk, failed: e.failed, what: 'Osoby z tego formularza' });
  if (gate !== null) return <div className="wk-subject-bar is-waiting">{gate}</div>;

  const desk = e.desk!;
  const all = desk.rows;
  const name = desk.module?.name ?? 'formularz';
  const id = e.chosen?.s.registrationId ?? null;
  const { prev, next, at } = neighbours(all, e.shown, id);
  const kinds = stepKindsOf(all);
  /* Zurück zur Liste — mit demselben Filter, und dort steht der, bei dem man gerade war. */
  const back = e.list === null ? null : `${pagePath(e.list)}${entryQueryString({ id, filter: e.filter, from: null })}`;
  const lone = e.shown.length === 1 && e.chosen === e.shown[0];
  const outside = e.chosen !== null && at === 0;

  return (
    <div className="wk-subject">
      <div className="wk-subject-bar" role="navigation" aria-label="Wybór osoby">
        {back !== null && <a className="wk-link wk-subject-back" href={back}>← lista</a>}
        <span className="wk-subject-of" title={`Osoby z formularza „${name}"`}>{name}</span>

        {all.length === 0 ? (
          <span className="wk-hint">W tym formularzu nie ma jeszcze nikogo.</span>
        ) : (
          <>
            {/* ◀ wer ▶ — beisammen, auch wo die Zeile umbricht (ein Telefon). */}
            <span className="wk-subject-nav">
              <button type="button" className="wk-subject-step" disabled={prev === null} aria-label={prev === null ? 'Poprzednia osoba' : `Poprzednia: ${prev.name}`}
                title={prev?.name} onClick={() => prev !== null && e.choose(prev.s.registrationId)}>◀</button>
              {lone ? (
                <strong className="wk-subject-name">{e.chosen!.name}</strong>
              ) : (
                <select className="wk-subject-pick" value={id ?? ''} aria-label="Osoba" onChange={(ev) => e.choose(ev.target.value === '' ? null : ev.target.value)}>
                  <option value="">— wybierz osobę —</option>
                  {outside && <option value={id!}>{e.chosen!.name} (poza filtrem)</option>}
                  {e.shown.map((r) => (
                    <option key={r.s.registrationId} value={r.s.registrationId}>{r.name}{r.s.hidden ? ' (ukryte)' : ''}</option>
                  ))}
                </select>
              )}
              <button type="button" className="wk-subject-step" disabled={next === null} aria-label={next === null ? 'Następna osoba' : `Następna: ${next.name}`}
                title={next?.name} onClick={() => next !== null && e.choose(next.s.registrationId)}>▶</button>
            </span>
            <span className="wk-subject-at">
              {at > 0 ? `${at} z ${e.shown.length}` : `${e.shown.length} ${plural(e.shown.length, 'osoba', 'osoby', 'osób')}`}
            </span>
            <button type="button" className="wk-link-btn" aria-expanded={filtering} onClick={() => setFiltering(!filtering)}>
              {isFiltered(e.filter) ? `Filtr: ${filterWords(e.filter, kinds)}` : 'Filtr'}
            </button>
          </>
        )}
      </div>

      {filtering && all.length > 0 && <EntryFilterBar filter={e.filter} kinds={kinds} onChange={e.setFilter} />}
      {all.length > 0 && e.shown.length === 0 && (
        <p className="wk-hint">Nikt nie pasuje do tego filtra{e.chosen === null ? '' : ` — ${e.chosen.name} jest poza nim`}.</p>
      )}
    </div>
  );
}

/** In den Einstellungen der Seite: welches Formular, und welche Seite die Liste ist. */
function EntrySettings({ decl, busy, onChange }: { decl: SubjectDecl; busy: boolean; onChange: (next: SubjectDecl) => void }) {
  return (
    <>
      <div className="wk-field">
        <span>Formularz</span>
        <PickForm value={formOf(decl)} busy={busy} onPick={(form) => onChange({ ...decl, form })} />
      </div>
      <div className="wk-field">
        <span>Strona z listą osób (nieobowiązkowo)</span>
        <PickPage value={typeof decl.list === 'string' ? decl.list : ''} busy={busy} onPick={(list) => onChange({ ...decl, list })} />
        <span className="wk-hint">
          Dokąd prowadzi „← lista”, gdy ktoś otworzy tę stronę bezpośrednio. Kto przyszedł z listy (moduł „Lista osób”), wraca tam, skąd przyszedł — z tym samym filtrem.
        </span>
      </div>
    </>
  );
}

export const entrySubjectKind: SubjectKind = {
  kind: 'entry',
  label: 'Osoba z formularza',
  use: 'U góry strony wybór jednej osoby, która wypełniła formularz (◀ ▶ po liście, filtr); moduły „Panel osoby” pokazują wszystko o niej. Dla koordynatorów.',
  keys: {
    kind: '"entry"',
    form: 'identyfikator modułu „Formularz” — czyje zgłoszenia są do wyboru',
    list: 'nieobowiązkowo: ścieżka strony z modułem „Lista osób” — dokąd prowadzi „← lista”'
  },
  example: { kind: 'entry', form: '0190a0a0-0000-7000-8000-0000000000aa', list: 'parafia/bierzmowanie/kandydaci' },
  missing: (decl) => (formOf(decl) === '' ? 'Wybierz formularz.' : null),
  uses: (decl) => (formOf(decl) === '' ? [] : [formOf(decl)]),
  Provider: EntryProvider,
  Bar: EntryBar,
  Settings: EntrySettings
};
