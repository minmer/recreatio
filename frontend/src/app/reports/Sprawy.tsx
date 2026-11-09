/**
 * 0129–0131 — SPRAWY: was ein Mensch entscheiden muss und nicht übersehen darf.
 *
 * <code>
 *   Zgłoszenia treści     der Betreiber: Meldungen öffnen (seine Rolle), entscheiden (unterschrieben, in der Kette)
 *   Katalog wydarzeń      der Betreiber: Karten für recreatio.pl/events freigeben
 *   Prośby o miejsce      Listen „Wydarzenia", die ich pflege
 *   Zablokowane           was von mir nach einer Meldung gesperrt ist — mit Widerspruch
 *   Administrator danych  Bitten, Angebote, Bereiche ohne Administrator — entschieden in den Ustawienia
 * </code>
 *
 * Woher: die Glocke (`Notify.Duties.cs`) und, für die Fälle selbst, die eigenen Abfragen.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { keysFor } from '../core/ringOf';
import type { Ring } from '../core/keys';
import { API, WorkspaceError, type Who } from '../core/session';
import type { TakedownAction } from '../core/dutyRecords';
import { current as notifyNow, refresh as refreshNotify, subscribe as notifySubscribe, type Duties } from '../notify/notify';
import { decideListing, eventImageUrl, loadEvent, openCard, whenText, type CardTexts, type EventCard } from '../events/events';
import { Unlock } from '../shell/Unlock';
import { pagePath, pageSteps, viewPath } from '../routes';
import { ask, toast } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import {
  ACTION_WORDS, actionsFor, checkLedger, DECISION_REASONS, decideReport, KIND_WORDS, loadLedger, loadMyTakedowns, loadQueue,
  openLetter, openObjection, operatorKey, REASONS, sendObjection, STATE_WORDS,
  type ChainHead, type DecisionReason, type MyTakedown, type OperatorKey, type QueueRow, type ReportLetter
} from './reports';
import type { ReportKind } from './reportPath';
import { appLang, localeOf, rich, useT } from '../core/i18n';

const said = (e: unknown, fallback: string) => (e instanceof WorkspaceError || (e instanceof Error && e.message !== '') ? e.message : fallback);

const day = (iso: string) => new Date(iso).toLocaleString(localeOf(appLang()), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const date = (iso: string) => new Date(iso).toLocaleDateString(localeOf(appLang()), { day: 'numeric', month: 'long', year: 'numeric' });
const code = (s: string, key: number) => <code key={key} className="wk-case-id">{s}</code>;

const kindWord = (kind: string): string => KIND_WORDS[kind as ReportKind] ?? kind;

/** Wo der Betreiber die Sache sieht (wenn sie offen ist) — eine Nachricht hat keinen Ort, nur das Zitat. */
function itemHref(row: { itemKind: string; itemId: string; path: string | null }): string | null {
  if (row.itemKind === 'file') return `${API}/page-image/${encodeURIComponent(row.itemId)}`;
  if (row.path === null) return null;
  return row.itemKind === 'part' ? `${pagePath(row.path)}?part=${encodeURIComponent(row.itemId)}` : pagePath(row.path);
}

