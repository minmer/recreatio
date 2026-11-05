/**
 * CZEKA NA CIEBIE (0094) — die Liste der Dinge, die sich melden können, und
 * in welcher Reihenfolge sie dastehen.
 *
 * <b>Jeder ordnet selbst.</b> Für die Kanzlei sind neue Zgłoszenia das Erste,
 * für einen Katecheten die Rozmowy, für den Hausverwalter die Reservierungen.
 * Die Arten stehen in einer Liste; jede lässt sich ein- und ausschalten und
 * nach oben oder unten schieben (`moveAlert`, `toggleAlert`). Gemerkt wird
 * das für das Konto (versiegelt, `prefs.ts`) — die Glocke und der Teil
 * „Czeka na Ciebie" auf der Seite des Warsztat folgen derselben Ordnung.
 *
 * <b>Woher die Zahlen kommen</b>: aus der einen Frage der Glocke
 * (`/workspace/notifications`, `notify.ts`) — Zgłoszenia, Rozmowy, Links,
 * Aufgaben, und seit 0094 Reservierungen, die auf ein Ja warten, und Schritte
 * der Kanzlei nach ihrer Frist. Die Termine von heute kommen aus dem eigenen
 * Kalender (der Teil lädt sie, die Glocke nicht).
 *
 * <b>Ein Widok obszaru</b> zeigt nur, was zu seinen Bereichen gehört
 * (`scope`); was keinem Bereich gehört (Links, die Summe der Aufgaben), steht
 * nur im Widok ohne Bereich.
 */

import type { Digest } from '../notify/notify';
import { chatLabel } from '../notify/notify';
import { useRemembered } from '../core/prefs';
import { appLang, fmtDate, localeOf, t } from '../core/i18n';
import { formNewsPath, pageSteps, viewPath, formsPath } from '../routes';

export type AlertKind = 'forms' | 'chats' | 'bookings' | 'steps' | 'tasks' | 'today' | 'links' | 'learn' | 'duties' | 'records' | 'plans';

export interface AlertKindDef {
  readonly kind: AlertKind;
  readonly label: string;
  readonly says: string;
  /** Zählt sie in der Zahl an der Glocke? (Termine von heute sind nichts Neues.) */
  readonly counts: boolean;
}

/** Bezeichnung und Erklärung werden erst beim Lesen übersetzt (Sprache der Anwendung). */
const kindDef = (kind: AlertKind, counts: boolean): AlertKindDef => ({
  kind, counts,
  get label() { return t(`workspace.alert.${kind}.label`); },
  get says() { return t(`workspace.alert.${kind}.says`); }
});

export const ALERT_KINDS: readonly AlertKindDef[] = [
  kindDef('forms', true),
  kindDef('chats', true),
  kindDef('bookings', true),
  kindDef('steps', true),
  kindDef('tasks', false),
  kindDef('today', false),
  /* 0109 — was in den eigenen Bibliotheken wieder dran ist: wie „dziś", etwas für jeden Tag. */
  kindDef('learn', false),
  kindDef('links', true),
  /* 0129–0131 — was entschieden werden muss: Administrator danych, gemeldete Inhalte, Bitten um einen Platz in einer Liste. */
  kindDef('duties', true),
  /* 0132 — was von aussen an einen Termin kam (eine Anmeldung) und auf die Kanzlei wartet; Pläne, deren Termine bald enden. */
  kindDef('records', true),
  kindDef('plans', false)
];

const KNOWN = new Set<string>(ALERT_KINDS.map((one) => one.kind));

export interface AlertSettings {
  /** Alle Arten, in der gewünschten Reihenfolge. */
  readonly order: readonly AlertKind[];
  /** Was ausgeschaltet ist. */
  readonly off: readonly AlertKind[];
}

export const DEFAULT_ALERTS: AlertSettings = { order: ALERT_KINDS.map((one) => one.kind), off: [] };

/**
 * Duldsam gelesen: Unbekanntes fällt weg, Doppeltes zählt einmal, und eine
 * Art, die es damals noch nicht gab, kommt an ihrer Stelle der Vorgabe dazu
 * (hinter die, die vor ihr steht).
 */
