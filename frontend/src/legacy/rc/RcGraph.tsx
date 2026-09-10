/**
 * Cogita — der Wissensgraph.
 *
 * Zwei Dinge trägt diese Ansicht, und beide sind Aussagen über Ehrlichkeit:
 *
 *   1. **Die Suche sagt, WO sie gesucht hat.** In einer offenen Bibliothek auf
 *      dem Server, in einer versiegelten hier im Browser — und im zweiten Fall
 *      steht dabei, dass „hier" nicht zwingend „alles" heisst. Eine Suche, die
 *      beides gleich darstellt, behauptet eine Vollständigkeit, die sie nicht
 *      hat.
 *
 *   2. **„Nicht bekannt" ist eine Angabe.** Der Zustand einer Kante wird
 *      ausgeschrieben und nicht weggelassen. Ein leeres Feld heisst „niemand
 *      hat sich damit befasst"; `unknown` heisst „wir haben nachgesehen und
 *      wissen es nicht". Das ist der ganze Gewinn dieses Modells, und eine
 *      Oberfläche, die beides gleich zeigt, wirft ihn weg.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rcCopy, rcPlural, type RcLang } from './i18n';
import type { RcArea } from './lib/rcChat';
import {
  RC_EDGE_STATES, RC_NODE_KINDS, rcAddEdge, rcAddNode, rcCreateLibrary, rcLibraries,
  rcNodeLabel, rcNodes, rcSearchGraph,
  type RcEdgeState, type RcGraphSearch, type RcLibrary, type RcNode, type RcNodeKind
} from './lib/rcGraph';
import { useRcError } from './RcThreads';

export function RcGraphSection({
  lang, areas, unlocked, onError
}: {
  lang: RcLang;
  areas: readonly RcArea[];
  unlocked: boolean;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].graph;
  const describe = useRcError(lang);

  const [list, setList] = useState<readonly RcLibrary[]>([]);
  const [open, setOpen] = useState<RcLibrary | null>(null);

  const refresh = useCallback(async () => {
    if (!unlocked) return;
    try { setList((await rcLibraries()).libraries ?? []); }
    catch (e) { onError(describe(e)); }
  }, [unlocked, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!unlocked) return <p className="rc-note">{rcCopy[lang].chat.locked}</p>;

  if (open !== null) {
    return (
      <RcLibraryDetail
        lang={lang}
        library={open}
        onBack={() => { setOpen(null); void refresh(); }}
        onError={onError}
      />
    );
  }

  const usable = areas.filter((a) => a.canCertify);

  return (
    <div className="rc-panel">
      {list.length === 0 && <p className="rc-note">{t.none}</p>}

      <ul className="rc-event-list">
        {list.map((library) => (
          <li key={library.libraryId} className="rc-event-row">
            <button type="button" className="rc-event-open" onClick={() => setOpen(library)}>
              <span className="rc-event-title">
                {library.title}
                {/* Offen oder versiegelt ist die wichtigste Eigenschaft einer
                    Bibliothek. Sie gehört an die Liste, nicht in eine
                    Detailansicht, die man erst aufmachen muss. */}
                <span className="rc-lib-mode" data-public={library.isPublic}>
                  {library.isPublic ? t.public : '🔒'}
                </span>
              </span>
              <span className="rc-event-meta">
                <code>/{library.slug}</code>
                {' · '}
                {rcPlural(lang, t.nodes, library.nodes)}
                {' · '}
                {rcPlural(lang, t.edges, library.edges)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {usable.length > 0 && (
        <RcNewLibrary lang={lang} areas={usable} onDone={refresh} onError={onError} />
      )}
    </div>
  );
}

/**
 * Eine Bibliothek anlegen — und die eine Entscheidung dabei sichtbar machen.
 *
 * Offen oder versiegelt fällt hier und lässt sich nie wieder umlegen. Beide
 * Folgen stehen deshalb ausgeschrieben da, bevor jemand klickt: nicht als
 * Hinweis unter einem Schalter, sondern als der eigentliche Inhalt dieses
 * Formulars.
 */
