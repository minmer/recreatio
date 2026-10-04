/**
 * 0082 — ZWEI SEITEN FÜR DIE MENSCHEN EINES FORMULARS.
 *
 * <code>
 *   Lista osób    alle, mit Suche und Schrittfilter — ein Name führt auf die Seite des Menschen
 *   Panel osoby   alles über den Menschen, der oben gewählt ist („Wybór na stronie")
 * </code>
 *
 * <b>Verbunden über die Adresse</b> (`entryDesk.ts`): die Liste schickt den
 * Filter und sich selbst mit (`?wpis=…&filtr=…&q=…&z=<liste>`), die Seite des
 * Menschen führt mit ◀ ▶ durch genau diese Liste und mit „← lista" zurück —
 * dorthin, wo man war, mit demselben Filter.
 *
 * <b>Für die Kanzlei.</b> Beide lesen die Antworten mit dem Schlüssel des
 * Amtes; wer ihn nicht hat, sieht nur, dass es ihn braucht.
 */

import { useEffect, useMemo, useRef } from 'react';

import { plural } from '../ChatKit';
import { EntryDeskPanel } from '../FormOffice';
import {
  PANEL_SECTION_LABEL, PANEL_SECTIONS, pickRows, readSections, stepKindsOf,
  type DeskRow, type PanelSection
} from '../entryDesk';
import {
  EntryFilterBar, entryHref, herePath, OfficeGate, useEntryDesk, useEntryQuery, useEntrySubject, useOfficeRing
} from '../entrySubject';
import type { OpenField } from '../form';
import { definePart, text, type EditorProps, type PartContext, type RawConfig } from '../part';
import { progressOf } from '../steps';

/* -- Woran ein Mensch ist, kurz ----------------------------------------------------- */

function RowTags({ row }: { row: DeskRow }) {
  const progress = progressOf(row.states);
  return (
    <span className="wk-tags">
      {row.s.hidden && <span className="wk-tag">ukryte</span>}
      {row.s.withdrawnAt !== null && <span className="wk-tag">wycofane</span>}
      {row.s.confirmedAt !== null && <span className="wk-tag wk-tag-open">dane potwierdzone</span>}
      {progress.total > 0 && (
        <span className={progress.done === progress.total ? 'wk-tag wk-tag-open' : 'wk-tag'}
          title={row.states.filter((st) => st.status !== 'done').map((st) => st.label).join(', ') || 'Wszystko zrobione'}>
          {progress.done}/{progress.total}{progress.overdue > 0 ? ' · po terminie!' : ''}
        </span>
      )}
    </span>
  );
}

/* -- Lista osób ---------------------------------------------------------------------- */

interface ListConfig {
  readonly title: string;
  readonly form: string;
  readonly page: string;
  readonly columns: string;
}

/** Die Antworten, die als Spalten dastehen — bei „wszystkie" ohne die, die schon im Namen und in den Nummern stehen. */
function columnsOf(fields: readonly OpenField[], chosen: string): readonly OpenField[] {
  if (chosen.trim() === '') return [];
  if (chosen.trim() === '*') {
    return fields.filter((f) => f.kind !== 'phone' && !['given_name', 'surname', 'nickname', 'name'].includes(f.identityRole));
  }
  const ids = chosen.split(',').map((one) => one.trim());
  return ids.map((id) => fields.find((f) => f.fieldId === id)).filter((f): f is OpenField => f !== undefined);
}

