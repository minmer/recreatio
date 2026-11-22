/**
 * 2026-11-22 (Homer-Einheit) — EINE LEKTÜRE-FRAGE SCHREIBEN (`QuestionFields`): das Werk (nur Werke, deren Text die Baza
 * über ihre Quellen erreicht) und die Stelle; dann je Art die richtigen Zeilen, die Rollen und ihre Zeilen, die Bereiche —
 * und die Fehler-Tags je Zeilenbereich. Darunter der Abschnitt mit seinen Nummern, damit man die Zeilen nicht zählen muss.
 */

import { useContext, useMemo } from 'react';

import { useT } from '../../core/i18n';
import { workTitle } from '../../library/libraryKinds';
import { readManifest, TEXT_KIND } from '../../library/sourceText';
import { CogitaContext } from '../ui';
import { readPassage, type ReadingForm } from './readingSpec';
import { usePassage } from './PassageLines';
import './reading.css';

type Put = (key: string, value: unknown) => void;

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const textOf = (v: unknown): string => (Array.isArray(v) ? v.map((x) => (typeof x === 'object' && x !== null ? `${str((x as { lines?: unknown }).lines)}: ${str((x as { role?: unknown; tag?: unknown }).role ?? (x as { tag?: unknown }).tag)}` : str(x))).join('\n') : str(v));
const linesOfText = (text: string): string[] => text.split('\n');

/** Die Werke mit Text, die diese Baza (mit ihren Quellen) erreicht — sortiert nach Titel. */
function useWorksWithText(): { id: string; title: string }[] {
  const ctx = useContext(CogitaContext);
  const look = ctx?.lib.markupLook;
  return useMemo(() => {
    if (look === undefined) return [];
    const ids = new Set<string>();
    for (const e of look.readable?.() ?? []) if (e.kind === TEXT_KIND) { const w = readManifest(e.data).work; if (w !== '') ids.add(w); }
    return [...ids].map((id) => ({ id, title: (() => { const w = look.get(id); return w === undefined ? id : workTitle(w.data) || id; })() }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [look, look?.revision]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function ReadingFields({ form, data, writes, onSet }: { form: ReadingForm; data: Readonly<Record<string, unknown>>; writes: boolean; onSet: Put }) {
  const t = useT();
  const works = useWorksWithText();
  const passage = readPassage(data.passage);
  const work = passage?.work ?? '';
  const locator = passage?.locator ?? '';
  const setPassage = (next: { work?: string; locator?: string }) => onSet('passage', { work: next.work ?? work, locator: next.locator ?? locator });
  const known = works.some((w) => w.id === work);
  return (
    <div className="cg-qmore cg-read-edit" data-read-edit={form}>
      <label className="wk-field"><span>{t('cogitaReading.edit.work')}</span>
        <select value={known ? work : work === '' ? '' : '~'} disabled={!writes} data-read-work="" onChange={(e) => { if (e.target.value !== '~') setPassage({ work: e.target.value }); }}>
          <option value="">{t('cogitaReading.edit.pickWork')}</option>
          {!known && work !== '' && <option value="~">{work}</option>}
          {works.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
        </select>
      </label>
      {works.length === 0 && <p className="cg-muted">{t('cogitaReading.edit.noWorks')}</p>}
      <label className="wk-field"><span>{t('cogitaReading.edit.locator')}</span>
        <input value={locator} disabled={!writes} placeholder={t('cogitaReading.edit.locatorPh')} data-read-locator="" onChange={(e) => setPassage({ locator: e.target.value })} />
      </label>
      {form === 'lines' && (
        <label className="wk-field"><span>{t('cogitaReading.edit.lines')}</span>
          <input value={str(data.lines)} disabled={!writes} placeholder="3-5, 9" data-read-right="" onChange={(e) => onSet('lines', e.target.value)} />
        </label>
      )}
      {form === 'label' && (
        <>
          <label className="wk-field"><span>{t('cogitaReading.edit.roles')}</span>
            <textarea rows={3} value={textOf(data.roles)} disabled={!writes} placeholder={t('cogitaReading.edit.rolesPh')} onChange={(e) => onSet('roles', linesOfText(e.target.value))} />
          </label>
          <label className="wk-field"><span>{t('cogitaReading.edit.labels')}</span>
            <textarea rows={4} value={textOf(data.labels)} disabled={!writes} placeholder={t('cogitaReading.edit.labelsPh')} onChange={(e) => onSet('labels', linesOfText(e.target.value))} />
          </label>
        </>
      )}
      {form === 'span' && (
        <label className="wk-field"><span>{t('cogitaReading.edit.spans')}</span>
          <input value={str(data.spans)} disabled={!writes} placeholder="12-15; 30-31" onChange={(e) => onSet('spans', e.target.value)} />
        </label>
      )}
      <label className="wk-field"><span>{t('cogitaReading.edit.tags')}</span>
        <textarea rows={2} value={textOf(data.tags)} disabled={!writes} placeholder={t('cogitaReading.edit.tagsPh')} onChange={(e) => onSet('tags', linesOfText(e.target.value))} />
      </label>
      {passage !== null && <PassageNumbers work={passage.work} locator={passage.locator} />}
    </div>
  );
}

/** Der Abschnitt mit seinen Nummern — zum Abzählen beim Schreiben. */
function PassageNumbers({ work, locator }: { work: string; locator: string }) {
  const t = useT();
  const state = usePassage(useMemo(() => ({ work, locator }), [work, locator]));
  if (state.status === 'loading') return null;
  if (state.status === 'missing') return <p className="wk-warn" data-read-edit-missing="">{t('cogitaReading.edit.notFound')}</p>;
  return (
    <details className="cg-read-edit-lines" data-read-edit-lines={state.lines.length}>
      <summary>{t('cogitaReading.edit.showLines', { count: state.lines.length })}</summary>
      <ol className="cg-read-lines">
        {state.lines.map((text, i) => <li key={i} className="cg-read-line"><span className="cg-read-no">{i + 1}</span><span className="cg-read-text">{text}</span><span /></li>)}
      </ol>
    </details>
  );
}
