/**
 * 2026-10-18 — DER EDITOR DES LABORS (Fizyka): Titel, Text für die
 * Schüler, Art (Piaskownica oder Doświadczenie) und die Szene als JSON —
 * dazu fertige Versuche zum Einsetzen, ein Polecenie dla AI zum Kopieren
 * (die KI arbeitet im eigenen Chat, nicht in der App) und die Vorschau des
 * Labors selbst. Übernommen wird erst mit „Przyjmij”.
 */

import { useEffect, useMemo, useState, type ComponentType } from 'react';

import type { EditorProps } from '../pages/part';

export interface LabPreset {
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly text: readonly string[];
  readonly scene: Readonly<Record<string, unknown>>;
}

export function LabEditor({ raw, onSet, busy, presets, sandbox, prompt, Preview, what }: EditorProps & {
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
}) {
  const [title, setTitle] = useState(raw.title ?? '');
  const [text, setText] = useState(raw.text ?? '');
  const [mode, setMode] = useState<'sandbox' | 'experiment'>(raw.mode === 'sandbox' ? 'sandbox' : 'experiment');
  const [scene, setScene] = useState(() => {
    try { return JSON.stringify(raw.scene === undefined || raw.scene.trim() === '' ? sandbox : JSON.parse(raw.scene) as unknown, null, 2); } catch { return raw.scene ?? ''; }
  });
  const [said, setSaid] = useState<string | null>(null);
  const [list, setList] = useState<readonly LabPreset[]>([]);
  useEffect(() => { let alive = true; void presets().then((p) => { if (alive) setList(p); }); return () => { alive = false; }; }, [presets]);
  const draft = useMemo(() => {
    try {
      const value = JSON.parse(scene) as unknown;
      return typeof value === 'object' && value !== null && !Array.isArray(value) ? { value } : { error: 'Scena to jeden obiekt { … }.' };
    } catch (e) {
      return { error: `To nie jest poprawny JSON: ${e instanceof Error ? e.message : ''}` };
    }
  }, [scene]);

  const apply = () => {
    if (!('value' in draft)) { setSaid(draft.error ?? null); return; }
    onSet({ title: title.trim(), text, mode, scene: JSON.stringify(draft.value) });
    setSaid('Przyjęto.');
  };

  return (
    <div className="an-edit">
      <label className="se-inline">
        <span>Tytuł</span>
        <input value={title} disabled={busy} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="se-inline">
        <span>Rodzaj</span>
        <select value={mode} disabled={busy} onChange={(e) => setMode(e.target.value === 'sandbox' ? 'sandbox' : 'experiment')}>
          <option value="experiment">Doświadczenie (scena jak w JSON)</option>
          <option value="sandbox">Piaskownica (wszystko wolno, gotowe doświadczenia do wczytania)</option>
        </select>
      </label>
      <label className="se-stack">
        <span>Tekst dla uczniów (każdy akapit w nowym wierszu)</span>
        <textarea rows={3} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="wk-actions">
        <select aria-label="Wstaw doświadczenie" value="" disabled={busy}
          onChange={(e) => {
            const p = list.find((x) => x.key === e.target.value);
            if (p === undefined) return;
            setScene(JSON.stringify(p.scene, null, 2));
            setTitle(p.title);
            setText(p.text.join('\n'));
            setMode('experiment');
            setSaid(`Wstawiono „${p.title}” — sprawdź podgląd i przyjmij.`);
          }}>
          <option value="">Wstaw doświadczenie…</option>
          {list.map((p) => <option key={p.key} value={p.key}>{p.title} — {p.summary}</option>)}
        </select>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => {
          void prompt().then((t) => navigator.clipboard.writeText(t)).then(() => setSaid('Polecenie dla AI skopiowane — wklej je w swoim czacie, a gotową scenę tutaj.')).catch(() => setSaid('Nie udało się skopiować polecenia.'));
        }}>Kopiuj polecenie dla AI</button>
      </div>
      <textarea className="an-edit-json" rows={14} value={scene} spellCheck={false} disabled={busy} aria-label={`Scena (${what}) JSON`} onChange={(e) => setScene(e.target.value)} />
      {'error' in draft && <p className="wk-error">{draft.error}</p>}
      {'value' in draft && (
        <div className="an-preview" aria-label="Podgląd">
          <Preview title={title} text={text.split('\n').map((t) => t.trim()).filter((t) => t !== '')} mode={mode} scene={draft.value} />
        </div>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || !('value' in draft)} onClick={apply}>Przyjmij</button>
        {said !== null && <span className="wk-card-muted" role="status">{said}</span>}
      </div>
    </div>
  );
}
