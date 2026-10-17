/**
 * MAPA FORMULARZY (0096) — wie Formulare zusammenhängen, als React-Flow-Karte
 * (`#/workspace/modules/mapa-formularzy[/<formularz>]`).
 *
 * <code>
 *   strona ──zapisy──▶ formularz ──uzupełnia przez swój link──▶ podformularz ──wypełniane na──▶ strona
 *                          │  „po wysłaniu: link osoby", „osoba: Imię, Nazwisko", „Telefon — do wysłania linku"
 *                          ├──link osoby otwiera──▶ strona
 *                          ├──osoby dostają rolę──▶ rola
 *                          └──pokazany, gdy wysłany──▶ inny formularz / „moduł" widać, gdy … ──▶ strona
 *   [ grupa ]  ein Kasten um die Formulare einer Gruppe
 * </code>
 *
 * Gerechnet wird in `formGroups.ts` (`formMapModel`); hier wird nur geladen
 * und gezeichnet. Ein Klick öffnet das Formular oder die Seite. Die Gruppen
 * selbst ändert man in der Liste (Moduły) — hier sieht man, was sie ordnen.
 */

import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, Handle, MiniMap, Position, type Edge, type Node, type NodeProps } from 'reactflow';
import 'reactflow/dist/style.css';

import { loadDesk } from '../workspace/desk';
import { loadFields, type IdentityRole } from './form';
import { formMapModel, formSections, logicDependencies, type LogicPage, type MapEdgeKind, type MapNode } from './formGroups';
import { loadModules, type FormGroup, type ModuleRow } from '../modules/module';
import { loadPage } from '../pages/page';
import { readLogic } from '../pages/pageLogic';
import { partLabel } from '../pages/parts/registry';
import { myRoleNames } from '../roles/roleNames';
import { pageSteps, viewPath, formPath, formsPath } from '../routes';
import { whoIsThere, WorkspaceError } from '../core/session';
import { Loading } from '../ui/Loading';

interface World {
  readonly modules: readonly ModuleRow[];
  readonly groups: readonly FormGroup[];
  readonly identity: ReadonlyMap<string, readonly IdentityRole[]>;
  readonly pages: readonly LogicPage[];
  readonly roles: ReadonlyMap<string, string>;
}

const KIND_WORD: Record<MapNode['kind'], string> = {
  group: 'grupa', main: 'formularz', sub: 'podformularz', page: 'strona', role: 'rola'
};

