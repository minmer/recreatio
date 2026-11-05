/**
 * ADMINISTRATOR DANYCH — 0129: ein Datensatz mit Geschichte (`controllers.ts`).
 *
 * Für einen Bereich gilt der Datensatz seines nächsten Anschlusses (er selbst,
 * dann die Bereiche darüber). Einen Anschluss UNTERSCHREIBT eine Rolle des
 * Heimatbereichs des Datensatzes — hier im Browser; der Dienst prüft nur. Wer
 * einen fremden will, bittet; wer ihn anbietet, unterschreibt gleich, und der
 * Bereich nimmt an. Ohne Datensatz nimmt der Bereich nichts an: keine Formulare,
 * keine Reservierungen, keine Rozmowy des Bereichs (auch „Napisz do nas").
 *
 * Hier: was gilt, die Wahl eines Datensatzes, ein neuer, die Datensätze mit
 * Heimat hier (ändern, Bedingungen, Bitten unterschreiben, anbieten, schliessen)
 * — und wer an einem vergangenen Tag geradestand.
 */

import { useCallback, useEffect, useState } from 'react';

import { fmtDate, rich, useT, type Lang } from '../core/i18n';
import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { OPERATOR } from '../operator';
import { PostalInput } from '../registry/PostalInput';
import { viewPath } from '../routes';
import { ask, toast } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { areasNow, invalidate } from '../workspace/viewData';
import type { AreaRow } from './area';
import { AreaPick } from './AreaPick';
import {
  acceptTerms, AUTHORITY_NAME, chooseController, closeController, controllerChanged, createController, decideAttachment, EMPTY_FIELDS,
  endAttachment, fieldsOf, inheritController, listControllers, loadAreaControllerState, offerController, signerOf,
  TERMS_VERSION, writeVersion,
  type AreaControllerState, type Authority, type ControllerChoice, type ControllerFields, type HomeRecord
} from './controllers';

const NO_KEY = 'areas.ctl.noKey';

const day = (iso: string | null, lang: Lang): string =>
  iso === null ? '' : fmtDate(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' }, lang);

const message = (e: unknown, fallback: string): string => (e instanceof WorkspaceError ? e.message : fallback);

/* -- Laden ------------------------------------------------------------------------- */

type Loaded<T> = T | 'failed' | undefined;

/** Was für einen Bereich gilt — `undefined`: lädt; `'failed'`: nicht zu lesen. */
function useControllerState(areaId: string | null): { state: Loaded<AreaControllerState>; reload: () => void } {
  const [state, setState] = useState<Loaded<AreaControllerState>>(undefined);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (areaId === null) { setState('failed'); return undefined; }
    let alive = true;
    void loadAreaControllerState(areaId).then(
      (found) => { if (alive) setState(found); },
      () => { if (alive) setState('failed'); });
    return () => { alive = false; };
  }, [areaId, round]);

  return { state, reload: useCallback(() => setRound((n) => n + 1), []) };
}

/** Die Bereiche, die ich sehe — für Namen und die Auswahl. */
function useAreas(): readonly AreaRow[] {
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  useEffect(() => {
    let alive = true;
    void areasNow().then((list) => { if (alive) setAreas(list); }, () => undefined);
    return () => { alive = false; };
  }, []);
  return areas;
}

/* -- Ein Datensatz in Worten --------------------------------------------------------- */

interface Shown {
  readonly name: string;
  readonly address: string | null;
  readonly email: string | null;
  readonly phone?: string | null;
  readonly dpo?: { readonly name: string | null; readonly contact: string | null } | null;
  readonly authority?: Authority | null;
}

