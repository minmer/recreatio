/**
 * Die Bereiche als Möglichkeiten einer Auswahl — mit dem Weg, in dem sie liegen.
 *
 * <b>Eine Stelle für alle Auswahllisten.</b> Sieben Listen setzten je
 * `a.name` ein, und in jeder stand dasselbe Problem: zwei „Kandydaci", und
 * niemand sah, welcher welcher ist.
 *
 * <b>In der Ordnung des Baums</b> (`inOrder`), nicht nach dem Alphabet: was
 * zusammen liegt, steht zusammen, und der Weg vor dem Namen liest sich von
 * Zeile zu Zeile weiter.
 */

import { areaPath, inOrder, type AreaRow } from './area';

export function AreaOptions({ areas, only }: {
  /** ALLE sichtbaren Bereiche — aus ihnen wird der Weg gebildet. */
  areas: readonly AreaRow[];

  /** Welche davon zur Wahl stehen. Fehlt es, alle. */
  only?: readonly AreaRow[];
}) {
  const offered = new Set((only ?? areas).map((a) => a.areaId));

  /* Was in `only` steht, aber in `areas` fehlt, käme im Baum nicht vor — es
     steht dann hinten, mit seinem blossen Namen, statt still zu verschwinden. */
  const known = new Set(areas.map((a) => a.areaId));
  const strays = (only ?? []).filter((a) => !known.has(a.areaId));

  return (
    <>
      {inOrder(areas)
        .filter(({ area }) => offered.has(area.areaId))
        .map(({ area }) => {
          const path = areaPath(areas, area.areaId);
          return <option key={area.areaId} value={area.areaId} title={path.full}>{path.short}</option>;
        })}

      {strays.map((a) => <option key={a.areaId} value={a.areaId}>{a.name}</option>)}
    </>
  );
}

export default AreaOptions;
