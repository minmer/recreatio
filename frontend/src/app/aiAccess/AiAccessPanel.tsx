/**
 * DOSTĘP DLA AI — die Karte eines Bereichs (Dostęp; beim eigenen Bereich
 * gleich unter seinem Namen). Wer den Bereich prowadzi, legt einen Link an
 * (welche Behälter, wie lange), kopiert ihn wieder, verlängert, ändert die
 * Behälter, löscht. Wer dort schreibt, frischt die Abschriften auf (das
 * geschieht auch von selbst, `aiAccess.ts`). Wer nur liest, sieht, DASS es
 * einen Link gibt und was er zeigt — er soll wissen, dass ein Assistent mitliest.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import type { AreaRow } from '../areas/area';
import type { Ring } from '../core/keys';
import { plural } from '../core/plural';
import { WorkspaceError } from '../core/session';
import { libraryKindOf, loadLibraries, openLibraries, type LibraryKind } from '../library/library';
import { ask } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import {
  aiLinkOf, createAiAccess, deleteAiAccess, extendAiAccess, failedWords, forgetAiWatch, loadAiAccess, refreshAiAccess, setAiParts,
  type AiAccessList, type AiAccessRow, type AiPart
} from './aiAccess';

const PART_NAME: Readonly<Record<LibraryKind, string>> = { books: 'Biblioteka', writing: 'Skryptorium', knowledge: 'Baza wiedzy' };
const PART_ORDER: Readonly<Record<LibraryKind, number>> = { books: 0, writing: 1, knowledge: 2 };
const DAYS_LABEL: Readonly<Record<number, string>> = { 7: 'tydzień', 30: 'miesiąc', 90: '3 miesiące', 365: 'rok' };

interface Container {
  readonly libraryId: string;
  readonly kind: LibraryKind;
  readonly name: string;
}

const day = (iso: string): string => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
const said = (e: unknown): string => (e instanceof WorkspaceError || e instanceof Error) && e.message !== '' ? e.message : 'Nie udało się.';
const times = (n: number): string => (n === 1 ? '1 raz' : `${n} razy`);

export function AiAccessPanel({ area, ring }: { area: AreaRow; ring: Ring | null }) {
  const [list, setList] = useState<AiAccessList | null>(null);
  const [containers, setContainers] = useState<readonly Container[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Der Dienst kennt den Dostęp dla AI (noch) nicht — ein älterer Dienst: dann still, statt rot. */
  const [unavailable, setUnavailable] = useState(false);
  /** Der eben angelegte Link — einmal offen gezeigt. */
  const [made, setMade] = useState<{ readonly id: string; readonly link: string } | null>(null);

  const reload = useCallback(async () => {
    const next = await loadAiAccess(area.areaId);
    setList(next);
    return next;
  }, [area.areaId]);

  useEffect(() => {
    let alive = true;
    setList(null);
    setContainers(null);
    setUnavailable(false);
    let listed = false;
    void (async () => {
      try {
        const next = await reload();
        listed = true;
        const rows = (await loadLibraries()).libraries.filter((r) => r.areaId === area.areaId);
        const named = ring === null ? rows.map((r) => ({ ...r, name: PART_NAME[libraryKindOf(r)] })) : await openLibraries(ring, rows);
        if (!alive) return;
        setContainers(named
          .map((r) => ({ libraryId: r.libraryId, kind: libraryKindOf(r), name: r.name }))
          .sort((a, b) => PART_ORDER[a.kind] - PART_ORDER[b.kind] || a.name.localeCompare(b.name, 'pl')));

        /* Wer hier schreibt und die Karte öffnet, frischt alte Abschriften auf — still, mit Stand. */
        if (ring !== null && next.writes && next.accesses.some((a) => a.works && a.parts.some((p) => !p.fresh))) {
          setWorking('Odświeżam odpisy dla AI…');
          const done = await refreshAiAccess(ring, area.areaId, { progress: (d, total) => { if (alive) setWorking(`Odświeżam odpisy dla AI… ${d}/${total}`); } });
          if (alive) { await reload(); setError(failedWords(done)); }
        }
      } catch (e) {
        if (alive) { if (listed) setError(said(e)); else setUnavailable(true); }
      } finally {
        if (alive) setWorking(null);
      }
    })();
    return () => { alive = false; };
  }, [area.areaId, ring, reload]);

  /* Die Liste kommt danach immer neu — auch wenn etwas misslang (ein Link kann trotzdem entstanden sein). */
  const run = async (label: string, todo: () => Promise<unknown>): Promise<void> => {
    setWorking(label);
    setError(null);
    try {
      await todo();
    } catch (e) {
      setError(said(e));
    } finally {
      await reload().catch(() => undefined);
      setWorking(null);
    }
  };

  const create = async (libraries: readonly string[], days: number): Promise<void> => {
    if (ring === null) return;
    const yes = await ask({
      title: 'Utworzyć link dla AI?',
      body: 'Kto ma ten link, przeczyta wybrane zbiory tego obszaru — także asystent AI, któremu go dasz, i jego dostawca. Nic poza nimi i niczego nie zmieni. Link możesz w każdej chwili usunąć.',
      confirm: 'Utwórz link'
    });
    if (!yes) return;
    await run('Tworzę link…', async () => {
      const out = await createAiAccess(ring, area.areaId, libraries, days, (done, total) => setWorking(`Przygotowuję odpisy… ${done}/${total}`));
      setMade({ id: out.id, link: out.link });
      const failed = failedWords(out.refresh);
      if (failed !== null) throw new WorkspaceError(failed);
    });
  };

  const nameOf = (part: AiPart): string => containers?.find((c) => c.libraryId === part.libraryId)?.name ?? PART_NAME[part.kind];

  return (
    <div className="wk-panel">
      <h2 className="wk-h2 wk-ai-title">Dostęp dla AI</h2>
      <p className="wk-note">
        Link tylko do odczytu: asystent AI (ChatGPT, Claude…) czyta przez niego wybrane zbiory tego obszaru — bibliotekę,
        skryptorium, bazy wiedzy — i nic poza nimi. Niczego nie zmieni. To, co przeczyta, trafia do jego dostawcy.
      </p>

      {list === null ? (
        unavailable ? <p className="wk-empty">Dostęp dla AI jest teraz niedostępny — spróbuj później.</p> : error === null ? <Loading lines={2} /> : null
      ) : (
        <>
          {list.accesses.length > 0 && (
            <ul className="wk-link-list">
              {list.accesses.map((row) => (
                <AccessItem
                  key={row.id}
                  row={row}
                  list={list}
                  area={area}
                  ring={ring}
                  containers={containers}
                  justMade={made?.id === row.id ? made.link : null}
                  busy={working !== null}
                  nameOf={nameOf}
                  run={run}
                  setWorking={setWorking}
                />
              ))}
            </ul>
          )}

          {list.leads && containers !== null && ring !== null && list.accesses.filter((a) => !a.expired).length < list.limit && (
            containers.length === 0
              ? <p className="wk-empty">Ten obszar nie ma jeszcze biblioteki, skryptorium ani bazy wiedzy.</p>
              : <CreateForm containers={containers} days={list.days} busy={working !== null} onCreate={(l, d) => void create(l, d)} />
          )}
          {!list.leads && list.accesses.length === 0 && <p className="wk-empty">Link dla AI zakłada ten, kto prowadzi obszar.</p>}
          {list.leads && ring === null && <p className="wk-empty">Odblokuj klucze (hasło), żeby tworzyć linki dla AI.</p>}
        </>
      )}

      {working !== null && <p className="wk-working" role="status">{working}</p>}
      {error !== null && <p className="wk-error" role="alert">{error}</p>}
    </div>
  );
}

