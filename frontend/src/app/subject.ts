/**
 * WOVON ein Bogen handelt — und wer das sein kann.
 *
 * <b>Ein Platz muss jemandem gehören.</b> Wer ein Formular abschickt, bekommt
 * einen Link, und der Link führt zu einem Platz. „Zu irgendetwas" ist keine
 * Antwort: an dem Platz hängen später Rechte, und Rechte hängen an einem
 * Menschen, an einer Gruppe oder an einem Amt. Der Baustein sagt, welche der
 * drei es ist (`forKind`, 0038); diese Datei sagt, WER davon in Frage kommt.
 *
 * <b>Mehr als einer ist der Normalfall, nicht die Ausnahme.</b> Ein Vater
 * meldet drei Kinder an. Jedes Kind ist eine eigene Rolle mit eigenen Angaben;
 * er hält ihre Schlüssel, weil sie ihm zugeteilt wurden. Deshalb ist die Frage
 * nie „wer bin ich", sondern „für wen fülle ich das gerade aus" — und die
 * Antwort muss sich während des Ausfüllens ändern lassen.
 *
 * <b>Die Angaben liegen EINMAL.</b> Vorname, Nachname, Rufname, Geburtstag
 * stehen an der Rolle des Menschen (`person_value`), nicht im Bogen. Der Bogen
 * schreibt sie ab; ändert der Mensch sie, zieht `setValue` die Abschriften
 * nach. Ohne diesen Weg tippt jeder seinen Vornamen zum vierten Mal und drei
 * der vier Stellen veralten still.
 */

import type { IdentityRole } from './form';
import type { Ring } from './keys';
import { loadPerson, openMine, PERSON_FIELDS, type PersonField } from './person';
import type { RoleGraphData } from './roles';

/** Wovon ein Baustein handeln kann. Dieselben vier wie `ck_module_for_kind`. */
export type ForKind = 'none' | 'person' | 'group' | 'role';

/** Einer, für den man den Bogen ausfüllen kann. */
export interface Subject {
  readonly roleId: string;

  /** `null` heisst „nicht lesbar", nicht „namenlos" — siehe `Ring.name`. */
  readonly name: string | null;

  /** Ist das die eigene Rolle? Sie steht zuerst. */
  readonly isMine: boolean;
}

/**
 * Welche Frage welche genormte Angabe abfragt.
 *
 * <b>Nur, wo beide dasselbe Wort benutzen.</b> `given_name` heisst hier wie
 * dort so, und deshalb genügt ein Vergleich. Die beiden alten Werte `name` und
 * `contact` stehen bewusst NICHT darin: „name" ist nicht „Vorname" und nicht
 * „Nachname", und raten heisst hier, in ein Formular etwas Falsches zu
 * schreiben, das danach abgeschickt wird.
 */
export function personFieldOf(role: IdentityRole): PersonField | null {
  return (PERSON_FIELDS as readonly string[]).includes(role)
    ? (role as PersonField)
    : null;
}

/**
 * Für wen dieser Bogen ausgefüllt werden kann.
 *
 * <b>Nur Rollen, deren Schlüssel man hält.</b> Eine Rolle, die man bloss sieht,
 * ist keine, für die man etwas eintragen kann: ihre Angaben gingen nicht auf,
 * und die Abschrift wäre unter einem Schlüssel versiegelt, den man nicht hat.
 *
 * <b>Die eigene zuerst.</b> Der häufigste Fall ist „ich für mich"; er soll
 * keinen Klick kosten. Der Rest steht nach Namen dahinter.
 */
export async function subjectsFor(
  forKind: ForKind, graph: RoleGraphData, ring: Ring
): Promise<readonly Subject[]> {
  if (forKind === 'none') return [];

  const out: Subject[] = [];

  for (const role of graph.roles) {
    if (role.kind !== forKind) continue;
    if (!ring.has(role.id)) continue;

    out.push({
      roleId: role.id,
      name: await ring.name(role.id),
      isMine: role.id === graph.personRoleId
    });
  }

  return out.sort((a, b) =>
    a.isMine !== b.isMine
      ? (a.isMine ? -1 : 1)
      : (a.name ?? '￿').localeCompare(b.name ?? '￿', 'pl'));
}

/**
 * Die genormten Angaben EINES Gewählten, offen.
 *
 * Eine Hülle, die nicht aufgeht, wird übergangen — wie überall sonst: ein
 * beschädigtes Feld darf die übrigen nicht verstecken. Wer nichts hinterlegt
 * hat, bekommt eine leere Karte und tippt wie bisher.
 */
export async function detailsOf(
  roleId: string, ring: Ring
): Promise<ReadonlyMap<PersonField, string>> {
  try {
    const mine = await loadPerson(roleId);
    return await openMine(roleId, ring, mine.values);
  } catch {
    return new Map();
  }
}
