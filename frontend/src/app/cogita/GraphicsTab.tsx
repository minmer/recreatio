/**
 * 2026-11-26 (Eigentümer: „dieselbe Grafik auf mehr als einer Folie") — NAUKA → WIĘCEJ → GRAFIKI: die Grafiken der Baza (Dokument
 * "graphic", `slideGraphics.ts`). Je Grafik: das Bild, wo sie gezeigt wird (Erzählung · Schritt), und für Schreibende ihr Name und
 * ihr JSON (dasselbe wie „Animacja"). Eine Folie nennt sie mit "drawing": "@name" — oder mit { "graphic": "@name", "add" … }.
 */

import { useMemo, useState } from 'react';

import { useT } from '../core/i18n';
import { ask } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { later } from '../ui/later';
import { drawingOfText } from './interactive';
import { readFlow } from './flow';
import { graphicLookup } from './SlideDrawing';
import { graphicRefOf } from './slideGraphics';
import { useBusy, useCtx } from './ui';
import './slideDrawing.css';

const Live = later(() => import('../pages/motion/LiveDrawing').then((m) => m.LiveDrawing));

const EXAMPLE = { size: [400, 240], alt: '', elements: [{ id: 'kern', type: 'circle', x: 200, y: 120, r: 30, fill: 'accent' }] };

export function GraphicsTab({ chosen, go }: { chosen: string | null; go: (...tail: string[]) => void }) {
  const t = useT();
  const { lib, writes } = useCtx();
  const list = lib.docs('graphic');
  /* Wo jede Grafik gezeigt wird: je Erzählung die Schritte, die sie nennen. */
  const uses = useMemo(() => {
    const look = graphicLookup(lib);
    const out = new Map<string, { flow: string; name: string; step: string }[]>();
    for (const e of lib.docs('flow')) {
      const f = readFlow(e.id, e.data);
      for (const n of f.graph.nodes) {
        const ref = graphicRefOf(n.config.drawing);
        const hit = ref === null ? null : look(ref);
        if (hit === null) continue;
        out.set(hit.id, [...(out.get(hit.id) ?? []), { flow: f.id, name: f.name, step: n.id }]);
      }
    }
    return out;
  }, [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const { busy, failed, run } = useBusy();
  const make = () => run(async () => {
    const made = await lib.saveDoc('graphic', { name: t('cogitaGraphics.newName'), drawing: EXAMPLE });
    go('grafiki', made.id);
  });

  return (
    <div className="cg" data-graphics={list.length}>
      <div className="cg-row-between">
        <p className="cg-muted">{t('cogitaGraphics.hint')}</p>
        {writes && <button type="button" className="wk-btn" disabled={busy} onClick={() => void make()} data-graphic-new=""><Icon name="plus" />{t('cogitaGraphics.add')}</button>}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {list.length === 0 && <p className="wk-empty">{t('cogitaGraphics.none')}</p>}
      <ul className="cg-graphics">
        {list.map((e) => (
          <GraphicRow key={e.id} id={e.id} data={e.data} open={chosen === e.id} uses={uses.get(e.id) ?? []} writes={writes}
            onOpen={() => go('grafiki', ...(chosen === e.id ? [] : [e.id]))} onFlow={(flow) => go('przebiegi', flow)} />
        ))}
      </ul>
    </div>
  );
}

function GraphicRow({ id, data, open, uses, writes, onOpen, onFlow }: {
  id: string; data: Readonly<Record<string, unknown>>; open: boolean; uses: readonly { flow: string; name: string; step: string }[]; writes: boolean;
  onOpen: () => void; onFlow: (flow: string) => void;
}) {
  const t = useT();
  const { lib } = useCtx();
  const name = String(data.name ?? '').trim() || t('cogitaGraphics.unnamed');
  const ref = typeof data._ref === 'string' && data._ref !== '' ? `@${data._ref}` : null;
  const [draft, setDraft] = useState(() => JSON.stringify(data.drawing ?? {}, null, 2));
  const [title, setTitle] = useState(name);
  const drawing = useMemo(() => drawingOfText(open ? draft : JSON.stringify(data.drawing ?? {})), [open, draft, data.drawing]);
  const { busy, failed, run } = useBusy();
  const save = () => run(async () => {
    let parsed: unknown;
    try { parsed = JSON.parse(draft); } catch { throw new Error(t('cogitaGraphics.badJson')); }
    await lib.saveDoc('graphic', { ...data, name: title.trim() || name, drawing: parsed }, id);
  });
  const remove = () => {
    void ask({ title: t('cogitaGraphics.removeAsk', { name }), body: uses.length > 0 ? t('cogitaGraphics.removeUsed', { count: uses.length }) : t('cogitaGraphics.removeSays'), confirm: t('common.delete'), danger: true })
      .then((yes) => { if (yes) void run(() => lib.remove(id)); });
  };
  return (
    <li className="cg-graphic" data-graphic={id} data-graphic-uses={uses.length}>
      <button type="button" className="lib-row" onClick={onOpen} aria-expanded={open}>
        <span className="lib-row-title">{name}{ref !== null && <code className="cg-muted"> {ref}</code>}</span>
        <span className="lib-row-meta">{uses.length === 0 ? t('cogitaGraphics.unused') : t('cogitaGraphics.usedOn', { count: uses.length })}</span>
      </button>
      <figure className="cg-graphic-view">
        {drawing === null ? <p className="wk-note">{t('cogitaGraphics.broken')}</p> : <Live drawing={drawing} identity={`graphic:${id}:${open ? 'draft' : 'saved'}`} />}
      </figure>
      {open && (
        <div className="cg" data-graphic-open={id}>
          {uses.length > 0 && (
            <p className="cg-muted">{t('cogitaGraphics.where')}{' '}
              {uses.map((u, i) => <span key={`${u.flow}:${u.step}`}>{i > 0 ? ', ' : ''}<button type="button" className="wk-link-btn" onClick={() => onFlow(u.flow)}>{u.name} · {u.step}</button></span>)}
            </p>
          )}
          <p className="cg-muted">{t('cogitaGraphics.howToUse', { ref: ref ?? id })}</p>
          {writes && (
            <>
              <label className="wk-field"><span>{t('common.name')}</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
              <label className="wk-field"><span>{t('cogitaGraphics.json')}</span>
                <textarea className="cg-graphic-json" rows={14} spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} data-graphic-json="" />
              </label>
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy} onClick={() => void save()} data-graphic-save="">{t('common.save')}</button>
                <button type="button" className="wk-link-btn wk-danger-link" disabled={busy} onClick={remove}>{t('common.delete')}</button>
              </div>
              {failed !== null && <p className="wk-error">{failed}</p>}
            </>
          )}
        </div>
      )}
    </li>
  );
}