/* -- Ein Link ------------------------------------------------------------------------------------- */

function AccessItem({ row, list, area, ring, containers, justMade, busy, nameOf, run, setWorking }: {
  row: AiAccessRow;
  list: AiAccessList;
  area: AreaRow;
  ring: Ring | null;
  containers: readonly Container[] | null;
  justMade: string | null;
  busy: boolean;
  nameOf: (part: AiPart) => string;
  run: (label: string, todo: () => Promise<unknown>) => Promise<void>;
  setWorking: (text: string | null) => void;
}) {
  const [link, setLink] = useState<string | null>(justMade);
  const [extend, setExtend] = useState(false);
  const [editParts, setEditParts] = useState(false);

  useEffect(() => { if (justMade !== null) setLink(justMade); }, [justMade]);

  const state = row.works ? 'działa' : row.expired ? 'wygasł' : !row.ready ? 'niedokończony' : 'nie działa';
  const show = async () => {
    if (ring === null) return;
    setLink(await aiLinkOf(ring, area.areaId, row) ?? '');
  };

  return (
    <li className="wk-link-item">
      <div className="wk-link-head">
        <strong>Link dla AI</strong>
        <span className={row.works ? 'wk-tag wk-tag-open' : 'wk-tag'}>{state}</span>
        <span className="wk-ai-when">
          od {day(row.createdAt)} · ważny do {day(row.expiresAt)} · użyty {times(row.uses)}{row.lastUsedAt === null ? '' : `, ostatnio ${day(row.lastUsedAt)}`}
        </span>
      </div>

      <ul className="wk-ai-parts">
        {row.parts.map((part) => (
          <li key={part.libraryId}>
            <strong>{nameOf(part)}</strong>{' '}
            <span className="wk-tag">{PART_NAME[part.kind]}</span>{' '}
            {part.madeFrom === null ? 'odpis jeszcze nie gotowy'
              : `${part.entries ?? 0} ${plural(part.entries ?? 0, 'wpis', 'wpisy', 'wpisów')} · ${part.fresh ? 'aktualny' : 'do odświeżenia'} (z ${day(part.madeAt ?? row.createdAt)})`}
          </li>
        ))}
      </ul>

      {row.ready && !row.creatorLeads && (
        <p className="wk-warn">Nie działa: osoba, która go utworzyła, nie prowadzi już tego obszaru. Usuń go i utwórz nowy.</p>
      )}

      {link !== null && (link === ''
        ? <p className="wk-warn">Tego linku nie da się pokazać na tym urządzeniu (brak klucza tego obszaru).</p>
        : <AiLinkBox url={link} />)}

      <div className="wk-actions">
        {list.leads && link === null && row.ready && (
          <button type="button" className="wk-btn" disabled={busy || ring === null} onClick={() => void show()}>Pokaż link</button>
        )}
        {list.writes && row.works && ring !== null && (
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => void run('Odświeżam odpisy…', async () => {
              const failed = failedWords(await refreshAiAccess(ring, area.areaId, {
                accessId: row.id, all: true, progress: (done, total) => setWorking(`Odświeżam odpisy… ${done}/${total}`)
              }));
              if (failed !== null) throw new WorkspaceError(failed);
            })}>
            Odśwież teraz
          </button>
        )}
        {list.leads && row.ready && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setExtend((x) => !x)}>Przedłuż</button>
        )}
        {list.leads && row.ready && containers !== null && containers.length > 0 && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setEditParts((x) => !x)}>Zbiory</button>
        )}
        {list.leads && (
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => void (async () => {
              const yes = await ask({
                title: 'Usunąć link dla AI?',
                body: 'Przestanie działać od razu: asystent, który go zna, nic już nie przeczyta. Odpisy znikną.',
                confirm: 'Usuń', danger: true
              });
              if (yes) await run('Usuwam…', async () => { await deleteAiAccess(area.areaId, row.id); forgetAiWatch(area.areaId); });
            })()}>
            Usuń
          </button>
        )}
      </div>

      {extend && (
        <div className="wk-actions">
          <span>Ważny od dziś przez:</span>
          {list.days.map((d) => (
            <button key={d} type="button" className="wk-link-btn" disabled={busy}
              onClick={() => void run('Przedłużam…', async () => { await extendAiAccess(area.areaId, row.id, d); setExtend(false); })}>
              {DAYS_LABEL[d] ?? `${d} dni`}
            </button>
          ))}
        </div>
      )}

      {editParts && containers !== null && ring !== null && (
        <PartsForm
          containers={containers}
          chosen={row.parts.map((p) => p.libraryId)}
          busy={busy}
          label="Zapisz zbiory"
          onSave={(libraries) => void run('Zmieniam zbiory…', async () => {
            await setAiParts(area.areaId, row.id, libraries);
            setEditParts(false);
            forgetAiWatch(area.areaId);
            const failed = failedWords(await refreshAiAccess(ring, area.areaId, { accessId: row.id, progress: (done, total) => setWorking(`Przygotowuję odpisy… ${done}/${total}`) }));
            if (failed !== null) throw new WorkspaceError(failed);
          })}
        />
      )}
    </li>
  );
}