function RcNewLibrary({
  lang, areas, onDone, onError
}: {
  lang: RcLang;
  areas: readonly RcArea[];
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].graph;
  const describe = useRcError(lang);

  const [areaId, setAreaId] = useState(areas[0]?.areaId ?? '');
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return (
    <form
      className="rc-new-event"
      onSubmit={async (e) => {
        e.preventDefault();
        if (title.trim().length === 0 || busy) return;
        setBusy(true);
        try {
          await rcCreateLibrary(areaId, slug, title, isPublic);
          setTitle('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.create}</h5>

      {areas.length > 1 && (
        <label className="rc-inline-field">
          <span>{rcCopy[lang].chat.areas}</span>
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => (
              <option key={a.areaId} value={a.areaId}>{a.title ?? a.areaId.slice(0, 8)}</option>
            ))}
          </select>
        </label>
      )}

      <label className="rc-field">
        <span>{t.title}</span>
        <input type="text" value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="rc-check">
        <input type="checkbox" checked={isPublic} disabled={busy}
          onChange={(e) => setIsPublic(e.target.checked)} />
        <span>{t.public}</span>
      </label>

      {/* BEIDE Folgen, nicht nur die des angeklickten Falls. Wer nur die eine
          liest, kennt die Entscheidung nicht — er kennt eine Hälfte davon. */}
      <div className="rc-mode-choice">
        <p className="rc-note" data-chosen={isPublic}>{t.publicWhy}</p>
        <p className="rc-note" data-chosen={!isPublic}>{t.privateWhy}</p>
        <p className="rc-note rc-mode-locked">{t.locked}</p>
      </div>

      <button type="submit" className="rc-btn" disabled={busy || title.trim().length === 0}>
        {t.make}
      </button>
    </form>
  );
}

// -- Eine Bibliothek ----------------------------------------------------------

function RcLibraryDetail({
  lang, library, onBack, onError
}: {
  lang: RcLang;
  library: RcLibrary;
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].graph;
  const describe = useRcError(lang);

  const [nodes, setNodes] = useState<readonly RcNode[]>([]);
  const [needle, setNeedle] = useState('');
  const [found, setFound] = useState<RcGraphSearch | null>(null);

  const refresh = useCallback(async () => {
    try { setNodes((await rcNodes(library.libraryId)).nodes ?? []); }
    catch (e) { onError(describe(e)); }
  }, [library.libraryId, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Die Arten, die als Beschreibung einer Entität in Frage kommen (§1.2).
  const kinds = useMemo(() => nodes.filter((n) => n.kind === 'entity_kind'), [nodes]);

  const shown = found === null ? nodes
    : nodes.filter((n) => found.hits.some((h) => h.nodeId === n.nodeId));

  return (
    <div className="rc-panel">
      <header className="rc-event-head">
        <button type="button" className="rc-link" onClick={onBack}>←</button>
        <h3>{library.title}</h3>
        <span className="rc-lib-mode" data-public={library.isPublic}>
          {library.isPublic ? t.public : '🔒'}
        </span>
      </header>

      {/* Die Suche. Was sie unter sich schreibt, ist wichtiger als die Treffer:
          in einer versiegelten Bibliothek hat sie nur gesehen, was geladen ist. */}
      <form
        className="rc-graph-search"
        onSubmit={async (e) => {
          e.preventDefault();
          if (needle.trim().length === 0) { setFound(null); return; }
          try { setFound(await rcSearchGraph(library.libraryId, needle, nodes)); }
          catch (err) { onError(describe(err)); }
        }}
      >
        <input
          type="search"
          value={needle}
          placeholder={t.searchHint}
          onChange={(e) => {
            setNeedle(e.target.value);
            if (e.target.value.trim().length === 0) setFound(null);
          }}
        />
        <button type="submit" className="rc-btn rc-btn-quiet">{t.search}</button>
      </form>

      {found !== null && (
        <div className="rc-search-where" data-where={found.where}>
          <p>{found.where === 'server' ? t.foundServer : t.foundBrowser}</p>
          {found.where === 'browser' && <p className="rc-note">{t.browserWhy}</p>}
          {found.hits.length === 0 && <p className="rc-note">{t.nothing}</p>}
        </div>
      )}

      <ul className="rc-node-list">
        {shown.map((node) => (
          <li key={node.nodeId} className="rc-node" data-unreadable={node.unreadable !== null && node.unreadable !== undefined}>
            <span className="rc-node-kind">{t.kinds[node.kind] ?? node.kind}</span>

            {/* 15.9 — Ein unlesbarer Knoten fällt NICHT aus dem Graphen. Ein
                Loch wäre schlimmer: die Kanten daran zeigten ins Leere. */}
            {node.unreadable !== null && node.unreadable !== undefined ? (
              <span className="rc-node-sealed">{t.unreadable}</span>
            ) : (
              <span className="rc-node-value">
                {node.value !== null && node.value !== undefined && node.value.length > 0
                  ? node.value
                  : <em>{t.emptyNode}</em>}
              </span>
            )}

            <code className="rc-node-id">{node.nodeId.slice(0, 8)}</code>
          </li>
        ))}
      </ul>

      <RcNewNode
        lang={lang}
        libraryId={library.libraryId}
        kinds={kinds}
        onDone={refresh}
        onError={onError}
      />

      {nodes.length >= 2 && (
        <RcNewEdge
          lang={lang}
          libraryId={library.libraryId}
          nodes={nodes}
          onDone={refresh}
          onError={onError}
        />
      )}
    </div>
  );
}

function RcNewNode({
  lang, libraryId, kinds, onDone, onError
}: {
  lang: RcLang;
  libraryId: string;
  kinds: readonly RcNode[];
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].graph;
  const describe = useRcError(lang);

  const [kind, setKind] = useState<RcNodeKind>('text');
  const [value, setValue] = useState('');
  const [kindNodeId, setKindNodeId] = useState('');
  const [busy, setBusy] = useState(false);

  const needsKind = kind === 'entity';

  return (
    <form
      className="rc-new-event"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (needsKind && kindNodeId === '') return;
        setBusy(true);
        try {
          await rcAddNode(libraryId, kind, value.trim() || undefined,
            needsKind ? kindNodeId : undefined);
          setValue('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.addNode}</h5>

      <div className="rc-poll-opts">
        <label className="rc-inline-field">
          <span>{t.kind}</span>
          <select value={kind} disabled={busy}
            onChange={(e) => setKind(e.target.value as RcNodeKind)}>
            {RC_NODE_KINDS.map((k) => (
              <option key={k} value={k}>{t.kinds[k] ?? k}</option>
            ))}
          </select>
        </label>

        {/* §1.3 — Eine Entität ist ein Verbindungspunkt und braucht die Art,
            die sie beschreibt. Ohne Auswahl gäbe es keine anzubieten: dann
            steht da, was zuerst zu tun ist. */}
        {needsKind && (
          <label className="rc-inline-field">
            <span>{t.ofKind}</span>
            {kinds.length === 0 ? (
              <em className="rc-note">{t.needsKind}</em>
            ) : (
              <select value={kindNodeId} disabled={busy}
                onChange={(e) => setKindNodeId(e.target.value)}>
                <option value="">—</option>
                {kinds.map((k) => (
                  <option key={k.nodeId} value={k.nodeId}>{rcNodeLabel(k, k.nodeId.slice(0, 8))}</option>
                ))}
              </select>
            )}
          </label>
        )}
      </div>

      <label className="rc-field">
        <span>{t.value}</span>
        <input type="text" value={value} disabled={busy} onChange={(e) => setValue(e.target.value)} />
      </label>

      <button type="submit" className="rc-btn rc-btn-quiet"
        disabled={busy || (needsKind && kindNodeId === '')}>
        {t.addNode}
      </button>
    </form>
  );
}

function RcNewEdge({
  lang, libraryId, nodes, onDone, onError
}: {
  lang: RcLang;
  libraryId: string;
  nodes: readonly RcNode[];
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].graph;
  const describe = useRcError(lang);

  const [from, setFrom] = useState(nodes[0]?.nodeId ?? '');
  const [to, setTo] = useState(nodes[1]?.nodeId ?? '');
  const [relation, setRelation] = useState('');
  const [state, setState] = useState<RcEdgeState>('known');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const label = (node: RcNode) => rcNodeLabel(node, t.unreadable);

  return (
    <form
      className="rc-new-event"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || from === to || relation.trim().length === 0) return;
        setBusy(true);
        try {
          await rcAddEdge(libraryId, from, to, relation, {
            state, note: note.trim() || undefined
          });
          setRelation(''); setNote('');
          await onDone();
        } catch (err) {
          onError(describe(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h5 className="rc-chat-h">{t.addEdge}</h5>

      <div className="rc-poll-opts">
        <label className="rc-inline-field">
          <span>{t.from}</span>
          <select value={from} disabled={busy} onChange={(e) => setFrom(e.target.value)}>
            {nodes.map((n) => <option key={n.nodeId} value={n.nodeId}>{label(n)}</option>)}
          </select>
        </label>

        <label className="rc-inline-field">
          <span>{t.to}</span>
          <select value={to} disabled={busy} onChange={(e) => setTo(e.target.value)}>
            {nodes.map((n) => <option key={n.nodeId} value={n.nodeId}>{label(n)}</option>)}
          </select>
        </label>
      </div>

      <label className="rc-field">
        <span>{t.relation}</span>
        <input type="text" value={relation} disabled={busy}
          onChange={(e) => setRelation(e.target.value)} />
      </label>

      {/* §1.6 — Der Zustand ist ausgeschrieben und nicht weggelassen. „Nicht
          bekannt" ist eine Aussage; ein leeres Feld ist keine. */}
      <label className="rc-inline-field">
        <span>{t.state}</span>
        <select value={state} disabled={busy}
          onChange={(e) => setState(e.target.value as RcEdgeState)}>
          {RC_EDGE_STATES.map((s) => (
            <option key={s} value={s}>{t.states[s] ?? s}</option>
          ))}
        </select>
      </label>

      {state !== 'known' && <p className="rc-note rc-hint">{t.stateWhy}</p>}

      <label className="rc-field">
        <span>{t.note}</span>
        <input type="text" value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
      </label>

      <button type="submit" className="rc-btn rc-btn-quiet"
        disabled={busy || from === to || relation.trim().length === 0}>
        {t.addEdge}
      </button>
    </form>
  );
}
