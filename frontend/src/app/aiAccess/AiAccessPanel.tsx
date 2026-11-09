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

import { WorkspaceError } from '../core/session';
import { libraryKindOf, loadLibraries, openLibraries, type LibraryKind } from '../library/library';
import { appLang, hasKey, localeOf, t as tApp, useT, type T } from '../core/i18n';
import { viewPath } from '../routes';
import { ask } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import {
  aiLinkOf, createAiAccess, deleteAiAccess, extendAiAccess, failedWords, forgetAiWatch, loadAiAccess, mcpUrl, refreshAiAccess, setAiParts,
  type AiAccessList, type AiAccessRow, type AiPart
} from './aiAccess';

/* Der Name eines Teils: `aiAccess.part.<kind>`; die Dauer: `aiAccess.panel.days.d<n>`, sonst „n Tage". */
const PART_ORDER: Readonly<Record<LibraryKind, number>> = { books: 0, writing: 1, knowledge: 2, liturgy: 3 };
const daysLabel = (t: T, d: number): string => (hasKey(`aiAccess.panel.days.d${d}`, t.lang) ? t(`aiAccess.panel.days.d${d}`) : t('aiAccess.panel.daysN', { count: d }));

interface Container {
  readonly libraryId: string;
  readonly kind: LibraryKind;
  readonly name: string;
}

const day = (iso: string): string => new Date(iso).toLocaleDateString(localeOf(appLang()), { day: 'numeric', month: 'short', year: 'numeric' });
const said = (e: unknown): string => (e instanceof WorkspaceError || e instanceof Error) && e.message !== '' ? e.message : tApp('common.failed');

