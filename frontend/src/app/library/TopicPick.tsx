/**
 * THEMEN WÄHLEN, ACHSE FÜR ACHSE (2026-10-21).
 *
 * Hat die Bibliothek Aspekte („Okres liturgiczny", „Księga", „Temat"),
 * bekommt jeder seine Zeile: man wählt den Wert in seiner Ordnung, und ein
 * neuer Wert („+ Utwórz") entsteht gleich unter seinem Aspekt. Was zu keinem
 * gehört, steht unter „Inne tematy". Ohne Aspekte bleibt es die eine Wahl
 * wie bisher — gespeichert wird in beiden Fällen dieselbe Liste `topics`.
 */

import { useMemo } from 'react';

import { RefPicker } from './LibraryPick';
import type { Entry, LibraryStore } from './libraryStore';
import { facetOf, facetsOf, topicNode, topicTree } from './topics';

export function TopicsField({ store, value, readOnly, onChange }: {
  store: LibraryStore;
  value: readonly string[];
  readOnly: boolean;
  onChange: (next: string[]) => void;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tree = useMemo(() => topicTree(store.ofKind('topic').map(topicNode)), [store, store.revision]);
  const facets = useMemo(() => (tree.aspects.length === 0 ? [] : facetsOf(tree)), [tree]);

  if (facets.length === 0) {
    return <RefPicker store={store} kinds={['topic']} value={value} multiple busy={readOnly} onChange={onChange} />;
  }

  /* „Inne tematy" immer — dort entsteht ein Thema ohne Aspekt. */
  const rows = facets.some((f) => f.id === '') ? facets : [...facets, { id: '', name: 'Inne tematy', values: [] }];

  return (
    <div className="lib-aspect-pick">
      {rows.map((facet) => {
        const inFacet = (id: string) => facetOf(tree, id) === facet.id && id !== facet.id;
        const only = (entry: Entry) => inFacet(entry.id) && !(tree.nodes.get(entry.id)?.aspect ?? false);
        return (
          <div key={facet.id || 'inne'} className="lib-aspect-row">
            <span className="lib-aspect-name">{facet.name}</span>
            <RefPicker
              store={store} kinds={['topic']} multiple busy={readOnly}
              value={value.filter(inFacet)}
              only={only}
              makeWith={facet.id === '' ? undefined : { parent: facet.id }}
              placeholder={facet.id === '' ? 'Szukaj tematu…' : `${facet.name}: szukaj albo dodaj…`}
              onChange={(next) => onChange([...value.filter((id) => !inFacet(id)), ...next])}
            />
          </div>
        );
      })}
    </div>
  );
}