function Box({ data }: NodeProps<MapNode>) {
  return (
    <div className={`wk-fmap-node is-${data.kind}`} data-fmap-node={data.id}>
      <Handle type="target" position={Position.Left} />
      <span className="wk-dep-kind">{KIND_WORD[data.kind]}</span>
      <strong>{data.label}</strong>
      {data.lines.map((line) => <span key={line} className="wk-dep-sub">{line}</span>)}
      {data.warnings.map((line) => <span key={line} className="wk-fmap-warn">⚠ {line}</span>)}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function GroupBox({ data }: NodeProps<MapNode>) {
  return (
    <div className="wk-fmap-group" data-fmap-node={data.id}>
      <span className="wk-dep-kind">grupa formularzy</span>
      <strong>{data.label}</strong>
    </div>
  );
}

const NODE_TYPES = { box: Box, groupBox: GroupBox };

const EDGE_CLASS: Record<MapEdgeKind, string> = {
  stands: 'is-stands', extends: 'is-extends', link: 'is-link', role: 'is-role', logic: 'is-logic', filled: 'is-filled'
};

export function FormMap({ focus = null }: { focus?: string | null }) {
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [only, setOnly] = useState<string>(focus ?? '');

  useEffect(() => { setOnly(focus ?? ''); }, [focus]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { modules, groups = [] } = await loadModules();
        const forms = modules.filter((m) => m.kind === 'form');

        /* Wozu die Fragen der Hauptformulare dienen (Imię, Telefon …) — ohne ihren Inhalt. */
        const identity = new Map<string, readonly IdentityRole[]>();
        await Promise.all(forms.filter((f) => f.extendsId === null).map(async (f) => {
          try {
            const { fields } = await loadFields(f.moduleId);
            identity.set(f.moduleId, fields.map((x) => x.identityRole));
          } catch {
            identity.set(f.moduleId, []);
          }
        }));

        /* Die Karten der Seiten: was dort von einem Formular abhängt. */
        const desk = await loadDesk().catch(() => null);
        const paths = new Set<string>([...(desk?.pages ?? []).filter((p) => p.aliasOf === null).map((p) => p.path)]);
        const pages: LogicPage[] = [];
        await Promise.all([...paths].map(async (path) => {
          try {
            const page = await loadPage(path);
            const logic = readLogic(page.logic ?? null);
            if (logic !== null) pages.push({ path, logic, parts: page.parts.map((p) => ({ id: p.id, moduleId: p.moduleId ?? null, kind: p.kind })) });
          } catch {
            // Eine Seite, die nicht aufgeht, fehlt auf der Karte.
          }
        }));

        const who = await whoIsThere();
        const roles = who === null ? new Map<string, string>() : await myRoleNames(who).catch(() => new Map<string, string>());
        if (alive) setWorld({ modules, groups, identity, pages, roles });
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać formularzy.');
      }
    })();
    return () => { alive = false; };
  }, []);

  const model = useMemo(() => {
    if (world === null) return null;
    const sections = formSections(world.modules, world.groups);
    return formMapModel({
      sections,
      identity: world.identity,
      needs: logicDependencies(world.pages),
      moduleName: (id) => {
        const m = world.modules.find((x) => x.moduleId === id);
        return m === undefined ? null : `${m.name}${m.kind === 'form' ? '' : ` (${partLabel(m.kind)})`}`;
      },
      roleName: (id) => world.roles.get(id) ?? null,
      focus: only === '' ? null : only
    });
  }, [world, only]);

  const nodes: Node<MapNode>[] = useMemo(() => (model?.nodes ?? []).map((n) => ({
    id: n.id,
    type: n.kind === 'group' ? 'groupBox' : 'box',
    position: { x: n.x, y: n.y },
    data: n,
    draggable: true,
    ...(n.parent === undefined ? {} : { parentNode: n.parent, extent: 'parent' as const }),
    ...(n.kind === 'group' ? { style: { width: n.width, height: n.height }, zIndex: -1, selectable: false } : {})
  })), [model]);

  const edges: Edge[] = useMemo(() => (model?.edges ?? []).map((e) => ({
    id: e.id, source: e.from, target: e.to, label: e.label, className: EDGE_CLASS[e.kind],
    animated: e.kind === 'link', data: { kind: e.kind }
  })), [model]);

  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (world === null || model === null) return <Loading label="Wczytywanie mapy formularzy…" />;

  const mains = world.modules.filter((m) => m.kind === 'form').sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  return (
    <div className="wk-dep wk-fmap" data-form-map="">
      <div className="wk-fmap-head">
        <label className="wk-inline">
          <span>Pokaż</span>
          <select value={only} data-fmap-focus="" onChange={(e) => setOnly(e.target.value)}>
            <option value="">wszystkie formularze</option>
            {mains.map((m) => <option key={m.moduleId} value={m.moduleId}>{m.extendsId === null ? m.name : `↳ ${m.name}`}</option>)}
          </select>
        </label>
        <a className="wk-link-btn" href={formsPath()}>‹ Lista formularzy</a>
      </div>
      <ul className="wk-fmap-legend" aria-label="Legenda">
        <li className="is-stands">strona z formularzem</li>
        <li className="is-extends">podformularz (uzupełnia przez link osoby)</li>
        <li className="is-link">link osoby otwiera</li>
        <li className="is-logic">zależy od formularza (mapa logiki strony)</li>
        <li className="is-role">rola uczestników</li>
      </ul>
      <div className="wk-dep-canvas wk-fmap-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          nodesConnectable={false}
          onNodeClick={(_e, node) => {
            const open = (node.data as MapNode).open;
            if (open?.form !== undefined) window.location.hash = formPath(open.form);
            else if (open?.page !== undefined) window.location.hash = viewPath('pages', ...pageSteps(open.page));
          }}
          fitView
          minZoom={0.2}
        >
          <Background />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {model.nodes.length === 0 && <p className="wk-empty">Nie ma tu jeszcze formularzy.</p>}
      <p className="wk-hint">Kliknij formularz albo stronę, żeby ją otworzyć. Grupy zmieniasz na liście formularzy.</p>
    </div>
  );
}

export default FormMap;
