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

import { t, useT } from '../../core/i18n';
import { EntryDeskPanel } from '../../forms/officeLazy';
import {
  columnsOf, PANEL_SECTION_LABEL, PANEL_SECTIONS, pickRows, readSections, stepKindsOf,
  type DeskRow, type PanelSection
} from '../../forms/entryDesk';
import {
  EntryFilterBar, entryHref, herePath, OfficeGate, useEntryDesk, useEntryQuery, useEntrySubject, useOfficeRing
} from '../../forms/entrySubject';
import { text, type EditorProps, type PartContext, type RawConfig } from '../part';
import { field, texts, textPart, withTexts } from './partTexts';
import { bookingTagClass, bookingTags, progressOf } from '../../steps/steps';

/* -- Woran ein Mensch ist, kurz ----------------------------------------------------- */

function RowTags({ row }: { row: DeskRow }) {
  const t = useT();
  const progress = progressOf(row.states);
  return (
    <span className="wk-tags">
      {row.s.hidden && <span className="wk-tag">{t('moduleData.entryList.hidden')}</span>}
      {row.s.withdrawnAt !== null && <span className="wk-tag">{t('moduleData.entryList.withdrawn')}</span>}
      {row.s.confirmedAt !== null && <span className="wk-tag wk-tag-open">{t('moduleData.entryList.confirmed')}</span>}
      {progress.total > 0 && (
        <span className={progress.done === progress.total ? 'wk-tag wk-tag-open' : 'wk-tag'}
          title={row.states.filter((st) => st.status !== 'done').map((st) => st.label).join(', ') || t('moduleData.entryList.allDone')}>
          {progress.done}/{progress.total}{progress.overdue > 0 ? t('moduleData.entryList.overdue') : ''}
        </span>
      )}
      {bookingTags(row.states).map((tag) => (
        <span key={tag.key} className={bookingTagClass(tag)} title={tag.title} data-booking-tag={tag.state}>{tag.text}</span>
      ))}
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


function EntryListView({ config, ctx }: { config: ListConfig; ctx: PartContext }) {
  const t = useT();
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

  const head = <h2 className="wk-card-title">{config.title === '' ? t('moduleData.entryList.label') : config.title}</h2>;
  if (config.form === '') return <>{head}<p className="wk-card-muted">{t('moduleData.entryList.noForm')}</p></>;

  const gate = OfficeGate({ who, ring, retry, desk, failed, what: t('moduleData.entryList.gateWhat') });
  if (gate !== null) return <>{head}{gate}</>;

  const columns = columnsOf(desk!, config.columns);
  const page = config.page.replace(/^#?\/*/, '');
  const from = herePath();
  const wide = ctx.whole === true || ctx.size.width === 'wide' || ctx.size.width === 'full';
  const link = (row: DeskRow) => (page === '' ? null : entryHref(page, row.s.registrationId, query.filter, from, config.form));
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
        {shown.length === all!.length ? t('common.persons', { count: shown.length }) : t('moduleDataCogita.v.xOfY', { x: shown.length, y: all!.length })}
        {page === '' && t('moduleData.entryList.pickPage')}
      </p>

      {all!.length === 0 ? (
        <p className="wk-card-muted">{t('moduleData.entryList.empty')}</p>
      ) : shown.length === 0 ? (
        <p className="wk-card-muted">{t('moduleData.entryList.noMatch')}</p>
      ) : wide ? (
        /* Breit: eine Tabelle — Name, Nummern, die gewählten Antworten, woran er ist. */
        <div className="wk-entry-table-wrap">
          <table className="wk-entry-table">
            <thead>
              <tr>
                <th scope="col">{t('moduleData.entryList.person')}</th>
                <th scope="col">{t('moduleData.entryList.phone')}</th>
                {columns.map((c) => (
                  <th key={c.id} scope="col" data-column-from={c.from ?? ''}>
                    {c.label}{c.from !== null && <span className="wk-th-from">{c.from}</span>}
                  </th>
                ))}
                <th scope="col">{t('moduleData.entryList.progress')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.s.registrationId} ref={mark(row)}
                  className={[row.s.registrationId === query.id ? 'is-here' : '', row.s.hidden || row.s.withdrawnAt !== null ? 'is-muted' : ''].join(' ').trim() || undefined}>
                  <th scope="row">{name(row)}</th>
                  <td>{row.phones.map((p) => <a key={p.dial} className="wk-entry-phone" href={`tel:${p.dial}`}>{p.shown}</a>)}</td>
                  {columns.map((c) => {
                    const value = c.value(row);
                    return <td key={c.id} title={value.length > 40 ? value : undefined}>{value}</td>;
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

export const entryListPart = textPart<ListConfig>(texts({ label: 'moduleData.entryList.label', use: 'moduleData.entryList.use' }), {
  kind: 'entry-list',
  box: { colSpan: 6, rowSpan: 5 },

  example: withTexts({ form: '0190a0a0-0000-7000-8000-0000000000aa', page: 'parafia/bierzmowanie/kandydat', columns: '*' }, texts({ title: 'moduleData.entryList.exTitle' })),
  fields: [
    field({ key: 'title', kind: 'line' }, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleData.entryList.titleHint' })),
    field({ key: 'form', kind: 'form' }, texts({ label: 'moduleData.form.label' })),
    field({ key: 'page', kind: 'page' }, texts({ label: 'moduleData.entryList.page', hint: 'moduleData.entryList.pageHint' })),
    field({ key: 'columns', kind: 'questions', of: 'form', subforms: true }, texts({ label: 'moduleData.entryList.columns' }))
  ],

  read: (raw: RawConfig): ListConfig => ({
    title: text(raw, 'title'),
    form: text(raw, 'form'),
    page: text(raw, 'page'),
    columns: text(raw, 'columns')
  }),
  hasContent: () => true,
  missing: (config) => (config.form === '' ? t('moduleData.entryList.missingForm')
    : config.page === '' ? t('moduleData.entryList.missingPage') : null),

  strip: texts({ title: 'moduleData.entryList.label', open: 'moduleData.entryList.open' }),
  fullscreen: true,
  shows: (_config, size) => size.width === 'wide' || size.width === 'full'
    ? t('moduleData.entryList.showsWide')
    : t('moduleData.entryList.showsBlock'),

  View: EntryListView
});

/* -- Panel osoby ---------------------------------------------------------------------- */

interface PanelConfig {
  readonly title: string;
  readonly sections: readonly PanelSection[];
}

function EntryPanelView({ config, ctx }: { config: PanelConfig; ctx: PartContext }) {
  const t = useT();
  const e = useEntrySubject();
  const chosen = e?.chosen ?? null;
  const head = (name: string | null) => <h2 className="wk-card-title">{config.title !== '' ? config.title : name ?? t('moduleData.entryPanel.label')}</h2>;

  if (e === null) {
    return <>{head(null)}<p className="wk-card-muted">{t('moduleData.entryPanel.noSubject')}</p></>;
  }

  /* Warum nichts dasteht, sagt die Leiste oben; hier nur ein Satz. */
  if (e.desk === null || e.ring == null) return <>{head(null)}<p className="wk-card-muted">{t('moduleData.entryPanel.later')}</p></>;
  if (chosen === null) {
    return <>{head(null)}<p className="wk-card-muted">{e.desk.rows.length === 0 ? t('moduleData.entryPanel.empty') : t('moduleDataSeat.office.pick')}</p></>;
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
  const t = useT();
  const sections = readSections(raw.sections ?? '');
  const toggle = (one: PanelSection, on: boolean) => {
    const next = PANEL_SECTIONS.filter((s) => (s === one ? on : sections.includes(s)));
    onSet({ sections: next.length === PANEL_SECTIONS.length ? '' : next.join(',') });
  };

  return (
    <>
      <label className="wk-field">
        <span>{t('moduleDataCogita.f.heading')}</span>
        <input value={raw.title ?? ''} disabled={busy} placeholder={t('moduleData.entryPanel.titlePh')} onChange={(e) => onSet({ title: e.target.value })} />
      </label>
      <div className="wk-field">
        <span>{t('moduleDataCogita.f.whatShows')}</span>
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
          {t('moduleData.entryPanel.hint')}
        </span>
      </div>
    </>
  );
}

export const entryPanelPart = textPart<PanelConfig>(texts({ label: 'moduleData.entryPanel.label', use: 'moduleData.entryPanel.use' }), {
  kind: 'entry-panel',
  box: { colSpan: 6, rowSpan: 5 },

  example: withTexts({ sections: 'steps,extensions' }, texts({ title: 'moduleData.entryPanel.exTitle' })),
  fields: [],
  extra: [
    withTexts({ key: 'title', shape: 'line' } as const, texts({ says: 'moduleData.entryPanel.sTitle' })),
    { key: 'sections', shape: 'line', get says() { return t('moduleData.entryPanel.sSections', { list: PANEL_SECTIONS.map((one) => `"${one}" (${PANEL_SECTION_LABEL[one]})`).join(', ') }); } }
  ],
  Editor: PanelSetup,

  read: (raw: RawConfig): PanelConfig => ({ title: text(raw, 'title'), sections: readSections(text(raw, 'sections')) }),
  hasContent: () => true,

  fullscreen: true,
  shows: (config, size) => size.height === 'strip'
    ? t('moduleData.entryPanel.showsStrip')
    : t('moduleData.entryPanel.showsBlock', { list: config.sections.map((one) => PANEL_SECTION_LABEL[one].toLowerCase()).join(', ') }),

  View: EntryPanelView
});
