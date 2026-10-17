/**
 * PRZENIESIENIE DANYCH (2026-10-17) — `#/workspace/account/przeniesienie`.
 *
 * Was noch in einer älteren Form in der Datenbank liegt, und ein Knopf, der
 * umstellt, was DIESER Browser mit DIESEM Konto umstellen kann (`transfer.ts`).
 * Darunter, was in der ganzen Datenbank noch übrig ist: erst wenn dort alles
 * auf null steht, kann die Rückwärtsverträglichkeit gehen (Schritt 3,
 * documentation/TRANSFER.md).
 */

import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';

import type { Ring, SealedRole } from '../core/keys';
import { plural } from '../core/plural';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { loadModules, type ModuleRow } from '../modules/module';
import { personsOf, type RoleGraphData } from '../roles/roles';
import { useCrumbs } from '../shell/crumbTrail';
import { Unlock } from '../shell/Unlock';
import { Icon, type IconName } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { invalidate } from '../workspace/viewData';
import { handOver, holdsAnything, loadHeld, type Held } from './handOver';
import {
  layoutsToSeparate, loadTransfer, moveControllers, moveSms, planControllers, remaining, rewrapForms, separateKeys,
  smsToMove, transferChats, type ControllerMove, type TransferStatus
} from './transfer';

/** Die Adresse dieser Seite unter dem Konto. */
export const TRANSFER = 'przeniesienie';

interface Loaded {
  readonly status: TransferStatus;
  readonly ring: Ring | null;
  readonly graph: RoleGraphData;
  readonly modules: readonly ModuleRow[];
  readonly held: Held | null;
  readonly moves: readonly ControllerMove[];
  readonly names: ReadonlyMap<string, string>;
}

const failure = (e: unknown, fallback: string) => (e instanceof WorkspaceError || e instanceof Error) && e.message !== '' ? e.message : fallback;

