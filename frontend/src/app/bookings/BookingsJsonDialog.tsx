/**
 * 2026-10-29 — REZERWACJE ALS JSON, das Fenster: „Więcej" → „Import i eksport (JSON)" über der Liste der
 * Dinge (alle) und auf der Seite eines Dings (im Export nur es). Dasselbe Fach wie überall (`JsonPanel`):
 * Export, Import mit Vorschau, daneben die Beschreibung (`BOOKINGS_JSON`).
 *
 * <b>Ohne Schlüssel kein Fach</b>: Titel und Orte der Termine liegen versiegelt — erst „podaj hasło"
 * (`Unlock`), dann der Rest. <b>Lesen darf, wer sieht; importieren, wer in einem Bereich schreibt</b> — und
 * auch dann nur dort (der Plan sagt es je Ding).
 */

import { useCallback, useEffect, useState } from 'react';

import { AreaPick } from '../areas/AreaPick';
import { useWho } from '../core/me';
import { keysFor } from '../core/ringOf';
import { WorkspaceError } from '../core/session';
import { Unlock } from '../shell/Unlock';
import { JsonPanel } from '../ui/JsonPanel';
import { Loading } from '../ui/Loading';
import { Modal } from '../ui/Modal';
import { BOOKINGS_JSON, exportBookings, newWithoutArea, planBookingsImport } from './bookingsJson';
import { loadBookings, runBookingsImport, type BookingKeys, type LoadedBookings } from './bookingsImport';
import type { ResourceRow } from './resource';

/**
 * Der Schlüsselbund und die Person, in deren Namen neue Termine entstehen — `null`: der Schlüssel ist zu.
 * Wie `useMe`, nur dass `tick` ihn nach dem Entsperren (`Unlock`) noch einmal holt.
 */
function useKeys(tick: number): { who: ReturnType<typeof useWho>; me: BookingKeys | null | undefined } {
  const who = useWho();
  const [me, setMe] = useState<BookingKeys | null | undefined>(undefined);
  useEffect(() => {
    if (who == null) return undefined;
    let alive = true;
    void (async () => {
      try {
        const { ring, graph } = await keysFor(who);
        const roles = ring === null ? [] : graph.roles.filter((r) => r.kind !== 'account' && ring.has(r.id));
        const person = roles.find((r) => r.kind === 'person') ?? null;
        if (alive) setMe(ring === null || person === null ? null : { ring, roles, person });
      } catch {
        if (alive) setMe(null);
      }
    })();
    return () => { alive = false; };
  }, [who, tick]);
  return { who, me: who === null ? null : me };
}

const fileName = (only: ResourceRow | null): string =>
  `rezerwacje${only === null ? '' : `-${only.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')}`}.json`;

/** Das Fenster — `only`: auf der Seite eines Dings (der Export trägt nur es, neue Dinge gehen in seinen Bereich). */
export function BookingsJsonDialog({ only, onClose, onImported }: {
  only: ResourceRow | null;
  onClose: () => void;
  onImported: () => void;
}) {
  return (
    <Modal title={only === null ? 'Rezerwacje — import i eksport (JSON)' : `${only.name} — import i eksport (JSON)`} onClose={onClose} wide>
      <BookingsJson only={only} onImported={onImported} />
    </Modal>
  );
}

function BookingsJson({ only, onImported }: { only: ResourceRow | null; onImported: () => void }) {
  const [tick, setTick] = useState(0);
  const { who, me } = useKeys(tick);
  const [loaded, setLoaded] = useState<LoadedBookings | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [areaId, setAreaId] = useState('');

  const look = useCallback(async () => {
    if (me == null) return;
    try {
      setLoaded(await loadBookings(me));
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać rezerwacji.');
    }
  }, [me]);

  useEffect(() => { void look(); }, [look]);

  if (who === undefined || me === undefined) return <Loading />;
  if (who === null) return <p className="wk-error">Import i eksport rezerwacji wymagają zalogowania.</p>;
  if (me === null) {
    return <Unlock who={who} why="Tytuły i miejsca terminów są zaszyfrowane — podaj hasło, żeby je wyeksportować albo zapisać." onDone={() => setTick((n) => n + 1)} />;
  }
  if (failed !== null && loaded === null) return <p className="wk-error">{failed}</p>;
  if (loaded === null) return <Loading label="Wczytywanie rezerwacji…" />;

  /* Wohin ein neues Ding ohne "area" geht: der Bereich dieses Dings, der einzige, in dem ich schreibe, oder die Wahl. */
  const writable = loaded.areas.filter((a) => (a.myLevel === 'write' || a.myLevel === 'admin') && a.personal !== true);
  const preset = only !== null && writable.some((a) => a.areaId === only.areaId) ? only.areaId : writable.length === 1 ? writable[0].areaId : '';
  const chosen = areaId !== '' ? areaId : preset;
  const options = { areaId: chosen === '' ? null : chosen };
  const writes = writable.length > 0;

  return (
    <JsonPanel
      open
      summary={only === null ? 'Rezerwacje jako JSON — eksport i import' : `Zasób „${only.name}” jako JSON — eksport i import`}
      lead={<>Zasoby z zasadami i terminami do wyboru — do kopii, do poprawy ręcznie albo przez AI. Import zmienia w miejscu to, co ma „id” z eksportu, zakłada to, co go nie ma, i niczego nie usuwa. Rezerwacje są w eksporcie tylko do wglądu.</>}
      fileName={fileName(only)}
      exportDoc={() => exportBookings(loaded.state, only?.resourceId ?? null)}
      format={BOOKINGS_JSON}
      preview={(doc) => {
        const plan = planBookingsImport(doc, loaded.state, options);
        return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
      }}
      options={(doc) => writes && newWithoutArea(doc) > 0 && (
        <label className="wk-field">
          <span>Obszar nowych zasobów bez „area”</span>
          <AreaPick label="Obszar nowych zasobów" areas={loaded.areas} only={writable} value={chosen} onChange={setAreaId} />
        </label>
      )}
      importLabel={writes ? 'Importuj' : 'Tylko odczyt'}
      onImport={async (doc, stage) => {
        if (!writes) throw new WorkspaceError('Rezerwacje możesz tu tylko czytać — nie piszesz w żadnym obszarze.');
        const done = await runBookingsImport({ doc, options, me, stage });
        await look();
        onImported();
        return done;
      }}
    />
  );
}

export default BookingsJsonDialog;
