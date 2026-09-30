/**
 * WAS AN EINER NACHRICHT HÄNGT (0058) — bearbeiten, die Geschichte, und das
 * Zurückholen. Dieselben Teile in allen drei Rozmowy: im Arbeitsplatz, auf
 * der Seite und hinter dem persönlichen Link.
 *
 * <b>Bearbeitet heisst: sichtbar bearbeitet.</b> Wer eine Nachricht ändert,
 * ändert nicht, was die anderen schon gelesen haben — „(edytowano)" steht
 * daneben, und ein Klick zeigt jede Fassung mit ihrer Zeit.
 */

import { useEffect, useState } from 'react';

import type { Opened, SealedMessage, SealedVersion } from './chat';
import { Modal } from './Modal';
import { WorkspaceError } from './session';

const when = (at: string) => new Date(at).toLocaleString('pl-PL', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
});

/** „(edytowano)" — ein Klick öffnet die Geschichte. */
export function EditedMark({ message, onOpen }: { message: SealedMessage; onOpen: () => void }) {
  if (message.deletedAt !== null || message.editedAt == null) return null;
  return (
    <button type="button" className="wk-msg-edited" title={`Edytowano ${when(message.editedAt)} — pokaż wersje`} onClick={onOpen}>
      (edytowano)
    </button>
  );
}

/** Die Nachricht im Bearbeiten — Enter speichert, Umschalt+Enter macht eine neue Zeile, Esc bricht ab. */
export function EditBox({ initial, onSave, onCancel }: {
  initial: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const save = async () => {
    const body = text.trim();
    if (body === '' || busy) return;
    if (body === initial.trim()) { onCancel(); return; }
    setBusy(true);
    setFailed(null);
    try {
      await onSave(body);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
      setBusy(false);
    }
  };

  return (
    <div className="wk-msg-editbox">
      <textarea
        value={text}
        rows={Math.min(8, Math.max(2, text.split('\n').length))}
        aria-label="Zmień wiadomość"
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void save(); }
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
      />
      <span className="wk-msg-editbar">
        <button type="button" className="wk-btn wk-btn-small" disabled={busy || text.trim() === ''} onClick={() => void save()}>
          {busy ? 'Zapisywanie…' : 'Zapisz'}
        </button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={onCancel}>Anuluj</button>
        {failed !== null && <span className="wk-error">{failed}</span>}
      </span>
    </div>
  );
}

/** Die kleinen Knöpfe an einer Nachricht — nur, was dieser Leser hier darf. */
export function MessageTools({ canEdit, canDelete, onEdit, onDelete }: {
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!canEdit && !canDelete) return null;
  return (
    <span className="wk-msg-tools">
      {canEdit && (
        <button type="button" className="wk-msg-tool" aria-label="Edytuj wiadomość" title="Edytuj" onClick={onEdit}>✎</button>
      )}
      {canDelete && (
        <button type="button" className="wk-msg-tool wk-msg-drop" aria-label="Usuń wiadomość" title="Usuń" onClick={onDelete}>×</button>
      )}
    </span>
  );
}

/** Gelöscht — und für den, der darf, der Weg zurück. */
export function DeletedBody({ message, canRestore, onRestore }: {
  message: SealedMessage;
  canRestore: boolean;
  onRestore: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <span className="wk-msg-deleted">
      <em className="wk-row-side">
        wiadomość usunięta{message.deletedBy === 'moderator' ? ' przez prowadzącego' : ''}
      </em>
      {canRestore && (
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => {
          setBusy(true);
          setFailed(null);
          onRestore().catch((e: unknown) => {
            setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przywrócić.');
          }).finally(() => setBusy(false));
        }}>
          {busy ? 'Przywracanie…' : 'Przywróć'}
        </button>
      )}
      {failed !== null && <span className="wk-error">{failed}</span>}
    </span>
  );
}

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