export function SprawyView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const { digest } = useSyncExternalStore(notifySubscribe, notifyNow);
  const duties = digest?.duties ?? null;
  const t = useT();

  /* Was die Abschnitte, die selbst laden, gefunden haben — für „nichts wartet". */
  const [found, setFound] = useState<Readonly<Record<'operator' | 'takedowns', boolean | undefined>>>({ operator: undefined, takedowns: undefined });
  const tell = useCallback((key: 'operator' | 'takedowns', any: boolean) => setFound((was) => (was[key] === any ? was : { ...was, [key]: any })), []);

  const catalogue = (duties?.listings ?? []).filter((one) => one.catalogue);
  const lists = (duties?.listings ?? []).filter((one) => !one.catalogue);
  const controllerCount = duties === null ? 0
    : duties.controllers.asks.length + duties.controllers.offers.length + duties.controllers.decided.length
      + duties.controllers.nobody.length + duties.controllers.missing.length + (duties.controllers.pages?.length ?? 0);

  const nothing = digest !== null && found.operator === false && found.takedowns === false && lists.length === 0 && controllerCount === 0;

  return (
    <div className="wk-narrow ui-page wk-sprawy" data-sprawy="">
      <OperatorSection who={who} focus={trail[0] ?? null} catalogue={catalogue} onFound={(any) => tell('operator', any)} />
      {lists.length > 0 && (
        <section aria-labelledby="sprawy-lists-h">
          <h2 className="wk-h2" id="sprawy-lists-h">{t('reports.sprawy.listsTitle')}</h2>
          {lists.map((one) => <ListingRow key={`${one.areaId}|${one.moduleId}`} row={one} catalogue={false} />)}
        </section>
      )}
      <TakedownSection stamp={(duties?.takedowns ?? []).map((t) => `${t.id}:${t.state}:${t.objectedAt ?? ''}`).join(',')}
        onFound={(any) => tell('takedowns', any)} />
      {duties !== null && controllerCount > 0 && <ControllerSection duties={duties} />}
      {nothing && <p className="wk-empty">{t('reports.sprawy.nothing')}</p>}
      {digest === null && found.operator === undefined && <Loading lines={2} />}
    </div>
  );
}

/* -- Der Betreiber ----------------------------------------------------------------------- */

interface Queue { readonly reports: readonly QueueRow[]; readonly head: ChainHead; readonly op: OperatorKey }

