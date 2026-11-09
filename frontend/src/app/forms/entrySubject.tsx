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

import { rich, t, useT } from '../core/i18n';
import {
  filterWords, isFiltered, loadEntryDesk, neighbours, NO_FILTER, onDeskChange, pickRows, readEntryQuery,
  STEP_CHOICES, stepKindsOf, entryQueryString, withEntryQuery,
  type DeskRow, type EntryDesk, type EntryFilter, type EntryQuery, type StepKind
} from './entryDesk';
import { PickForm } from './FormPick';
import { PickPage } from '../pages/PickPage';
import type { Ring } from '../core/keys';
import { useWho } from '../core/me';
import { usePerson } from '../pages/pagePerson';
import { useSeats } from '../seats/seatContext';
import type { SubjectDecl, SubjectKind } from '../pages/pageSubject';
import { keysFor } from '../core/ringOf';
import { pagePath, path as routePath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { Unlock } from '../shell/Unlock';
import { Loading } from '../ui/Loading';

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
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : t('formsOffice.subject.openFailed'));
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

/**
 * Der Link auf die Seite eines Menschen — mit dem Filter, der Liste, aus der er
 * kommt, und (0104) dem Formular: so wählt ihn auch eine Seite ohne eigenen
 * „Wybór na stronie" (`implicitSubject`).
 */
export const entryHref = (page: string, id: string, filter: EntryFilter, from: string | null, form: string | null = null): string =>
  `${pagePath(page.replace(/^#?\/*/, ''))}${entryQueryString({ id, filter, from, form })}`;

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
  /* Auch als Funktion gerufen (`EntryBar`) — darum `t` der App, kein Hook. */
  if (who === undefined || (who !== null && ring === undefined)) return <Loading label={t('common.loading')} />;
  if (who === null) {
    return (
      <p className="wk-hint">
        {rich(t('formsOffice.subject.signIn', { what }), { a: (s, k) => <a key={k} className="wk-link" href={routePath('workspace')}>{s}</a> })}
      </p>
    );
  }
  if (ring === null) return <Unlock who={who} why={t('formsOffice.subject.noPassword', { what: what.toLowerCase() })} onDone={retry} />;
  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (desk === null) return <p className="wk-hint" role="status">{t('formsOffice.openingEntries')}</p>;
  return null;
}

/**
 * DER FILTER — dieselben drei Dinge in der Liste und oben auf der Seite eines
 * Menschen: ein Stück Text, ein Schritt, auch die ausgeblendeten.
 */