function EntryListView({ config, ctx }: { config: ListConfig; ctx: PartContext }) {
  const { who, ring, retry } = useOfficeRing();
  const { desk, failed } = useEntryDesk(config.form, ring);
  const [query, write] = useEntryQuery();
  const here = useRef<HTMLElement | null>(null);
  const scrolled = useRef(false);

  const all = desk?.rows ?? null;
  const shown = useMemo(() => (all === null ? [] : pickRows(all, query.filter)), [all, query.filter]);

  /* Wer von der Seite eines Menschen zurückkommt, sieht ihn wieder — einmal hingerollt. */
  useEffect(() => {
    if (scrolled.current || here.current === null) return;
    scrolled.current = true;
    here.current.scrollIntoView({ block: 'center' });
  });

  const head = <h2 className="wk-card-title">{config.title === '' ? 'Lista osób' : config.title}</h2>;
  if (config.form === '') return <>{head}<p className="wk-card-muted">Tu pojawi się lista osób — trzeba jeszcze wybrać formularz.</p></>;

  const gate = OfficeGate({ who, ring, retry, desk, failed, what: 'Listę osób' });
  if (gate !== null) return <>{head}{gate}</>;

  const fields = desk!.form.fields;
  const columns = columnsOf(fields, config.columns);
  const page = config.page.replace(/^#?\/*/, '');
  const from = herePath();
  const wide = ctx.whole === true || ctx.size.width === 'wide' || ctx.size.width === 'full';
  const link = (row: DeskRow) => (page === '' ? null : entryHref(page, row.s.registrationId, query.filter, from));
  const mark = (row: DeskRow) => (row.s.registrationId === query.id ? (el: HTMLElement | null) => { here.current = el; } : undefined);
  const name = (row: DeskRow) => {
    const href = link(row);
    return href === null ? <strong>{row.name}</strong> : <a className="wk-link wk-entry-open" href={href}>{row.name}</a>;
  };

  return (
    <>
      {head}
      <EntryFilterBar filter={query.filter} kinds={stepKindsOf(all!)} onChange={(filter) => write({ ...query, filter })} />
      <p className="wk-hint" role="status">
        {shown.length === all!.length ? `${shown.length} ${plural(shown.length, 'osoba', 'osoby', 'osób')}` : `${shown.length} z ${all!.length}`}
        {page === '' && ' · wybierz w module „Strona osoby”, żeby otwierać osobę na jej stronie'}
      </p>

      {all!.length === 0 ? (
        <p className="wk-card-muted">W tym formularzu nie ma jeszcze nikogo.</p>
      ) : shown.length === 0 ? (
        <p className="wk-card-muted">Nikt nie pasuje do tego filtra.</p>
      ) : wide ? (
        /* Breit: eine Tabelle — Name, Nummern, die gewählten Antworten, woran er ist. */
        <div className="wk-entry-table-wrap">
          <table className="wk-entry-table">
            <thead>
              <tr>
                <th scope="col">Osoba</th>
                <th scope="col">Telefon</th>
                {columns.map((f) => <th key={f.fieldId} scope="col">{f.label ?? 'pytanie'}</th>)}
                <th scope="col">Postęp</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.s.registrationId} ref={mark(row)}
                  className={[row.s.registrationId === query.id ? 'is-here' : '', row.s.hidden || row.s.withdrawnAt !== null ? 'is-muted' : ''].join(' ').trim() || undefined}>
                  <th scope="row">{name(row)}</th>
                  <td>{row.phones.map((p) => <a key={p.dial} className="wk-entry-phone" href={`tel:${p.dial}`}>{p.shown}</a>)}</td>
                  {columns.map((f) => {
                    const value = row.values?.get(f.fieldId) ?? '';
                    return <td key={f.fieldId} title={value.length > 40 ? value : undefined}>{value}</td>;
                  })}
                  <td><RowTags row={row} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Schmal: Namen untereinander, mit dem, woran sie sind. */
        <ul className="wk-entry-picks">
          {shown.map((row) => (
            <li key={row.s.registrationId} ref={mark(row)}
              className={[row.s.registrationId === query.id ? 'is-here' : '', row.s.hidden || row.s.withdrawnAt !== null ? 'is-muted' : ''].join(' ').trim() || undefined}>
              {name(row)}
              <RowTags row={row} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export const entryListPart = definePart<ListConfig>({
  kind: 'entry-list',
  label: 'Lista osób',
  use: 'Wszystkie osoby z formularza — szukanie, filtr kroków; nazwisko otwiera stronę tej osoby (z panelem). Dla koordynatorów.',
  box: { colSpan: 6, rowSpan: 5 },

  example: { title: 'Kandydaci', form: '0190a0a0-0000-7000-8000-0000000000aa', page: 'parafia/bierzmowanie/kandydat', columns: '*' },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Kandydaci' },
    { key: 'form', label: 'Formularz', kind: 'form' },
    { key: 'page', label: 'Strona osoby', kind: 'page', hint: 'strona z „Wyborem na stronie”: osoba z tego formularza' },
    { key: 'columns', label: 'Kolumny (na szerokim module)', kind: 'questions', of: 'form' }
  ],

  read: (raw: RawConfig): ListConfig => ({
    title: text(raw, 'title'),
    form: text(raw, 'form'),
    page: text(raw, 'page'),
    columns: text(raw, 'columns')
  }),
  hasContent: () => true,
  missing: (config) => (config.form === '' ? 'Wybierz formularz.'
    : config.page === '' ? 'Wybierz stronę osoby — bez niej nazwiska nie prowadzą dalej.' : null),

  strip: { title: 'Lista osób', open: 'Pokaż listę' },
  fullscreen: true,
  shows: (_config, size) => size.width === 'wide' || size.width === 'full'
    ? 'Szukanie i filtr, potem tabela: osoba, telefon, wybrane odpowiedzi, postęp.'
    : 'Szukanie i filtr, potem same nazwiska z postępem.',

  View: EntryListView
});

/* -- Panel osoby ---------------------------------------------------------------------- */

interface PanelConfig {
  readonly title: string;
  readonly sections: readonly PanelSection[];
}

function EntryPanelView({ config, ctx }: { config: PanelConfig; ctx: PartContext }) {
  const e = useEntrySubject();
  const chosen = e?.chosen ?? null;
  const head = (name: string | null) => <h2 className="wk-card-title">{config.title !== '' ? config.title : name ?? 'Panel osoby'}</h2>;

  if (e === null) {
    return <>{head(null)}<p className="wk-card-muted">Ta strona nie wybiera osoby — w ustawieniach strony ustaw „Wybór na stronie”: osoba z formularza.</p></>;
  }

  /* Warum nichts dasteht, sagt die Leiste oben; hier nur ein Satz. */
  if (e.desk === null || e.ring == null) return <>{head(null)}<p className="wk-card-muted">Osoba pojawi się tu po wyborze u góry strony.</p></>;
  if (chosen === null) {
    return <>{head(null)}<p className="wk-card-muted">{e.desk.rows.length === 0 ? 'W formularzu nie ma jeszcze nikogo.' : 'Wybierz osobę u góry strony.'}</p></>;
  }

  /* Ein Streifen: wer, seine Nummern, woran er ist. */
  if (ctx.size.height === 'strip' && ctx.whole !== true) {
    return (
      <p className="wk-entry-strip">
        <strong>{chosen.name}</strong>
        {chosen.phones.map((p) => <a key={p.dial} className="wk-entry-phone" href={`tel:${p.dial}`}>{p.shown}</a>)}
        <RowTags row={chosen} />
      </p>
    );
  }

  return (
    <>
      {head(chosen.name)}
      {config.title !== '' && <p className="wk-entry-who"><strong>{chosen.name}</strong> <RowTags row={chosen} /></p>}
      <EntryDeskPanel key={chosen.s.registrationId} desk={e.desk} row={chosen} ring={e.ring} sections={config.sections} />
    </>
  );
}

/** Die Einstellungen: Überschrift und welche Teile. */
function PanelSetup({ raw, onSet, busy }: EditorProps) {
  const sections = readSections(raw.sections ?? '');
  const toggle = (one: PanelSection, on: boolean) => {
    const next = PANEL_SECTIONS.filter((s) => (s === one ? on : sections.includes(s)));
    onSet({ sections: next.length === PANEL_SECTIONS.length ? '' : next.join(',') });
  };

  return (
    <>
      <label className="wk-field">
        <span>Nagłówek</span>
        <input value={raw.title ?? ''} disabled={busy} placeholder="puste: imię i nazwisko osoby" onChange={(e) => onSet({ title: e.target.value })} />
      </label>
      <div className="wk-field">
        <span>Co pokazuje</span>
        <div className="wk-checks">
          {PANEL_SECTIONS.map((one) => (
            <label key={one} className="wk-inline">
              <input type="checkbox" checked={sections.includes(one)} disabled={busy || (sections.length === 1 && sections[0] === one)}
                onChange={(e) => toggle(one, e.target.checked)} />
              <span>{PANEL_SECTION_LABEL[one]}</span>
            </label>
          ))}
        </div>
        <span className="wk-hint">
          Osobę wybiera się u góry strony — w ustawieniach strony „Wybór na stronie”: osoba z formularza. Kilka paneli na jednej
          stronie pokazuje tę samą osobę: np. odpowiedzi w jednym, kroki w drugim.
        </span>
      </div>
    </>
  );
}

export const entryPanelPart = definePart<PanelConfig>({
  kind: 'entry-panel',
  label: 'Panel osoby',
  use: 'Wszystko o osobie wybranej u góry strony: odpowiedzi, kroki, rozszerzenia, link, rozmowa. Wymaga „Wyboru na stronie”: osoba z formularza.',
  box: { colSpan: 6, rowSpan: 5 },

  example: { title: 'Kroki', sections: 'steps,extensions' },
  fields: [],
  extra: [
    { key: 'title', shape: 'line', says: 'nagłówek; puste — imię i nazwisko wybranej osoby' },
    { key: 'sections', shape: 'line', says: `które części, po przecinku: ${PANEL_SECTIONS.map((one) => `"${one}" (${PANEL_SECTION_LABEL[one]})`).join(', ')}; puste — wszystkie` }
  ],
  Editor: PanelSetup,

  read: (raw: RawConfig): PanelConfig => ({ title: text(raw, 'title'), sections: readSections(text(raw, 'sections')) }),
  hasContent: () => true,

  fullscreen: true,
  shows: (config, size) => size.height === 'strip'
    ? 'Imię i nazwisko wybranej osoby, telefon i postęp.'
    : `Wybrana osoba: ${config.sections.map((one) => PANEL_SECTION_LABEL[one].toLowerCase()).join(', ')}.`,

  View: EntryPanelView
});