export function AiAccessPanel({ area, ring }: { area: AreaRow; ring: Ring | null }) {
  const [list, setList] = useState<AiAccessList | null>(null);
  const [containers, setContainers] = useState<readonly Container[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Der Dienst kennt den Dostęp dla AI (noch) nicht — ein älterer Dienst: dann still, statt rot. */
  const [unavailable, setUnavailable] = useState(false);
  /** Der eben angelegte Link — einmal offen gezeigt. */
  const [made, setMade] = useState<{ readonly id: string; readonly link: string } | null>(null);
  const t = useT();

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
        const named = ring === null ? rows.map((r) => ({ ...r, name: t(`aiAccess.part.${libraryKindOf(r)}`) })) : await openLibraries(ring, rows);
        if (!alive) return;
        setContainers(named
          .map((r) => ({ libraryId: r.libraryId, kind: libraryKindOf(r), name: r.name }))
          .sort((a, b) => PART_ORDER[a.kind] - PART_ORDER[b.kind] || a.name.localeCompare(b.name, 'pl')));

        /* Wer hier schreibt und die Karte öffnet, frischt alte Abschriften auf — still, mit Stand. */
        if (ring !== null && next.writes && next.accesses.some((a) => a.works && a.parts.some((p) => !p.fresh))) {
          setWorking(t('aiAccess.panel.refreshingAi'));
          const done = await refreshAiAccess(ring, area.areaId, { progress: (d, total) => { if (alive) setWorking(t('aiAccess.panel.refreshingAiN', { done: d, total })); } });
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

  const create = async (libraries: readonly string[], days: number, whole: boolean): Promise<void> => {
    if (ring === null) return;
    const yes = await ask({
      title: t('aiAccess.panel.askCreate'),
      body: t('aiAccess.panel.askCreateBody'),
      confirm: t('aiAccess.panel.createLinkShort')
    });
    if (!yes) return;
    await run(t('aiAccess.panel.creating'), async () => {
      const out = await createAiAccess(ring, area.areaId, libraries, days, (done, total) => setWorking(t('aiAccess.connect.snapshots', { done, total })), whole);
      setMade({ id: out.id, link: out.link });
      const failed = failedWords(out.refresh);
      if (failed !== null) throw new WorkspaceError(failed);
    });
  };

  const nameOf = (part: AiPart): string => containers?.find((c) => c.libraryId === part.libraryId)?.name ?? t(`aiAccess.part.${part.kind}`);

  return (
    <div className="wk-panel">
      <h2 className="wk-h2 wk-ai-title">{t('aiAccess.panel.title')}</h2>
      <p className="wk-note">{t('aiAccess.panel.lead')}</p>
      {/* 0127 — dasselbe als MCP-Server: der Assistent verbindet sich einmal, der Mensch wählt hier angelegte Links. */}
      <p className="wk-note">
        {t('aiAccess.panel.mcpBefore')} <code>{mcpUrl()}</code> {t('aiAccess.panel.mcpAfter')}
      </p>
      {/* 0138 — einen Bereich einer schon bestehenden Verbindung hinzufügen: ohne neue Anmeldung, auf der Seite der Verbindungen. */}
      <ManageLink />

      {list === null ? (
        unavailable ? <p className="wk-empty">{t('aiAccess.panel.unavailable')}</p> : error === null ? <Loading lines={2} /> : null
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
              ? <p className="wk-empty">{t('aiAccess.panel.noContainers')}</p>
              : <CreateForm containers={containers} days={list.days} busy={working !== null} onCreate={(l, d, w) => void create(l, d, w)} />
          )}
          {!list.leads && list.accesses.length === 0 && <p className="wk-empty">{t('aiAccess.panel.leaderOnly')}</p>}
          {list.leads && ring === null && <p className="wk-empty">{t('aiAccess.panel.unlock')}</p>}
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
  const t = useT();

  useEffect(() => { if (justMade !== null) setLink(justMade); }, [justMade]);

  const state = row.works ? t('aiAccess.panel.state.works') : row.expired ? t('aiAccess.panel.state.expired') : !row.ready ? t('aiAccess.panel.state.unfinished') : t('aiAccess.panel.state.broken');
  const show = async () => {
    if (ring === null) return;
    setLink(await aiLinkOf(ring, area.areaId, row) ?? '');
  };

  return (
    <li className="wk-link-item">
      <div className="wk-link-head">
        <strong>{t('aiAccess.connect.linkForAi')}</strong>
        <span className={row.works ? 'wk-tag wk-tag-open' : 'wk-tag'}>{state}</span>
        <span className="wk-ai-when">
          {row.lastUsedAt === null
            ? t('aiAccess.panel.when', { from: day(row.createdAt), until: day(row.expiresAt), count: row.uses })
            : t('aiAccess.panel.whenLast', { from: day(row.createdAt), until: day(row.expiresAt), count: row.uses, last: day(row.lastUsedAt) })}
        </span>
      </div>

      {row.wholeArea === true && <p className="wk-ai-whole">{t('aiAccess.area.whole')}</p>}
      <ul className="wk-ai-parts">
        {row.parts.map((part) => (
          <li key={part.libraryId}>
            <strong>{nameOf(part)}</strong>{' '}
            <span className="wk-tag">{t(`aiAccess.part.${part.kind}`)}</span>{' '}
            {part.madeFrom === null ? t('aiAccess.area.notReady')
              : t(part.fresh ? 'aiAccess.panel.partFresh' : 'aiAccess.panel.partStale', { count: part.entries ?? 0, date: day(part.madeAt ?? row.createdAt) })}
          </li>
        ))}
      </ul>

      {row.ready && !row.creatorLeads && (
        <p className="wk-warn">{t('aiAccess.panel.creatorLeft')}</p>
      )}

      {link !== null && (link === ''
        ? <p className="wk-warn">{t('aiAccess.panel.cannotShow')}</p>
        : <AiLinkBox url={link} />)}

      <div className="wk-actions">
        {list.leads && link === null && row.ready && (
          <button type="button" className="wk-btn" disabled={busy || ring === null} onClick={() => void show()}>{t('aiAccess.panel.showLink')}</button>
        )}
        {list.writes && row.works && ring !== null && (
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => void run(t('aiAccess.panel.refreshing'), async () => {
              const failed = failedWords(await refreshAiAccess(ring, area.areaId, {
                accessId: row.id, all: true, progress: (done, total) => setWorking(t('aiAccess.panel.refreshingN', { done, total }))
              }));
              if (failed !== null) throw new WorkspaceError(failed);
            })}>
            {t('aiAccess.panel.refreshNow')}
          </button>
        )}
        {list.leads && row.ready && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setExtend((x) => !x)}>{t('aiAccess.panel.extend')}</button>
        )}
        {list.leads && row.ready && containers !== null && containers.length > 0 && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setEditParts((x) => !x)}>{t('aiAccess.panel.collections')}</button>
        )}
        {list.leads && (
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => void (async () => {
              const yes = await ask({
                title: t('aiAccess.panel.askDelete'),
                body: t('aiAccess.panel.askDeleteBody'),
                confirm: t('common.delete'), danger: true
              });
              if (yes) await run(t('aiAccess.panel.deleting'), async () => { await deleteAiAccess(area.areaId, row.id); forgetAiWatch(area.areaId); });
            })()}>
            {t('common.delete')}
          </button>
        )}
      </div>

      {extend && (
        <div className="wk-actions">
          <span>{t('aiAccess.panel.validFromToday')}</span>
          {list.days.map((d) => (
            <button key={d} type="button" className="wk-link-btn" disabled={busy}
              onClick={() => void run(t('aiAccess.panel.extending'), async () => { await extendAiAccess(area.areaId, row.id, d); setExtend(false); })}>
              {daysLabel(t, d)}
            </button>
          ))}
        </div>
      )}

      {editParts && containers !== null && ring !== null && (
        <PartsForm
          containers={containers}
          chosen={row.parts.map((p) => p.libraryId)}
          whole={row.wholeArea === true}
          busy={busy}
          label={t('aiAccess.panel.saveCollections')}
          onSave={(libraries, whole) => void run(t('aiAccess.panel.changing'), async () => {
            await setAiParts(area.areaId, row.id, libraries, whole);
            setEditParts(false);
            forgetAiWatch(area.areaId);
            const failed = failedWords(await refreshAiAccess(ring, area.areaId, { accessId: row.id, progress: (done, total) => setWorking(t('aiAccess.connect.snapshots', { done, total })) }));
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
  const t = useT();

  return (
    <div className="wk-link-share">
      <input className="wk-link-url" readOnly value={url} aria-label={t('aiAccess.connect.linkForAi')} onFocus={(e) => e.currentTarget.select()} />
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); });
        }}>{copied ? t('common.copied') : t('aiAccess.panel.copyLink')}</button>
        <a className="wk-link-btn" href={url} target="_blank" rel="noreferrer">{t('aiAccess.panel.seeAsAi')}</a>
      </div>
      <p className="wk-note">{t('aiAccess.panel.howToUse', { url })}</p>
    </div>
  );
}

