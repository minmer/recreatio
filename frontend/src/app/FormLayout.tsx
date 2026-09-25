/**
 * Der AUFBAU eines Formulars — Gruppen, Seiten, Reiter, Texte (0043).
 *
 * <b>Eine Gliederung, kein Zeichenbrett.</b> Ein Formular ist eine Folge mit
 * Ebenen; die bearbeitet man am besten als das, was sie ist: nach oben, nach
 * unten, in die Gruppe darüber hinein, aus der Gruppe heraus. Jede Zeile hat
 * dieselben vier Griffe, und jede Gruppe sagt, was sie ist.
 *
 * <b>Die Fragen selbst entstehen im Reiter „Pytania".</b> Hier werden sie nur
 * angeordnet — und eine neue Frage steht von selbst am Ende, bis jemand sie
 * einordnet.
 */

import { useEffect, useMemo, useState } from 'react';

import type { OpenField } from './form';
import { GROUP_LABEL, type GroupItem, type GroupKind, type LayoutItem } from './formDesign';
import { newId } from './ids';

/* -- Der Baum, als reine Umformungen ----------------------------------------------- */

type Tree = readonly LayoutItem[];

/** Das Element herausnehmen — und sagen, wo es stand. */
function take(tree: Tree, id: string): { rest: Tree; item: LayoutItem | null } {
  let found: LayoutItem | null = null;
  const walk = (items: Tree): LayoutItem[] => items.flatMap((item): LayoutItem[] => {
    if (item.id === id) { found = item; return []; }
    return item.type === 'group' ? [{ ...item, items: walk(item.items) }] : [item];
  });
  const rest = walk(tree);
  return { rest, item: found };
}

/** An eine Stelle einsetzen: in die Gruppe `parent` (oder ganz oben), an Stelle `at`. */
function put(tree: Tree, parent: string | null, at: number, item: LayoutItem): Tree {
  if (parent === null) return [...tree.slice(0, at), item, ...tree.slice(at)];
  return tree.map((one) => one.type !== 'group' ? one
    : one.id === parent ? { ...one, items: [...one.items.slice(0, at), item, ...one.items.slice(at)] }
    : { ...one, items: put(one.items, parent, at, item) });
}

/** Wo ein Element steht: seine Gruppe und seine Stelle darin. */
function where(tree: Tree, id: string, parent: string | null = null): { parent: string | null; at: number; siblings: Tree } | null {
  const at = tree.findIndex((one) => one.id === id);
  if (at >= 0) return { parent, at, siblings: tree };
  for (const one of tree) {
    if (one.type !== 'group') continue;
    const inner = where(one.items, id, one.id);
    if (inner !== null) return inner;
  }
  return null;
}

function change(tree: Tree, id: string, patch: (item: LayoutItem) => LayoutItem): Tree {
  return tree.map((one) => one.id === id ? patch(one)
    : one.type === 'group' ? { ...one, items: change(one.items, id, patch) } : one);
}

const move = (tree: Tree, id: string, by: -1 | 1): Tree => {
  const at = where(tree, id);
  if (at === null) return tree;
  const to = at.at + by;
  if (to < 0 || to >= at.siblings.length) return tree;
  const { rest, item } = take(tree, id);
  return item === null ? tree : put(rest, at.parent, to, item);
};

/** In die Gruppe darüber hinein — ans Ende. */
const indent = (tree: Tree, id: string): Tree => {
  const at = where(tree, id);
  if (at === null || at.at === 0) return tree;
  const above = at.siblings[at.at - 1];
  if (above.type !== 'group') return tree;
  const { rest, item } = take(tree, id);
  return item === null ? tree : put(rest, above.id, above.items.length, item);
};

/** Aus der Gruppe heraus — direkt hinter sie. */
const outdent = (tree: Tree, id: string): Tree => {
  const at = where(tree, id);
  if (at === null || at.parent === null) return tree;
  const group = where(tree, at.parent);
  if (group === null) return tree;
  const { rest, item } = take(tree, id);
  return item === null ? tree : put(rest, group.parent, group.at + 1, item);
};

/** Eine Gruppe auflösen: ihr Inhalt rückt an ihre Stelle. Nichts geht verloren. */
const dissolve = (tree: Tree, id: string): Tree => {
  const at = where(tree, id);
  if (at === null) return tree;
  const { rest, item } = take(tree, id);
  if (item === null || item.type !== 'group') return rest;
  let out = rest;
  item.items.forEach((child, i) => { out = put(out, at.parent, at.at + i, child); });
  return out;
};

/* -- Die Ansicht ----------------------------------------------------------------------- */