export function TransferPage({ who }: { who: Who }) {
  useCrumbs([{ label: 'Przeniesienie danych', href: null }]);

  const [loaded, setLoaded] = useState<Loaded | null | 'failed'>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<readonly string[]>([]);
  const [personId, setPersonId] = useState('');

  const look = useCallback(async () => {
    try {
      const [status, keys, modules, held] = await Promise.all([
        loadTransfer(), keysFor(who), loadModules().then((r) => r.modules), loadHeld().catch(() => null)
      ]);
      const moves = await planControllers(modules).catch(() => []);
      const names = keys.ring === null ? new Map<string, string>() : await keys.ring.names().catch(() => new Map<string, string>());
      setLoaded({ status, ring: keys.ring, graph: keys.graph, modules, held, moves, names });
    } catch {
      setLoaded('failed');
    }
  }, [who]);

  useEffect(() => { void look(); }, [look]);

  if (loaded === null) return <div className="wk-narrow ui-page"><Loading lines={4} /></div>;
  if (loaded === 'failed') {
    return <div className="wk-narrow ui-page"><p className="wk-error">Nie udało się wczytać stanu przeniesienia.</p></div>;
  }

  const { status, ring, graph, modules, held, moves, names } = loaded;
  const persons = personsOf(graph);
  const person: SealedRole | null = persons.find((p) => p.id === personId) ?? persons[0] ?? null;
  const sms = smsToMove(modules);
  const layouts = ring === null ? [] : layoutsToSeparate(ring, graph);
  const handing = held !== null && holdsAnything(held);
  const movable = moves.filter((m) => !m.conflict);

  /** Ein Schritt nach dem anderen; jeder sagt, was er tat — auch, was er stehen liess. */
  const run = async (steps: readonly (readonly [string, () => Promise<string>])[]) => {
    setSaid([]);
    for (const [what, todo] of steps) {
      setBusy(what);
      try {
        const line = await todo();
        setSaid((was) => [...was, line]);
      } catch (e) {
        setSaid((was) => [...was, `${what}: ${failure(e, 'nie udało się')}.`]);
      }
    }
    setBusy(null);
    invalidate();
    await look();
  };

  const chatsStep = ['Rozmowy', async () => {
    const done = await transferChats();
    return `Rozmowy: przestawiono ${done.converted}${done.skipped > 0 ? `, ${done.skipped} czeka na prowadzącego ich obszar` : ''}.`;
  }] as const;

  const controllersStep = ['Administrator danych', async () => {
    const done = await moveControllers(moves);
    return `Administrator danych: ${done.lifted} ${plural(done.lifted, 'obszar', 'obszary', 'obszarów')} z wpisem, ${done.cleared} ${plural(done.cleared, 'stary wpis usunięty', 'stare wpisy usunięte', 'starych wpisów usuniętych')}`
      + `${done.left > 0 ? `; ${done.left} czeka na decyzję (różne wpisy w jednym obszarze albo formularz bez obszaru)` : ''}.`;
  }] as const;

  const smsStep = ['Szablony SMS', async () => `Szablony SMS: przeniesiono ${await moveSms(sms)}.`] as const;

  const layoutStep = ['Klucze podpisu', async () => {
    if (ring === null) throw new WorkspaceError('potrzebne hasło');
    const done = await separateKeys(ring, layouts);
    return `Klucze podpisu: osobny klucz dla ${done.separated} ${plural(done.separated, 'roli', 'ról', 'ról')}${done.failed > 0 ? `, ${done.failed} się nie udało` : ''}.`;
  }] as const;

  const rsaStep = ['Odpowiedzi', async () => {
    if (ring === null) throw new WorkspaceError('potrzebne hasło');
    const done = await rewrapForms(ring, status.rsaForms);
    return `Odpowiedzi: ${done.rewrapped} przepakowanych z koperty RSA${done.failed > 0 ? `, ${done.failed} ${plural(done.failed, 'formularz', 'formularze', 'formularzy')} się nie otworzył(y)` : ''}.`;
  }] as const;

  const handStep = ['Konto → osoba', async () => {
    if (ring === null || held === null || person === null) throw new WorkspaceError('potrzebne hasło i osoba');
    const done = await handOver(ring, held, person);
    return `Konto → osoba: ${done.areas} ${plural(done.areas, 'obszar', 'obszary', 'obszarów')}, ${done.intakes} ${plural(done.intakes, 'skrzynka', 'skrzynki', 'skrzynek')}, `
      + `${done.addresses} ${plural(done.addresses, 'adres', 'adresy', 'adresów')}, ${done.calendarItems} ${plural(done.calendarItems, 'wpis', 'wpisy', 'wpisów')} w kalendarzu.`;
  }] as const;

  const all = [
    status.chatsMine > 0 && chatsStep,
    movable.length > 0 && controllersStep,
    sms.length > 0 && smsStep,
    ring !== null && handing && person !== null && handStep,
    ring !== null && layouts.length > 0 && layoutStep,
    ring !== null && status.rsaForms.length > 0 && rsaStep
  ].filter((x): x is Exclude<typeof x, false> => x !== false);

  const left = remaining(status);

  return (
    <div className="wk-narrow ui-page wk-transfer">
      <PageHeader
        title="Przeniesienie danych"
        meta={left === 0 ? 'Wszystko jest już w obecnej postaci.' : `Do przeniesienia w całej bazie: ${left}`}
        actions={all.length > 0 && (
          <button type="button" className="wk-btn" disabled={busy !== null} onClick={() => void run(all)}>
            {busy !== null ? `${busy}…` : 'Przenieś wszystko'}
          </button>
        )}
      />

      <p className="wk-lede">
        Część danych leży jeszcze w formie sprzed kolejnych zmian platformy. Tu przenosisz do obecnej postaci to, do czego
        masz dostęp — klucze są przepakowywane w tej przeglądarce. Nic nie zmienia tego, kto co widzi.
      </p>

      {ring === null && (
        <Unlock who={who} why="Klucze podpisu, konto i odpowiedzi przepakowuje ta przeglądarka — potrzebne jest hasło." onDone={() => void look()} />
      )}

      {said.length > 0 && (
        <p className="wk-done" role="status">{said.map((line, i) => <Fragment key={line}>{i > 0 && <br />}{line}</Fragment>)}</p>
      )}

      <section className="wk-box" aria-label="Do przeniesienia">
        <Line icon="chat" title="Rozmowy — kto może pisać" first
          sub={status.chatsMine === 0
            ? (status.chats === 0 ? 'Wszystkie mają zapisaną zasadę.' : 'Pozostałe należą do obszarów, których nie prowadzisz.')
            : `${status.chatsMine} ${plural(status.chatsMine, 'rozmowa ma', 'rozmowy mają', 'rozmów ma')} jeszcze „dotychczasowe zasady" — zostaną zapisane wprost.`}
          action={status.chatsMine > 0 ? <Run busy={busy} onRun={() => void run([chatsStep])}>Przestaw</Run> : null} />

        <Line icon="form" title="Administrator danych — z formularzy do obszarów"
          sub={moves.length === 0 ? 'Żaden formularz nie ma już własnego wpisu.'
            : moves.map((m) => `${m.areaName ?? 'bez obszaru'}: ${m.forms.length} ${plural(m.forms.length, 'formularz', 'formularze', 'formularzy')}`
              + (m.conflict ? ' — różne wpisy, ustaw ręcznie' : m.lift === null ? ' — obszar ma już administratora' : ` → „${m.lift.name}"`)).join(' · ')}
          action={movable.length > 0 ? <Run busy={busy} onRun={() => void run([controllersStep])}>Przenieś</Run> : null} />

        <Line icon="mail" title="Szablony SMS"
          sub={sms.length === 0 ? 'Wszystkie są na liście szablonów.' : `${sms.length} ${plural(sms.length, 'formularz ma', 'formularze mają', 'formularzy ma')} jeszcze pojedynczy stary szablon.`}
          action={sms.length > 0 ? <Run busy={busy} onRun={() => void run([smsStep])}>Przenieś</Run> : null} />

        <Line icon="user" title="Konto → osoba"
          sub={!handing ? 'Konto samo niczego nie trzyma.'
            : person === null ? 'Konto trzyma jeszcze obszary sprzed zmian — najpierw załóż osobę w „Role".'
            : `Konto trzyma jeszcze ${held!.areas.length} ${plural(held!.areas.length, 'obszar', 'obszary', 'obszarów')} i ${held!.calendarItems} ${plural(held!.calendarItems, 'wpis', 'wpisy', 'wpisów')} w kalendarzu — przejmie je osoba.`}
          action={handing && person !== null && ring !== null ? (
            <span className="wk-actions">
              {persons.length > 1 && (
                <select aria-label="Która osoba przejmuje" value={person.id} disabled={busy !== null} onChange={(e) => setPersonId(e.target.value)}>
                  {persons.map((p) => <option key={p.id} value={p.id}>{names.get(p.id) ?? 'Osoba bez nazwy'}</option>)}
                </select>
              )}
              <Run busy={busy} onRun={() => void run([handStep])}>Przekaż</Run>
            </span>
          ) : null} />

        <Line icon="key" title="Osobny klucz podpisu"
          sub={ring === null ? 'Widać po podaniu hasła.'
            : layouts.length === 0 ? 'Twoje role mają już osobny klucz podpisu.'
            : `${layouts.length} ${plural(layouts.length, 'rola ma', 'role mają', 'ról ma')} jeszcze jeden klucz do czytania i podpisu — podpis dostaną tylko prowadzący.`}
          action={ring !== null && layouts.length > 0 ? <Run busy={busy} onRun={() => void run([layoutStep])}>Rozdziel</Run> : null} />

        <Line icon="lock" title="Odpowiedzi w kopertach RSA"
          sub={status.rsaForms.length === 0
            ? (status.rsa === 0 ? 'Wszystkie odpowiedzi leżą pod kluczem kancelarii.' : 'Pozostałe należą do formularzy, których nie prowadzisz.')
            : `${status.rsaForms.reduce((n, f) => n + f.values, 0)} odpowiedzi w ${status.rsaForms.length} ${plural(status.rsaForms.length, 'formularzu', 'formularzach', 'formularzach')} — zostaną przepakowane pod klucz kancelarii.`}
          action={ring !== null && status.rsaForms.length > 0 ? <Run busy={busy} onRun={() => void run([rsaStep])}>Przepakuj</Run> : null} />
      </section>

      <section aria-labelledby="transfer-all">
        <h2 className="wk-h2" id="transfer-all">W całej bazie</h2>
        <p>
          Gdy wszystko poniżej jest na zero, można usunąć części platformy, które istnieją tylko dla starych danych (krok 3).
          Resztę muszą przenieść osoby, do których te dane należą — po zalogowaniu, na tej samej stronie.
        </p>
        <ul className="wk-list">
          <Count n={status.chats} label="rozmowy z dotychczasowymi zasadami" />
          <Count n={status.controllers} label="formularze z własnym administratorem danych" />
          <Count n={status.sms} label="formularze ze starym szablonem SMS" />
          <Count n={status.accounts} label="konta, które same coś trzymają" />
          <Count n={status.layouts} label="role z jednym kluczem do czytania i podpisu" />
          <Count n={status.rsa} label="odpowiedzi jeszcze w kopertach RSA (nie blokuje kroku 3)" />
          <Count n={status.plainNames} label="jawne nazwy i imiona" />
        </ul>
      </section>

      <section aria-labelledby="transfer-server">
        <h2 className="wk-h2" id="transfer-server">Po stronie serwera</h2>
        <ul className="wk-list">
          <Count n={status.migrations.length} label={`skrypty bazy bez wpisu${status.migrations.length > 0 ? ` (${status.migrations[0]} … ${status.migrations[status.migrations.length - 1]})` : ''}`} />
          <Count n={status.legacySchemas.length} label={`puste schematy starego systemu${status.legacySchemas.length > 0 ? `: ${status.legacySchemas.join(', ')}` : ''}`} />
          <Count n={status.unheld} label="role, których nikt już nie trzyma" />
        </ul>
        <p>To porządkuje administrator serwera — opis w documentation/TRANSFER.md.</p>
      </section>
    </div>
  );
}

function Line({ icon, title, sub, action, first = false }: {
  icon: IconName; title: string; sub: string; action: ReactNode; first?: boolean;
}) {
  return (
    <div className={`wk-line is-wrap${first ? ' wk-line-first' : ''}`}>
      <span className={`wk-line-ic ${action === null ? 'is-ok' : 'is-warn'}`}><Icon name={action === null ? 'check' : icon} /></span>
      <span className="wk-line-text">
        <span className="wk-line-title">{title}</span>
        <span className="wk-line-sub">{sub}</span>
      </span>
      {action !== null && <span className="wk-line-end">{action}</span>}
    </div>
  );
}

function Run({ busy, onRun, children }: { busy: string | null; onRun: () => void; children: ReactNode }) {
  return <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy !== null} onClick={onRun}>{children}</button>;
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <li className="wk-row">
      <span><strong>{n}</strong> {label}</span>
      {n === 0 && <span className="wk-tag">gotowe</span>}
    </li>
  );
}