/* -- Anlegen ------------------------------------------------------------------------------------- */

function CreateForm({ containers, days, busy, onCreate }: {
  containers: readonly Container[];
  days: readonly number[];
  busy: boolean;
  onCreate: (libraries: readonly string[], days: number, whole: boolean) => void;
}) {
  const [length, setLength] = useState(days.includes(90) ? 90 : days[0] ?? 30);
  const t = useT();

  return (
    <PartsForm containers={containers} chosen={containers.map((c) => c.libraryId)} whole busy={busy} label={t('aiAccess.panel.createLink')}
      onSave={(libraries, whole) => onCreate(libraries, length, whole)}>
      <label className="wk-field">
        <span>{t('aiAccess.panel.validFor')}</span>
        <select value={length} onChange={(e) => setLength(Number(e.target.value))}>
          {days.map((d) => <option key={d} value={d}>{daysLabel(t, d)}</option>)}
        </select>
      </label>
    </PartsForm>
  );
}

/**
 * Welche Behälter des Bereichs der Link zeigt — mindestens einer. 2026-10-24 (0128): oder der
 * ganze Bereich, auch was später dazukommt (eine neue Bibliothek, eine Baza wiedzy).
 */
function PartsForm({ containers, chosen, whole: wholeAtStart = false, busy, label, onSave, children }: {
  containers: readonly Container[];
  chosen: readonly string[];
  whole?: boolean;
  busy: boolean;
  label: string;
  onSave: (libraries: readonly string[], whole: boolean) => void;
  children?: ReactNode;
}) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(chosen));
  const [whole, setWhole] = useState(wholeAtStart);
  const t = useT();
  const flip = (id: string) => setPicked((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <form className="wk-form" onSubmit={(e) => {
      e.preventDefault();
      if (whole) onSave(containers.map((c) => c.libraryId), true);
      else if (picked.size > 0) onSave(containers.filter((c) => picked.has(c.libraryId)).map((c) => c.libraryId), false);
    }}>
      <fieldset className="wk-field">
        <legend>{t('aiAccess.panel.whatReads')}</legend>
        <label className="wk-check">
          <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} />
          <span>{t('aiAccess.panel.wholeArea')}</span>
        </label>
        {containers.map((c) => (
          <label key={c.libraryId} className="wk-check">
            <input type="checkbox" checked={whole || picked.has(c.libraryId)} disabled={whole} onChange={() => flip(c.libraryId)} />
            <span>{c.name} <span className="wk-tag">{t(`aiAccess.part.${c.kind}`)}</span></span>
          </label>
        ))}
      </fieldset>
      {children}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || (!whole && picked.size === 0)}>{label}</button>
      </div>
    </form>
  );
}

/** 0138 — zur Seite der MCP-Verbindungen (im Konto), wo Bereiche ohne neue Anmeldung dazukommen. */
function ManageLink() {
  const t = useT();
  return <p className="wk-hint">{t('aiAccess.manageHint')} <a href={viewPath('account', 'dostep-ai')}>{t('aiAccess.manage')}</a></p>;
}

export default AiAccessPanel;