export function readAlerts(text: string | null | undefined): AlertSettings {
  let raw: { order?: unknown; off?: unknown } = {};
  try { raw = JSON.parse(text ?? '') as typeof raw; } catch { return DEFAULT_ALERTS; }
  const list = (value: unknown): AlertKind[] => (Array.isArray(value) ? value : [])
    .filter((one): one is AlertKind => typeof one === 'string' && KNOWN.has(one))
    .filter((one, i, all) => all.indexOf(one) === i);

  const order = list(raw.order);
  for (const [i, kind] of DEFAULT_ALERTS.order.entries()) {
    if (order.includes(kind)) continue;
    const before = DEFAULT_ALERTS.order.slice(0, i).reverse().find((one) => order.includes(one));
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, kind);
  }
  return { order, off: list(raw.off) };
}

export const alertsJson = (settings: AlertSettings): string => JSON.stringify({ order: settings.order, off: settings.off });

/** Eine Art eine Stelle nach oben (-1) oder unten (+1). Am Rand bleibt sie, wo sie ist. */
export function moveAlert(settings: AlertSettings, kind: AlertKind, by: -1 | 1): AlertSettings {
  const order = [...settings.order];
  const at = order.indexOf(kind);
  const to = at + by;
  if (at < 0 || to < 0 || to >= order.length) return settings;
  [order[at], order[to]] = [order[to], order[at]];
  return { ...settings, order };
}

export const toggleAlert = (settings: AlertSettings, kind: AlertKind, on: boolean): AlertSettings => ({
  ...settings,
  off: on ? settings.off.filter((one) => one !== kind) : [...new Set([...settings.off, kind])]
});

/** Die eingeschalteten Arten, in ihrer Reihenfolge. */
export const shownKinds = (settings: AlertSettings): AlertKind[] => settings.order.filter((one) => !settings.off.includes(one));

/* -- Die Einträge ----------------------------------------------------------------------------------- */

export interface AlertItem {
  readonly kind: AlertKind;
  readonly key: string;
  readonly label: string;
  /** Wie viel — oder `null` (ein Termin). */
  readonly count: number | null;
  /** Wie die Zahl heisst: „3 nowe", „2 wiadomości", „18:00". */
  readonly detail: string;
  readonly href: string;
  /** Lässt sich als gesehen abhaken (✓): ein Formular, die Links. */
  readonly seen?: { readonly form: string } | { readonly links: true };
}

