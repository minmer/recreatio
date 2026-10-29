/**
 * 2026-10-29 — MOJE DANE ALS JSON (`personsJson.ts`), im Konto unter „Moje dane": die Angaben aller Personen,
 * die das Konto selbst hält, hinaus und herein — mit dem Plan vor dem Knopf und der Beschreibung daneben.
 *
 * Geöffnet und versiegelt wird wie in `PersonCard`: mit dem Bund dieses Tabs (`keysFor`), jedes Feld einzeln
 * durch `setValue`, das auch die Abschriften in den Bereichen nachzieht. Geplant wird beim Import noch einmal
 * gegen den frischen Stand — was jemand inzwischen in „Moje dane" geändert hat, zählt.
 */

import { useEffect, useState } from 'react';

import { JsonPanel } from '../ui/JsonPanel';
import type { Ring } from '../core/keys';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { personsOf, type RoleGraphData } from '../roles/roles';
import { loadPerson, openMine, setValue } from './person';
import { applyPersons, exportPersons, planPersons, PERSONS_JSON, type PersonState } from './personsJson';

/** Die Personen des Kontos, offen — nur die, deren Schlüssel dieser Bund hält. */
async function loadPersons(ring: Ring, graph: RoleGraphData): Promise<PersonState[]> {
  const out: PersonState[] = [];
  for (const role of personsOf(graph)) {
    if (!ring.has(role.id)) continue;
    const mine = await loadPerson(role.id);
    out.push({
      roleId: role.id,
      name: await ring.name(role.id),
      values: await openMine(role.id, ring, mine.values),
      releases: mine.releases.map((r) => ({ field: r.field, areaName: r.areaName }))
    });
  }
  return out;
}

async function openKeys(who: Who): Promise<{ ring: Ring; graph: RoleGraphData }> {
  const { ring, graph } = await keysFor(who);
  if (ring === null) throw new WorkspaceError('Ta karta nie ma klucza konta — zaloguj się ponownie, żeby otworzyć swoje dane.');
  return { ring, graph };
}

export function PersonsJsonPanel({ who, onImported }: { who: Who; onImported: () => void }) {
  const [persons, setPersons] = useState<readonly PersonState[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void openKeys(who)
      .then(({ ring, graph }) => loadPersons(ring, graph))
      .then((found) => { if (alive) { setPersons(found); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [who, tick]);

  return (
    <JsonPanel
      summary="Moje dane jako JSON"
      lead={<>Imię, nazwisko, telefon, data urodzenia, adres, e-mail i przezwisko każdej osoby tego konta — do kopii albo do uzupełnienia przez AI. Import zmienia tylko pola osób z tego eksportu (po ich „id”), niczego nie usuwa i nikomu nowemu nie udostępnia.</>}
      fileName="moje-dane.json"
      exportDoc={async () => {
        const { ring, graph } = await openKeys(who);
        return exportPersons(await loadPersons(ring, graph));
      }}
      format={PERSONS_JSON}
      preview={(doc) => (persons === null
        ? { error: failed ? 'Nie udało się otworzyć danych osób tego konta.' : 'Dane osób jeszcze się otwierają — za chwilę zobaczysz plan.' }
        : planPersons(doc, persons))}
      importLabel="Zapisz dane"
      onImport={async (doc, stage) => {
        const { ring, graph } = await openKeys(who);
        const plan = planPersons(doc, await loadPersons(ring, graph));
        if ('error' in plan) throw new WorkspaceError(plan.error);
        const done = await applyPersons(plan, (roleId, field, value) => setValue(roleId, ring, field, value), stage);
        setTick((n) => n + 1);
        onImported();
        return { lines: done.lines, warnings: [...plan.warnings, ...done.warnings] };
      }}
    />
  );
}

export default PersonsJsonPanel;
