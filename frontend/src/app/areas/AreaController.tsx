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

const NO_KEY = 'Do podpisu potrzebny jest klucz roli, która prowadzi ten obszar — odblokuj warsztat hasłem.';

const NOBODY = 'Nikt nie odpowiada tu za dane osobowe — formularze, rezerwacje i rozmowy tego obszaru (także „Napisz do nas”) '
  + 'niczego nie przyjmą, a strona publiczna nie może wskazać tego obszaru.';

const day = (iso: string | null): string =>
  iso === null ? '' : new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

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
  const dpo = [c.dpo?.name, c.dpo?.contact].filter((one): one is string => (one ?? '').trim() !== '').join(', ');
  return (
    <div className="wk-ctl-lines">
      <p><strong>{c.name}</strong>{c.address !== null && c.address !== '' && `, ${c.address}`}</p>
      {(c.email || c.phone) && <p>{[c.email, c.phone ? `tel. ${c.phone}` : null].filter(Boolean).join(' · ')}</p>}
      {dpo !== '' && <p>Inspektor ochrony danych: {dpo}</p>}
      {c.authority ? <p>Skargi: {AUTHORITY_NAME[c.authority]}</p> : null}
    </div>
  );
}

/* -- Die Felder eines Datensatzes ---------------------------------------------------- */

const TERMS_SUMMARY: readonly string[] = [
  `Serwis recreatio.pl technicznie prowadzi ${OPERATOR.name} (${OPERATOR.email}) — przechowuje dane i obsługuje serwis na zlecenie organizacji.`,
  'Treści są szyfrowane w przeglądarkach; serwis ich nie odczytuje.',
  'Organizacja decyduje, jakie dane zbiera i po co, i odpowiada na prośby osób, których dane dotyczą.',
  'Zgłoszenia treści trafiają do operatora. Może on treść zablokować, a usunąć ją na zawsze dopiero po 14 dniach albo po odwołaniu autora; każdy krok jest podpisany i zapisany w łańcuchu.'
];

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
  const [f, setF] = useState<ControllerFields>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [terms, setTerms] = useState(false);
  const set = (patch: Partial<ControllerFields>) => setF((was) => ({ ...was, ...patch }));

  const renamed = !create && f.name.trim() !== initial.name.trim();
  const needsConfirm = create || renamed;
  const changed = create || (Object.keys(f) as (keyof ControllerFields)[]).some((k) => f[k].trim() !== initial[k].trim());

  const blocker =
    f.name.trim() === '' ? 'Podaj nazwę organizacji.'
    : f.address.trim() === '' ? 'Podaj adres.'
    : f.email.trim() === '' ? 'Podaj e-mail.'
    : f.authority === '' ? 'Wybierz organ, do którego można złożyć skargę.'
    : needsConfirm && !confirmed ? 'Potwierdź, że możesz działać w imieniu tej organizacji.'
    : create && !terms ? 'Zaakceptuj warunki powierzenia.'
    : !changed ? 'Nic się nie zmieniło.'
    : null;

  return (
    <form className="wk-form wk-ctl-form" onSubmit={(e) => { e.preventDefault(); if (blocker === null && !busy) void onSubmit(f, confirmed); }}>
      <label className="wk-field">
        <span>Nazwa organizacji</span>
        <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="np. Parafia św. Kazimierza" />
      </label>
      {/* 0082 — die Adresse in der einen Form der Datenbank. */}
      <div className="wk-field">
        <span>Adres</span>
        <PostalInput value={f.address} onChange={(address) => set({ address })} />
      </div>
      <div className="wk-ctl-pair">
        <label className="wk-field">
          <span>E-mail</span>
          <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </label>
        <label className="wk-field">
          <span>Telefon (opcjonalnie)</span>
          <input type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
        </label>
      </div>
      <div className="wk-ctl-pair">
        <label className="wk-field">
          <span>Inspektor ochrony danych (opcjonalnie)</span>
          <input value={f.dpoName} onChange={(e) => set({ dpoName: e.target.value })} />
        </label>
        <label className="wk-field">
          <span>Kontakt do inspektora</span>
          <input value={f.dpoContact} onChange={(e) => set({ dpoContact: e.target.value })} />
        </label>
      </div>
      <label className="wk-field">
        <span>Skargę można złożyć do</span>
        <select value={f.authority} onChange={(e) => set({ authority: e.target.value as Authority | '' })}>
          <option value="">— wybierz —</option>
          {(Object.keys(AUTHORITY_NAME) as Authority[]).map((a) => <option key={a} value={a}>{AUTHORITY_NAME[a]}</option>)}
        </select>
      </label>

      {needsConfirm && (
        <label className="wk-check">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>Potwierdzam, że mogę działać w imieniu tej organizacji{renamed ? ' (zmieniasz nazwę)' : ''}.</span>
        </label>
      )}
      {create && <Terms checked={terms} onChange={setTerms} />}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || blocker !== null}>{create ? 'Wpisz administratora' : 'Zapisz zmiany'}</button>
        {onCancel !== undefined && <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onCancel}>Anuluj</button>}
        {blocker !== null && changed && <span className="wk-blocker">{blocker}</span>}
      </div>
    </form>
  );
}