/** Ein Termin von heute, schon geöffnet (der Titel). */
export interface TodayItem {
  readonly key: string;
  readonly title: string;
  readonly at: string;
  readonly areaId: string;
  readonly href: string;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString(localeOf(appLang()), { hour: '2-digit', minute: '2-digit' });

/**
 * WAS JETZT DASTEHT — in der Reihenfolge der Einstellung, je Art das Dringendste
 * zuerst. `scope`: nur, was zu diesen Bereichen gehört (`null`: alles).
 */
export function alertItems(
  digest: Digest | null, today: readonly TodayItem[] | null, settings: AlertSettings, scope: ReadonlySet<string> | null
): AlertItem[] {
  const inScope = (areaId: string | null | undefined) => scope === null || (areaId != null && scope.has(areaId));
  const out: AlertItem[] = [];

  for (const kind of shownKinds(settings)) {
    if (kind === 'forms') {
      for (const f of digest?.registrations.list ?? []) {
        if (!inScope(f.areaId)) continue;
        out.push({ kind, key: `f${f.moduleId}`, label: f.name, count: f.count, detail: t('workspace.alertItem.newCount', { count: f.count }), href: formNewsPath(f.moduleId), seen: { form: f.moduleId } });
      }
    } else if (kind === 'chats') {
      for (const c of (digest?.chats.list ?? []).filter((one) => one.unread > 0)) {
        if (!inScope(c.areaId)) continue;
        out.push({ kind, key: `c${c.chatId}`, label: c.quiet ? t('workspace.alertItem.muted', { name: chatLabel(c) }) : chatLabel(c), count: c.unread, detail: t('workspace.alertItem.messages', { count: c.unread }), href: viewPath('chat', c.chatId) });
      }
    } else if (kind === 'bookings') {
      for (const b of digest?.bookings?.list ?? []) {
        if (!inScope(b.areaId)) continue;
        out.push({ kind, key: `b${b.resourceId ?? b.name}`, label: b.name, count: b.count, detail: t('workspace.alertItem.toConfirm', { count: b.count }), href: b.resourceId === undefined ? viewPath('bookings') : viewPath('bookings', b.resourceId) });
      }
    } else if (kind === 'steps') {
      for (const s of digest?.steps?.list ?? []) {
        if (!inScope(s.areaId)) continue;
        out.push({ kind, key: `s${s.moduleId ?? s.name}`, label: s.name, count: s.count, detail: t('workspace.alertItem.stepsLate', { count: s.count }), href: s.moduleId === undefined ? formsPath() : formNewsPath(s.moduleId) });
      }
    } else if (kind === 'records') {
      for (const r of digest?.records?.list ?? []) {
        if (!inScope(r.areaId)) continue;
        out.push({ kind, key: `r${r.calendarId}`, label: r.title, count: r.count, detail: t('workspace.alertItem.recordsWait', { count: r.count }), href: viewPath('calendar') });
      }
    } else if (kind === 'plans') {
      for (const p of digest?.plans?.list ?? []) {
        if (!inScope(p.areaId)) continue;
        out.push({
          kind, key: `p${p.calendarId}`, label: p.title, count: null,
          detail: t('workspace.alertItem.plannedUntil', { date: fmtDate(new Date(p.until), { day: 'numeric', month: 'long' }) }),
          href: viewPath('calendar', 'zaplanuj', p.calendarId)
        });
      }
    } else if (kind === 'tasks') {
      if (scope === null && (digest?.tasks ?? 0) > 0) {
        out.push({ kind, key: 'tasks', label: t('workspace.alertItem.tasksNow'), count: digest!.tasks, detail: t('workspace.alertItem.tasks', { count: digest!.tasks }), href: viewPath('tasks') });
      }
    } else if (kind === 'today') {
      for (const one of today ?? []) {
        if (!inScope(one.areaId)) continue;
        out.push({ kind, key: `t${one.key}`, label: one.title, count: null, detail: time(one.at), href: one.href });
      }
    } else if (kind === 'links') {
      if (scope === null && (digest?.links ?? 0) > 0) {
        out.push({ kind, key: 'links', label: t('workspace.alertItem.joinedByLink'), count: digest!.links, detail: `${digest!.links}`, href: viewPath('areas'), seen: { links: true } });
      }
    } else if (kind === 'learn') {
      const learn = digest?.learn;
      if (scope === null && learn !== undefined && learn.count > 0) {
        out.push({ kind, key: 'learn', label: t('workspace.alert.learn.label'), count: learn.count, detail: t('workspace.alertItem.cards', { count: learn.count }), href: viewPath('learn') });
      }
    } else if (kind === 'duties') {
      out.push(...dutyItems(digest, inScope, scope === null));
    }
  }
  return out;
}

/**
 * 0129–0131 — SPRAWY: was den Administrator danych betrifft, führt in die
 * Ustawienia des Bereichs (dort wird unterschrieben); Meldungen, eigene gesperrte
 * Inhalte und Bitten um einen Platz in einer Liste nach „Sprawy".
 */
function dutyItems(digest: Digest | null, inScope: (areaId: string | null | undefined) => boolean, everything: boolean): AlertItem[] {
  const d = digest?.duties;
  if (d === undefined) return [];
  const out: AlertItem[] = [];
  const settings = (areaId: string) => viewPath('areas', areaId, 'ustawienia');
  const kind = 'duties' as const;

  for (const a of d.controllers.asks) {
    if (!inScope(a.homeAreaId)) continue;
    out.push({ kind, key: `da${a.attachmentId}`, label: t('workspace.duty.asksController', { area: a.areaName ?? t('workspace.duty.area'), name: a.controllerName }), count: null, detail: t('workspace.duty.toSign'), href: settings(a.homeAreaId) });
  }
  for (const o of d.controllers.offers) {
    if (!inScope(o.areaId)) continue;
    out.push({ kind, key: `do${o.attachmentId}`, label: t('workspace.duty.offer', { name: o.controllerName, area: o.areaName ?? t('workspace.duty.areaOf') }), count: null, detail: t('workspace.duty.toAccept'), href: settings(o.areaId) });
  }
  for (const x of d.controllers.decided) {
    if (!inScope(x.areaId)) continue;
    out.push({ kind, key: `dd${x.attachmentId}`, label: t('workspace.duty.decided', { name: x.controllerName, area: x.areaName ?? t('workspace.duty.areaOf') }), count: null, detail: x.state === 'live' ? t('workspace.duty.accepted') : t('workspace.duty.refused'), href: settings(x.areaId) });
  }
  for (const n of d.controllers.nobody) {
    if (!inScope(n.areaId)) continue;
    out.push({ kind, key: `dn${n.areaId}`, label: t('workspace.duty.nobody', { area: n.areaName }), count: null, detail: t('workspace.duty.pickController'), href: settings(n.areaId) });
  }
  for (const m of d.controllers.missing) {
    if (!inScope(m.homeAreaId)) continue;
    const what = !m.terms ? t('workspace.duty.acceptTerms') : !m.confirmed ? t('workspace.duty.confirmRight') : t('workspace.duty.completeData');
    out.push({ kind, key: `dm${m.controllerId}`, label: m.name, count: null, detail: what, href: settings(m.homeAreaId) });
  }

  if (!everything) return out;

  for (const p of d.controllers.pages ?? []) {
    out.push({ kind, key: `dp${p.path}`, label: t('workspace.duty.pageNobody', { page: p.path === '' ? 'recreatio.pl' : p.path }), count: null, detail: t('workspace.duty.pickArea'), href: viewPath('pages', ...pageSteps(p.path)) });
  }
  if (d.reports.isOperator && d.reports.count > 0) {
    out.push({ kind, key: 'dr', label: t('workspace.duty.reports'), count: d.reports.count, detail: t('workspace.duty.toDecide', { count: d.reports.count }), href: viewPath('sprawy') });
  }
  for (const one of d.takedowns.filter((x) => x.state === 'blocked')) {
    out.push({
      kind, key: `dt${one.id}`, label: t('workspace.duty.blocked', { what: one.path ?? t('workspace.duty.yourContent') }), count: null,
      detail: one.objectedAt === null ? t('workspace.duty.objectUntil', { date: new Date(one.objectUntil).toLocaleDateString(localeOf(appLang())) }) : t('workspace.duty.objectSent'), href: viewPath('sprawy')
    });
  }
  for (const l of d.listings) {
    out.push({ kind, key: `dl${l.areaId}${l.moduleId}`, label: l.path === null ? t('workspace.duty.listing', { name: l.name }) : t('workspace.duty.listingAt', { name: l.name, path: l.path }), count: null, detail: l.catalogue ? t('workspace.duty.catalogue') : t('workspace.duty.list'), href: viewPath('sprawy') });
  }
  return out;
}

/** Die Zahl an der Glocke: was neu ist, nur eingeschaltete Arten. */
export function alertCount(digest: Digest | null, settings: AlertSettings): number {
  if (digest === null) return 0;
  const on = new Set(shownKinds(settings));
  const counted = (kind: AlertKind) => on.has(kind) && ALERT_KINDS.find((one) => one.kind === kind)!.counts;
  return (counted('chats') ? digest.chats.unread : 0)
    + (counted('forms') ? digest.registrations.count : 0)
    + (counted('links') ? digest.links : 0)
    + (counted('bookings') ? digest.bookings?.count ?? 0 : 0)
    + (counted('steps') ? digest.steps?.count ?? 0 : 0)
    + (counted('duties') ? digest.duties?.count ?? 0 : 0)
    + (counted('records') ? digest.records?.count ?? 0 : 0);
}

export const alertLabel = (kind: AlertKind): string => ALERT_KINDS.find((one) => one.kind === kind)?.label ?? kind;

/** Unter diesem Namen merkt das Konto die Liste (`prefs.ts`) — 2026-10-29 eine Stelle auch für den JSON-Import (`viewJson.ts`). */
export const ALERTS_PREF = 'alerts';

/** Die Einstellung dieses Kontos — und wie man sie ändert (gemerkt versiegelt, `prefs.ts`). */
export function useAlertSettings(): [AlertSettings, (next: AlertSettings) => void] {
  const [text, setText] = useRemembered(ALERTS_PREF, '');
  return [readAlerts(text), (next) => setText(alertsJson(next))];
}
