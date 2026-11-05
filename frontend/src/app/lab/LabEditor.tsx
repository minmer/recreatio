/**
 * 2026-10-18 — DER EDITOR DES LABORS (Fizyka): Titel, Text für die
 * Schüler, Art (Piaskownica oder Doświadczenie) und die Szene als JSON —
 * dazu fertige Versuche zum Einsetzen, ein Polecenie dla AI zum Kopieren
 * (die KI arbeitet im eigenen Chat, nicht in der App) und die Vorschau des
 * Labors selbst. Übernommen wird erst mit „Przyjmij”.
 *
 * Wahlweise (Laboratorium 2D, B): Auswahlfelder des Bausteins (wie das Labor
 * beim Öffnen startet, wie lange ein Nachweis wird) und eine Liste weiterer
 * Szenariusze, zwischen denen die Schüler im Labor wählen.
 */

import { useEffect, useMemo, useState, type ComponentType } from 'react';

import { useT } from '../core/i18n';
import type { EditorProps } from '../pages/part';

export interface LabPreset {
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly text: readonly string[];
  readonly scene: Readonly<Record<string, unknown>>;
}

/** Ein Auswahlfeld des Bausteins: Schlüssel in der Tafel, Beschriftung, die Werte (der erste gilt, wenn nichts dasteht). */
export interface LabChoice {
  readonly key: string;
  readonly label: string;
  readonly choices: readonly { readonly value: string; readonly label: string }[];
}

/** Ein Szenariusz in der Liste (gespeichert als JSON unter `scenarios`). */
interface Scenario {
  readonly title: string;
  readonly text: readonly string[];
  readonly scene: unknown;
}

function readScenarios(raw: string | undefined): Scenario[] {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    if (!Array.isArray(v)) return [];
    return v.flatMap((x): Scenario[] => {
      if (x === null || typeof x !== 'object') return [];
      const o = x as Record<string, unknown>;
      if (o.scene === null || typeof o.scene !== 'object') return [];
      const text = Array.isArray(o.text) ? o.text.filter((x): x is string => typeof x === 'string') : typeof o.text === 'string' ? o.text.split('\n') : [];
      return [{ title: typeof o.title === 'string' ? o.title : '', text, scene: o.scene }];
    });
  } catch { return []; }
}