function OperatorSection({ who, focus, catalogue, onFound }: {
  who: Who;
  /** Eine Meldung, zu der die Glocke führte (`#/workspace/sprawy/<kennung>`). */
  focus: string | null;
  catalogue: Duties['listings'];
  onFound: (any: boolean) => void;
}) {
  /* `null`: dieses Konto ist nicht der Betreiber (der Dienst sagt 403). */
  const [queue, setQueue] = useState<Queue | null | undefined>(undefined);
  const [ring, setRing] = useState<Ring | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const again = useCallback(() => setRound((n) => n + 1), []);
  const t = useT();

  useEffect(() => {
    let alive = true;
    void (async () => {
      let list: Awaited<ReturnType<typeof loadQueue>>;
      try {
        list = await loadQueue();
      } catch {
        /* Nicht der Betreiber (der Dienst sagt 403) — dann gibt es diesen Abschnitt nicht. */
        if (alive) setQueue((was) => (was === undefined ? null : was));
        return;
      }
      try {
        const op = await operatorKey();
        if (!alive) return;
        setQueue({ ...list, op });
        setFailed(null);
        const keys = await keysFor(who);
        if (alive) setRing(keys.ring);
      } catch (e) {
        if (alive) setFailed(said(e, t('reports.sprawy.opKeyFailed')));
      }
    })();
    return () => { alive = false; };
  }, [who, round]);

  useEffect(() => {
    if (queue === undefined) return;
    onFound(queue !== null || catalogue.length > 0);
  }, [queue, catalogue.length, onFound]);

  /* Zur Meldung, zu der die Glocke führte. */
  useEffect(() => {
    if (focus === null || queue == null) return undefined;
    const timer = window.setTimeout(() => document.getElementById(`report-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    return () => window.clearTimeout(timer);
  }, [focus, queue === null || queue === undefined]);

  if (queue === undefined) return failed === null ? null : <p className="wk-error" role="alert">{failed}</p>;
  if (queue === null) return null;

  const open = queue.reports.filter((r) => r.state === 'received' || r.state === 'objected');
  const blocked = queue.reports.filter((r) => r.state === 'blocked' || r.state === 'restored');
  const closed = queue.reports.filter((r) => r.state === 'deleted' || r.state === 'rejected');
  const opRole = queue.op.roleId;
  const holds = ring != null && ring.has(opRole) && ring.maySign(opRole);

  const decided = () => { again(); void refreshNotify(); };
  const cases = (rows: readonly QueueRow[]) => rows.map((row) => (
    <ReportCase key={row.id} row={row} ring={holds ? ring! : null} opRole={opRole} head={queue.head} focused={row.id === focus} onDecided={decided} />
  ));

  return (
    <>
      <section aria-labelledby="sprawy-reports-h" data-operator="">
        <h2 className="wk-h2" id="sprawy-reports-h">{t('workspace.duty.reports')}</h2>
        {ring === null && (
          <Unlock who={who} why={t('reports.sprawy.unlockWhy')} onDone={again} />
        )}
        {ring != null && !holds && (
          <p className="wk-warn">{t('reports.sprawy.noOpKey')}</p>
        )}
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        {open.length === 0 ? <p className="wk-empty">{t('reports.sprawy.noNew')}</p> : cases(open)}
        {blocked.length > 0 && (
          <>
            <h3 className="wk-h3 wk-case-group">{t('reports.sprawy.blockedRestored', { count: blocked.length })}</h3>
            {cases(blocked)}
          </>
        )}
        {closed.length > 0 && (
          <details className="wk-fold">
            <summary>{t('reports.sprawy.closed', { count: closed.length })}</summary>
            <div className="wk-case-list">{cases(closed)}</div>
          </details>
        )}
        <LedgerCheck signPublicKey={queue.op.signPublicKey} head={queue.head} />
      </section>

      {catalogue.length > 0 && (
        <section aria-labelledby="sprawy-catalogue-h">
          <h2 className="wk-h2" id="sprawy-catalogue-h">{t('reports.sprawy.catalogue')}</h2>
          {catalogue.map((one) => <ListingRow key={`${one.areaId}|${one.moduleId}`} row={one} catalogue />)}
        </section>
      )}
    </>
  );
}

function ReportCase({ row, ring, opRole, head, focused, onDecided }: {
  row: QueueRow;
  /** `null`: dieser Bund hält die Rolle des Betreibers (noch) nicht. */
  ring: Ring | null;
  opRole: string;
  head: ChainHead;
  focused: boolean;
  onDecided: () => void;
}) {
  /* `undefined`: noch nicht geöffnet; `null`: der Text ist nach einem halben Jahr fort. */
  const [letter, setLetter] = useState<ReportLetter | null | undefined>(undefined);
  const [objection, setObjection] = useState<string | null>(null);
  const [reason, setReason] = useState<DecisionReason>(row.reason === 'data' ? 'personal-data' : row.reason === 'illegal' ? 'illegal' : 'other');
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const openIt = useCallback(async () => {
    if (ring === null) return;
    setFailed(null);
    try {
      setLetter(await openLetter(ring, opRole, row));
      setObjection(row.objection === null ? null : await openObjection(ring, opRole, row));
    } catch (e) {
      setFailed(said(e, t('reports.sprawy.openFailed')));
    }
  }, [ring, opRole, row]);

  /* Aus der Glocke gekommen: gleich offen. */
  useEffect(() => { if (focused && letter === undefined && ring !== null) void openIt(); }, [focused, ring, letter, openIt]);

  const actions = actionsFor(row);

  const act = async (action: TakedownAction) => {
    if (ring === null || letter == null) return;
    if (action === 'delete') {
      const yes = await ask({
        title: t('reports.sprawy.askDelete'),
        body: t('reports.sprawy.askDeleteBody'),
        confirm: t('reports.action.delete'),
        danger: true
      });
      if (!yes) return;
    }
    setBusy(true);
    setFailed(null);
    try {
      await decideReport(ring, opRole, row, letter, action, reason, head);
      toast(t('reports.sprawy.saved', { action: ACTION_WORDS[action].toLocaleLowerCase(localeOf(appLang())) }), { kind: 'ok' });
      onDecided();
    } catch (e) {
      const moved = e instanceof WorkspaceError && e.message.startsWith('Łańcuch się przesunął'); // i18n-ignore — Satz des Dienstes
      setFailed(moved ? t('reports.sprawy.moved') : said(e, t('reports.sprawy.decideFailed')));
      if (moved) onDecided();
    } finally {
      setBusy(false);
    }
  };

  const href = itemHref(row);
  const tag = row.state === 'received' || row.state === 'objected' ? 'wk-tag-warn'
    : row.state === 'blocked' ? 'wk-tag-danger' : row.state === 'deleted' ? 'wk-tag' : 'wk-tag-ok';

  return (
    <article className="wk-box wk-case" id={`report-${row.id}`} data-report-case={row.state} data-report-kind={row.itemKind}>
      <div className="wk-case-head">
        <strong>{kindWord(row.itemKind)}</strong>
        <span className={`wk-tag ${tag}`}>{STATE_WORDS[row.state] ?? row.state}</span>
        <span className="wk-case-when">{day(row.receivedAt)}</span>
      </div>
      <div className="wk-case-body">
        {href !== null && (
          <p><a className="wk-link" href={href} target="_blank" rel="noopener noreferrer">{row.path === null ? t('reports.sprawy.openFile') : `recreatio.pl/${row.path}`}</a></p>
        )}
        {(row.areaName !== null || row.controllerName !== null) && (
          <p className="wk-case-meta">
            {row.areaName !== null && t('reports.sprawy.area', { name: row.areaName })}
            {row.areaName !== null && row.controllerName !== null && ' · '}
            {row.controllerName !== null && t('reports.sprawy.controller', { name: row.controllerName })}
          </p>
        )}
        <p className="wk-case-meta">{t('reports.sprawy.number')} <code className="wk-case-id">{row.itemKind}/{row.itemId}</code></p>
        {row.blockedSince !== null && (
          <p className="wk-case-meta">
            {t('reports.sprawy.blockedSince', { date: day(row.blockedSince) })}
            {row.state === 'blocked' && row.deleteFrom !== null && <> · {t('reports.sprawy.deleteFrom', { date: date(row.deleteFrom) })}</>}
          </p>
        )}
        {row.objectedAt !== null && <p className="wk-case-meta">{t('reports.sprawy.objected', { date: day(row.objectedAt) })}</p>}

        {letter === undefined ? (
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ring === null} onClick={() => void openIt()} data-report-open="">
              {t('reports.sprawy.openReport')}
            </button>
          </div>
        ) : letter === null ? (
          <p className="wk-case-meta">{t('reports.sprawy.letterGone')}</p>
        ) : (
          <Letter letter={letter} objection={objection} />
        )}

        {letter != null && actions.length > 0 && (
          <div className="wk-case-decide">
            {(actions.includes('block') || actions.includes('delete')) && (
              <label className="wk-field wk-case-reason">
                <span>{t('reports.sprawy.reasonLabel')}</span>
                <select value={reason} disabled={busy} onChange={(e) => setReason(e.target.value as DecisionReason)}>
                  {(Object.keys(DECISION_REASONS) as DecisionReason[]).map((key) => <option key={key} value={key}>{DECISION_REASONS[key]}</option>)}
                </select>
              </label>
            )}
            <div className="wk-actions">
              {actions.map((action) => (
                <button key={action} type="button" disabled={busy} data-report-action={action}
                  className={action === 'delete' ? 'wk-btn wk-btn-danger' : action === 'block' ? 'wk-btn' : 'wk-btn wk-btn-line'}
                  onClick={() => void act(action)}>
                  {ACTION_WORDS[action]}
                </button>
              ))}
            </div>
            <p className="wk-report-small">{t('reports.sprawy.signedNote')}</p>
          </div>
        )}
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
      </div>
    </article>
  );
}

function Letter({ letter, objection }: { letter: ReportLetter; objection: string | null }) {
  const t = useT();
  return (
    <div className="wk-case-letter" data-report-letter="">
      <p><strong>{REASONS.find((one) => one.value === letter.reason)?.label ?? letter.reason}</strong> · {t('reports.sprawy.sentAt', { date: day(letter.sentAt) })}</p>
      <p className="wk-case-text">{letter.text}</p>
      {letter.quote !== null && (
        <>
          <p className="wk-case-meta">{t('reports.sprawy.quote')}</p>
          <blockquote className="wk-case-quote">{letter.quote}</blockquote>
        </>
      )}
      <p className="wk-case-meta">{letter.contact === null ? t('reports.sprawy.noContact') : t('reports.sprawy.contact', { contact: letter.contact })}</p>
      {objection !== null && (
        <div className="wk-case-objection">
          <p><strong>{t('reports.sprawy.authorObjection')}</strong></p>
          <p className="wk-case-text">{objection}</p>
        </div>
      )}
    </div>
  );
}

/** Die Kette nachrechnen — im Browser, gegen den öffentlichen Schlüssel der Rolle des Betreibers. */
function LedgerCheck({ signPublicKey, head }: { signPublicKey: string; head: ChainHead }) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const t = useT();
  const [busy, setBusy] = useState(false);

  if (head.sequence === 0) return null;

  const run = async () => {
    setBusy(true);
    try {
      const { entries } = await loadLedger();
      const check = await checkLedger(entries, signPublicKey);
      setResult(check.broken === null
        ? { ok: true, text: entries.length < head.sequence
          ? t('reports.sprawy.chainOkLast', { count: check.checked, last: entries.length, total: head.sequence })
          : t('reports.sprawy.chainOk', { count: check.checked }) }
        : { ok: false, text: check.broken });
    } catch (e) {
      setResult({ ok: false, text: said(e, t('reports.sprawy.chainFailed')) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-actions wk-ledger" data-ledger="">
      <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" disabled={busy} onClick={() => void run()}>
        {busy ? t('seats.checking') : t('reports.sprawy.checkChain')}
      </button>
      {result !== null && <span className={result.ok ? 'wk-done' : 'wk-error'} data-ledger-result={result.ok ? 'ok' : 'broken'}>{result.text}</span>}
    </div>
  );
}

/* -- Listen von Wydarzenia ----------------------------------------------------------------- */

function ListingRow({ row, catalogue }: { row: Duties['listings'][number]; catalogue: boolean }) {
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ card: EventCard; texts: CardTexts } | 'none' | null>(null);
  const t = useT();

  const decide = async (accept: boolean) => {
    setBusy(true);
    setFailed(null);
    try {
      await decideListing(row.areaId, row.moduleId, accept, catalogue && accept && checked);
      toast(accept ? t('reports.sprawy.listed') : t('reports.sprawy.refused'), { kind: 'ok' });
      void refreshNotify();
    } catch (e) {
      setFailed(said(e, t('common.failed')));
    } finally {
      setBusy(false);
    }
  };

  const show = async () => {
    try {
      const { event } = await loadEvent(row.areaId);
      setPreview({ card: event, texts: await openCard(event) });
    } catch {
      setPreview('none');
    }
  };

  return (
    <article className="wk-box wk-case" data-listing={catalogue ? 'catalogue' : 'list'}>
      <div className="wk-case-head">
        <strong>{row.name}</strong>
        {row.path !== null && <span className="wk-case-when">{t('reports.sprawy.list')} <a className="wk-link" href={pagePath(row.path)} target="_blank" rel="noopener noreferrer">{`recreatio.pl/${row.path}`}</a></span>}
      </div>
      <div className="wk-case-body">
        {preview === null ? (
          <div className="wk-actions"><button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={() => void show()}>{t('reports.sprawy.showCard')}</button></div>
        ) : preview === 'none' ? (
          <p className="wk-case-meta">{t('reports.sprawy.notPublic')}</p>
        ) : (
          <EventPreview card={preview.card} texts={preview.texts} />
        )}
        {catalogue && (
          <label className="wk-check">
            <input type="checkbox" checked={checked} disabled={busy} onChange={(e) => setChecked(e.target.checked)} data-listing-nodata="" />
            <span>{t('reports.sprawy.noPersonal')}</span>
          </label>
        )}
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy || (catalogue && !checked)} onClick={() => void decide(true)}>
            {catalogue ? t('reports.sprawy.showInCatalogue') : t('reports.sprawy.showInList')}
          </button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => void decide(false)}>{t('reports.sprawy.refuse')}</button>
        </div>
        {catalogue && <p className="wk-report-small">{t('reports.sprawy.consentNote')}</p>}
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
      </div>
    </article>
  );
}

function EventPreview({ card, texts }: { card: EventCard; texts: CardTexts }) {
  const when = whenText(card.item);
  const t = useT();
  return (
    <div className="wk-case-card" data-event-preview={card.areaId}>
      {card.page.imageId !== null && <img src={eventImageUrl(card.page.imageId)} alt="" loading="lazy" />}
      <div>
        <p><strong>{texts.title ?? card.page.title ?? card.name}</strong></p>
        {when !== null && <p className="wk-case-meta">{when}{texts.location !== null && ` · ${texts.location}`}</p>}
        {card.page.lead !== null && <p className="wk-case-text">{card.page.lead}</p>}
        {card.organiser !== null && <p className="wk-case-meta">{t('reports.sprawy.organiser', { name: card.organiser })}</p>}
        <p><a className="wk-link" href={pagePath(card.page.path)} target="_blank" rel="noopener noreferrer">{t('reports.sprawy.eventPage')}</a></p>
      </div>
    </div>
  );
}

/* -- Was von mir gesperrt ist ---------------------------------------------------------------- */

function TakedownSection({ stamp, onFound }: {
  /** Was die Glocke über meine gesperrten Inhalte weiss — ändert es sich, lädt der Abschnitt neu. */
  stamp: string;
  onFound: (any: boolean) => void;
}) {
  const [rows, setRows] = useState<readonly MyTakedown[] | undefined>(undefined);
  const t = useT();
  const [failed, setFailed] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    loadMyTakedowns()
      .then((found) => { if (alive) { setRows(found.takedowns); setFailed(null); } })
      .catch((e: unknown) => { if (alive) { setRows([]); setFailed(said(e, t('reports.sprawy.takedownsFailed'))); } });
    return () => { alive = false; };
  }, [round, stamp]);

  useEffect(() => { if (rows !== undefined) onFound(rows.length > 0); }, [rows, onFound]);

  if (rows === undefined || (rows.length === 0 && failed === null)) return null;

  return (
    <section aria-labelledby="sprawy-takedowns-h">
      <h2 className="wk-h2" id="sprawy-takedowns-h">{t('reports.sprawy.takedowns')}</h2>
      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
      {rows.map((one) => <TakedownRow key={one.id} row={one} onSent={() => { setRound((n) => n + 1); void refreshNotify(); }} />)}
    </section>
  );
}

function TakedownRow({ row, onSent }: { row: MyTakedown; onSent: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const href = row.path === null ? null : pagePath(row.path);
  const t = useT();

  const send = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await sendObjection(row, text);
      toast(t('reports.sprawy.objectionSent'), { kind: 'ok' });
      setText('');
      onSent();
    } catch (e) {
      setFailed(said(e, t('reports.sprawy.objectionFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="wk-box wk-case" data-takedown={row.state}>
      <div className="wk-case-head">
        <strong>{kindWord(row.itemKind)}</strong>
        <span className={`wk-tag ${row.state === 'blocked' ? 'wk-tag-danger' : ''}`}>{row.state === 'blocked' ? t('reports.sprawy.blocked') : t('reports.sprawy.deleted')}</span>
        <span className="wk-case-when">{day(row.since)}</span>
      </div>
      <div className="wk-case-body">
        {href !== null && <p><a className="wk-link" href={href}>{`recreatio.pl/${row.path}`}</a></p>}
        <p className="wk-case-meta">{rich(t('reports.sprawy.reasonLine', { reason: DECISION_REASONS[row.reason] ?? row.reason, id: `${row.itemKind}/${row.itemId}` }), { code })}</p>
        {row.state === 'deleted' ? (
          <p className="wk-case-meta">{t('reports.sprawy.operatorDeleted')}</p>
        ) : row.objectedAt !== null ? (
          <p className="wk-case-meta">{t('reports.sprawy.objectionSentAt', { date: day(row.objectedAt) })}</p>
        ) : (
          <form className="wk-form wk-case-object" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3 && !busy) void send(); }}>
            <p className="wk-case-meta">{t('reports.sprawy.objectUntil', { date: date(row.objectUntil) })}</p>
            <label className="wk-field">
              <span>{t('reports.sprawy.objection')}</span>
              <textarea rows={3} maxLength={5000} value={text} disabled={busy} data-objection-text=""
                placeholder={t('reports.sprawy.objectionPlaceholder')}
                onChange={(e) => setText(e.target.value)} />
            </label>
            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy || text.trim().length < 3} data-objection-send="">
                {busy ? t('reports.sprawy.sending') : t('reports.sprawy.sendObjection')}
              </button>
            </div>
          </form>
        )}
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
      </div>
    </article>
  );
}

/* -- Administrator danych: wohin ------------------------------------------------------------ */

function ControllerSection({ duties }: { duties: Duties }) {
  const c = duties.controllers;
  const settings = (areaId: string) => viewPath('areas', areaId, 'ustawienia');
  const t = useT();
  const lacking = (m: Duties['controllers']['missing'][number]) => [
    m.terms ? null : t('reports.ctrl.lackTerms'),
    m.confirmed ? null : t('reports.ctrl.lackConfirm'),
    m.complete ? null : t('reports.ctrl.lackData')
  ].filter((one): one is string => one !== null).join(', ');

  const lines = useMemo(() => [
    ...c.asks.map((one) => ({ key: `a${one.attachmentId}`, href: settings(one.homeAreaId), title: t('reports.ctrl.ask', { area: one.areaName ?? t('reports.ctrl.area'), name: one.controllerName }), sub: t('reports.ctrl.askSub'), warn: true })),
    ...c.offers.map((one) => ({ key: `o${one.attachmentId}`, href: settings(one.areaId), title: t('reports.ctrl.offer', { area: one.areaName ?? t('workspace.duty.areaOf'), name: one.controllerName }), sub: t('reports.ctrl.offerSub'), warn: true })),
    ...c.decided.map((one) => ({ key: `d${one.attachmentId}`, href: settings(one.areaId), title: t(one.state === 'live' ? 'reports.ctrl.decidedLive' : 'reports.ctrl.decidedRefused', { name: one.controllerName, area: one.areaName ?? t('workspace.duty.areaOf') }), sub: one.state === 'live' ? t('reports.ctrl.liveSub') : t('reports.ctrl.refusedSub'), warn: one.state !== 'live' })),
    ...c.nobody.map((one) => ({ key: `n${one.areaId}`, href: settings(one.areaId), title: t('reports.ctrl.nobody', { area: one.areaName }), sub: t('reports.ctrl.nobodySub'), warn: true })),
    ...c.missing.map((one) => ({ key: `m${one.controllerId}`, href: settings(one.homeAreaId), title: t('reports.ctrl.missing', { name: one.name, what: lacking(one) }), sub: t('reports.ctrl.missingSub'), warn: true })),
    ...(c.pages ?? []).map((one) => ({ key: `p${one.path}`, href: viewPath('pages', ...pageSteps(one.path)), title: t('reports.ctrl.page', { path: one.path }), sub: t('reports.ctrl.pageSub'), warn: true }))
  ], [c, t]);

  return (
    <section aria-labelledby="sprawy-controllers-h">
      <h2 className="wk-h2" id="sprawy-controllers-h">{t('reports.ctrl.title')}</h2>
      <div className="wk-box">
        {lines.map((one, i) => (
          <a key={one.key} className={`wk-line is-wrap${i === 0 ? ' wk-line-first' : ''}`} href={one.href} data-duty={one.key[0]}>
            <span className="wk-line-text">
              <span className="wk-line-title">{one.title}</span>
              <span className="wk-line-sub">{one.sub}</span>
            </span>
            <span className="wk-line-end">{one.warn ? t('common.open') : t('reports.ctrl.see')} ›</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export default SprawyView;