function RecordLines({ c }: { c: Shown }) {
  const t = useT();
  const dpo = [c.dpo?.name, c.dpo?.contact].filter((one): one is string => (one ?? '').trim() !== '').join(', ');
  return (
    <div className="wk-ctl-lines">
      <p><strong>{c.name}</strong>{c.address !== null && c.address !== '' && `, ${c.address}`}</p>
      {(c.email || c.phone) && <p>{[c.email, c.phone ? t('areas.clause.phone', { phone: c.phone }) : null].filter(Boolean).join(' · ')}</p>}
      {dpo !== '' && <p>{t('areas.ctl.dpoLine', { dpo })}</p>}
      {c.authority ? <p>{t('areas.ctl.complaintsLine', { authority: AUTHORITY_NAME[c.authority] })}</p> : null}
    </div>
  );
}

/* -- Die Felder eines Datensatzes ---------------------------------------------------- */

const TERMS_SUMMARY: readonly string[] = ['areas.ctl.terms1', 'areas.ctl.terms2', 'areas.ctl.terms3', 'areas.ctl.terms4'];

/**
 * Nazwa, adres, kontakt, inspektor, organ — und die Häkchen. `create`: neu (beide
 * Häkchen Pflicht); sonst eine neue Fassung (die Bestätigung nur, wenn sich die
 * Nazwa ändert — vielleicht ist es dann eine andere Organisation).
 */
function RecordForm({ initial, create, busy, onSubmit, onCancel }: {
  initial: ControllerFields;
  create: boolean;
  busy: boolean;
  onSubmit: (fields: ControllerFields, confirmed: boolean) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = useT();
  const [f, setF] = useState<ControllerFields>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [terms, setTerms] = useState(false);
  const set = (patch: Partial<ControllerFields>) => setF((was) => ({ ...was, ...patch }));

  const renamed = !create && f.name.trim() !== initial.name.trim();
  const needsConfirm = create || renamed;
  const changed = create || (Object.keys(f) as (keyof ControllerFields)[]).some((k) => f[k].trim() !== initial[k].trim());

  const blocker =
    f.name.trim() === '' ? t('areas.ctl.needName')
    : f.address.trim() === '' ? t('areas.ctl.needAddress')
    : f.email.trim() === '' ? t('areas.ctl.needEmail')
    : f.authority === '' ? t('areas.ctl.needAuthority')
    : needsConfirm && !confirmed ? t('areas.ctl.needConfirm')
    : create && !terms ? t('areas.ctl.needTerms')
    : !changed ? t('areas.ctl.nothingChanged')
    : null;

  return (
    <form className="wk-form wk-ctl-form" onSubmit={(e) => { e.preventDefault(); if (blocker === null && !busy) void onSubmit(f, confirmed); }}>
      <label className="wk-field">
        <span>{t('areas.ctl.orgName')}</span>
        <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('areas.ctl.orgNamePlaceholder')} />
      </label>
      {/* 0082 — die Adresse in der einen Form der Datenbank. */}
      <div className="wk-field">
        <span>{t('areas.ctl.address')}</span>
        <PostalInput value={f.address} onChange={(address) => set({ address })} />
      </div>
      <div className="wk-ctl-pair">
        <label className="wk-field">
          <span>{t('areas.ctl.email')}</span>
          <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </label>
        <label className="wk-field">
          <span>{t('areas.ctl.phone')}</span>
          <input type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
        </label>
      </div>
      <div className="wk-ctl-pair">
        <label className="wk-field">
          <span>{t('areas.ctl.dpo')}</span>
          <input value={f.dpoName} onChange={(e) => set({ dpoName: e.target.value })} />
        </label>
        <label className="wk-field">
          <span>{t('areas.ctl.dpoContact')}</span>
          <input value={f.dpoContact} onChange={(e) => set({ dpoContact: e.target.value })} />
        </label>
      </div>
      <label className="wk-field">
        <span>{t('areas.ctl.authority')}</span>
        <select value={f.authority} onChange={(e) => set({ authority: e.target.value as Authority | '' })}>
          <option value="">{t('areas.chooseDash')}</option>
          {(Object.keys(AUTHORITY_NAME) as Authority[]).map((a) => <option key={a} value={a}>{AUTHORITY_NAME[a]}</option>)}
        </select>
      </label>

      {needsConfirm && (
        <label className="wk-check">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>{renamed ? t('areas.ctl.confirmRenamed') : t('areas.ctl.confirm')}</span>
        </label>
      )}
      {create && <Terms checked={terms} onChange={setTerms} />}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || blocker !== null}>{create ? t('areas.ctl.enter') : t('areas.ctl.saveChanges')}</button>
        {onCancel !== undefined && <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onCancel}>{t('common.cancel')}</button>}
        {blocker !== null && changed && <span className="wk-blocker">{blocker}</span>}
      </div>
    </form>
  );
}

