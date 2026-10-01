/**
 * BILDER UND DATEIEN EINER SEITE WÄHLEN (0062, 0063) — im Editor der Slajdy
 * und in den Bausteinen aus den Ereignisseiten (Osoby, Galeria, Pliki, Mapa).
 *
 * Altbestand: `ImagePicker` und `DocumentPicker`. Sie schreiben die gewählte
 * Adresse zurück; ein Feld daneben nimmt weiterhin jede andere Adresse an —
 * eine Datei, die woanders liegt, bleibt so gültig wie zuvor.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import {
  deletePageImage, describeFile, FILE_ACCEPT, imageRef, isImageType, loadPageImages, typeOfFile, uploadPageFile,
  uploadPageImage, type PageImageRow
} from './pageImages';
import { WorkspaceError } from './session';
import { imageUrl } from './slides';

/** Die Dateien einer Seite — einmal geholt, danach von Hand nachgeführt. */
function usePageFiles(path: string) {
  const [files, setFiles] = useState<readonly PageImageRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadPageImages(path)
      .then((found) => { if (alive) setFiles(found.images); })
      .catch(() => { if (alive) setFiles([]); });
    return () => { alive = false; };
  }, [path]);

  return { files, setFiles };
}

/**
 * Ein Bild wählen oder hochladen. Die Bilder gehören der Seite und sind
 * öffentlich wie sie — das steht dabei.
 */
export function ImagePicker({ path, value, busy, onPick }: {
  path: string;
  value: string;
  busy: boolean;
  onPick: (url: string) => void;
}) {
  const { files, setFiles } = usePageFiles(path);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const upload = async (file: File) => {
    setWorking(true);
    setFailed(null);
    try {
      const made = await uploadPageImage(path, file);
      setFiles((was) => [made, ...(was ?? [])]);
      onPick(imageRef(made.id));
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wgrać obrazu.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="se-images">
      <div className="se-thumbs">
        {(files ?? []).filter((one) => isImageType(one.contentType)).map((one) => {
          const ref = imageRef(one.id);
          return (
            <span key={one.id} className={`se-thumb${value === ref ? ' is-on' : ''}`}>
              <button type="button" disabled={busy} title={one.name ?? ''} onClick={() => onPick(ref)}
                style={{ backgroundImage: `url(${JSON.stringify(imageUrl(ref))})` } as CSSProperties} aria-label={`Wybierz ${one.name ?? 'obraz'}`} />
              <button type="button" className="se-thumb-x" disabled={busy} aria-label="Usuń obraz"
                onClick={() => {
                  if (!window.confirm('Usunąć ten obraz ze strony? Miejsca, które go używają, stracą go.')) return;
                  void deletePageImage(one.id).then(() => setFiles((was) => (was ?? []).filter((x) => x.id !== one.id)))
                    .catch((e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.'));
                }}>×</button>
            </span>
          );
        })}
        <button type="button" className="se-thumb se-thumb-add" disabled={busy || working} onClick={() => input.current?.click()}>
          {working ? 'Wgrywanie…' : '+ Wgraj obraz'}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }} />
      </div>
      <span className="wk-hint">Obrazy strony są publiczne jak sama strona (do 8 MB: JPEG, PNG, WebP, GIF, AVIF).</span>
      {failed !== null && <span className="wk-error">{failed}</span>}
    </div>
  );
}

/**
 * Eine Datei wählen oder hochladen — Altbestand: `DocumentPicker`. Hochladen
 * füllt die Adresse und, nur wo es noch leer ist, Name und Grösse: eine Datei,
 * mit einem Klick hinzugefügt, ist schon ein fertiger Eintrag.
 */
export function FilePicker({ path, value, busy, onPick }: {
  path: string;
  value: string;
  busy: boolean;
  onPick: (url: string, name: string, size: string) => void;
}) {
  const { files, setFiles } = usePageFiles(path);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const upload = async (file: File) => {
    setWorking(true);
    setFailed(null);
    try {
      const type = typeOfFile(file);
      if (type === null) throw new WorkspaceError('Tego rodzaju pliku strona nie przyjmuje — PDF, Word, Excel, PowerPoint, OpenDocument, GPX albo obraz.');
      const made = await uploadPageFile(path, file, file.name, type);
      setFiles((was) => [made, ...(was ?? [])]);
      onPick(imageRef(made.id), file.name, describeFile(file.name, file.size));
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wgrać pliku.');
    } finally {
      setWorking(false);
    }
  };

  const documents = (files ?? []).filter((one) => !isImageType(one.contentType));

  return (
    <div className="pe-files">
      {documents.length > 0 && (
        <select className="pe-files-pick" value={documents.some((one) => imageRef(one.id) === value) ? value : ''} disabled={busy}
          aria-label="Plik z tej strony"
          onChange={(e) => {
            const one = documents.find((x) => imageRef(x.id) === e.target.value);
            if (one !== undefined) onPick(imageRef(one.id), one.name ?? 'Plik', describeFile(one.name ?? '', one.size));
          }}>
          <option value="">— plik z tej strony —</option>
          {documents.map((one) => <option key={one.id} value={imageRef(one.id)}>{one.name ?? one.id} · {describeFile(one.name ?? '', one.size)}</option>)}
        </select>
      )}
      <button type="button" className="wk-btn wk-btn-quiet pe-files-add" disabled={busy || working} onClick={() => input.current?.click()}>
        {working ? 'Wgrywanie…' : 'Wgraj plik'}
      </button>
      <input ref={input} type="file" accept={`${FILE_ACCEPT},image/*`} hidden
        onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }} />
      <span className="wk-hint">Pliki strony są publiczne jak sama strona i pobierają się jako plik (do 25 MB).</span>
      {failed !== null && <span className="wk-error">{failed}</span>}
    </div>
  );
}
