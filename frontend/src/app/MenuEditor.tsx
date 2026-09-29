/**
 * DAS MENÜ EINER SEITE BAUEN (0054) — über dem Editor der Seite.
 *
 * Ein Baum bis drei Ebenen tief: Einträge anlegen, darunter einrücken
 * (→) oder herausnehmen (←), verschieben (↑ ↓). Jeder Eintrag sagt, wohin er
 * führt, und zeigt es gleich daneben ausgerechnet — ein relativer Pfad ist
 * sonst eine Vermutung.
 *
 * <b>Hat die Seite kein eigenes Menü, gilt das der nächsten darüber</b>; das
 * steht hier, samt dem Weg, es zu übernehmen und abzuwandeln.
 */

import { useCallback, useEffect, useState } from 'react';

import { hrefOf, joinPath, loadMenu, saveMenu, type MenuItem } from './menu';
import { WorkspaceError } from './session';

interface Draft {
  readonly id: number;
  readonly label: string;
  readonly kind: MenuItem['kind'];
  readonly target: string;
  readonly children: readonly Draft[];
}

const MAX_DEPTH = 3;
let counter = 0;
const nextId = () => ++counter;

const toDraft = (items: readonly MenuItem[]): Draft[] =>
  items.map((one) => ({ id: nextId(), label: one.label, kind: one.kind, target: one.target, children: toDraft(one.children) }));

const toItems = (drafts: readonly Draft[]): MenuItem[] =>
  drafts.map((one) => ({ label: one.label.trim(), kind: one.kind, target: one.target.trim(), children: toItems(one.children) }));

const blank = (): Draft => ({ id: nextId(), label: '', kind: 'rel', target: '', children: [] });

/**
 * Ein Menü von oben ÜBERNEHMEN: seine relativen Ziele galten von DORT aus —
 * hier kopiert, werden sie zu festen Pfaden, sonst zeigten sie auf einmal woanders hin.
 */
const absolutise = (items: readonly MenuItem[], from: string): MenuItem[] =>
  items.map((one) => ({
    ...one,
    kind: one.kind === 'rel' ? 'abs' : one.kind,
    target: one.kind === 'rel' ? joinPath(from, one.target) : one.target,
    children: absolutise(one.children, from)
  }));

/* -- Den Baum umbauen: jede Änderung gibt einen neuen Baum zurück ------------------------ */

type Path = readonly number[];

function update(list: readonly Draft[], path: Path, change: (siblings: Draft[], at: number) => Draft[]): Draft[] {
  if (path.length === 1) return change([...list], path[0]);
  return list.map((one, i) => (i === path[0] ? { ...one, children: update(one.children, path.slice(1), change) } : one));
}

const at = (list: readonly Draft[], path: Path): Draft | undefined =>
  path.length === 1 ? list[path[0]] : at(list[path[0]]?.children ?? [], path.slice(1));

const depthOf = (draft: Draft): number => 1 + Math.max(0, ...draft.children.map(depthOf));

const KINDS: readonly { value: MenuItem['kind']; label: string; hint: string }[] = [
  { value: 'rel', label: 'Względem tej strony', hint: 'np. oaza, ./terminy, ../kontakt' },
  { value: 'abs', label: 'Strona w serwisie', hint: 'np. parish/grzegorzki/oaza' },
  { value: 'url', label: 'Adres zewnętrzny', hint: 'https://…, mailto:…, tel:…' },
  { value: 'none', label: 'Tylko nagłówek', hint: '' }
];

