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

const said = (e: unknown, fallback: string) => (e instanceof WorkspaceError || (e instanceof Error && e.message !== '') ? e.message : fallback);

const day = (iso: string) => new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const date = (iso: string) => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

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
          <h2 className="wk-h2" id="sprawy-lists-h">Prośby o miejsce na liście wydarzeń</h2>
          {lists.map((one) => <ListingRow key={`${one.areaId}|${one.moduleId}`} row={one} catalogue={false} />)}
        </section>
      )}
      <TakedownSection stamp={(duties?.takedowns ?? []).map((t) => `${t.id}:${t.state}:${t.objectedAt ?? ''}`).join(',')}
        onFound={(any) => tell('takedowns', any)} />
      {duties !== null && controllerCount > 0 && <ControllerSection duties={duties} />}
      {nothing && <p className="wk-empty">Nic nie czeka na Twoją decyzję.</p>}
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
        if (alive) setFailed(said(e, 'Nie udało się wczytać klucza operatora.'));
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
        <h2 className="wk-h2" id="sprawy-reports-h">Zgłoszenia treści</h2>
        {ring === null && (
          <Unlock who={who} why="Zgłoszenia są zaszyfrowane dla roli operatora — otworzysz je i podpiszesz decyzję jej kluczem." onDone={again} />
        )}
        {ring != null && !holds && (
          <p className="wk-warn">Ta przeglądarka nie ma klucza roli operatora — zgłoszenia otworzy i rozstrzygnie tylko konto, które ją prowadzi.</p>
        )}
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        {open.length === 0 ? <p className="wk-empty">Nowych zgłoszeń nie ma.</p> : cases(open)}
        {blocked.length > 0 && (
          <>
            <h3 className="wk-h3 wk-case-group">Zablokowane i przywrócone ({blocked.length})</h3>
            {cases(blocked)}
          </>
        )}
        {closed.length > 0 && (
          <details className="wk-fold">
            <summary>Rozpatrzone ({closed.length})</summary>
            <div className="wk-case-list">{cases(closed)}</div>
          </details>
        )}
        <LedgerCheck signPublicKey={queue.op.signPublicKey} head={queue.head} />
      </section>

      {catalogue.length > 0 && (
        <section aria-labelledby="sprawy-catalogue-h">
          <h2 className="wk-h2" id="sprawy-catalogue-h">Katalog wydarzeń</h2>
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
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const openIt = useCallback(async () => {
    if (ring === null) return;
    setFailed(null);
    try {
      setLetter(await openLetter(ring, opRole, row));
      setObjection(row.objection === null ? null : await openObjection(ring, opRole, row));
    } catch (e) {
      setFailed(said(e, 'Nie udało się otworzyć zgłoszenia.'));
    }
  }, [ring, opRole, row]);

  /* Aus der Glocke gekommen: gleich offen. */
  useEffect(() => { if (focused && letter === undefined && ring !== null) void openIt(); }, [focused, ring, letter, openIt]);

  const actions = actionsFor(row);

  const act = async (action: TakedownAction) => {
    if (ring === null || letter == null) return;
    if (action === 'delete') {
      const yes = await ask({
        title: 'Usunąć tę treść na zawsze?',
        body: 'Zniknie bezpowrotnie — nie da się jej przywrócić. Decyzja zostanie podpisana kluczem roli operatora i dopisana do łańcucha.',
        confirm: 'Usuń na zawsze',
        danger: true
      });
      if (!yes) return;
    }
    setBusy(true);
    setFailed(null);
    try {
      await decideReport(ring, opRole, row, letter, action, reason, head);
      toast(`Zapisano: ${ACTION_WORDS[action].toLocaleLowerCase('pl-PL')}.`, { kind: 'ok' });
      onDecided();
    } catch (e) {
      const moved = e instanceof WorkspaceError && e.message.startsWith('Łańcuch się przesunął');
      setFailed(moved ? 'Łańcuch się przesunął — lista jest odświeżona, podejmij decyzję jeszcze raz.' : said(e, 'Nie udało się zapisać decyzji.'));
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
          <p><a className="wk-link" href={href} target="_blank" rel="noopener noreferrer">{row.path === null ? 'Otwórz plik' : `recreatio.pl/${row.path}`}</a></p>
        )}
        {(row.areaName !== null || row.controllerName !== null) && (
          <p className="wk-case-meta">
            {row.areaName !== null && <>Obszar: {row.areaName}</>}
            {row.areaName !== null && row.controllerName !== null && ' · '}
            {row.controllerName !== null && <>Administrator danych: {row.controllerName}</>}
          </p>
        )}
        <p className="wk-case-meta">Numer: <code className="wk-case-id">{row.itemKind}/{row.itemId}</code></p>
        {row.blockedSince !== null && (
          <p className="wk-case-meta">
            Zablokowane od {day(row.blockedSince)}
            {row.state === 'blocked' && row.deleteFrom !== null && <> · usunąć na zawsze można od {date(row.deleteFrom)}</>}
          </p>
        )}
        {row.objectedAt !== null && <p className="wk-case-meta">Autor odwołał się {day(row.objectedAt)}.</p>}

        {letter === undefined ? (
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ring === null} onClick={() => void openIt()} data-report-open="">
              Otwórz zgłoszenie
            </button>
          </div>
        ) : letter === null ? (
          <p className="wk-case-meta">Treść zgłoszenia usunięto pół roku po decyzji — zostało, co zgłoszono i jak zdecydowano.</p>
        ) : (
          <Letter letter={letter} objection={objection} />
        )}

        {letter != null && actions.length > 0 && (
          <div className="wk-case-decide">
            {(actions.includes('block') || actions.includes('delete')) && (
              <label className="wk-field wk-case-reason">
                <span>Powód decyzji (zobaczy go autor)</span>
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
            <p className="wk-report-small">Decyzję podpisuje klucz roli operatora; trafia do łańcucha, którego nie da się po cichu zmienić.</p>
          </div>
        )}
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
      </div>
    </article>
  );
}

function Letter({ letter, objection }: { letter: ReportLetter; objection: string | null }) {
  return (
    <div className="wk-case-letter" data-report-letter="">
      <p><strong>{REASONS.find((one) => one.value === letter.reason)?.label ?? letter.reason}</strong> · wysłane {day(letter.sentAt)}</p>
      <p className="wk-case-text">{letter.text}</p>
      {letter.quote !== null && (
        <>
          <p className="wk-case-meta">Co widział zgłaszający:</p>
          <blockquote className="wk-case-quote">{letter.quote}</blockquote>
        </>
      )}
      <p className="wk-case-meta">{letter.contact === null ? 'Bez kontaktu do zgłaszającego.' : <>Kontakt: {letter.contact}</>}</p>
      {objection !== null && (
        <div className="wk-case-objection">
          <p><strong>Odwołanie autora</strong></p>
          <p className="wk-case-text">{objection}</p>
        </div>
      )}
    </div>
  );
}

/** Die Kette nachrechnen — im Browser, gegen den öffentlichen Schlüssel der Rolle des Betreibers. */
function LedgerCheck({ signPublicKey, head }: { signPublicKey: string; head: ChainHead }) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (head.sequence === 0) return null;

  const run = async () => {
    setBusy(true);
    try {
      const { entries } = await loadLedger();
      const check = await checkLedger(entries, signPublicKey);
      setResult(check.broken === null
        ? { ok: true, text: `Łańcuch w porządku: ${check.checked} ${check.checked === 1 ? 'wpis' : check.checked % 10 >= 2 && check.checked % 10 <= 4 && (check.checked % 100 < 12 || check.checked % 100 > 14) ? 'wpisy' : 'wpisów'} sprawdzonych${entries.length < head.sequence ? ` (ostatnie ${entries.length} z ${head.sequence})` : ''}.` }
        : { ok: false, text: check.broken });
    } catch (e) {
      setResult({ ok: false, text: said(e, 'Nie udało się sprawdzić łańcucha.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-actions wk-ledger" data-ledger="">
      <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" disabled={busy} onClick={() => void run()}>
        {busy ? 'Sprawdzanie…' : 'Sprawdź łańcuch decyzji'}
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

  const decide = async (accept: boolean) => {
    setBusy(true);
    setFailed(null);
    try {
      await decideListing(row.areaId, row.moduleId, accept, catalogue && accept && checked);
      toast(accept ? 'Wydarzenie pokazane na liście.' : 'Odmówiono.', { kind: 'ok' });
      void refreshNotify();
    } catch (e) {
      setFailed(said(e, 'Nie udało się.'));
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
        {row.path !== null && <span className="wk-case-when">lista: <a className="wk-link" href={pagePath(row.path)} target="_blank" rel="noopener noreferrer">recreatio.pl/{row.path}</a></span>}
      </div>
      <div className="wk-case-body">
        {preview === null ? (
          <div className="wk-actions"><button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={() => void show()}>Pokaż kartę</button></div>
        ) : preview === 'none' ? (
          <p className="wk-case-meta">Tego wydarzenia nie widać publicznie — karta się nie pokaże.</p>
        ) : (
          <EventPreview card={preview.card} texts={preview.texts} />
        )}
        {catalogue && (
          <label className="wk-check">
            <input type="checkbox" checked={checked} disabled={busy} onChange={(e) => setChecked(e.target.checked)} data-listing-nodata="" />
            <span>Na karcie nie ma danych osobowych (nazwisk, zdjęć osób, kontaktów prywatnych).</span>
          </label>
        )}
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy || (catalogue && !checked)} onClick={() => void decide(true)}>
            {catalogue ? 'Pokaż w katalogu' : 'Pokaż na liście'}
          </button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => void decide(false)}>Odmów</button>
        </div>
        {catalogue && <p className="wk-report-small">Zgoda dotyczy karty w tej postaci — gdy ktoś ją zmieni, zniknie z katalogu do ponownej zgody.</p>}
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
      </div>
    </article>
  );
}

function EventPreview({ card, texts }: { card: EventCard; texts: CardTexts }) {
  const when = whenText(card.item);
  return (
    <div className="wk-case-card" data-event-preview={card.areaId}>
      {card.page.imageId !== null && <img src={eventImageUrl(card.page.imageId)} alt="" loading="lazy" />}
      <div>
        <p><strong>{texts.title ?? card.page.title ?? card.name}</strong></p>
        {when !== null && <p className="wk-case-meta">{when}{texts.location !== null && ` · ${texts.location}`}</p>}
        {card.page.lead !== null && <p className="wk-case-text">{card.page.lead}</p>}
        {card.organiser !== null && <p className="wk-case-meta">Organizator: {card.organiser}</p>}
        <p><a className="wk-link" href={pagePath(card.page.path)} target="_blank" rel="noopener noreferrer">Strona wydarzenia</a></p>
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
  const [failed, setFailed] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    loadMyTakedowns()
      .then((found) => { if (alive) { setRows(found.takedowns); setFailed(null); } })
      .catch((e: unknown) => { if (alive) { setRows([]); setFailed(said(e, 'Nie udało się wczytać zablokowanych treści.')); } });
    return () => { alive = false; };
  }, [round, stamp]);

  useEffect(() => { if (rows !== undefined) onFound(rows.length > 0); }, [rows, onFound]);

  if (rows === undefined || (rows.length === 0 && failed === null)) return null;

  return (
    <section aria-labelledby="sprawy-takedowns-h">
      <h2 className="wk-h2" id="sprawy-takedowns-h">Twoje treści zablokowane po zgłoszeniu</h2>
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

  const send = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await sendObjection(row, text);
      toast('Odwołanie wysłane do operatora.', { kind: 'ok' });
      setText('');
      onSent();
    } catch (e) {
      setFailed(said(e, 'Nie udało się wysłać odwołania.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="wk-box wk-case" data-takedown={row.state}>
      <div className="wk-case-head">
        <strong>{kindWord(row.itemKind)}</strong>
        <span className={`wk-tag ${row.state === 'blocked' ? 'wk-tag-danger' : ''}`}>{row.state === 'blocked' ? 'zablokowane' : 'usunięte na zawsze'}</span>
        <span className="wk-case-when">{day(row.since)}</span>
      </div>
      <div className="wk-case-body">
        {href !== null && <p><a className="wk-link" href={href}>recreatio.pl/{row.path}</a></p>}
        <p className="wk-case-meta">Powód: {DECISION_REASONS[row.reason] ?? row.reason} · numer <code className="wk-case-id">{row.itemKind}/{row.itemId}</code></p>
        {row.state === 'deleted' ? (
          <p className="wk-case-meta">Operator usunął tę treść na zawsze.</p>
        ) : row.objectedAt !== null ? (
          <p className="wk-case-meta">Odwołanie wysłane {day(row.objectedAt)} — operator je przeczyta i zdecyduje: przywróci treść albo usunie ją na zawsze.</p>
        ) : (
          <form className="wk-form wk-case-object" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3 && !busy) void send(); }}>
            <p className="wk-case-meta">
              Do {date(row.objectUntil)} treść pozostaje zablokowana, ale nie usunięta — w tym czasie możesz się odwołać.
              Operator przeczyta odwołanie przed decyzją; bez odwołania może ją potem usunąć na zawsze.
            </p>
            <label className="wk-field">
              <span>Odwołanie</span>
              <textarea rows={3} maxLength={5000} value={text} disabled={busy} data-objection-text=""
                placeholder="Dlaczego ta treść powinna wrócić? Odwołanie trafi zaszyfrowane do operatora."
                onChange={(e) => setText(e.target.value)} />
            </label>
            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy || text.trim().length < 3} data-objection-send="">
                {busy ? 'Wysyłanie…' : 'Wyślij odwołanie'}
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
  const lacking = (m: Duties['controllers']['missing'][number]) => [
    m.terms ? null : 'akceptacji warunków powierzenia',
    m.confirmed ? null : 'potwierdzenia, że można działać w imieniu organizacji',
    m.complete ? null : 'adresu, e-maila albo organu do skarg'
  ].filter((one): one is string => one !== null).join(', ');

  const lines = useMemo(() => [
    ...c.asks.map((one) => ({ key: `a${one.attachmentId}`, href: settings(one.homeAreaId), title: `Prośba: „${one.areaName ?? 'obszar'}” chce administratora „${one.controllerName}”`, sub: 'Zdecyduj i podpisz w ustawieniach obszaru, w którym administrator jest wpisany.', warn: true })),
    ...c.offers.map((one) => ({ key: `o${one.attachmentId}`, href: settings(one.areaId), title: `Propozycja dla „${one.areaName ?? 'obszaru'}”: administrator „${one.controllerName}”`, sub: 'Przyjmij albo odrzuć w ustawieniach obszaru.', warn: true })),
    ...c.decided.map((one) => ({ key: `d${one.attachmentId}`, href: settings(one.areaId), title: `„${one.controllerName}” dla „${one.areaName ?? 'obszaru'}”: ${one.state === 'live' ? 'przyjęte' : 'odrzucone'}`, sub: one.state === 'live' ? 'Obowiązuje od teraz.' : 'Wybierz innego administratora.', warn: one.state !== 'live' })),
    ...c.nobody.map((one) => ({ key: `n${one.areaId}`, href: settings(one.areaId), title: `Za dane w „${one.areaName}” nikt nie odpowiada`, sub: 'Formularze, rezerwacje i rozmowy tego obszaru nic teraz nie przyjmą. Wskaż administratora danych.', warn: true })),
    ...c.missing.map((one) => ({ key: `m${one.controllerId}`, href: settings(one.homeAreaId), title: `„${one.name}”: brakuje ${lacking(one)}`, sub: 'Uzupełnij w ustawieniach obszaru, w którym administrator jest wpisany.', warn: true })),
    ...(c.pages ?? []).map((one) => ({ key: `p${one.path}`, href: viewPath('pages', ...pageSteps(one.path)), title: `Strona recreatio.pl/${one.path}: nikt nie odpowiada za jej treść`, sub: 'Wskaż obszar, który za nią odpowiada — bez tego nie zapiszesz zmian.', warn: true }))
  ], [c]);

  return (
    <section aria-labelledby="sprawy-controllers-h">
      <h2 className="wk-h2" id="sprawy-controllers-h">Administrator danych</h2>
      <div className="wk-box">
        {lines.map((one, i) => (
          <a key={one.key} className={`wk-line is-wrap${i === 0 ? ' wk-line-first' : ''}`} href={one.href} data-duty={one.key[0]}>
            <span className="wk-line-text">
              <span className="wk-line-title">{one.title}</span>
              <span className="wk-line-sub">{one.sub}</span>
            </span>
            <span className="wk-line-end">{one.warn ? 'Otwórz' : 'Zobacz'} ›</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export default SprawyView;
