/**
 * DIE GESCHICHTE EINER NACHRICHT (0058). Bearbeitet heisst: sichtbar
 * bearbeitet — „edytowano" steht an der Blase, und ein Klick darauf (oder
 * „Historia zmian" im Menü der Nachricht, `ChatKit.tsx`) zeigt jede Fassung
 * mit ihrer Zeit. Dieselbe Geschichte in allen drei Rozmowy: im Arbeitsplatz,
 * auf der Seite und hinter dem persönlichen Link.
 */

import { useEffect, useState } from 'react';

import type { Opened, SealedVersion } from './chat';
import { Modal } from './Modal';
import { WorkspaceError } from './session';

const when = (at: string) => new Date(at).toLocaleString('pl-PL', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
});

/**
 * DIE GESCHICHTE einer Nachricht — jede Fassung mit ihrer Zeit, die jüngste
 * oben. Geöffnet wird hier, im Browser, mit denselben Schlüsseln wie die
 * Nachricht selbst.
 */
export function HistoryDialog({ load, open, onClose }: {
  load: () => Promise<{ versions: readonly SealedVersion[] }>;
  open: (version: SealedVersion) => Promise<Opened | null>;
  onClose: () => void;
}) {
  const [list, setList] = useState<readonly { version: SealedVersion; opened: Opened | null }[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { versions } = await load();
        const opened = await Promise.all(versions.map(async (version) => ({ version, opened: await open(version) })));
        if (alive) setList([...opened].reverse());
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać wersji.');
      }
    })();
    return () => { alive = false; };
  }, [load, open]);

  return (
    <Modal title="Wersje wiadomości" onClose={onClose}>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {list === null && failed === null && <p className="wk-hint">Wczytywanie…</p>}
      {list !== null && (
        <ol className="wk-msg-history">
          {list.map(({ version, opened }, i) => (
            <li key={version.version} className={i === 0 ? 'is-current' : ''}>
              <span className="wk-msg-history-head">
                Wersja {version.version}{i === 0 ? ' (obecna)' : ''} · {when(version.createdAt)}
              </span>
              <span className="wk-msg-history-body">
                {opened === null ? <em className="wk-row-side">Nie do odczytania — brak klucza tej epoki.</em> : opened.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