export function MenuEditor({ path }: { path: string }) {
  const [items, setItems] = useState<Draft[] | null>(null);
  const [own, setOwn] = useState(false);
  const [inherited, setInherited] = useState<{ from: string; items: readonly MenuItem[] } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const look = useCallback(async () => {
    try {
      const found = await loadMenu(path);
      setOwn(found.items !== null);
      setItems(toDraft(found.items ?? []));
      setInherited(found.inherited);
      setDirty(false);
      setFailed(null);
    } catch (e) {
      setItems([]);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać menu.');
    }
  }, [path]);

  useEffect(() => { void look(); }, [look]);

  if (items === null) return <p className="wk-hint">Wczytywanie menu…</p>;

  const change = (next: Draft[]) => { setItems(next); setDirty(true); setSaved(false); };

  const save = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await saveMenu(path, toItems(items));
      await look();
      setSaved(true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać menu.');
    } finally {
      setBusy(false);
    }
  };

  const row = (draft: Draft, where: Path, depth: number) => {
    const set = (patch: Partial<Draft>) =>
      change(update(items, where, (list, i) => { list[i] = { ...list[i], ...patch }; return list; }));
    const index = where[where.length - 1];
    const siblings = where.length === 1 ? items : at(items, where.slice(0, -1))!.children;
    const href = draft.kind === 'none' ? null : hrefOf({ ...draft, children: [] }, path);
    const kind = KINDS.find((k) => k.value === draft.kind)!;

    return (
      <li key={draft.id} className="wk-menued-item">
        <div className="wk-menued-row" style={{ paddingLeft: `${(depth - 1) * 1.5}rem` }}>
          <input className="wk-menued-label" value={draft.label} placeholder="Nazwa" aria-label="Nazwa pozycji" maxLength={80}
            onChange={(e) => set({ label: e.target.value })} />
          <select value={draft.kind} aria-label="Rodzaj celu" onChange={(e) => set({ kind: e.target.value as MenuItem['kind'] })}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          {draft.kind !== 'none' && (
            <input className="wk-menued-target" value={draft.target} placeholder={kind.hint} aria-label="Cel" maxLength={400}
              onChange={(e) => set({ target: e.target.value })} />
          )}
          <span className="wk-menued-tools">
            <button type="button" className="wk-menued-btn" aria-label="W górę" disabled={index === 0}
              onClick={() => change(update(items, where, (list, i) => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; return list; }))}>↑</button>
            <button type="button" className="wk-menued-btn" aria-label="W dół" disabled={index === siblings.length - 1}
              onClick={() => change(update(items, where, (list, i) => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; return list; }))}>↓</button>
            <button type="button" className="wk-menued-btn" aria-label="Wsuń pod poprzednią pozycję"
              disabled={index === 0 || depth + depthOf(draft) - 1 >= MAX_DEPTH}
              onClick={() => change(update(items, where, (list, i) => {
                const [moved] = list.splice(i, 1);
                list[i - 1] = { ...list[i - 1], children: [...list[i - 1].children, moved] };
                return list;
              }))}>→</button>
            <button type="button" className="wk-menued-btn" aria-label="Wysuń poziom wyżej" disabled={where.length === 1}
              onClick={() => {
                const parentPath = where.slice(0, -1);
                let moved: Draft | null = null;
                let next = update(items, where, (list, i) => { [moved] = list.splice(i, 1); return list; });
                next = update(next, parentPath, (list, i) => { list.splice(i + 1, 0, moved!); return list; });
                change(next);
              }}>←</button>
            <button type="button" className="wk-menued-btn" aria-label="Dodaj podpozycję" disabled={depth >= MAX_DEPTH}
              onClick={() => set({ children: [...draft.children, blank()] })}>+</button>
            <button type="button" className="wk-menued-btn wk-danger" aria-label="Usuń pozycję"
              onClick={() => change(update(items, where, (list, i) => { list.splice(i, 1); return list; }))}>×</button>
          </span>
          {href !== null && draft.target.trim() !== '' && (
            <span className="wk-menued-preview">→ <code>{href}</code></span>
          )}
        </div>

        {draft.children.length > 0 && (
          <ul className="wk-menued-list">
            {draft.children.map((child, i) => row(child, [...where, i], depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="wk-menued">
      {!own && items.length === 0 && (
        <p className="wk-hint">
          {inherited === null
            ? 'Ta strona nie ma menu. Dodaj pozycje — menu pokaże się nad nią i nad wszystkimi stronami pod nią.'
            : <>Ta strona pokazuje menu strony <code>{inherited.from}</code> ({inherited.items.length} poz.). Własne menu je zastąpi — tutaj i niżej.</>}
        </p>
      )}

      {items.length > 0 && <ul className="wk-menued-list">{items.map((one, i) => row(one, [i], 1))}</ul>}

      <p className="wk-hint">
        Ścieżka względna liczy się od tej strony (<code>{path}</code>): „oaza" to <code>{path}/oaza</code>, „../" to strona wyżej.
        Menu obowiązuje też na stronach pod tą, dopóki któraś nie ma własnego.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {saved && !dirty && <p className="wk-done">Menu zapisane.</p>}

      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" onClick={() => change([...items, blank()])}>+ Pozycja</button>
        {!own && inherited !== null && items.length === 0 && (
          <button type="button" className="wk-link-btn" onClick={() => change(toDraft(absolutise(inherited.items, inherited.from)))}>
            Skopiuj menu z góry i zmień
          </button>
        )}
        <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? 'Zapisywanie…' : 'Zapisz menu'}
        </button>
        {own && (
          <button type="button" className="wk-link-btn wk-danger" disabled={busy}
            onClick={() => { if (window.confirm('Usunąć własne menu tej strony?')) { setItems([]); setDirty(true); void saveMenu(path, []).then(look); } }}>
            Usuń menu
          </button>
        )}
      </div>
    </section>
  );
}

export default MenuEditor;