/** Die Bedingungen der Auftragsverarbeitung: kurz, und das Häkchen. */
function Terms({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  const t = useT();
  return (
    <div className="wk-ctl-terms">
      <label className="wk-check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{t('areas.ctl.acceptTerms', { version: TERMS_VERSION })}</span>
      </label>
      <details className="wk-ctl-terms-text">
        <summary>{t('areas.ctl.termsSummary')}</summary>
        <ul>{TERMS_SUMMARY.map((line) => <li key={line}>{t(line, { name: OPERATOR.name, email: OPERATOR.email })}</li>)}</ul>
      </details>
    </div>
  );
}

/* -- Die Einstellung im Bereich ------------------------------------------------------ */

export function AreaControllerSettings({ areaId, areaName, editable, ring }: {
  areaId: string;
  areaName: string;
  editable: boolean;
  ring: Ring | null;
}) {
  const t = useT();
  const { state, reload } = useControllerState(areaId);
  const areas = useAreas();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (state === undefined) return <Loading lines={2} />;
  if (state === 'failed') return <p className="wk-error">{t('areas.ctl.loadFailed')}</p>;

  const admin = state.admin && editable;
  const signer = signerOf(state, ring);
  const c = state.controller;
  const own = c !== null && c.fromAreaId === areaId;

  /** Ein Handgriff: Fehler sagen, nach Erfolg melden, Zwischenspeicher leeren, neu laden. */
  const act = async (done: string, todo: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setFailed(null);
    try {
      await todo();
      invalidate();
      controllerChanged(areaId);
      toast(done, { kind: 'ok' });
      reload();
      return true;
    } catch (e) {
      setFailed(message(e, t('common.failed')));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const asks = state.waiting.filter((w) => w.state === 'asked');
  const offers = state.waiting.filter((w) => w.state === 'offered');

  return (
    <div className="wk-controller wk-ctl" data-area-controller={own ? 'own' : c === null ? 'none' : 'inherited'}>
      {/* -- Was gilt -- */}
      {c === null ? (
        <p className="wk-warn">{t('areas.ctl.nobody')}</p>
      ) : (
        <div className="wk-controller-now">
          <RecordLines c={c} />
          <p className="wk-ctl-from">
            {own
              ? t('areas.ctl.ownFor', { area: areaName })
              : rich(t('areas.ctl.fromArea', { area: c.fromAreaName ?? t('areas.ctl.parentArea') }), { a: (s) => <a href={viewPath('areas', c.fromAreaId, 'ustawienia')}>{s}</a> })}
          </p>
          {/* Erben gibt es nur, wo es ein Oben gibt. */}
          {admin && state.own !== null && areas.find((a) => a.areaId === areaId)?.parentAreaId != null && (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => void (async () => {
              const yes = await ask({
                title: t('areas.ctl.inheritAsk'),
                body: t('areas.ctl.inheritBody', { area: areaName }),
                confirm: t('areas.ctl.inheritConfirm')
              });
              if (yes) await act(t('areas.ctl.inherited'), () => inheritController(areaId));
            })()}>
              {t('areas.ctl.inherit')}
            </button>
          )}
        </div>
      )}

      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}

      {/* -- Was auf eine Antwort wartet -- */}
      {admin && asks.map((w) => (
        <div key={w.attachmentId} className="wk-note wk-ctl-wait" data-attachment={w.attachmentId}>
          <p>{rich(w.askedAt !== null ? t('areas.ctl.askWaitingSince', { name: w.name, date: day(w.askedAt, t.lang) }) : t('areas.ctl.askWaiting', { name: w.name }), { b: (s) => <strong>{s}</strong> })}</p>
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => void act(t('areas.ctl.askWithdrawn'), () => endAttachment(w.attachmentId))}>
            {t('areas.ctl.withdrawAsk')}
          </button>
        </div>
      ))}
      {admin && offers.map((w) => (
        <div key={w.attachmentId} className="wk-note wk-ctl-wait" data-attachment={w.attachmentId}>
          <p>{rich(t('areas.ctl.offerLine', { name: w.name }), { b: (s) => <strong>{s}</strong> })}</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-small" disabled={busy}
              onClick={() => void act(t('areas.ctl.accepted'), () => decideAttachment(ring, { attachmentId: w.attachmentId, accept: true }))}>
              {t('areas.ctl.accept')}
            </button>
            <button type="button" className="wk-link-btn" disabled={busy}
              onClick={() => void act(t('areas.ctl.refused'), () => decideAttachment(ring, { attachmentId: w.attachmentId, accept: false }))}>
              {t('areas.ctl.refuse')}
            </button>
          </div>
        </div>
      ))}

      {/* -- Wählen oder neu -- */}
      {admin && (
        <>
          <Choose areaId={areaId} state={state} ring={ring} busy={busy} act={act} />
          {creating ? (
            <section className="wk-ctl-new" aria-label={t('areas.ctl.newTitle')}>
              <h3 className="wk-h3">{t('areas.ctl.newTitle')}</h3>
              {signer === null && <p className="wk-warn">{t(NO_KEY)}</p>}
              <RecordForm initial={EMPTY_FIELDS} create busy={busy || signer === null}
                onCancel={() => setCreating(false)}
                onSubmit={async (fields, confirmed) => {
                  if (ring === null || signer === null) { setFailed(t(NO_KEY)); return; }
                  const ok = await act(t('areas.ctl.created'), () =>
                    createController(ring, { homeAreaId: areaId, signerRoleId: signer, fields, authorityConfirmed: confirmed }));
                  if (ok) setCreating(false);
                }} />
            </section>
          ) : (
            <div className="wk-actions">
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => setCreating(true)}>
                {t('areas.ctl.newButton')}
              </button>
            </div>
          )}
        </>
      )}

      {!admin && c === null && <p className="wk-note">{t('areas.ctl.leaderPoints')}</p>}

      {/* -- Was hier zu Hause ist -- */}
      {admin && state.home.length > 0 && (
        <section className="wk-ctl-home" aria-label={t('areas.ctl.homeLabel')}>
          <h3 className="wk-h3">{t('areas.ctl.home')}</h3>
          {state.home.map((record) => (
            <HomeRecordCard key={record.id} record={record} areaId={areaId} areas={areas} ring={ring} signer={signer} busy={busy} act={act} />
          ))}
        </section>
      )}

      <History areaId={areaId} />
    </div>
  );
}

