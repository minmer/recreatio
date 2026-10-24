/**
 * 2026-10-24 — DIE DATEIEN, UM DIE EIN DOKUMENT BITTET, vor dem Import der
 * Seite (`pageImageNeeds.ts`).
 *
 * Je Bitte: eine Datei von diesem Gerät — sie wird erst beim Import
 * hochgeladen, bis dahin ändert sich an der Seite nichts — oder eine, die die
 * Seite schon hat. Mehrere Dateien auf einmal (auch hineingezogen) ordnen sich
 * nach ihrem Namen zu; was nicht passt, ordnet der Mensch zu. Eine Datei der
 * Seite mit dem genannten Namen nimmt die Bitte von selbst: ein zweiter Import
 * desselben Dokuments lädt nichts doppelt hoch.
 */

import { useEffect, useRef, useState, type DragEvent } from 'react';

import { count } from './event/kit';
import { describeFile, imageRef, isAudioType, isImageType, isVideoType, loadPageImages, typeOfFile, type PageImageRow } from './pageImages';
import { acceptOf, fileProblem, fitsNeed, matchFiles, type ImageNeed, type NeedFit } from './pageImageNeeds';
import { imageUrl } from './slides/slideLook';
import { Icon, type IconName } from '../ui/icons';

/** Was für eine Bitte gewählt ist: eine Datei von hier (noch nicht hochgeladen) oder eine der Seite. */
export type ImageChoice =
  | { readonly from: 'device'; readonly file: File; readonly type: string; readonly preview: string | null }
  | { readonly from: 'page'; readonly id: string; readonly name: string | null; readonly type: string };

const typeIcon = (type: string): IconName => (isImageType(type) ? 'image' : isVideoType(type) ? 'play' : isAudioType(type) ? 'music' : 'file');
const needIcon = (kind: NeedFit): IconName => (kind === 'video' ? 'play' : kind === 'sound' ? 'music' : kind === 'file' ? 'file' : 'image');

/** Zieht jemand Dateien herein (und nicht etwa Text)? */
const carriesFiles = (e: DragEvent<HTMLElement>): boolean => Array.from(e.dataTransfer.types).includes('Files');

function Thumb({ need, choice }: { need: ImageNeed; choice: ImageChoice | undefined }) {
  if (choice === undefined) return <Icon name={needIcon(need.kind)} />;
  if (choice.from === 'device') return choice.preview !== null ? <img src={choice.preview} alt="" /> : <Icon name={typeIcon(choice.type)} />;
  return isImageType(choice.type) ? <img src={imageUrl(imageRef(choice.id))} alt="" /> : <Icon name={typeIcon(choice.type)} />;
}

function metaOf(need: ImageNeed, choice: ImageChoice | undefined): string {
  const said = [
    choice === undefined ? null
      : choice.from === 'device' ? `wybrany: ${choice.file.name} (${describeFile(choice.file.name, choice.file.size)}) — wgra się przy imporcie`
      : `z plików strony: ${choice.name ?? 'bez nazwy'}`,
    choice === undefined && need.name !== null ? `plik: ${need.name}` : null,
    need.declared ? null : 'bez opisu w dokumencie',
    `${count(need.uses, 'miejsce', 'miejsca', 'miejsc')} na stronie`
  ];
  return said.filter((one) => one !== null).join(' · ');
}

