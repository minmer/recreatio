/**
 * EINEN BEREICH WÄHLEN — die eine Auswahl dafür, überall (`ui/TreePick`).
 *
 * <b>Der Baum, wie er ist.</b> Ein Bereich, der selbst nicht zur Wahl steht
 * (ich schreibe dort nicht), steht trotzdem da, als Weg zu denen darunter —
 * sonst stünde „Kandydaci" zweimal ohne Herkunft. Was nichts Wählbares trägt,
 * fällt weg. „Tylko ja" steht oben, die eigenen Bereiche der Rozmowy unten in
 * EINEM Ordner „Rozmowy", der zu ist — zehnmal „Rozmowa" untereinander sagte
 * nichts und schob die Gruppen aus dem Bild.
 *
 * <b>Mehrere auf einmal</b>: `AreaPickMany` — dieselbe Liste mit Kästchen,
 * eingebettet.
 */

import { useMemo } from 'react';

import { TreeList, TreePick, type TreeExtra, type TreeNode } from '../ui/TreePick';
import { parentInSight, type AreaRow } from './area';

/** Der Ordner der Rozmowy — keine Kennung eines Bereichs (die sind UUIDs). */
const CHATS = '~rozmowy';

/** Die Bereiche als Knoten: alle für den Weg, wählbar nur `only`; „Tylko ja" kommt als feste Zeile. */
function useAreaNodes(areas: readonly AreaRow[], only: readonly AreaRow[] | undefined, note?: (areaId: string) => string | null) {
  return useMemo(() => {
    const offered = new Set((only ?? areas).map((a) => a.areaId));
    const known = new Set(areas.map((a) => a.areaId));
    const personal = areas.find((a) => a.personal === true && offered.has(a.areaId)) ?? null;

    const nodes: TreeNode[] = areas
      .filter((a) => a.personal !== true)
      .map((a) => {
        const parent = parentInSight(areas, a);
        return {
          id: a.areaId,
          parentId: parent === null && a.ownChat != null ? CHATS : parent,
          label: a.name,
          selectable: offered.has(a.areaId),
          note: note?.(a.areaId) ?? (a.ownChat === 'direct' ? 'rozmowa we dwoje' : a.ownChat === 'group' ? 'grupa' : null)
        };
      });
    if (nodes.some((n) => n.parentId === CHATS)) {
      nodes.push({ id: CHATS, parentId: null, label: 'Rozmowy', selectable: false, closed: true, order: 1, note: 'grupy i rozmowy we dwoje' });
    }

    /* Was zur Wahl steht, aber in `areas` fehlt, steht oben ohne Weg — statt still zu verschwinden. */
    for (const a of only ?? []) {
      if (!known.has(a.areaId)) nodes.push({ id: a.areaId, parentId: null, label: a.name, selectable: true });
    }

    return { nodes, personal };
  }, [areas, only, note]);
}

export function AreaPick({ areas, only, value, onChange, extras = [], recent, note, placeholder, label, disabled, personalLabel = 'Tylko ja (prywatny)', id }: {
  /** ALLE sichtbaren Bereiche — aus ihnen wird der Baum. */
  areas: readonly AreaRow[];
  /** Welche zur Wahl stehen. Fehlt es, alle. */
  only?: readonly AreaRow[];
  value: string;
  onChange: (areaId: string) => void;
  /** Feste Zeilen oben: „— bez obszaru —", „jak w kalendarzu". */
  extras?: readonly TreeExtra[];
  /** Zuletzt gewählte Bereiche. */
  recent?: readonly string[];
  /** Was hinter einem Bereich steht („kanał już jest"). */
  note?: (areaId: string) => string | null;
  placeholder?: string;
  /** Wie die Wahl heisst — vorgelesen und über der Suche („Obszar"). */
  label: string;
  disabled?: boolean;
  /** Wie der eigene Bereich heisst, wenn er zur Wahl steht. */
  personalLabel?: string;
  id?: string;
}) {
  const { nodes, personal } = useAreaNodes(areas, only, note);
  const all = personal === null || extras.some((e) => e.value === personal.areaId)
    ? extras
    : [{ value: personal.areaId, label: personalLabel }, ...extras];

  return (
    <TreePick
      id={id}
      nodes={nodes}
      value={value}
      onChange={onChange}
      extras={all}
      recent={recent}
      placeholder={placeholder}
      label={label}
      disabled={disabled}
      emptyText="Nie ma tu obszaru do wyboru."
    />
  );
}

/** Mehrere Bereiche — eingebettet, mit Kästchen. */
export function AreaPickMany({ areas, only, value, onChange, label }: {
  areas: readonly AreaRow[];
  only?: readonly AreaRow[];
  value: readonly string[];
  onChange: (areaIds: readonly string[]) => void;
  label: string;
}) {
  const { nodes, personal } = useAreaNodes(areas, only);
  const extras = personal === null ? [] : [{ value: personal.areaId, label: 'Tylko ja (prywatny)' }];

  return (
    <TreeList
      inline
      nodes={nodes}
      extras={extras}
      multiple
      selected={value}
      label={label}
      emptyText="Nie ma tu obszaru do wyboru."
      onPick={(areaId) => onChange(value.includes(areaId) ? value.filter((one) => one !== areaId) : [...value, areaId])}
    />
  );
}

export default AreaPick;