type Act = (done: string, todo: () => Promise<unknown>) => Promise<boolean>;

/* -- Einen Datensatz wählen ------------------------------------------------------------ */

/**
 * Die Datensätze aus meinen Bereichen und die, die in deren Ketten gelten. Führe ich
 * die Heimat eines Datensatzes, unterschreibe ich gleich (mit einer Rolle, die DIE
 * HEIMAT führt) — sonst geht eine Bitte an sie.
 */
function Choose({ areaId, state, ring, busy, act }: {
  areaId: string; state: AreaControllerState; ring: Ring | null; busy: boolean; act: Act;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<readonly ControllerChoice[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setChoices(null);
    void listControllers().then((r) => { if (alive) setChoices(r.records); }, (e) => { if (alive) { setChoices([]); setFailed(message(e, t('areas.ctl.listFailed'))); } });
    return () => { alive = false; };
  }, [open, state]);

  const pick = async (choice: ControllerChoice) => {
    setFailed(null);
    if (choice.homeAdmin) {
      if (ring === null) { setFailed(t(NO_KEY)); return; }
      const home = choice.homeAreaId === areaId ? state : await loadAreaControllerState(choice.homeAreaId).catch(() => null);
      const signer = home === null ? null : signerOf(home, ring);
      if (signer === null) { setFailed(t(NO_KEY)); return; }
      await act(t('areas.ctl.appliesNow'), () =>
        chooseController(ring, { areaId, controllerId: choice.id, homeAreaId: choice.homeAreaId, homeSignerRoleId: signer }));
      return;
    }
    await act(t('areas.ctl.askSent'), () =>
      chooseController(ring, { areaId, controllerId: choice.id, homeAreaId: choice.homeAreaId, homeSignerRoleId: null }));
  };

  return (
    <details className="wk-fold wk-ctl-choose" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{t('areas.ctl.choose')}</summary>
      {choices === null ? <Loading lines={2} /> : choices.length === 0 ? (
        <p className="wk-empty">{t('areas.ctl.noneToChoose')}</p>
      ) : (
        <ul className="wk-ctl-choices">
          {choices.map((choice) => {
            const applies = state.controller?.id === choice.id;
            const waiting = state.waiting.some((w) => w.controllerId === choice.id);
            return (
              <li key={choice.id} data-controller={choice.id}>
                <div>
                  <strong>{choice.name}</strong>
                  {choice.address !== null && <>, {choice.address}</>}
                  <span className="wk-ctl-meta"> · {t('areas.ctl.homeIn', { area: choice.homeAreaName ?? '—' })}{choice.usedIn > 0 ? ` · ${t('areas.ctl.usedIn', { count: choice.usedIn })}` : ''}</span>
                </div>
                {applies ? (<span className="wk-tag wk-tag-ok">{t('areas.ctl.appliesHere')}</span>)
                  : waiting ? (<span className="wk-tag">{t('areas.ctl.waiting')}</span>)
                  : (
                    <button type="button" className="wk-btn wk-btn-small" disabled={busy} onClick={() => void pick(choice)}>
                      {choice.homeAdmin ? t('common.select') : t('areas.ctl.ask')}
                    </button>
                  )}
              </li>
            );
          })}
        </ul>
      )}
      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
    </details>
  );
}

