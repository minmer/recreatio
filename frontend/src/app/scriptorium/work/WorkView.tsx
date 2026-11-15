/**
 * DAS WERK EINES PROJEKTS (2026-11-15) — die Reiter, in denen ein Werk von oben nach unten entsteht:
 *
 * <code>
 *   #/workspace/scriptorium/&lt;id&gt;/&lt;projekt&gt;[/&lt;reiter&gt;[/&lt;knoten&gt;]]
 *   przebieg · struktura · tabela · pojecia · reguly · kontrola · szablony · druk · ustawienia · dane
 * </code>
 *
 * Struktura (der Baum mit Zweck, Rolle, Ziel) · Tabela (die Dimensionen) · Pojęcia (das Register der Vorkommen) ·
 * Reguły (das Regelbuch) · Kontrola (der Bericht je Weg) · Szablony (Vorlagen und Zyklen) · Druk (LaTeX) ·
 * Ustawienia (Ebenen, Dimensionen, Wege, Rollen, Wissen) · Dane (die alten Felder und die Gliederung).
 */

import type { ReactNode } from 'react';

import { useT } from '../../core/i18n';
import type { Me } from '../../core/me';
import { useRemembered } from '../../core/prefs';
import type { OpenLibrary } from '../../library/library';
import type { EntryData, LibEntry } from '../../library/libraryKinds';
import type { LibraryStore } from '../../library/libraryStore';
import { viewPath } from '../../routes';
import type { ScriptoriumLens } from '../lens';
import { countFindings } from './workChecks';
import { useWork, type Work } from './useWork';
import { ChecksPanel } from './ChecksPanel';
import { WorkConcepts } from './WorkConcepts';
import { WorkPrint } from './WorkPrint';
import { RulesPanel } from './RulesPanel';
import { WorkSettings } from './WorkSettings';
import { WorkTable } from './WorkTable';
import { TemplatesPanel } from './TemplatesPanel';
import { WorkTree } from './WorkTree';
import { CourseView } from './CourseView';

export const WORK_TABS = ['przebieg', 'struktura', 'tabela', 'pojecia', 'reguly', 'kontrola', 'szablony', 'druk', 'ustawienia', 'dane'] as const;
export type WorkTab = (typeof WORK_TABS)[number];

/** Was jeder Reiter des Werks bekommt. */
export interface WorkCtx {
  readonly me: Me;
  readonly store: LibraryStore;
  readonly library: OpenLibrary;
  /** Das Projekt, wie es im Formular steht. */
  readonly project: LibEntry;
  readonly work: Work;
  readonly lens: ScriptoriumLens | null;
  readonly readOnly: boolean;
  /** Der gewählte Weg — `*`: alle Fassungen. */
  readonly path: string;
  readonly setPath: (key: string) => void;
  /** Eine Adresse im Werk. */
  readonly href: (...trail: string[]) => string;
  /** Felder des Projekts ändern (gespeichert von selbst). */
  readonly setProject: (patch: EntryData) => void;
}

export const ALL_PATHS = '*';

export function WorkView({ me, store, library, project, lens, readOnly, setProject, trail, data }: {
  me: Me;
  store: LibraryStore;
  library: OpenLibrary;
  project: LibEntry;
  lens: ScriptoriumLens | null;
  readOnly: boolean;
  setProject: (patch: EntryData) => void;
  trail: readonly string[];
  /** Der Reiter „Dane": die Felder des Projekts und die Gliederung. */
  data: ReactNode;
}) {
  const t = useT();
  const work = useWork(store, project, lens);
  const tab: WorkTab = (WORK_TABS as readonly string[]).includes(trail[0] ?? '') ? trail[0] as WorkTab
    /* 2026-11-15 — der Gang des Werks zuerst: wie die Erklärung gebaut ist, was eingeführt und was gebraucht wird. */
    : 'przebieg';
  const [path, setPath] = useRemembered(`scriptorium.work.path.${project.id}`, ALL_PATHS);
  const shownPath = path === ALL_PATHS || work.paths.some((p) => p.key === path) ? path : ALL_PATHS;
  const href = (...rest: string[]) => viewPath('scriptorium', library.libraryId, project.id, ...rest);
  const ctx: WorkCtx = { me, store, library, project, work, lens, readOnly, path: shownPath, setPath, href, setProject };
  const counts = countFindings(work.reports.flatMap((r) => r.findings));

  return (
    <div className="work-view">
      <nav className="wk-tabs lib-tabs" aria-label={t('workUi.tabs.label')}>
        {WORK_TABS.map((one) => (
          <a key={one} className={one === tab ? 'wk-tab wk-tab-on' : 'wk-tab'} href={href(one)}>
            {t(`workUi.tabs.${one}`)}
            {one === 'kontrola' && counts.must + counts.should > 0 && <span className="lib-count">{counts.must + counts.should}</span>}
            {one === 'struktura' && <span className="lib-count">{work.model.nodes.size}</span>}
          </a>
        ))}
      </nav>
      <div className="wk-panel work-panel">
        {tab === 'przebieg' ? <CourseView ctx={ctx} />
          : tab === 'struktura' ? <WorkTree ctx={ctx} selected={trail[1] ?? null} />
          : tab === 'tabela' ? <WorkTable ctx={ctx} />
          : tab === 'pojecia' ? <WorkConcepts ctx={ctx} />
          : tab === 'reguly' ? <RulesPanel ctx={ctx} />
          : tab === 'kontrola' ? <ChecksPanel ctx={ctx} />
          : tab === 'szablony' ? <TemplatesPanel ctx={ctx} />
          : tab === 'druk' ? <WorkPrint ctx={ctx} />
          : tab === 'ustawienia' ? <WorkSettings ctx={ctx} />
          : data}
      </div>
    </div>
  );
}

/** Die Wahl des Weges — für die Reiter, die je Weg zeigen. `all`: auch „alle Fassungen". */
export function PathPick({ ctx, all = true }: { ctx: WorkCtx; all?: boolean }) {
  const t = useT();
  const paths = ctx.work.paths;
  if (paths.length <= 1 && !all) return null;
  const value = !all && ctx.path === ALL_PATHS ? paths[0]?.key ?? '' : ctx.path;
  return (
    <label className="wk-field work-path-pick">
      <span>{t('workUi.path.label')}</span>
      <select value={value} onChange={(e) => ctx.setPath(e.target.value)}>
        {all && <option value={ALL_PATHS}>{t('workUi.path.all')}</option>}
        {paths.map((p) => <option key={p.key} value={p.key}>{p.name === '' ? t('workUi.path.default') : p.name}</option>)}
      </select>
    </label>
  );
}

/** Der Weg, der gilt, wo ein Reiter einen braucht (bei „alle Fassungen": der erste). */
export const pathKeyOf = (ctx: WorkCtx): string => (ctx.path === ALL_PATHS ? ctx.work.paths[0]?.key ?? '' : ctx.path);
