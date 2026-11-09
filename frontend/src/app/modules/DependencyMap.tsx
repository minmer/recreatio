/**
 * MAPA ZALEŻNOŚCI (0072) — was woran hängt: Seiten, Bausteine, und woher die
 * Bausteine ihre Daten nehmen (Bereich, Kalender, Termin, Bibliothek,
 * Rozmowa, erweitertes Formular).
 *
 * <code>
 *   Strona  ──pokazuje──▶  Moduł  ──dane w──▶  Obszar
 *                             └──z kalendarza / biblioteki / rozmowy──▶  …
 *   Moduł (rozszerzenie) ──rozszerza──▶ Formularz
 *   Moduł (Lista osób) ──z formularza──▶ Formularz, ──otwiera──▶ Strona     (0082)
 *   Strona ──wybór: osoba z formularza──▶ Formularz                          (0082)
 * </code>
 *
 * <b>Bearbeiten durch Ziehen.</b> Eine Linie von einer Seite zu einem
 * Baustein stellt ihn auf die Seite; von einem Baustein zu einem Kalender,
 * einer Bibliothek oder einer Rozmowa setzt seine Quelle (wenn seine Art so
 * eine Quelle kennt). Eine Linie löschen (markieren, Entf) nimmt den
 * Baustein von der Seite oder die Quelle weg. Was sich nicht ändern lässt
 * (Bereich, Erweiterung), ist grau und fest.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background, Controls, Handle, MiniMap, Position,
  type Connection, type Edge, type Node, type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import { loadCalendars, type CalendarRow } from '../calendar/calendar';
import { linkAudienceForm } from '../areas/audience';
import { loadChats, type ChatRow } from '../chat/chat';
import { loadDesk, type Desk } from '../workspace/desk';
import { newId } from '../core/ids';
import { libraryKindOf, loadLibraries, type LibraryRow } from '../library/library';
import { loadModules, readConfig, updateModule, type ModuleRow } from './module';
import { loadPage, savePageSubject, saveParts, toDraft } from '../pages/page';
import { readSubject, subjectKindOf } from '../pages/pageSubject';
import { partOf } from '../pages/parts/registry';
import { pageSteps, viewPath, modulePath } from '../routes';
import { WorkspaceError } from '../core/session';
import { askText } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { useT, type T } from '../core/i18n';

type Kind = 'page' | 'module' | 'area' | 'calendar' | 'library' | 'chat';

interface Data {
  readonly label: string;
  readonly sub: string;
  readonly kind: Kind;
  readonly href?: string;
}

/* Das Wort je Art: `modules.dep.kind.<kind>`. */
const kindWord = (t: T, kind: Kind): string => t(`modules.dep.kind.${kind}`);

