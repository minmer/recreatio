/**
 * 2026-11-01 — EIN BEREICH FÜR EIN FELD der Art `area`: wohin die Antworten eines Lernbausteins gehen (Powtórka,
 * Przebieg, Nauka osoby z linkiem). Zur Wahl stehen Bereiche, die ich führe — ein Kurs, eine Gruppe, eine Klasse; leer:
 * wie die Baza wiedzy es sagt.
 *
 * Darunter, ob der Bereich Przyjęcia hat: ohne sie liest die Antworten nur der Uczący się selbst. Wer den Bereich
 * prowadzi, legt sie hier an (ein Schlüssel für seine Person, wie in den Ustawienia einer Baza).
 */

import { useEffect, useState } from 'react';

import type { AreaRow } from '../areas/area';
import { AreaPick, answerAreas } from '../areas/AreaPick';
import { useWho } from '../core/me';
import { keysFor } from '../core/ringOf';
import { call, WorkspaceError } from '../core/session';
import { createIntake } from '../forms/intake';
import { selfOf } from '../roles/roles';
import { useSeenAreas } from './PartAudience';

export function PickArea({ value, busy, onPick }: { value: string; busy: boolean; onPick: (areaId: string) => void }) {
  const areas = useSeenAreas();
  return (
    <>
      <AreaPick label="Obszar" areas={areas} only={answerAreas(areas)} value={value} disabled={busy}
        extras={[{ value: '', label: 'jak w bazie wiedzy' }]} onChange={onPick} />
      {value !== '' && (
        <p className="wk-part-audience-says" data-area-says="">
          Odpowiedzi przyślą uczący się, którzy należą do tego obszaru albo do obszaru nad nim (np. kursu). Czyta je ten, kto ma klucz przyjęć —
          na stronie zobaczy pod modułem „Odpowiedzi uczących się →”. Kto tu nie może wysłać, zachowa odpowiedzi dla siebie.
        </p>
      )}
      {value !== '' && <IntakeNote key={value} areaId={value} areas={areas} />}
    </>
  );
}

/** Hat der Bereich Przyjęcia? Ohne sie: ein Satz, und für wer ihn leitet der Knopf, der sie anlegt. */
function IntakeNote({ areaId, areas }: { areaId: string; areas: readonly AreaRow[] }) {
  const who = useWho();
  const [has, setHas] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void call<{ publicKey: string }>(`/intake/${encodeURIComponent(areaId)}`).then(() => { if (alive) setHas(true); }, () => { if (alive) setHas(false); });
    return () => { alive = false; };
  }, [areaId]);
  if (has !== false) return null;
  const leads = areas.some((a) => a.areaId === areaId && a.myLevel === 'admin');
  const make = async () => {
    if (who == null) return;
    setBusy(true);
    setFailed(null);
    try {
      const keys = await keysFor(who);
      const person = selfOf(keys.graph);
      if (keys.ring === null || person === null) throw new WorkspaceError('Najpierw podaj hasło — klucze nie są otwarte w tej karcie.');
      await createIntake(keys.ring, areaId, person.id);
      setHas(true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się utworzyć przyjęć.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wk-part-intake" data-area-intake="missing">
      <p className="wk-part-audience-says">Ten obszar nie ma jeszcze przyjęć — odpowiedzi tu nie trafią (zobaczy je tylko sam uczący się).</p>
      {leads && who != null && (
        <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => void make()}>
          {busy ? 'Tworzenie klucza (kilka sekund)…' : 'Utwórz przyjęcia'}
        </button>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}
