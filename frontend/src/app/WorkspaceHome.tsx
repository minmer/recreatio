/**
 * TERAZ — die Seite des Arbeitsplatzes, und der Überblick eines Bereichs
 * (2026-10-16).
 *
 * <b>Eine Seite, kein Baukasten.</b> Seit 0094 war sie ein „Widok": Teile, die
 * man hinzufügen, verschieben, umbenennen, je Teil anders zeigen und als JSON
 * hinaus- und hereintragen konnte. Jede dieser Wahlmöglichkeiten stand auf der
 * Seite selbst, vor dem, was sie zeigen sollte. Jetzt zeigt sie, was man am
 * Morgen wissen will — was auf einen wartet, was heute ist, wer geschrieben hat —
 * und jeder Teil führt mit einem Klick dorthin, wo man es erledigt.
 *
 * <b>Wer keine Seite führt</b> (0106: ein Animator, ein Kandydat mit Konto),
 * sieht zuerst die Seiten, auf denen er arbeitet.
 *
 * <b>Der Überblick eines Bereichs</b> (`AreaOverview`) ist der erste Reiter
 * eines Bereichs: dieselben Teile, nur für ihn und die Bereiche darin.
 */

import type { ReactNode } from 'react';

import type { AreaRow } from './area';
import { leadsNoPage, type Desk } from './desk';
import { viewPath, VIEWS } from './routes';
import type { Who } from './session';
import { NewMenu } from './Starters';
import { Icon } from './ui/icons';
import { PageHeader } from './ui/PageHeader';
import { PART_VIEWS } from './ViewParts';
import { areasNow, useLoaded } from './viewData';
import { AREA_PARTS, areaViewId, MINE, partDef, withInside, type PartKind, type ViewConfig } from './workspaceViews';
import { loadDue } from './cogita/learn';

/* -- Ein Kasten ------------------------------------------------------------------------- */

function Box({ title, more, wide = false, children }: {
  title: string;
  /** Wohin „alles" führt: „Kalendarz ›". */
  more?: { readonly label: string; readonly href: string };
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={wide ? 'wk-box is-wide' : 'wk-box'} aria-label={title}>
      <header className="wk-box-head">
        <h2 className="wk-box-title">{title}</h2>
        {more !== undefined && (
          <a className="wk-box-more" href={more.href}>{more.label}<Icon name="next" /></a>
        )}
      </header>
      <div className="wk-box-body">{children}</div>
    </section>
  );
}

/** Ein Teil (`ViewParts.tsx`) in einem Kasten — mit dem einen Weg, sich zu zeigen, der hier passt. */
function Part({ kind, mode, view, scope, who, desk, more, wide }: {
  kind: PartKind;
  mode: string;
  view: ViewConfig;
  scope: ReadonlySet<string> | null;
  who: Who;
  desk: Desk;
  more?: { readonly label: string; readonly href: string };
  wide?: boolean;
}) {
  const Body = PART_VIEWS[kind];
  return (
    <Box title={partDef(kind).label} more={more} wide={wide}>
      <Body mode={mode} scope={scope} view={view} who={who} desk={desk} />
    </Box>
  );
}

/* -- Teraz ---------------------------------------------------------------------------- */

const MINE_VIEW: ViewConfig = { id: MINE, name: 'Teraz', kind: 'mine', areaIds: [], parts: [] };

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 || h >= 18 ? 'Dobry wieczór' : 'Dzień dobry';
}

export function WorkspaceHome({ who, desk }: { who: Who; desk: Desk }) {
  const taker = leadsNoPage(desk);
  const now = new Date();
  /* Nauka nur, wo es etwas zu lernen gibt — ein leerer Kasten wäre Rauschen. */
  const learning = useLoaded(() => loadDue().then((r) => r.due.length > 0), []);
  const p = { view: MINE_VIEW, scope: null, who, desk } as const;

  return (
    <div className="wk-teraz">
      <PageHeader
        title={greeting(now)}
        meta={now.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={taker ? undefined : <NewMenu who={who} />}
      />

      {taker && <Part kind="mypages" mode="cards" {...p} wide />}

      <div className="wk-teraz-grid">
        <div className="wk-teraz-col">
          <Part kind="alerts" mode="list" {...p} more={{ label: 'Ustaw', href: viewPath('account', 'widok') }} />
          <Part kind="chats" mode="unread" {...p} more={{ label: VIEWS.chat, href: viewPath('chat') }} />
          {learning === true && <Part kind="learn" mode="due" {...p} more={{ label: VIEWS.learn, href: viewPath('learn') }} />}
        </div>
        <div className="wk-teraz-col">
          <Part kind="agenda" mode="today" {...p} more={{ label: VIEWS.calendar, href: viewPath('calendar') }} />
          <Part kind="tasks" mode="now" {...p} more={{ label: 'Wszystkie', href: viewPath('tasks') }} />
          {!taker && <Part kind="pages" mode="list" {...p} more={{ label: VIEWS.pages, href: viewPath('pages') }} />}
        </div>
      </div>
    </div>
  );
}

/* -- Der Überblick eines Bereichs ----------------------------------------------------- */

export function AreaOverview({ who, desk, area }: { who: Who; desk: Desk; area: AreaRow }) {
  const areas = useLoaded(() => areasNow(), []);
  const view: ViewConfig = { id: areaViewId(area.areaId), name: area.name, kind: 'area', areaIds: [area.areaId], parts: AREA_PARTS };
  const scope: ReadonlySet<string> = new Set(withInside(areas ?? [], [area.areaId]));
  const p = { view, scope, who, desk } as const;
  const tab = (t: string) => viewPath('areas', area.areaId, t);

  return (
    <div className="wk-teraz-grid">
      <div className="wk-teraz-col">
        <Part kind="alerts" mode="list" {...p} />
        <Part kind="chats" mode="all" {...p} more={{ label: VIEWS.chat, href: viewPath('chat') }} />
        <Part kind="forms" mode="list" {...p} more={{ label: VIEWS.forms, href: viewPath('forms') }} />
      </div>
      <div className="wk-teraz-col">
        <Part kind="agenda" mode="week" {...p} more={{ label: VIEWS.calendar, href: viewPath('calendar') }} />
        <Part kind="people" mode="list" {...p} more={{ label: 'Osoby', href: tab('osoby') }} />
        <Part kind="pages" mode="list" {...p} />
        <Part kind="access" mode="links" {...p} more={{ label: 'Dostęp', href: tab('dostep') }} />
      </div>
    </div>
  );
}

export default WorkspaceHome;
