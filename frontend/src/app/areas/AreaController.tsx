/**
 * ADMINISTRATOR DANYCH — EINE STELLE (2026-10-17).
 *
 * Er stand je Formular: jedes neue Formular fragte nach derselben Pfarrei, und
 * wer die Anschrift änderte, musste jedes Formular einzeln anfassen. Jetzt
 * steht er beim Obszar, und ein Obszar ohne eigenen erbt den des nächsten
 * darüber (die Gruppe den der Pfarrei) — dieselbe Kette, nach der der Dienst
 * die Klausel eines Formulars findet (`Form.WholeAsync`). Ein Formular zeigt
 * nur noch, welcher für es gilt, und führt hierher. Ist die ganze Kette leer,
 * nimmt das Formular nichts an.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadAreaController, setController, type AreaController } from '../forms/intake';
import { PostalInput } from '../registry/PostalInput';
import { viewPath } from '../routes';
import { WorkspaceError } from '../core/session';
import { toast } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { areasNow, invalidate } from '../workspace/viewData';

type Shown = { readonly controller: AreaController | null } | 'failed' | undefined;

/** Was für einen Bereich gilt. `undefined`: lädt; `'failed'`: nicht zu lesen. */
export function useAreaController(areaId: string | null): { shown: Shown; reload: () => void } {
  const [shown, setShown] = useState<Shown>(undefined);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (areaId === null) { setShown('failed'); return undefined; }
    let alive = true;
    setShown(undefined);
    void loadAreaController(areaId).then(
      (found) => { if (alive) setShown({ controller: found.controller }); },
      () => { if (alive) setShown('failed'); });
    return () => { alive = false; };
  }, [areaId, round]);

  return { shown, reload: useCallback(() => setRound((n) => n + 1), []) };
}

/** Die Namen der Bereiche, die ich sehe — für „aus dem Obszar …". */
function useAreaNames(): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    void areasNow().then((list) => { if (alive) setNames(new Map(list.map((a) => [a.areaId, a.name]))); }, () => undefined);
    return () => { alive = false; };
  }, []);
  return names;
}

export const controllerLine = (c: { name: string; address: string | null; email: string | null }) => (
  <>
    <strong>{c.name}</strong>
    {c.address !== null && `, ${c.address}`}
    {c.email !== null && ` (${c.email})`}
  </>
);

/** Die Einstellung im Obszar (Ustawienia): sein eigener Eintrag, oder der geerbte mit dem Weg dorthin. */
export function AreaControllerSettings({ areaId, editable }: { areaId: string; editable: boolean }) {
  const { shown, reload } = useAreaController(areaId);
  const names = useAreaNames();
  const [editing, setEditing] = useState(false);

  if (shown === undefined) return <Loading lines={2} />;
  if (shown === 'failed') return <p className="wk-error">Nie udało się wczytać administratora danych.</p>;

  const c = shown.controller;
  const own = c !== null && c.fromAreaId === areaId;

  const save = async (next: { name: string; address: string; email: string }) => {
    await setController(areaId, next);
    invalidate();
    toast('Zapisano administratora danych.', { kind: 'ok' });
    setEditing(false);
    reload();
  };

  return (
    <div className="wk-controller" data-area-controller={own ? 'own' : c === null ? 'none' : 'inherited'}>
      {c !== null && !own && !editing && (
        <div className="wk-controller-now">
          <p className="wk-controller-line">{controllerLine(c)}</p>
          <p className="wk-hint">
            Z obszaru <a href={viewPath('areas', c.fromAreaId, 'ustawienia')}>{names.get(c.fromAreaId) ?? 'nadrzędnego'}</a> — obowiązuje też tutaj.
          </p>
          {editable && (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={() => setEditing(true)}>
              Ustaw osobnego dla tego obszaru
            </button>
          )}
        </div>
      )}

      {(own || c === null || editing) && (editable
        ? <ControllerFields value={own ? c : null} onSave={save} onCancel={editing ? () => setEditing(false) : undefined} />
        : c === null
          ? <p className="wk-note">Nikt nie jest wpisany — formularze tego obszaru nie przyjmą zgłoszeń. Wpisuje go ten, kto prowadzi obszar.</p>
          : <p className="wk-controller-line">{controllerLine(c)}</p>)}
    </div>
  );
}

/** Nazwa, adres, e-mail — z jednym „Zapisz", gdy coś się zmieniło. */
export function ControllerFields({ value, onSave, onCancel }: {
  value: { name: string; address: string | null; email: string | null } | null;
  onSave: (next: { name: string; address: string; email: string }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(value?.name ?? '');
  const [address, setAddress] = useState(value?.address ?? '');
  const [email, setEmail] = useState(value?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    setName(value?.name ?? '');
    setAddress(value?.address ?? '');
    setEmail(value?.email ?? '');
  }, [value?.name, value?.address, value?.email]);

  const changed = name.trim() !== (value?.name ?? '')
    || address.trim() !== (value?.address ?? '')
    || email.trim() !== (value?.email ?? '');

  const go = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await onSave({ name: name.trim(), address: address.trim(), email: email.trim() });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-form wk-controller-form">
      <label className="wk-field">
        <span>Nazwa</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Parafia św. Kazimierza" />
      </label>

      {/* 0082 — auch die Adresse des Verantwortlichen in der einen Form der Datenbank. */}
      <div className="wk-field">
        <span>Adres</span>
        <PostalInput value={address} onChange={setAddress} />
      </div>

      <label className="wk-field">
        <span>E-mail (opcjonalnie)</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}

      {(changed || onCancel !== undefined) && (
        <div className="wk-actions">
          {changed && (
            <button type="button" className="wk-btn" disabled={busy || name.trim() === ''} onClick={() => void go()}>
              {busy ? 'Zapisywanie…' : 'Zapisz'}
            </button>
          )}
          {onCancel !== undefined && <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onCancel}>Anuluj</button>}
        </div>
      )}
    </div>
  );
}

/** Im Formular: welcher Administrator für es gilt und wo man ihn ändert. */
export function FormControllerNote({ areaId }: { areaId: string | null }) {
  const { shown } = useAreaController(areaId);
  const names = useAreaNames();

  if (areaId === null) return <p className="wk-note wk-controller-missing">Formularz bez obszaru nie przyjmuje zgłoszeń.</p>;
  if (shown === undefined) return <Loading lines={1} />;
  if (shown === 'failed') return <p className="wk-error">Nie udało się wczytać administratora danych.</p>;

  const c = shown.controller;
  const settings = viewPath('areas', c?.fromAreaId ?? areaId, 'ustawienia');

  return (
    <section className="wk-form wk-controller" data-form-controller={c !== null ? 'area' : 'none'}>
      <h4 className="wk-h2">Administrator danych</h4>

      {c !== null ? (
        <>
          <p className="wk-controller-line">{controllerLine(c)}</p>
          <p className="wk-hint">
            Ustawiany w obszarze <a href={settings}>{names.get(c.fromAreaId) ?? 'tego formularza'}</a> — ten sam dla wszystkich jego formularzy.
          </p>
        </>
      ) : (
        <p className="wk-note wk-controller-missing">
          Formularz nie przyjmie zgłoszeń, dopóki obszar nie ma administratora danych.{' '}
          <a href={settings}>Wpisz go w ustawieniach obszaru</a>.
        </p>
      )}
    </section>
  );
}
