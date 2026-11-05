/**
 * BAUSTEIN „WIDOK" (2026-10-22, Schritt 9) — ein gespeicherter Widok einer
 * Baza wiedzy auf einer Seite: dieselbe Auswahl wie in „Wpisy" (Schritte aus
 * `cogita/selection.ts`, die auch eine Powtórka benutzt), als Tabela oder
 * Drzewo mit Gruppen, mit einer Suche; ein Klick klappt den Eintrag unter dem
 * Widok auf (oder wählt ihn oben, wenn die Seite einen Wpis wählt).
 *
 * <b>Sein Zustand steht in der Adresse unter seinem eigenen Zakres</b>
 * (`partQuery.ts`): `?<zakres>.q=` die Suche, `.e=` der offene Eintrag, `.u=`
 * Tabela/Drzewo, `.s=` die Reihenfolge. Zwei Widoki auf einer Seite stören
 * einander nicht.
 *
 * <b>Wer ihn sieht:</b> wer die Baza lesen darf (`cogita/pageBase.ts`) — eine
 * öffentliche, geöffnete jeder, sonst Mitglieder, Links, Plätze.
 *
 * <b>Je Grösse:</b> im Streifen eine Zeile mit „Zobacz"; als Block die ersten
 * Einträge; hoch und im Vollbild das Ganze.
 */

import { t } from '../../core/i18n';
import { flag, text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { defineTextPart, field, texts, withTexts } from './partTexts';

export interface ViewConfig {
  readonly title: string;
  readonly library: string;
  readonly view: string;
  /** `tabela` / `drzewo` / `macierz` / `mapa` / 2026-11-01 `postepy` (Mapa postępów; auch englisch: `quilt`) / 2026-11-03 `krajobraz` — leer: wie gespeichert. */
  readonly mode: string;
  /** 2026-11-03 — wohin die Antworten aus dem Krajobraz gehen (wie in „Powtórka"; leer: wie die Baza). */
  readonly answers: string;
  /** 2026-11-03 — Punkte und Serie beim Lernen aus dem Krajobraz (leer: wie ein Baustein „Punkty i seria" der Seite, sonst keine). */
  readonly rewards: string;
  /**
   * 2026-11-05 (Prompt 17, §5) — darf der Leser die Gestalt wechseln und im Widok suchen? Vorgabe NEIN: ein eingebetteter
   * Widok zeigt, was der Besitzer wählte (ohne Reiter, ohne Suche); die eigenen Knöpfe eines Krajobraz bleiben.
   */
  readonly switching: boolean;
}

const ViewView = later(() => import('./viewViews').then((m) => m.ViewView));

export const viewPart = defineTextPart<ViewConfig>({
  kind: 'view',
  example: withTexts({ mode: 'macierz', switch: 'nie' }, texts({ title: 'moduleDataLearn.viewPart.exTitle', library: 'moduleDataCogita.ex.base', view: 'moduleDataLearn.viewPart.exView', answers: 'moduleDataCogita.ex.area', rewards: 'moduleDataCogita.ex.rewardsOrEmpty' })),
  box: { colSpan: 6, rowSpan: 4 },
  fields: [
    field({ key: 'title', kind: 'line' }, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataLearn.viewPart.titleHint' })),
    field({ key: 'library', kind: 'knowledge' }, texts({ label: 'moduleDataCogita.f.fromBase' })),
    field({ key: 'view', kind: 'libraryEntry', of: 'library', entryKinds: ['view'] }, texts({ label: 'moduleDataLearn.viewPart.which' })),
    field({ key: 'mode', kind: 'line' }, texts({ label: 'moduleDataLearn.viewPart.mode', hint: 'moduleDataLearn.viewPart.modeHint' })),
    /* 2026-11-03 — wie in „Powtórka": wohin die Antworten gehen, und Punkte beim Lernen (Krajobraz, Mapa postępów). */
    field({ key: 'answers', kind: 'area' }, texts({ label: 'moduleDataCogita.f.answers', hint: 'moduleDataCogita.f.answersHint' })),
    field({ key: 'rewards', kind: 'libraryEntry', of: 'library', entryKinds: ['reward'], optional: true }, texts({ label: 'moduleDataCogita.f.rewardsInRun', none: 'moduleDataCogita.f.rewardsInRunNone' })),
    field({ key: 'switch', kind: 'line' }, texts({ label: 'moduleDataLearn.viewPart.switch', hint: 'moduleDataLearn.viewPart.switchHint' }))
  ],
  read: (raw: RawConfig): ViewConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), view: text(raw, 'view'), mode: text(raw, 'mode'), answers: text(raw, 'answers'), rewards: text(raw, 'rewards'), switching: flag(raw, 'switch', false) }),
  hasContent: (c) => c.library !== '' && c.view !== '',
  missing: (c) => (c.library === '' ? t('moduleDataCogita.m.pickBase') : c.view === '' ? t('moduleDataLearn.viewPart.missingView') : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataLearn.viewPart.showsStrip')
    : size.height === 'tall' ? t('moduleDataLearn.viewPart.showsTall')
    : t('moduleDataLearn.viewPart.showsBlock'),
  View: ViewView
}, texts({ label: 'moduleDataLearn.view', use: 'moduleDataLearn.viewPart.use' }));