export function FormLayout({ layout, fields, busy, onSave }: {
  /** Der Aufbau, schon vollständig (`layoutWith`): jede Frage kommt genau einmal vor. */
  layout: readonly LayoutItem[];
  fields: ReadonlyMap<string, OpenField>;
  busy: boolean;
  onSave: (layout: readonly LayoutItem[]) => void;
}) {
  const [draft, setDraft] = useState<Tree>(layout);
  const key = useMemo(() => JSON.stringify(layout), [layout]);

  /*
   * Wird der gespeicherte Aufbau neu geladen, beginnt der Entwurf von dort.
   * Am INHALT gemessen (`key`), nicht an der Identität: ein neu gerechneter,
   * aber gleicher Aufbau soll keinen angefangenen Entwurf wegwerfen.
   */
  useEffect(() => { setDraft(layout); }, [key]);

  const dirty = JSON.stringify(draft) !== key;

  /* Neues kommt ans ENDE seiner Ebene — dorthin, wo man gerade hinsieht. */
  const add = (parent: string | null, item: LayoutItem) => setDraft((was) =>
    put(was, parent, parent === null ? was.length : (findGroup(was, parent)?.items.length ?? 0), item));

  return (
    <section className="wk-layout">
      <p className="wk-hint">
        Grupa zbiera pytania pod jednym nagłówkiem. Kolejne <strong>strony</strong> wypełnia się po kolei —
        następna otwiera się, gdy na poprzedniej są wszystkie wymagane odpowiedzi. Kolejne{' '}
        <strong>zakładki</strong> są dostępne jednocześnie. Grupy można zagnieżdżać.
      </p>

      <Level
        items={draft}
        parent={null}
        fields={fields}
        onDraft={setDraft}
        onAdd={add}
      />

      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => onSave(draft)}>
          Zapisz układ
        </button>
        {dirty && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setDraft(layout)}>
            Cofnij zmiany
          </button>
        )}
      </div>
    </section>
  );
}

function findGroup(tree: Tree, id: string): GroupItem | null {
  for (const one of tree) {
    if (one.type !== 'group') continue;
    if (one.id === id) return one;
    const inner = findGroup(one.items, id);
    if (inner !== null) return inner;
  }
  return null;
}

/** Eine Ebene: ihre Zeilen, und darunter „+ Tekst" / „+ Grupa". */
function Level({ items, parent, fields, onDraft, onAdd }: {
  items: Tree;
  parent: string | null;
  fields: ReadonlyMap<string, OpenField>;
  onDraft: (next: (was: Tree) => Tree) => void;
  onAdd: (parent: string | null, item: LayoutItem) => void;
}) {
  return (
    <ul className={parent === null ? 'wk-layout-list' : 'wk-layout-list wk-layout-inner'}>
      {items.map((item, i) => (
        <li key={item.id} className={`wk-layout-row wk-layout-${item.type}`}>
          <div className="wk-layout-head">
            {item.type === 'field' && (
              <span className="wk-layout-what">
                <strong>{fields.get(item.id)?.label ?? 'zapieczętowane pytanie'}</strong>
              </span>
            )}

            {item.type === 'text' && (
              <textarea
                className="wk-layout-what"
                rows={2}
                value={item.text}
                placeholder="Tekst między pytaniami"
                onChange={(e) => {
                  const text = e.target.value;
                  onDraft((was) => change(was, item.id, (one) => ({ ...one, text } as LayoutItem)));
                }}
              />
            )}

            {item.type === 'group' && (
              <span className="wk-layout-what wk-layout-group-head">
                <select
                  value={item.kind}
                  aria-label="Rodzaj grupy"
                  onChange={(e) => {
                    const kind = e.target.value as GroupKind;
                    onDraft((was) => change(was, item.id, (one) => ({ ...one, kind } as LayoutItem)));
                  }}
                >
                  {(['group', 'page', 'tab'] as const).map((k) => <option key={k} value={k}>{GROUP_LABEL[k]}</option>)}
                </select>
                <input
                  value={item.title}
                  placeholder="Tytuł"
                  onChange={(e) => {
                    const title = e.target.value;
                    onDraft((was) => change(was, item.id, (one) => ({ ...one, title } as LayoutItem)));
                  }}
                />
              </span>
            )}

            <span className="wk-layout-grips">
              <button type="button" className="wk-grip" title="W górę" disabled={i === 0}
                onClick={() => onDraft((was) => move(was, item.id, -1))}>↑</button>
              <button type="button" className="wk-grip" title="W dół" disabled={i === items.length - 1}
                onClick={() => onDraft((was) => move(was, item.id, 1))}>↓</button>
              <button type="button" className="wk-grip" title="Do grupy powyżej"
                disabled={i === 0 || items[i - 1].type !== 'group'}
                onClick={() => onDraft((was) => indent(was, item.id))}>→</button>
              <button type="button" className="wk-grip" title="Wyjmij z grupy" disabled={parent === null}
                onClick={() => onDraft((was) => outdent(was, item.id))}>←</button>
              {item.type !== 'field' && (
                <button type="button" className="wk-grip" title={item.type === 'group' ? 'Rozwiąż grupę (zawartość zostaje)' : 'Usuń tekst'}
                  onClick={() => onDraft((was) => item.type === 'group' ? dissolve(was, item.id) : take(was, item.id).rest)}>✕</button>
              )}
            </span>
          </div>

          {item.type === 'group' && (
            <Level items={item.items} parent={item.id} fields={fields} onDraft={onDraft} onAdd={onAdd} />
          )}
        </li>
      ))}

      <li className="wk-layout-add">
        <button type="button" className="wk-link-btn"
          onClick={() => onAdd(parent, { type: 'text', id: newId(), text: '' })}>+ Tekst</button>
        {' · '}
        <button type="button" className="wk-link-btn"
          onClick={() => onAdd(parent, { type: 'group', id: newId(), kind: 'group', title: '', items: [] })}>+ Grupa</button>
      </li>
    </ul>
  );
}

export default FormLayout;