export function EntryFilterBar({ filter, kinds, onChange }: {
  filter: EntryFilter;
  kinds: readonly StepKind[];
  onChange: (next: EntryFilter) => void;
}) {
  const t = useT();
  return (
    <div className="wk-entry-filter" role="search">
      <input
        type="search" value={filter.q} placeholder={t('formsOffice.subject.searchPlaceholder')} aria-label={t('formsOffice.subject.search')}
        onChange={(e) => onChange({ ...filter, q: e.target.value })}
      />
      {kinds.length > 0 && (
        <select value={filter.step} aria-label={t('formsOffice.subject.stepFilter')} onChange={(e) => onChange({ ...filter, step: e.target.value })}>
          {STEP_CHOICES.map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
          <StepOptions kinds={kinds} />
        </select>
      )}
      <label className="wk-inline">
        <input type="checkbox" checked={filter.hidden} onChange={(e) => onChange({ ...filter, hidden: e.target.checked })} />
        <span>{t('formsOffice.subject.hiddenToo')}</span>
      </label>
      {isFiltered(filter) && (
        <button type="button" className="wk-link-btn" onClick={() => onChange(NO_FILTER)}>{t('formsOffice.subject.clear')}</button>
      )}
    </div>
  );
}

/** Je Schritt eine Gruppe im Filter — zrobione / brakuje, bei „Wybierz termin" nach Terminen. */
export function StepOptions({ kinds }: { kinds: readonly StepKind[] }) {
  return (
    <>
      {kinds.map((k) => (
        <optgroup key={k.key} label={k.label}>
          {k.options.map(([value, short]) => <option key={value} value={value}>{short}</option>)}
        </optgroup>
      ))}
    </>
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

/**
 * 0104 — GILT DIE WAHL FÜR DIESEN BESUCHER? Auf der Seite, die die Kandydaci
 * über ihren Link sehen, steht sie für die Kanzlei. Wer als SEIN Platz da ist
 * (oben gewählt), oder ohne Anmeldung mit einem Link in diesem Browser, sieht
 * weiter sich selbst — und keine Leiste mit „zaloguj się".
 */
export function useOfficeSubject(subject: EntrySubject | null): EntrySubject | null {
  const person = usePerson();
  const seats = useSeats();
  if (subject === null || person?.chosen?.kind === 'seat') return null;
  if (subject.who === null && seats.length > 0) return null;
  return subject;
}

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
    formId, who, ring, retry, desk, failed: formId === '' ? t('formsOffice.subject.noForm') : failed,
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
  const e = useOfficeSubject(useEntrySubject());
  const [filtering, setFiltering] = useState(false);
  const t = useT();
  if (e === null) return null;

  const gate = OfficeGate({ who: e.who, ring: e.ring, retry: e.retry, desk: e.desk, failed: e.failed, what: t('formsOffice.subject.peopleOfForm') });
  if (gate !== null) return <div className="wk-subject-bar is-waiting">{gate}</div>;

  const desk = e.desk!;
  const all = desk.rows;
  const name = desk.module?.name ?? t('formsOffice.subject.form');
  const id = e.chosen?.s.registrationId ?? null;
  const { prev, next, at } = neighbours(all, e.shown, id);
  const kinds = stepKindsOf(all);
  /* Zurück zur Liste — mit demselben Filter, und dort steht der, bei dem man gerade war. */
  const back = e.list === null ? null : `${pagePath(e.list)}${entryQueryString({ id, filter: e.filter, from: null })}`;
  const lone = e.shown.length === 1 && e.chosen === e.shown[0];
  const outside = e.chosen !== null && at === 0;

  return (
    <div className="wk-subject">
      <div className="wk-subject-bar" role="navigation" aria-label={t('formsOffice.subject.choose')}>
        {back !== null && <a className="wk-link wk-subject-back" href={back}>{t('formsOffice.subject.back')}</a>}
        <span className="wk-subject-of" title={t('formsOffice.subject.peopleOf', { name })}>{name}</span>

        {all.length === 0 ? (
          <span className="wk-hint">{t('formsOffice.subject.empty')}</span>
        ) : (
          <>
            {/* ◀ wer ▶ — beisammen, auch wo die Zeile umbricht (ein Telefon). */}
            <span className="wk-subject-nav">
              <button type="button" className="wk-subject-step" disabled={prev === null} aria-label={prev === null ? t('formsOffice.subject.prev') : t('formsOffice.subject.prevName', { name: prev.name })}
                title={prev?.name} onClick={() => prev !== null && e.choose(prev.s.registrationId)}>◀</button>
              {lone ? (
                <strong className="wk-subject-name">{e.chosen!.name}</strong>
              ) : (
                <select className="wk-subject-pick" value={id ?? ''} aria-label={t('formsOffice.subject.person')} onChange={(ev) => e.choose(ev.target.value === '' ? null : ev.target.value)}>
                  <option value="">{t('formsOffice.subject.pick')}</option>
                  {outside && <option value={id!}>{e.chosen!.name} {t('formsOffice.subject.outside')}</option>}
                  {e.shown.map((r) => (
                    <option key={r.s.registrationId} value={r.s.registrationId}>{r.name}{r.s.hidden ? ` ${t('formsOffice.subject.hidden')}` : ''}</option>
                  ))}
                </select>
              )}
              <button type="button" className="wk-subject-step" disabled={next === null} aria-label={next === null ? t('formsOffice.subject.next') : t('formsOffice.subject.nextName', { name: next.name })}
                title={next?.name} onClick={() => next !== null && e.choose(next.s.registrationId)}>▶</button>
            </span>
            <span className="wk-subject-at">
              {at > 0 ? t('formsOffice.subject.at', { at, count: e.shown.length }) : t('formsOffice.subject.count', { count: e.shown.length })}
            </span>
            <button type="button" className="wk-link-btn" aria-expanded={filtering} onClick={() => setFiltering(!filtering)}>
              {isFiltered(e.filter) ? t('formsOffice.subject.filterOn', { words: filterWords(e.filter, kinds) }) : t('common.filter')}
            </button>
          </>
        )}
      </div>

      {filtering && all.length > 0 && <EntryFilterBar filter={e.filter} kinds={kinds} onChange={e.setFilter} />}
      {all.length > 0 && e.shown.length === 0 && (
        <p className="wk-hint">{e.chosen === null ? t('formsOffice.people.noMatch') : t('formsOffice.subject.noMatchChosen', { name: e.chosen.name })}</p>
      )}
    </div>
  );
}

/** In den Einstellungen der Seite: welches Formular, und welche Seite die Liste ist. */
function EntrySettings({ decl, busy, onChange }: { decl: SubjectDecl; busy: boolean; onChange: (next: SubjectDecl) => void }) {
  const t = useT();
  return (
    <>
      <div className="wk-field">
        <span>{t('forms.sheet.form')}</span>
        <PickForm value={formOf(decl)} busy={busy} onPick={(form) => onChange({ ...decl, form })} />
      </div>
      <div className="wk-field">
        <span>{t('formsOffice.subject.listPage')}</span>
        <PickPage value={typeof decl.list === 'string' ? decl.list : ''} busy={busy} onPick={(list) => onChange({ ...decl, list })} />
        <span className="wk-hint">
          {t('formsOffice.subject.listHint')}
        </span>
      </div>
    </>
  );
}

export const entrySubjectKind: SubjectKind = {
  kind: 'entry',
  get label() { return t('formsOffice.subject.kindLabel'); },
  get use() { return t('formsOffice.subject.kindUse'); },
  keys: {
    kind: '"entry"',
    get form() { return t('formsOffice.subject.keyForm'); },
    get list() { return t('formsOffice.subject.keyList'); }
  },
  example: { kind: 'entry', form: '0190a0a0-0000-7000-8000-0000000000aa', list: 'parafia/bierzmowanie/kandydaci' },
  missing: (decl) => (formOf(decl) === '' ? t('formsOffice.subject.pickForm') : null),
  uses: (decl) => (formOf(decl) === '' ? [] : [formOf(decl)]),
  Provider: EntryProvider,
  Bar: EntryBar,
  Settings: EntrySettings
};