function Box({ data }: NodeProps<Data>) {
  const t = useT();
  return (
    <div className={`wk-dep-node is-${data.kind}`}>
      {/* 0082 — auch eine Seite ist Ziel: ein Baustein öffnet sie („Lista osób" → die Seite eines Menschen). */}
      <Handle type="target" position={Position.Left} />
      <span className="wk-dep-kind">{kindWord(t, data.kind)}</span>
      <strong>{data.label}</strong>
      {data.sub !== '' && <span className="wk-dep-sub">{data.sub}</span>}
      {(data.kind === 'page' || data.kind === 'module') && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

const NODE_TYPES = { box: Box };

/** Wovon ein Baustein etwas nimmt — 0082 auch ein Formular (seine Menschen) und eine Seite (die er öffnet). */
type Source = 'calendar' | 'library' | 'chat' | 'page' | 'form';

const SOURCES: readonly Source[] = ['calendar', 'library', 'chat', 'page', 'form'];

/** Welche Quelle eine Art kennt — und unter welchem Schlüssel ihrer Tafel. */
function sourceKey(kind: string, target: Source): { key: string; many: boolean } | null {
  const def = partOf(kind);
  if (def === undefined) return null;
  const want: readonly string[] = target === 'calendar' ? ['calendar', 'calendars'] : [target];
  const field = def.fields.find((f) => want.includes(f.kind));
  return field === undefined ? null : { key: field.key, many: field.kind === 'calendars' };
}

const idsIn = (value: string | undefined) => (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** Wie eine Rozmowa auf der Karte heisst — der Kanał neben der Rozmowa desselben Bereichs. */
const chatLabel = (t: T, c: ChatRow | undefined) => c === undefined ? t('modules.dep.kind.chat') : c.kind === 'channel' ? t('notify.chat.channel', { name: c.areaName }) : c.areaName;

/** 0080 — woran ein Formular hängen kann: die Rozmowa und der Kanał eines Bereichs (`audience.ts`). */
const takesForms = (c: ChatRow | undefined) => c !== undefined && (c.kind === 'area' || c.kind === 'channel');

interface World {
  readonly desk: Desk;
  readonly modules: readonly ModuleRow[];
  readonly calendars: readonly CalendarRow[];
  readonly libraries: readonly LibraryRow[];
  readonly chats: readonly ChatRow[];
}

export function DependencyMap() {
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [onlyUsed, setOnlyUsed] = useState(false);
  const t = useT();

  const look = useCallback(async () => {
    try {
      const [desk, modules, calendars, libraries, chats] = await Promise.all([
        loadDesk(), loadModules(), loadCalendars().catch(() => ({ calendars: [] as readonly CalendarRow[] })),
        loadLibraries().catch(() => ({ libraries: [] as readonly LibraryRow[] })), loadChats().catch(() => ({ chats: [] as readonly ChatRow[] }))
      ]);
      setWorld({ desk, modules: modules.modules, calendars: calendars.calendars, libraries: libraries.libraries, chats: chats.chats });
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('modules.dep.loadFailed'));
    }
  }, [t]);
  useEffect(() => { void look(); }, [look]);

  const { nodes, edges } = useMemo(() => {
    if (world === null) return { nodes: [] as Node<Data>[], edges: [] as Edge[] };
    const out: Node<Data>[] = [];
    const lines: Edge[] = [];
    const pages = world.desk.pages.filter((p) => p.aliasOf === null);
    const modules = world.modules.filter((m) => !onlyUsed || m.usedOnPages > 0);

    pages.forEach((p, i) => out.push({
      id: `page:${p.path}`, type: 'box', position: { x: 0, y: i * 80 },
      data: { kind: 'page', label: p.path === '' ? 'recreatio.pl' : p.path, sub: p.host ?? '', href: viewPath('pages', ...pageSteps(p.path)) }
    }));

    modules.forEach((m, i) => {
      out.push({
        id: `module:${m.moduleId}`, type: 'box', position: { x: 340, y: i * 80 },
        data: { kind: 'module', label: m.name, sub: partOf(m.kind)?.label ?? m.kind, href: modulePath(m.kind, m.moduleId) }
      });
      for (const path of m.pages) {
        if (!pages.some((p) => p.path === path)) continue;
        lines.push({ id: `on:${path}:${m.moduleId}`, source: `page:${path}`, target: `module:${m.moduleId}`, label: t('modules.dep.edge.shows'), data: { rel: 'on' } });
      }
      if (m.extendsId !== null && modules.some((x) => x.moduleId === m.extendsId)) {
        lines.push({ id: `ext:${m.moduleId}`, source: `module:${m.moduleId}`, target: `module:${m.extendsId}`, label: t('modules.dep.edge.extends'), deletable: false, className: 'is-fixed', data: { rel: 'fixed' } });
      }
    });

    /* Die Quellen: Bereiche, Kalender, Bibliotheken, Rozmowy — nur die, auf die etwas zeigt, und alle meine. */
    let row = 0;
    const place = (id: string, data: Data) => {
      if (out.some((n) => n.id === id)) return;
      out.push({ id, type: 'box', position: { x: 700, y: (row++) * 72 }, data });
    };

    for (const m of modules) {
      if (m.areaId !== null) {
        place(`area:${m.areaId}`, { kind: 'area', label: m.areaName ?? t('modules.dep.kind.area'), sub: '', href: viewPath('areas', m.areaId) });
        lines.push({ id: `data:${m.moduleId}`, source: `module:${m.moduleId}`, target: `area:${m.areaId}`, label: t('modules.dep.edge.dataIn'), deletable: false, className: 'is-fixed', data: { rel: 'fixed' } });
      }
      const config = readConfig(m.config);
      for (const target of SOURCES) {
        const field = sourceKey(m.kind, target);
        if (field === null) continue;
        for (const id of idsIn(config[field.key])) {
          /* 0082 — eine Seite und ein Formular stehen schon auf der Karte; fehlen sie (nicht meine), keine Linie ins Leere. */
          if (target === 'page' || target === 'form') {
            const node = target === 'page' ? `page:${id.replace(/^#?\/*/, '')}` : `module:${id}`;
            if (!out.some((n) => n.id === node)) continue;
            lines.push({ id: `src:${m.moduleId}:${target}:${id}`, source: `module:${m.moduleId}`, target: node,
              label: target === 'page' ? t('modules.dep.edge.opens') : t('modules.dep.edge.fromForm'), data: { rel: 'source', key: field.key, many: field.many, id } });
            continue;
          }
          const label = target === 'calendar' ? world.calendars.find((c) => c.calendarId === id)?.title ?? t('modules.dep.kind.calendar')
            : target === 'chat' ? chatLabel(t, world.chats.find((c) => c.chatId === id))
            : t('modules.dep.kind.library');
          place(`${target}:${id}`, { kind: target, label, sub: target === 'library' ? id.slice(0, 8) : '' });
          lines.push({ id: `src:${m.moduleId}:${target}:${id}`, source: `module:${m.moduleId}`, target: `${target}:${id}`, label: t('modules.dep.edge.from'), data: { rel: 'source', key: field.key, many: field.many, id } });
        }
      }
    }
    /* 0082 — „Wybór na stronie": die Seite handelt von einem Menschen aus diesem Formular. */
    for (const p of pages) {
      const decl = readSubject(p.subject ?? null);
      const kind = decl === null ? undefined : subjectKindOf(decl.kind);
      if (decl === null || kind === undefined) continue;
      for (const id of kind.uses(decl)) {
        if (!modules.some((m) => m.moduleId === id)) continue;
        lines.push({ id: `subj:${p.path}:${id}`, source: `page:${p.path}`, target: `module:${id}`,
          label: t('modules.dep.edge.subject', { kind: kind.label.toLowerCase() }), className: 'is-subject', data: { rel: 'subject', path: p.path } });
      }
    }

    /* 0081 — ein Formular an „Napisz do nas": wer es ausgefüllt hat, darf dort anfangen. */
    for (const m of modules) {
      for (const formId of m.formIds ?? []) {
        if (!modules.some((x) => x.moduleId === formId)) continue;
        lines.push({ id: `ask:${formId}:${m.moduleId}`, source: `module:${formId}`, target: `module:${m.moduleId}`,
          label: t('modules.dep.edge.writeTo'), data: { rel: 'ask', subject: m.moduleId, moduleId: formId } });
      }
    }

    /* 0080 — ein Formular an einer Rozmowa: wer es ausgefüllt hat, liest (Kanał) oder schreibt mit. */
    for (const c of world.chats) {
      for (const moduleId of c.formIds ?? []) {
        if (!modules.some((m) => m.moduleId === moduleId)) continue;
        place(`chat:${c.chatId}`, { kind: 'chat', label: chatLabel(t, c), sub: '', href: viewPath('chat', c.chatId) });
        lines.push({ id: `aud:${moduleId}:${c.chatId}`, source: `module:${moduleId}`, target: `chat:${c.chatId}`,
          label: c.kind === 'channel' ? t('modules.dep.edge.read') : t('modules.dep.edge.write'), data: { rel: 'audience', chatId: c.chatId, moduleId } });
      }
    }
    for (const c of world.calendars.filter((x) => x.archived !== true)) place(`calendar:${c.calendarId}`, { kind: 'calendar', label: c.title, sub: c.areaName });
    /* 2026-10-23 — drei Teile: Bibliothek, Skryptorium, Baza wiedzy. */
    for (const l of world.libraries) place(`library:${l.libraryId}`, { kind: 'library', label: t(`aiAccess.part.${libraryKindOf(l) === 'writing' ? 'writing' : libraryKindOf(l) === 'knowledge' ? 'knowledge' : 'books'}`), sub: l.libraryId.slice(0, 8) });

    return { nodes: out, edges: lines };
  }, [world, onlyUsed, t]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);
    try { await todo(); await look(); } catch (e) { setFailed(e instanceof WorkspaceError ? e.message : t('common.failed')); } finally { setBusy(null); }
  };

  const moduleOf = (nodeId: string) => world?.modules.find((m) => `module:${m.moduleId}` === nodeId);

  /* Eine neue Linie: Seite → Baustein (auf die Seite), Baustein → Quelle (als Quelle). */
  const onConnect = async (c: Connection) => {
    if (world === null || c.source === null || c.target === null) return;
    if (c.source.startsWith('page:') && c.target.startsWith('module:')) {
      const path = c.source.slice(5);
      const m = moduleOf(c.target);
      if (m === undefined) return;
      if (!(await askText(t('modules.dep.askAdd', { name: m.name, path })))) return;
      void act(t('modules.dep.adding'), async () => {
        const page = await loadPage(path);
        const parts = page.parts.map(toDraft);
        await saveParts(path, [...parts, { id: newId(), moduleId: m.moduleId, kind: m.kind, layout: {}, config: readConfig(m.config) }]);
      });
      return;
    }
    if (c.source.startsWith('module:')) {
      const m = moduleOf(c.source);
      const [target, id] = c.target.split(':') as [Kind, string];
      if (m === undefined || id === undefined) return;

      /* 0081 — ein Formular zu „Napisz do nas": wer es ausgefüllt hat, darf dort anfangen. */
      const target2 = target === 'module' ? world.modules.find((x) => x.moduleId === id) : undefined;
      if (m.kind === 'form' && target2?.kind === 'seat-ask') {
        if (!(await askText(t('modules.dep.askLinkAsk', { name: m.name, target: target2.name })))) return;
        void act(t('modules.dep.linking'), () => linkAudienceForm('module', id, m.moduleId, true));
        return;
      }

      /* 0080 — ein Formular zu einer Rozmowa: wer es ausgefüllt hat, ist dabei. */
      const chat = target === 'chat' ? world.chats.find((x) => x.chatId === id) : undefined;
      if (m.kind === 'form' && takesForms(chat)) {
        if (!(await askText(t(chat?.kind === 'channel' ? 'modules.dep.askLinkChannel' : 'modules.dep.askLinkChat', { name: m.name, chat: chatLabel(t, chat) })))) return;
        void act(t('modules.dep.linking'), () => linkAudienceForm('chat', id, m.moduleId, true));
        return;
      }
      /* 0082 — ein Baustein zu einem Formular (seine Menschen) oder zu einer Seite (die er öffnet). */
      const source: Source | null = target === 'module' ? (target2?.kind === 'form' ? 'form' : null) : target === 'area' ? null : target;
      const field = source === null ? null : sourceKey(m.kind, source);
      if (field === null) {
        setFailed(t('modules.dep.noSource', { kind: partOf(m.kind)?.label ?? m.kind, source: source === 'form' ? t('modules.dep.form') : kindWord(t, target) }));
        return;
      }
      const config = readConfig(m.config);
      const next = field.many ? [...new Set([...idsIn(config[field.key]), id])].join(',') : id;
      void act(t('modules.dep.settingSource'), () => updateModule(m.moduleId, { config: JSON.stringify({ ...config, [field.key]: next }) }));
    }
  };

  const onEdgesDelete = async (gone: readonly Edge[]) => {
    for (const edge of gone) {
      const rel = (edge.data as { rel?: string } | undefined)?.rel;
      if (rel === 'on') {
        const path = edge.source.slice(5);
        const m = moduleOf(edge.target);
        if (m === undefined || !(await askText(t('modules.dep.askRemove', { name: m.name, path })))) { void look(); continue; }
        void act(t('modules.dep.removing'), async () => {
          const page = await loadPage(path);
          await saveParts(path, page.parts.map(toDraft).filter((p) => p.moduleId !== m.moduleId));
        });
      } else if (rel === 'ask') {
        const info = edge.data as { subject: string; moduleId: string };
        const m = moduleOf(edge.source);
        if (!(await askText(t('modules.dep.askUnlinkAsk', { name: m?.name ?? t('modules.dep.form') })))) { void look(); continue; }
        void act(t('modules.dep.unlinking'), () => linkAudienceForm('module', info.subject, info.moduleId, false));
      } else if (rel === 'audience') {
        const info = edge.data as { chatId: string; moduleId: string };
        const m = moduleOf(edge.source);
        if (!(await askText(t('modules.dep.askUnlinkChat', { name: m?.name ?? t('modules.dep.form') })))) { void look(); continue; }
        void act(t('modules.dep.unlinking'), () => linkAudienceForm('chat', info.chatId, info.moduleId, false));
      } else if (rel === 'subject') {
        const info = edge.data as { path: string };
        if (!(await askText(t('modules.dep.askRemoveSubject', { path: info.path })))) { void look(); continue; }
        void act(t('modules.dep.removingSubject'), () => savePageSubject(info.path, null));
      } else if (rel === 'source') {
        const m = moduleOf(edge.source);
        const info = edge.data as { key: string; many: boolean; id: string };
        if (m === undefined) continue;
        const config = readConfig(m.config);
        const next = info.many ? idsIn(config[info.key]).filter((x) => x !== info.id).join(',') : '';
        void act(t('modules.dep.removingSource'), () => updateModule(m.moduleId, { config: JSON.stringify({ ...config, [info.key]: next }) }));
      } else {
        void look();
      }
    }
  };

  if (world === null) return failed !== null ? <p className="wk-error">{failed}</p> : <Loading label={t('modules.dep.loading')} />;

  return (
    <div className="wk-dep">
      <p className="wk-lede">{t('modules.dep.lede')}</p>
      <label className="wk-check"><input type="checkbox" checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} /> <span>{t('modules.dep.onlyUsed')}</span></label>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-working">{busy}</p>}
      <div className="wk-dep-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDoubleClick={(_, node) => { const href = (node.data as Data).href; if (href !== undefined) window.location.hash = href; }}
          fitView
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default DependencyMap;
