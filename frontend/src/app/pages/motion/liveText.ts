/**
 * 2026-10-17 — DAS BILD ZUM ANFASSEN IN WORTEN: die Beschreibung neben dem
 * Import (`pageJsonText.ts`) und das Polecenie dla AI im Editor der Animacja.
 * Eigene Datei, damit die langen Sätze nur dort geladen werden, wo jemand
 * baut — nie auf einer öffentlichen Seite.
 */

import { t } from '../../core/i18n';
import { exprDescription } from './expr';
import { ACTION_LABEL, BUILTINS, CONTROL_TYPES, LIVE_LIMITS } from './liveModel';

/** Die Beschreibung des Bildes zum Anfassen — aus den Wörterbüchern, damit sie nicht hinter ihnen zurückbleibt. */
export function liveDescription(): string {
  return [
    t('pageMotion.live.intro'),
    '',
    t('pageMotion.live.keys'),
    t('pageMotion.live.vars', { n: LIVE_LIMITS.vars }),
    t('pageMotion.live.let'),
    t('pageMotion.live.sim'),
    t('pageMotion.live.events'),
    t('pageMotion.live.until'),
    t('pageMotion.live.rk4'),
    t('pageMotion.live.controls', { n: LIVE_LIMITS.controls, types: CONTROL_TYPES.map((c) => `"${c}"`).join(', ') }),
    t('pageMotion.live.slider'),
    t('pageMotion.live.toggle'),
    t('pageMotion.live.button', { actions: Object.keys(ACTION_LABEL).map((a) => `"${a}"`).join('|') }),
    t('pageMotion.live.rules', { n: LIVE_LIMITS.rules }),
    t('pageMotion.live.rules2'),
    t('pageMotion.live.goal'),
    t('pageMotion.live.show'),
    t('pageMotion.live.predict'),
    t('pageMotion.live.held'),
    t('pageMotion.live.task'),
    t('pageMotion.live.task2'),
    t('pageMotion.live.task3'),
    t('pageMotion.live.panel'),
    '',
    t('pageMotion.live.elements'),
    t('pageMotion.live.anyNumber'),
    t('pageMotion.live.text'),
    t('pageMotion.live.showStep'),
    t('pageMotion.live.drag'),
    t('pageMotion.live.tap'),
    t('pageMotion.live.repeat', { n: LIVE_LIMITS.repeat }),
    t('pageMotion.live.kinds'),
    t('pageMotion.live.plot', { n: LIVE_LIMITS.samples }),
    t('pageMotion.live.trace'),
    t('pageMotion.live.frame'),
    t('pageMotion.live.frame2'),
    '',
    t('pageMotion.live.world'),
    t('pageMotion.live.worldKinds', { n: LIVE_LIMITS.kinds }),
    t('pageMotion.live.props'),
    t('pageMotion.live.thingLet'),
    t('pageMotion.live.thingState'),
    t('pageMotion.live.shapes'),
    t('pageMotion.live.thingDrag'),
    t('pageMotion.live.can'),
    t('pageMotion.live.brief'),
    t('pageMotion.live.things'),
    t('pageMotion.live.allow'),
    t('pageMotion.live.keep'),
    t('pageMotion.live.panelGiven'),
    t('pageMotion.live.worldEl'),
    t('pageMotion.live.worldExpr'),
    t('pageMotion.live.worldUndo'),
    '',
    t('pageMotion.live.builtins', { list: BUILTINS.map((b) => `"${b}"`).join(', ') }),
    '',
    exprDescription(),
    '',
    t('pageMotion.live.light'),
    t('pageMotion.live.physics')
  ].join('\n');
}

/** Das Polecenie dla AI — kopiert neben den Import: der Kontext, die Regeln, das Format, ein Beispiel. */
export function livePrompt(example: unknown): string {
  return [
    t('pageMotion.prompt.intro'),
    t('pageMotion.prompt.topic'),
    t('pageMotion.prompt.rules'),
    t('pageMotion.prompt.return'),
    '',
    liveDescription(),
    '',
    t('pageMotion.prompt.example'),
    JSON.stringify(example, null, 2)
  ].join('\n');
}