/* -- Ein Datensatz mit Heimat hier ------------------------------------------------------ */

function HomeRecordCard({ record, areaId, areas, ring, signer, busy, act }: {
  record: HomeRecord; areaId: string; areas: readonly AreaRow[]; ring: Ring | null; signer: string | null; busy: boolean; act: Act;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [offerTo, setOfferTo] = useState('');

  const complete = record.address !== null && record.email !== null && record.authority !== null;
  const nameOf = (id: string, fallback: string | null) => areas.find((a) => a.areaId === id)?.name ?? fallback ?? t('areas.ctl.anArea');
  const used = new Set(record.uses.map((u) => u.areaId));
  const offerable = areas.filter((a) => a.personal !== true && a.ownChat == null && !used.has(a.areaId));
  const live = record.uses.filter((u) => u.state === 'live').length;

  return (
    <article className="wk-ctl-record" data-record={record.id} data-closed={record.closed ? 'yes' : 'no'}>
      <div className="wk-ctl-head">
        <RecordLines c={record} />
        <span className="wk-tags">
          {record.closed && <span className="wk-tag">{t('areas.ctl.closed')}</span>}
          {!record.closed && !record.terms && <span className="wk-tag wk-tag-warn">{t('areas.ctl.noTerms')}</span>}
          {!record.closed && !record.confirmed && <span className="wk-tag wk-tag-warn">{t('areas.ctl.unconfirmed')}</span>}
        </span>
      </div>

      {!record.closed && !complete && !editing && (
        <p className="wk-warn">{t('areas.ctl.incomplete')}</p>
      )}

      {/* Bedingungen und Bestätigung nachholen (ein gewanderter Datensatz hat beides nicht). */}
      {!record.closed && (!record.terms || !record.confirmed) && (
        <div className="wk-warn wk-ctl-missing">
          <p>{!record.terms && !record.confirmed ? t('areas.ctl.missingBoth') : !record.terms ? t('areas.ctl.missingTerms') : t('areas.ctl.missingConfirm')}</p>
          {!record.terms && <Terms checked={terms} onChange={setTerms} />}
          {!record.confirmed && (
            <label className="wk-check">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>{t('areas.ctl.confirm')}</span>
            </label>
          )}
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-small" disabled={busy || (!record.terms && !terms) || (!record.confirmed && !confirmed)}
              onClick={() => void act(t('common.saved'), () => acceptTerms(record.id, confirmed || record.confirmed))}>
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {editing && !record.closed && (
        <RecordForm initial={fieldsOf(record)} create={false} busy={busy}
          onCancel={() => setEditing(false)}
          onSubmit={async (fields, ok) => {
            if (await act(t('areas.ctl.versionSaved'), () => writeVersion(record.id, fields, ok))) setEditing(false);
          }} />
      )}

      {/* Wo er gilt, wer um ihn bittet, wem er angeboten ist. */}
      {record.uses.length > 0 && (
        <ul className="wk-ctl-uses">
          {record.uses.map((u) => (
            <li key={u.attachmentId} data-use={u.state}>
              <span>
                {u.areaId === areaId ? t('areas.ctl.thisArea') : nameOf(u.areaId, u.areaName)}
                {u.state === 'live' && u.liveFrom !== null && <span className="wk-ctl-meta"> · {t('areas.ctl.since', { date: day(u.liveFrom, t.lang) })}</span>}
                {u.state === 'asked' && <span className="wk-ctl-meta"> · {t('areas.ctl.usesAsked')}</span>}
                {u.state === 'offered' && <span className="wk-ctl-meta"> · {t('areas.ctl.usesOffered')}</span>}
              </span>
              <span className="wk-actions">
                {u.state === 'live' && (
                  <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void (async () => {
                    const yes = await ask({
                      title: t('areas.ctl.withdrawConsentAsk'),
                      body: t('areas.ctl.withdrawConsentBody', { area: u.areaId === areaId ? t('areas.ctl.thisArea') : nameOf(u.areaId, u.areaName) }),
                      confirm: t('areas.ctl.withdraw'), danger: true
                    });
                    if (yes) await act(t('areas.ctl.consentWithdrawn'), () => endAttachment(u.attachmentId));
                  })()}>
                    {t('areas.ctl.withdrawConsent')}
                  </button>
                )}
                {u.state === 'asked' && (
                  <>
                    <button type="button" className="wk-btn wk-btn-small" disabled={busy || signer === null || ring === null}
                      title={signer === null ? t(NO_KEY) : undefined}
                      onClick={() => void act(t('areas.ctl.signed'), () => decideAttachment(ring, {
                        attachmentId: u.attachmentId, accept: true,
                        sign: { controllerId: record.id, areaId: u.areaId, homeAreaId: areaId, signerRoleId: signer! }
                      }))}>
                      {t('areas.ctl.signAccept')}
                    </button>
                    <button type="button" className="wk-link-btn" disabled={busy}
                      onClick={() => void act(t('areas.ctl.refused'), () => decideAttachment(ring, { attachmentId: u.attachmentId, accept: false }))}>
                      {t('areas.ctl.refuse')}
                    </button>
                  </>
                )}
                {u.state === 'offered' && (
                  <button type="button" className="wk-link-btn" disabled={busy}
                    onClick={() => void act(t('areas.ctl.offerWithdrawn'), () => endAttachment(u.attachmentId))}>
                    {t('areas.ctl.withdrawOffer')}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!record.closed && signer === null && record.uses.some((u) => u.state === 'asked') && <p className="wk-note">{t(NO_KEY)}</p>}

      {!record.closed && (
        <div className="wk-ctl-offer">
          <AreaPick areas={areas} only={offerable} value={offerTo} onChange={setOfferTo} label={t('areas.ctl.offerTo')} placeholder={t('areas.ctl.offerToPlaceholder')} disabled={busy} />
          <button type="button" className="wk-btn wk-btn-small" disabled={busy || offerTo === '' || signer === null || ring === null}
            title={signer === null ? t(NO_KEY) : undefined}
            onClick={() => void (async () => {
              const target = areas.find((a) => a.areaId === offerTo);
              if (ring === null || signer === null || target === undefined) return;
              const ok = await act(target.myLevel === 'admin' ? t('areas.ctl.appliesInChosen') : t('areas.ctl.offerSent'), () =>
                offerController(ring, { controllerId: record.id, homeAreaId: areaId, areaId: target.areaId, signerRoleId: signer, accept: target.myLevel === 'admin' }));
              if (ok) setOfferTo('');
            })()}>
            {t('areas.ctl.offer')}
          </button>
        </div>
      )}

      {!record.closed && !editing && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => setEditing(true)}>{t('areas.ctl.editData')}</button>
          <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void (async () => {
            const yes = await ask({
              title: t('areas.ctl.closeAsk'),
              body: live > 0 ? t('areas.ctl.closeBodyLive', { count: live }) : t('areas.ctl.closeBody'),
              confirm: t('common.close'), danger: true
            });
            if (yes) await act(t('areas.ctl.closedDone'), () => closeController(record.id));
          })()}>
            {t('common.close')}
          </button>
        </div>
      )}
    </article>
  );
}

/* -- Wer an einem Tag geradestand -------------------------------------------------------- */

function History({ areaId }: { areaId: string }) {
  const t = useT();
  const [date, setDate] = useState('');
  const [found, setFound] = useState<AreaControllerState | null | 'failed'>(null);
  const [busy, setBusy] = useState(false);

  const look = async () => {
    setBusy(true);
    try {
      setFound(await loadAreaControllerState(areaId, new Date(`${date}T23:59:59`).toISOString()));
    } catch {
      setFound('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="wk-fold wk-ctl-history">
      <summary>{t('areas.ctl.history')}</summary>
      <div className="wk-actions">
        <input type="date" value={date} aria-label={t('areas.ctl.day')} onChange={(e) => { setDate(e.target.value); setFound(null); }} />
        <button type="button" className="wk-btn wk-btn-small wk-btn-line" disabled={busy || date === ''} onClick={() => void look()}>{t('areas.ctl.check')}</button>
      </div>
      {found === 'failed' && <p className="wk-error">{t('areas.ctl.checkFailed')}</p>}
      {found !== null && found !== 'failed' && (found.controller === null
        ? <p className="wk-note">{t('areas.ctl.nobodyThatDay')}</p>
        : <RecordLines c={found.controller} />)}
    </details>
  );
}

/* -- Im Formular ------------------------------------------------------------------------ */

/** Welcher Administrator für das Formular gilt — und wo man ihn ändert. */
export function FormControllerNote({ areaId }: { areaId: string | null }) {
  const t = useT();
  const { state } = useControllerState(areaId);

  if (areaId === null) return <p className="wk-note wk-controller-missing">{t('areas.ctl.formNoArea')}</p>;
  if (state === undefined) return <Loading lines={1} />;
  if (state === 'failed') return <p className="wk-error">{t('areas.ctl.loadFailed')}</p>;

  const c = state.controller;
  const settings = viewPath('areas', c?.fromAreaId ?? areaId, 'ustawienia');

  return (
    <section className="wk-form wk-controller" data-form-controller={c !== null ? 'area' : 'none'}>
      <h4 className="wk-h2">{t('areas.page.controller')}</h4>
      {c !== null ? (
        <p className="wk-controller-line">
          {rich(t('areas.ctl.formLine', { name: c.name, area: c.fromAreaName ?? t('areas.ctl.formArea') }), { b: (s) => <strong>{s}</strong>, a: (s) => <a href={settings}>{s}</a> })}
        </p>
      ) : (
        <p className="wk-warn">
          {rich(t('areas.ctl.formNone'), { a: (s) => <a href={settings}>{s}</a> })}
        </p>
      )}
    </section>
  );
}