export function LabEditor({ raw, onSet, busy, presets, sandbox, prompt, Preview, what, choices, scenarios }: EditorProps & {
  /** Die fertigen Versuche — erst geladen, wenn der Editor offen ist. */
  presets: () => Promise<readonly LabPreset[]>;
  /** Die Szene einer leeren Piaskownica. */
  sandbox: Readonly<Record<string, unknown>>;
  /** Das Polecenie dla AI (lädt, wenn gebraucht). */
  prompt: () => Promise<string>;
  /** Die Vorschau (das Labor selbst, später geladen). */
  Preview: ComponentType<{ title: string; text: readonly string[]; mode: 'sandbox' | 'experiment'; scene: unknown }>;
  /** „laboratorium fizyki”. */
  what: string;
  /** Weitere Auswahlfelder des Bausteins (Laboratorium 2D: Start, Länge eines Nachweises). */
  choices?: readonly LabChoice[];
  /** Eine Liste weiterer Szenariusze anbieten (Laboratorium 2D). */
  scenarios?: boolean;
}) {
  const t = useT();
  const [title, setTitle] = useState(raw.title ?? '');
  const [text, setText] = useState(raw.text ?? '');
  const [mode, setMode] = useState<'sandbox' | 'experiment'>(raw.mode === 'sandbox' ? 'sandbox' : 'experiment');
  const [scene, setScene] = useState(() => {
    try { return JSON.stringify(raw.scene === undefined || raw.scene.trim() === '' ? sandbox : JSON.parse(raw.scene) as unknown, null, 2); } catch { return raw.scene ?? ''; }
  });
  const [extra, setExtra] = useState<Record<string, string>>(() => Object.fromEntries((choices ?? []).map((c) => {
    const v = raw[c.key];
    return [c.key, v !== undefined && c.choices.some((x) => x.value === v) ? v : c.choices[0]?.value ?? ''];
  })));
  const [picked, setPicked] = useState<Scenario[]>(() => readScenarios(raw.scenarios));
  const [said, setSaid] = useState<string | null>(null);
  const [list, setList] = useState<readonly LabPreset[]>([]);
  useEffect(() => { let alive = true; void presets().then((p) => { if (alive) setList(p); }); return () => { alive = false; }; }, [presets]);
  const draft = useMemo(() => {
    try {
      const value = JSON.parse(scene) as unknown;
      return typeof value === 'object' && value !== null && !Array.isArray(value) ? { value } : { error: t('lab.editor.sceneOneObject') };
    } catch (e) {
      return { error: t('lab.editor.notJson', { error: e instanceof Error ? e.message : '' }) };
    }
  }, [scene, t]);

  const apply = () => {
    if (!('value' in draft)) { setSaid(draft.error ?? null); return; }
    onSet({
      title: title.trim(), text, mode, scene: JSON.stringify(draft.value), ...extra,
      ...(scenarios === true ? { scenarios: picked.length > 0 ? JSON.stringify(picked) : '' } : {})
    });
    setSaid(t('lab.editor.accepted'));
  };

  const move = (k: number, by: number): void => {
    const next = [...picked];
    const [one] = next.splice(k, 1);
    next.splice(Math.max(0, Math.min(next.length, k + by)), 0, one);
    setPicked(next);
  };

  return (
    <div className="an-edit">
      <label className="se-inline">
        <span>{t('lab.editor.title')}</span>
        <input value={title} disabled={busy} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="se-inline">
        <span>{t('lab.editor.kind')}</span>
        <select value={mode} disabled={busy} onChange={(e) => setMode(e.target.value === 'sandbox' ? 'sandbox' : 'experiment')}>
          <option value="experiment">{t('lab.editor.kindExperiment')}</option>
          <option value="sandbox">{t('lab.editor.kindSandbox')}</option>
        </select>
      </label>
      {(choices ?? []).map((c) => (
        <label key={c.key} className="se-inline">
          <span>{c.label}</span>
          <select value={extra[c.key] ?? ''} disabled={busy} onChange={(e) => setExtra({ ...extra, [c.key]: e.target.value })}>
            {c.choices.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
      ))}
      <label className="se-stack">
        <span>{t('lab.editor.studentText')}</span>
        <textarea rows={3} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="wk-actions">
        <select aria-label={t('lab.editor.insertLabel')} value="" disabled={busy}
          onChange={(e) => {
            const p = list.find((x) => x.key === e.target.value);
            if (p === undefined) return;
            setScene(JSON.stringify(p.scene, null, 2));
            setTitle(p.title);
            setText(p.text.join('\n'));
            setMode('experiment');
            setSaid(t('lab.editor.inserted', { title: p.title }));
          }}>
          <option value="">{t('lab.editor.insertPlaceholder')}</option>
          {list.map((p) => <option key={p.key} value={p.key}>{t('lab.editor.presetOption', { title: p.title, summary: p.summary })}</option>)}
        </select>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => {
          void prompt().then((text) => navigator.clipboard.writeText(text)).then(() => setSaid(t('lab.editor.copied'))).catch(() => setSaid(t('lab.editor.copyFailed')));
        }}>{t('lab.editor.copyPrompt')}</button>
      </div>
      <textarea className="an-edit-json" rows={14} value={scene} spellCheck={false} disabled={busy} aria-label={t('lab.editor.sceneJson', { what })} onChange={(e) => setScene(e.target.value)} />
      {'error' in draft && <p className="wk-error">{draft.error}</p>}
      {scenarios === true && (
        <div className="se-stack">
          <span>{t('lab.editor.scenarios')}</span>
          {picked.length === 0 && <p className="wk-card-muted">{t('lab.editor.noScenarios')}</p>}
          {picked.map((p, k) => (
            <div key={k} className="wk-actions">
              <span>{t('lab.editor.scenarioRow', { n: k + 2, title: p.title || t('lab.editor.untitled') })}</span>
              <button type="button" className="wk-link-btn" disabled={busy || k === 0} onClick={() => move(k, -1)} aria-label={t('lab.editor.moveUp', { title: p.title })}>↑</button>
              <button type="button" className="wk-link-btn" disabled={busy || k === picked.length - 1} onClick={() => move(k, 1)} aria-label={t('lab.editor.moveDown', { title: p.title })}>↓</button>
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setPicked(picked.filter((_x, j) => j !== k))}>{t('lab.editor.remove')}</button>
            </div>
          ))}
          <div className="wk-actions">
            <select aria-label={t('lab.editor.addPresetLabel')} value="" disabled={busy}
              onChange={(e) => {
                const p = list.find((x) => x.key === e.target.value);
                if (p !== undefined) setPicked([...picked, { title: p.title, text: p.text, scene: p.scene }]);
              }}>
              <option value="">{t('lab.editor.addPresetPlaceholder')}</option>
              {list.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
            </select>
            <button type="button" className="wk-link-btn" disabled={busy || !('value' in draft)} onClick={() => {
              if ('value' in draft) setPicked([...picked, { title: title.trim(), text: text.split('\n').map((x) => x.trim()).filter((x) => x !== ''), scene: draft.value }]);
            }}>{t('lab.editor.addCurrent')}</button>
          </div>
        </div>
      )}
      {'value' in draft && (
        <div className="an-preview" aria-label={t('lab.editor.preview')}>
          <Preview title={title} text={text.split('\n').map((x) => x.trim()).filter((x) => x !== '')} mode={mode} scene={draft.value} />
        </div>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || !('value' in draft)} onClick={apply}>{t('lab.editor.accept')}</button>
        {said !== null && <span className="wk-card-muted" role="status">{said}</span>}
      </div>
    </div>
  );
}
