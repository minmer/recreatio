/**
 * DER DRUCK (2026-11-15) — ein Weg (eine Ausgabe), das ganze Werk oder ein Teil davon, als LaTeX, das dem Baum
 * folgt: Ebenen → \part / \chapter / \section …, Glossar, Register, Quellen, Verweise über feste Marken. Entwurf:
 * Zweck und Rolle sichtbar, Ungeschriebenes als Platzhalter, Befunde am Rand; Endfassung: sauber.
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import { saveBlob } from '../../core/platform';
import { useRemembered } from '../../core/prefs';
import { toast } from '../../ui/dialogs';
import { latexFileName } from '../latex';
import { allNodes } from './workModel';
import { workLatexReady, workToLatex, type WorkLatexOptions } from './workLatex';
import { pathKeyOf, PathPick, type WorkCtx } from './WorkView';

export function WorkPrint({ ctx }: { ctx: WorkCtx }) {
  const t = useT();
  const { model } = ctx.work;
  const [node, setNode] = useState('');
  const [mode, setMode] = useState<'draft' | 'final'>('final');
  const [table, setTable] = useState(false);
  const [author, setAuthor] = useRemembered('library.latex.author', '');
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const options = (): WorkLatexOptions => ({
    path: pathKeyOf(ctx), mode, dimensionTable: table, ...(node === '' ? {} : { node }), ...(author.trim() === '' ? {} : { author: author.trim() })
  });
  const source = async (): Promise<string> => {
    await workLatexReady(ctx.project);
    return workToLatex(ctx.project, ctx.store, ctx.work.knowledge, options());
  };
  const act = (todo: (tex: string) => void | Promise<void>) => void (async () => {
    setBusy(true);
    try { await todo(await source()); } catch (e) { toast(e instanceof Error ? e.message : t('workUi.print.failed'), { kind: 'error' }); } finally { setBusy(false); }
  })();
  const suffix = `${pathKeyOf(ctx) === '' ? '' : `-${pathKeyOf(ctx)}`}${mode === 'draft' ? '-draft' : ''}`; // i18n-ignore — Dateiname

  return (
    <div className="work-print">
      <p className="lib-meta">{t('workUi.print.lead')}</p>
      <div className="lib-fields">
        <PathPick ctx={ctx} all={false} />
        <label className="wk-field">
          <span>{t('workUi.print.scope')}</span>
          <select value={node} onChange={(e) => setNode(e.target.value)}>
            <option value="">{t('workUi.print.whole')}</option>
            {allNodes(model).map((n) => <option key={n.id} value={n.id}>{'· '.repeat(n.depth)}{n.title || t('work.untitled')}</option>)}
          </select>
        </label>
        <label className="wk-field">
          <span>{t('workUi.print.mode')}</span>
          <select value={mode} onChange={(e) => setMode(e.target.value === 'draft' ? 'draft' : 'final')}>
            <option value="final">{t('workUi.print.final')}</option>
            <option value="draft">{t('workUi.print.draft')}</option>
          </select>
        </label>
        <label className="wk-field">
          <span>{t('scriptorium.boxes.author')}</span>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t('scriptorium.boxes.authorPlaceholder')} />
        </label>
      </div>
      {model.dimensions.length > 0 && (
        <label className="pe-check"><input type="checkbox" checked={table} onChange={(e) => setTable(e.target.checked)} /><span>{t('workUi.print.table')}</span></label>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy} onClick={() => act(async (tex) => { await saveBlob(new Blob([tex], { type: 'application/x-tex' }), latexFileName(ctx.project, suffix)); })}>{t('scriptorium.boxes.download')}</button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => (shown === null ? act((tex) => setShown(tex)) : setShown(null))}>{shown === null ? t('common.preview') : t('scriptorium.boxes.hidePreview')}</button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => act(async (tex) => { await navigator.clipboard?.writeText(tex); toast(t('workUi.print.copied')); })}>{t('common.copy')}</button>
      </div>
      <p className="lib-meta">{t('workUi.print.compile')}</p>
      {shown !== null && <pre className="lib-latex">{shown}</pre>}
    </div>
  );
}
