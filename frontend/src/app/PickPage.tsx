/**
 * 0082 — EINE SEITE WÄHLEN, statt ihren Pfad zu tippen.
 *
 * Die Liste sind die Adressen, die meine Rollen führen (ohne zweite Namen —
 * die zeigen nur auf eine andere). Steht schon ein Pfad da, der nicht darunter
 * ist (eine Seite einer anderen Rolle, ein Tippfehler aus einem Import), bleibt
 * er stehen und wird so genannt — er wird nicht still durch „keine" ersetzt.
 */

import { useEffect, useState } from 'react';

import { loadDesk } from './desk';
import { pagePath } from './routes';

export function PickPage({ value, busy, onPick }: {
  value: string;
  busy: boolean;
  onPick: (path: string) => void;
}) {
  const [pages, setPages] = useState<readonly string[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadDesk()
      .then((desk) => { if (alive) setPages(desk.pages.filter((p) => p.aliasOf === null).map((p) => p.path).sort((a, b) => a.localeCompare(b, 'pl'))); })
      .catch(() => { if (alive) setPages([]); });
    return () => { alive = false; };
  }, []);

  if (pages === null) return <p className="wk-hint">Wczytywanie stron…</p>;

  const path = value.trim().replace(/^#?\/*/, '');
  const known = path === '' || pages.includes(path);

  return (
    <>
      <select value={path} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">— wybierz stronę —</option>
        {!known && <option value={path}>{path} — nie ma jej wśród Twoich stron</option>}
        {pages.map((one) => <option key={one} value={one}>{one}</option>)}
      </select>
      {path !== '' && <a className="wk-link-btn" href={pagePath(path)}>Zobacz stronę</a>}
    </>
  );
}