/** Die Bedingungen der Auftragsverarbeitung: kurz, und das Häkchen. */
function Terms({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="wk-ctl-terms">
      <label className="wk-check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>Akceptuję warunki powierzenia przetwarzania danych (wersja {TERMS_VERSION}).</span>
      </label>
      <details className="wk-ctl-terms-text">
        <summary>Co obejmują warunki</summary>
        <ul>{TERMS_SUMMARY.map((line) => <li key={line}>{line}</li>)}</ul>
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
  const { state, reload } = useControllerState(areaId);
  const areas = useAreas();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (state === undefined) return <Loading lines={2} />;
  if (state === 'failed') return <p className="wk-error">Nie udało się wczytać administratora danych.</p>;

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
      setFailed(message(e, 'Nie udało się.'));
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
        <p className="wk-warn">{NOBODY}</p>
      ) : (
        <div className="wk-controller-now">
          <RecordLines c={c} />
          <p className="wk-ctl-from">
            {own
              ? <>Wpisany dla obszaru „{areaName}” — obowiązuje też w obszarach w nim.</>
              : <>Z obszaru <a href={viewPath('areas', c.fromAreaId, 'ustawienia')}>{c.fromAreaName ?? 'nadrzędnego'}</a> — obowiązuje też tutaj.</>}
          </p>
          {/* Erben gibt es nur, wo es ein Oben gibt. */}
          {admin && state.own !== null && areas.find((a) => a.areaId === areaId)?.parentAreaId != null && (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => void (async () => {
              const yes = await ask({
                title: 'Dziedziczyć z obszaru wyżej?',
                body: `Obszar „${areaName}” przestanie mieć własnego administratora danych. Obowiązywać będzie ten z obszaru wyżej — jeśli tam nikogo nie ma, ten obszar niczego nie przyjmie.`,
                confirm: 'Dziedzicz'
              });
              if (yes) await act('Obszar dziedziczy administratora z góry.', () => inheritController(areaId));
            })()}>
              Dziedzicz z obszaru wyżej
            </button>
          )}
        </div>
      )}

      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}

      {/* -- Was auf eine Antwort wartet -- */}
      {admin && asks.map((w) => (
        <div key={w.attachmentId} className="wk-note wk-ctl-wait" data-attachment={w.attachmentId}>
          <p>Prośba o administratora <strong>{w.name}</strong> czeka na zgodę obszaru, w którym jest wpisany{w.askedAt !== null ? ` (od ${day(w.askedAt)})` : ''}.</p>
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => void act('Prośba wycofana.', () => endAttachment(w.attachmentId))}>
            Wycofaj prośbę
          </button>
        </div>
      ))}
      {admin && offers.map((w) => (
        <div key={w.attachmentId} className="wk-note wk-ctl-wait" data-attachment={w.attachmentId}>
          <p>Propozycja: administratorem danych tego obszaru ma być <strong>{w.name}</strong> — obszar, w którym jest wpisany, już to podpisał.</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-small" disabled={busy}
              onClick={() => void act('Przyjęto administratora danych.', () => decideAttachment(ring, { attachmentId: w.attachmentId, accept: true }))}>
              Przyjmij
            </button>
            <button type="button" className="wk-link-btn" disabled={busy}
              onClick={() => void act('Odmówiono.', () => decideAttachment(ring, { attachmentId: w.attachmentId, accept: false }))}>
              Odmów
            </button>
          </div>
        </div>
      ))}

      {/* -- Wählen oder neu -- */}
      {admin && (
        <>
          <Choose areaId={areaId} state={state} ring={ring} busy={busy} act={act} />
          {creating ? (
            <section className="wk-ctl-new" aria-label="Nowy administrator danych">
              <h3 className="wk-h3">Nowy administrator danych</h3>
              {signer === null && <p className="wk-warn">{NO_KEY}</p>}
              <RecordForm initial={EMPTY_FIELDS} create busy={busy || signer === null}
                onCancel={() => setCreating(false)}
                onSubmit={async (fields, confirmed) => {
                  if (ring === null || signer === null) { setFailed(NO_KEY); return; }
                  const ok = await act('Wpisano administratora danych — obowiązuje od teraz.', () =>
                    createController(ring, { homeAreaId: areaId, signerRoleId: signer, fields, authorityConfirmed: confirmed }));
                  if (ok) setCreating(false);
                }} />
            </section>
          ) : (
            <div className="wk-actions">
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => setCreating(true)}>
                Nowy administrator danych…
              </button>
            </div>
          )}
        </>
      )}

      {!admin && c === null && <p className="wk-note">Wskazuje go ten, kto prowadzi obszar.</p>}

      {/* -- Was hier zu Hause ist -- */}
      {admin && state.home.length > 0 && (
        <section className="wk-ctl-home" aria-label="Administratorzy wpisani w tym obszarze">
          <h3 className="wk-h3">Wpisani w tym obszarze</h3>
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
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<readonly ControllerChoice[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setChoices(null);
    void listControllers().then((r) => { if (alive) setChoices(r.records); }, (e) => { if (alive) { setChoices([]); setFailed(message(e, 'Nie udało się wczytać listy.')); } });
    return () => { alive = false; };
  }, [open, state]);

  const pick = async (choice: ControllerChoice) => {
    setFailed(null);
    if (choice.homeAdmin) {
      if (ring === null) { setFailed(NO_KEY); return; }
      const home = choice.homeAreaId === areaId ? state : await loadAreaControllerState(choice.homeAreaId).catch(() => null);
      const signer = home === null ? null : signerOf(home, ring);
      if (signer === null) { setFailed(NO_KEY); return; }
      await act('Administrator danych obowiązuje od teraz.', () =>
        chooseController(ring, { areaId, controllerId: choice.id, homeAreaId: choice.homeAreaId, homeSignerRoleId: signer }));
      return;
    }
    await act('Wysłano prośbę do obszaru, w którym administrator jest wpisany.', () =>
      chooseController(ring, { areaId, controllerId: choice.id, homeAreaId: choice.homeAreaId, homeSignerRoleId: null }));
  };

  return (
    <details className="wk-fold wk-ctl-choose" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Wybierz administratora danych</summary>
      {choices === null ? <Loading lines={2} /> : choices.length === 0 ? (
        <p className="wk-empty">Nie ma jeszcze administratora, którego można tu wybrać — wpisz nowego.</p>
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
                  <span className="wk-ctl-meta"> · wpisany w obszarze {choice.homeAreaName ?? '—'}{choice.usedIn > 0 ? ` · obowiązuje w ${choice.usedIn}` : ''}</span>
                </div>
                {applies ? <span className="wk-tag wk-tag-ok">obowiązuje tutaj</span>
                  : waiting ? <span className="wk-tag">czeka</span>
                  : (
                    <button type="button" className="wk-btn wk-btn-small" disabled={busy} onClick={() => void pick(choice)}>
                      {choice.homeAdmin ? 'Wybierz' : 'Poproś'}
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
  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [offerTo, setOfferTo] = useState('');

  const complete = record.address !== null && record.email !== null && record.authority !== null;
  const nameOf = (id: string, fallback: string | null) => areas.find((a) => a.areaId === id)?.name ?? fallback ?? 'obszar';
  const used = new Set(record.uses.map((u) => u.areaId));
  const offerable = areas.filter((a) => a.personal !== true && a.ownChat == null && !used.has(a.areaId));
  const live = record.uses.filter((u) => u.state === 'live').length;

  return (
    <article className="wk-ctl-record" data-record={record.id} data-closed={record.closed ? 'yes' : 'no'}>
      <div className="wk-ctl-head">
        <RecordLines c={record} />
        <span className="wk-tags">
          {record.closed && <span className="wk-tag">zamknięty</span>}
          {!record.closed && !record.terms && <span className="wk-tag wk-tag-warn">bez warunków</span>}
          {!record.closed && !record.confirmed && <span className="wk-tag wk-tag-warn">niepotwierdzony</span>}
        </span>
      </div>

      {!record.closed && !complete && !editing && (
        <p className="wk-warn">Brakuje adresu, e-maila albo organu do skarg — uzupełnij dane („Zmień dane”).</p>
      )}

      {/* Bedingungen und Bestätigung nachholen (ein gewanderter Datensatz hat beides nicht). */}
      {!record.closed && (!record.terms || !record.confirmed) && (
        <div className="wk-warn wk-ctl-missing">
          <p>{!record.terms && !record.confirmed ? 'Brakuje akceptacji warunków i potwierdzenia.' : !record.terms ? 'Brakuje akceptacji warunków.' : 'Brakuje potwierdzenia.'}</p>
          {!record.terms && <Terms checked={terms} onChange={setTerms} />}
          {!record.confirmed && (
            <label className="wk-check">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>Potwierdzam, że mogę działać w imieniu tej organizacji.</span>
            </label>
          )}
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-small" disabled={busy || (!record.terms && !terms) || (!record.confirmed && !confirmed)}
              onClick={() => void act('Zapisano.', () => acceptTerms(record.id, confirmed || record.confirmed))}>
              Zapisz
            </button>
          </div>
        </div>
      )}

      {editing && !record.closed && (
        <RecordForm initial={fieldsOf(record)} create={false} busy={busy}
          onCancel={() => setEditing(false)}
          onSubmit={async (fields, ok) => {
            if (await act('Zapisano nową wersję danych administratora.', () => writeVersion(record.id, fields, ok))) setEditing(false);
          }} />
      )}

      {/* Wo er gilt, wer um ihn bittet, wem er angeboten ist. */}
      {record.uses.length > 0 && (
        <ul className="wk-ctl-uses">
          {record.uses.map((u) => (
            <li key={u.attachmentId} data-use={u.state}>
              <span>
                {u.areaId === areaId ? 'ten obszar' : nameOf(u.areaId, u.areaName)}
                {u.state === 'live' && u.liveFrom !== null && <span className="wk-ctl-meta"> · od {day(u.liveFrom)}</span>}
                {u.state === 'asked' && <span className="wk-ctl-meta"> · prosi o tego administratora</span>}
                {u.state === 'offered' && <span className="wk-ctl-meta"> · zaproponowano, czeka na przyjęcie</span>}
              </span>
              <span className="wk-actions">
                {u.state === 'live' && (
                  <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void (async () => {
                    const yes = await ask({
                      title: 'Wycofać zgodę?',
                      body: `Ten administrator przestanie obowiązywać w obszarze „${u.areaId === areaId ? 'ten obszar' : nameOf(u.areaId, u.areaName)}” (i w obszarach w nim, które po nim dziedziczą).`,
                      confirm: 'Wycofaj', danger: true
                    });
                    if (yes) await act('Zgoda wycofana.', () => endAttachment(u.attachmentId));
                  })()}>
                    Wycofaj zgodę
                  </button>
                )}
                {u.state === 'asked' && (
                  <>
                    <button type="button" className="wk-btn wk-btn-small" disabled={busy || signer === null || ring === null}
                      title={signer === null ? NO_KEY : undefined}
                      onClick={() => void act('Podpisano — administrator obowiązuje w tym obszarze.', () => decideAttachment(ring, {
                        attachmentId: u.attachmentId, accept: true,
                        sign: { controllerId: record.id, areaId: u.areaId, homeAreaId: areaId, signerRoleId: signer! }
                      }))}>
                      Podpisz i przyjmij
                    </button>
                    <button type="button" className="wk-link-btn" disabled={busy}
                      onClick={() => void act('Odmówiono.', () => decideAttachment(ring, { attachmentId: u.attachmentId, accept: false }))}>
                      Odmów
                    </button>
                  </>
                )}
                {u.state === 'offered' && (
                  <button type="button" className="wk-link-btn" disabled={busy}
                    onClick={() => void act('Propozycja wycofana.', () => endAttachment(u.attachmentId))}>
                    Wycofaj propozycję
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!record.closed && signer === null && record.uses.some((u) => u.state === 'asked') && <p className="wk-note">{NO_KEY}</p>}

      {!record.closed && (
        <div className="wk-ctl-offer">
          <AreaPick areas={areas} only={offerable} value={offerTo} onChange={setOfferTo} label="Zaproponuj obszarowi" placeholder="Zaproponuj obszarowi…" disabled={busy} />
          <button type="button" className="wk-btn wk-btn-small" disabled={busy || offerTo === '' || signer === null || ring === null}
            title={signer === null ? NO_KEY : undefined}
            onClick={() => void (async () => {
              const target = areas.find((a) => a.areaId === offerTo);
              if (ring === null || signer === null || target === undefined) return;
              const ok = await act(target.myLevel === 'admin' ? 'Administrator obowiązuje w wybranym obszarze.' : 'Propozycja wysłana — czeka na przyjęcie.', () =>
                offerController(ring, { controllerId: record.id, homeAreaId: areaId, areaId: target.areaId, signerRoleId: signer, accept: target.myLevel === 'admin' }));
              if (ok) setOfferTo('');
            })()}>
            Zaproponuj
          </button>
        </div>
      )}

      {!record.closed && !editing && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => setEditing(true)}>Zmień dane</button>
          <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void (async () => {
            const yes = await ask({
              title: 'Zamknąć tego administratora danych?',
              body: `Przestanie obowiązywać wszędzie${live > 0 ? ` (teraz w ${live} ${live === 1 ? 'obszarze' : 'obszarach'})` : ''}, a otwarte prośby i propozycje wygasną. Zostaje jako historia — nie da się go otworzyć ponownie.`,
              confirm: 'Zamknij', danger: true
            });
            if (yes) await act('Administrator zamknięty.', () => closeController(record.id));
          })()}>
            Zamknij
          </button>
        </div>
      )}
    </article>
  );
}

/* -- Wer an einem Tag geradestand -------------------------------------------------------- */

function History({ areaId }: { areaId: string }) {
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
      <summary>Kto odpowiadał w dniu…</summary>
      <div className="wk-actions">
        <input type="date" value={date} aria-label="Dzień" onChange={(e) => { setDate(e.target.value); setFound(null); }} />
        <button type="button" className="wk-btn wk-btn-small wk-btn-line" disabled={busy || date === ''} onClick={() => void look()}>Sprawdź</button>
      </div>
      {found === 'failed' && <p className="wk-error">Nie udało się sprawdzić.</p>}
      {found !== null && found !== 'failed' && (found.controller === null
        ? <p className="wk-note">Tego dnia nikt nie odpowiadał tu za dane.</p>
        : <RecordLines c={found.controller} />)}
    </details>
  );
}

/* -- Im Formular ------------------------------------------------------------------------ */

/** Welcher Administrator für das Formular gilt — und wo man ihn ändert. */
export function FormControllerNote({ areaId }: { areaId: string | null }) {
  const { state } = useControllerState(areaId);

  if (areaId === null) return <p className="wk-note wk-controller-missing">Formularz bez obszaru nie przyjmuje zgłoszeń.</p>;
  if (state === undefined) return <Loading lines={1} />;
  if (state === 'failed') return <p className="wk-error">Nie udało się wczytać administratora danych.</p>;

  const c = state.controller;
  const settings = viewPath('areas', c?.fromAreaId ?? areaId, 'ustawienia');

  return (
    <section className="wk-form wk-controller" data-form-controller={c !== null ? 'area' : 'none'}>
      <h4 className="wk-h2">Administrator danych</h4>
      {c !== null ? (
        <p className="wk-controller-line">
          <strong>{c.name}</strong> — z obszaru <a href={settings}>{c.fromAreaName ?? 'tego formularza'}</a>, ten sam dla wszystkich jego formularzy.
        </p>
      ) : (
        <p className="wk-warn">
          Formularz nie przyjmie zgłoszeń, dopóki obszar nie ma administratora danych. <a href={settings}>Wskaż go w ustawieniach obszaru</a>.
        </p>
      )}
    </section>
  );
}