/** Der Link, zum Kopieren — und wie man ihn einem Assistenten gibt. */
function AiLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="wk-link-share">
      <input className="wk-link-url" readOnly value={url} aria-label="Link dla AI" onFocus={(e) => e.currentTarget.select()} />
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); });
        }}>{copied ? 'Skopiowano' : 'Kopiuj link'}</button>
        <a className="wk-link-btn" href={url} target="_blank" rel="noreferrer">Zobacz, co widzi AI</a>
      </div>
      <p className="wk-note">
        Wklej link w rozmowie z AI i napisz, czego szukasz — np. „Przeczytaj {url} i znajdź moje kazania o chlebie”.
        W ChatGPT możesz dodać go na stałe: Utwórz GPT → Konfiguruj → Akcje → Importuj z adresu URL → {url}/openapi.json.
        Kto ma ten link, czyta — wysyłaj go tylko tam, gdzie ma trafić.
      </p>
    </div>
  );
}

/* -- Anlegen ------------------------------------------------------------------------------------- */

function CreateForm({ containers, days, busy, onCreate }: {
  containers: readonly Container[];
  days: readonly number[];
  busy: boolean;
  onCreate: (libraries: readonly string[], days: number) => void;
}) {
  const [length, setLength] = useState(days.includes(90) ? 90 : days[0] ?? 30);

  return (
    <PartsForm containers={containers} chosen={containers.map((c) => c.libraryId)} busy={busy} label="Utwórz link dla AI"
      onSave={(libraries) => onCreate(libraries, length)}>
      <label className="wk-field">
        <span>Ważny przez</span>
        <select value={length} onChange={(e) => setLength(Number(e.target.value))}>
          {days.map((d) => <option key={d} value={d}>{DAYS_LABEL[d] ?? `${d} dni`}</option>)}
        </select>
      </label>
    </PartsForm>
  );
}

/** Welche Behälter des Bereichs der Link zeigt — mindestens einer. */
function PartsForm({ containers, chosen, busy, label, onSave, children }: {
  containers: readonly Container[];
  chosen: readonly string[];
  busy: boolean;
  label: string;
  onSave: (libraries: readonly string[]) => void;
  children?: ReactNode;
}) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(chosen));
  const flip = (id: string) => setPicked((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (picked.size > 0) onSave(containers.filter((c) => picked.has(c.libraryId)).map((c) => c.libraryId)); }}>
      <fieldset className="wk-field">
        <legend>Co czyta AI</legend>
        {containers.map((c) => (
          <label key={c.libraryId} className="wk-check">
            <input type="checkbox" checked={picked.has(c.libraryId)} onChange={() => flip(c.libraryId)} />
            <span>{c.name} <span className="wk-tag">{PART_NAME[c.kind]}</span></span>
          </label>
        ))}
      </fieldset>
      {children}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || picked.size === 0}>{label}</button>
      </div>
    </form>
  );
}

export default AiAccessPanel;
