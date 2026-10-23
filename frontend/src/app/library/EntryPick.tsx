/**
 * VIELE WPISY NARAZ ZAZNACZYĆ I USUNĄĆ (2026-10-23) — w listach Biblioteki,
 * Skryptorium i w „Stare wpisy".
 *
 * Usuwa się tylko własne wpisy (z tej biblioteki), po pytaniu, które mówi, ile
 * innych wpisów się do nich odwołuje: te odwołania pokażą potem, że wpisu nie
 * ma. Usuwanie wpisów jest teraz ręcznym porządkiem właściciela — niczego nie
 * usuwa się samo.
 */

import { useEffect, useState } from 'react';

import { plural } from '../core/plural';
import { askText, toast } from '../ui/dialogs';
import { WorkspaceError } from '../core/session';
import type { LibraryStore } from './libraryStore';

/** Was jest zaznaczone — zostaje przez filtry i wyszukiwanie, aż się odznaczy (Esc też odznacza). */
export function usePicked(): {
  readonly picked: ReadonlySet<string>;
  readonly toggle: (id: string) => void;
  readonly set: (ids: ReadonlySet<string>) => void;
} {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (picked.size === 0) return undefined;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicked(new Set()); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [picked.size]);
  const toggle = (id: string) => setPicked((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return { picked, toggle, set: setPicked };
}

/** Pole wyboru przy wierszu listy. */
export function PickBox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <label className="lib-pick">
      <input type="checkbox" checked={checked} aria-label={`Zaznacz: ${label}`} onChange={onToggle} />
    </label>
  );
}

/** Pasek u dołu, gdy coś jest zaznaczone: zaznacz wszystkie, odznacz, usuń. */
export function PickBar({ store, picked, all, onPicked, writes }: {
  store: LibraryStore;
  picked: ReadonlySet<string>;
  /** Wszystko, co lista teraz pokazuje — „zaznacz wszystkie". */
  all: readonly string[];
  onPicked: (next: ReadonlySet<string>) => void;
  writes: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (picked.size === 0) return null;
  const own = [...picked].filter((id) => store.own(id) !== undefined);
  const foreign = picked.size - own.length;

  const remove = async () => {
    const gone = new Set(own);
    const pointing = new Set(own.flatMap((id) => store.backlinks(id).map((e) => e.id)).filter((id) => !gone.has(id)));
    const asked = [
      `Usunąć ${own.length} ${plural(own.length, 'wpis', 'wpisy', 'wpisów')}?`,
      pointing.size > 0 ? `${pointing.size} ${plural(pointing.size, 'inny wpis się do nich odwołuje', 'inne wpisy się do nich odwołują', 'innych wpisów się do nich odwołuje')} — te odwołania pokażą, że wpisu już nie ma.` : '',
      foreign > 0 ? `${foreign} z zaznaczonych ${plural(foreign, 'leży', 'leżą', 'leży')} w innej bibliotece — te zostaną.` : '',
      'Tego nie da się cofnąć z tej listy.'
    ].filter(Boolean).join(' ');
    if (own.length === 0 || !(await askText(asked))) return;
    setBusy(true);
    setFailed(null);
    try {
      const done = await store.removeMany(own, (n, total) => setProgress(`Usuwanie… ${n} z ${total}`));
      toast(`Usunięto ${done} ${plural(done, 'wpis', 'wpisy', 'wpisów')}.`);
      onPicked(new Set([...picked].filter((id) => !gone.has(id))));
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="lib-pick-bar" role="region" aria-label="Zaznaczone wpisy">
      <div className="lib-pick-head">
        <strong>Zaznaczone: {picked.size}</strong>
        {picked.size < all.length && <button type="button" className="wk-link-btn" onClick={() => onPicked(new Set(all))}>Zaznacz wszystkie ({all.length})</button>}
        <button type="button" className="wk-link-btn" onClick={() => onPicked(new Set())}>Odznacz</button>
        {writes && <button type="button" className="wk-btn lib-btn-danger" disabled={busy || own.length === 0} onClick={() => void remove()}>Usuń ({own.length})</button>}
      </div>
      {progress !== null && <p className="lib-pick-note">{progress}</p>}
      {foreign > 0 && <p className="lib-pick-note">{foreign} z zaznaczonych {plural(foreign, 'leży', 'leżą', 'leży')} w innej bibliotece — tych nie da się tu usunąć.</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}
