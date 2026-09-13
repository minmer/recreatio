/**
 * Aus flachen Pfaden ein Baum — die Adressen, wie sie ineinanderliegen.
 *
 * <b>Warum das hier steht und nicht in der Ansicht.</b> Es ist reine Rechnerei
 * ohne Bild: Pfade hinein, Ebenen heraus. So lässt es sich prüfen, ohne einen
 * Browser zu starten — und geprüft gehört es, weil zwei seiner Fälle sich
 * nicht von selbst verstehen (die Lücke und die Wurzel, siehe unten).
 */

import type { PageCard } from './desk';

/**
 * Ein Knoten im Adressbaum.
 *
 * <b>`page` darf fehlen.</b> `parish/grzegorzki/chor` lässt sich öffnen, ohne
 * dass `parish/grzegorzki` je eine eigene Zeile bekommen hätte: das Recht dazu
 * hängt an der nächsthöheren ÜBERNOMMENEN Adresse, nicht an einem lückenlosen
 * Pfad. Ein Baum, der solche Zwischenstücke verschwiege, hängte `chor` direkt
 * unter `parish` und zeigte damit eine Ebene weniger, als es gibt.
 */
export interface Node {
  readonly path: string;

  /** Nur das letzte Stück — was diesen Knoten vom Elternteil unterscheidet. */
  readonly name: string;

  /** Die Registerzeile, oder `null` bei einem blossen Zwischenstück. */
  page: PageCard | null;

  readonly children: Node[];
}

/**
 * Die Pfade einsortieren.
 *
 * <b>Die Reihenfolge der Eingabe ist gleichgültig.</b> Ein Elternteil entsteht
 * bei Bedarf mit und bekommt seine Zeile nachgetragen, wenn sie kommt. Hinge
 * das daran, dass der Dienst sortiert liefert, wäre es eine Zusage, die niemand
 * gegeben hat — und der Baum bräche an dem Tag, an dem jemand die Sortierung
 * der Abfrage ändert.
 *
 * <b>Die Wurzel (`''`) ist ein Geschwister, kein Elternteil.</b> Sie hat keinen
 * Schrägstrich und landet damit oben neben `parish`. Das ist richtig so: Pfade
 * hängen nicht unter der leeren Adresse — `start` ist keine Unterseite von
 * `recreatio.pl`, sondern eine eigene Wurzel, auf die die leere Adresse bloss
 * zeigt.
 */
export function treeOf(pages: readonly PageCard[]): Node[] {
  const roots: Node[] = [];
  const byPath = new Map<string, Node>();

  const ensure = (path: string): Node => {
    const known = byPath.get(path);
    if (known !== undefined) return known;

    const cut = path.lastIndexOf('/');
    const node: Node = {
      path,
      name: cut < 0 ? path : path.slice(cut + 1),
      page: null,
      children: []
    };

    byPath.set(path, node);

    if (cut < 0) roots.push(node);
    else ensure(path.slice(0, cut)).children.push(node);

    return node;
  };

  for (const page of pages) ensure(page.path).page = page;

  const sort = (nodes: Node[]): void => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) sort(node.children);
  };

  sort(roots);
  return roots;
}