export function ImageNeeds({ path, needs, chosen, busy, onChoose }: {
  /** Die Seite, in deren Dateien sie gehen. */
  path: string;
  needs: readonly ImageNeed[];
  chosen: Readonly<Record<string, ImageChoice>>;
  busy: boolean;
  onChoose: (key: string, choice: ImageChoice | null) => void;
}) {
  const [files, setFiles] = useState<readonly PageImageRow[] | null>(null);
  const [problems, setProblems] = useState<Readonly<Record<string, string>>>({});
  const [loose, setLoose] = useState<readonly File[]>([]);
  const [dropping, setDropping] = useState(false);
  const many = useRef<HTMLInputElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    let alive = true;
    loadPageImages(path).then((r) => { if (alive) setFiles(r.images); }, () => { if (alive) setFiles([]); });
    return () => { alive = false; };
  }, [path]);

  /* Eine Datei der Seite mit dem genannten Namen nimmt die Bitte von selbst — je Bitte einmal, nur wo nichts gewählt ist. */
  const offered = useRef(new Set<string>());
  useEffect(() => {
    if (files === null) return;
    for (const need of needs) {
      if (offered.current.has(need.key)) continue;
      offered.current.add(need.key);
      if (chosen[need.key] !== undefined || need.name === null) continue;
      const wanted = need.name.toLowerCase();
      const hit = files.find((f) => (f.name ?? '').toLowerCase() === wanted && fitsNeed(need.kind, f.contentType));
      if (hit !== undefined) onChoose(need.key, { from: 'page', id: hit.id, name: hit.name, type: hit.contentType });
    }
  }, [files, needs]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Bitten, die das Dokument nicht mehr hat (es wurde geändert), verlieren ihre Wahl. */
  useEffect(() => {
    const keys = new Set(needs.map((n) => n.key));
    for (const key of Object.keys(chosen)) if (!keys.has(key)) onChoose(key, null);
  }, [needs]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Eine Datei für eine Bitte — oder in Worten, warum sie nicht passt. */
  const take = (need: ImageNeed, file: File): boolean => {
    const type = typeOfFile(file);
    const wrong = fileProblem(need.kind, type, file.size);
    setProblems((was) => {
      const { [need.key]: _gone, ...rest } = was;
      return wrong === null ? rest : { ...rest, [need.key]: `${file.name}: ${wrong}` };
    });
    if (wrong !== null || type === null) return false;
    onChoose(need.key, { from: 'device', file, type, preview: isImageType(type) ? URL.createObjectURL(file) : null });
    return true;
  };

  const takeMany = (list: readonly File[]) => {
    if (list.length === 0) return;
    const { byKey, rest } = matchFiles(needs, list.map((f) => f.name));
    const left = rest.map((i) => list[i]);
    for (const [key, index] of byKey) {
      const need = needs.find((n) => n.key === key);
      if (need !== undefined && !take(need, list[index])) left.push(list[index]);
    }
    setLoose((was) => [...was, ...left]);
  };

  const missing = needs.filter((n) => chosen[n.key] === undefined).length;

  return (
    <section
      className={dropping ? 'pe-needs is-drop' : 'pe-needs'} data-image-needs="" aria-label="Pliki dla tej strony"
      onDragOver={(e) => { if (!busy && carriesFiles(e)) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        if (busy || !carriesFiles(e)) return;
        e.preventDefault();
        setDropping(false);
        takeMany(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="pe-needs-head">
        <p className="wk-json-h">Pliki dla tej strony — {missing === 0 ? 'wszystkie dodane' : `brakuje ${missing} z ${needs.length}`}</p>
        <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} data-need-many="" onClick={() => many.current?.click()}>
          <Icon name="upload" /> Dodaj kilka naraz…
        </button>
        <input
          ref={many} type="file" multiple hidden accept={acceptOf(needs.every((n) => n.kind === 'image') ? 'image' : 'any')}
          onChange={(e) => { const list = Array.from(e.target.files ?? []); e.target.value = ''; takeMany(list); }}
        />
      </div>
      <p className="pe-needs-lead">
        Dokument prosi o te pliki. Dodaj je przed importem (albo przeciągnij tutaj) — import wgra je do plików strony, publicznych jak sama strona, i wstawi w każde miejsce, które ich używa.
      </p>

      <ul className="pe-needs-list">
        {needs.map((need) => {
          const choice = chosen[need.key];
          const fitting = (files ?? []).filter((f) => fitsNeed(need.kind, f.contentType));
          return (
            <li key={need.key} className={choice === undefined ? 'pe-need is-missing' : 'pe-need'} data-need={need.key} data-need-state={choice?.from ?? 'missing'}>
              <span className="pe-need-thumb" aria-hidden="true"><Thumb need={need} choice={choice} /></span>
              <span className="pe-need-text">
                <strong>{need.label}</strong>
                {need.description !== '' && <span>{need.description}</span>}
                <span className="pe-need-meta">{metaOf(need, choice)}</span>
                {problems[need.key] !== undefined && <span className="wk-error">{problems[need.key]}</span>}
              </span>
              <span className="pe-need-act">
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} data-need-pick={need.key}
                  onClick={() => inputs.current.get(need.key)?.click()}>
                  {choice === undefined ? 'Wybierz plik…' : 'Zmień'}
                </button>
                {choice !== undefined && (
                  <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onChoose(need.key, null)}>Usuń</button>
                )}
                {fitting.length > 0 && (
                  <select
                    value={choice?.from === 'page' ? choice.id : ''} disabled={busy} aria-label={`${need.label} — plik, który strona już ma`}
                    onChange={(e) => {
                      const one = fitting.find((f) => f.id === e.target.value);
                      if (one !== undefined) onChoose(need.key, { from: 'page', id: one.id, name: one.name, type: one.contentType });
                    }}
                  >
                    <option value="">— albo plik, który strona już ma —</option>
                    {fitting.map((f) => <option key={f.id} value={f.id}>{f.name ?? f.id} · {describeFile(f.name ?? '', f.size)}</option>)}
                  </select>
                )}
                <input
                  ref={(el) => { if (el !== null) inputs.current.set(need.key, el); else inputs.current.delete(need.key); }}
                  type="file" hidden accept={acceptOf(need.kind)}
                  onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file !== undefined) take(need, file); }}
                />
              </span>
            </li>
          );
        })}
      </ul>

      {loose.length > 0 && (
        <div className="pe-needs-loose" data-need-loose="">
          <p className="wk-note">Te pliki nie pasują nazwą do żadnego opisu — przypisz je:</p>
          <ul>
            {loose.map((file, i) => (
              <li key={`${file.name}-${i}`}>
                <span>{file.name}</span>
                <select
                  value="" disabled={busy} aria-label={`Do którego opisu: ${file.name}`}
                  onChange={(e) => {
                    const need = needs.find((n) => n.key === e.target.value);
                    if (need !== undefined && take(need, file)) setLoose((was) => was.filter((one) => one !== file));
                  }}
                >
                  <option value="">— do którego opisu —</option>
                  {needs.map((n) => <option key={n.key} value={n.key}>{n.label}{chosen[n.key] === undefined ? '' : ' (zamień)'}</option>)}
                </select>
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setLoose((was) => was.filter((one) => one !== file))}>Pomiń</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
