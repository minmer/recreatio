/**
 * 2026-10-24 — DAS FORMULAR IM BAUM DER JSON-FORMATE (`core/jsonTree.ts`):
 * was ein Formular-Modul im Dokument trägt — Fragen, Aufbau und Logik,
 * Wymagania, Rollen, Obszary osób, Gruppe, Wiederholung. EIN Knoten: die Seite
 * (jeder Eintrag "form") und das Modul ("recreatio/module") tragen ihn, und
 * beide Importe tun damit dasselbe (`modules/moduleImport.ts`).
 */

import { keyLines, pretty, type JsonNode, type JsonSample } from '../core/jsonTree';
import { QUESTION_EXAMPLE, QUESTION_KEYS } from './formJson';
import { choiceOf, NEEDS } from './needs';
import { NEEDS_EXAMPLE, needsKeys } from './needsJson';
import { MODULE_FORMAT } from '../pages/pageJson';
import { t } from '../core/i18n';

const F = 'formsFormat.';

/** Was ausser Fragen und Aufbau nur ein Formular trägt — ein Satz je Schlüssel. */
const formModuleLines = (): string => ['needs', 'extends', 'group', 'repeat', 'memberRoles', 'virtualAreas']
  .map((k) => `  ${t(`${F}module.${k}`)}`).join('\n');

/**
 * EIN GANZES FORMULAR mit allen Möglichkeiten für Minderjährige — zum
 * Einsetzen in den Import eines Moduls oder einer Seite (dort kommt es als
 * neues Modul dazu). Die Fragen der Wymagania stehen NICHT darin: der Import
 * legt sie an.
 */
export const minorFormSample = (age: 'birth' | 'ask'): Record<string, unknown> => ({
  format: MODULE_FORMAT,
  version: 1,
  kind: 'form',
  name: t(`${F}sample.name`),
  config: { title: t(`${F}sample.name`), sentTitle: t(`${F}sample.sentTitle`) },
  questions: [
    { id: 'q1', kind: 'email', label: t(`${F}sample.email`), help: null, options: [], required: true, halfWidth: true, identity: 'email', selfEdit: true },
    { id: 'q2', kind: 'phone', label: t(`${F}sample.phone`), help: null, options: [], required: false, halfWidth: true, identity: 'phone', selfEdit: true }
  ],
  needs: [{ id: 'minor', age, ways: ['parent', 'adult', 'consent'] }, 'health', 'rules']
});

const samples = (): readonly JsonSample[] => [
  { label: t(`${F}sample.birth`), doc: () => minorFormSample('birth') },
  { label: t(`${F}sample.ask`), doc: () => minorFormSample('ask') }
];

/** Die Wymagania im Dokument — erzeugt aus den Wymagania selbst (`needs.ts`). */
export const NEEDS_FORMAT: JsonNode = {
  key: 'form.needs',
  get title() { return t(`${F}needs.title`); },
  text: () => [
    t(`${F}needs.intro`),
    t(`${F}needs.importDoes`),
    t(`${F}needs.import1`),
    t(`${F}needs.import2`),
    t(`${F}needs.import3`),
    t(`${F}needs.import4`),
    keyLines(needsKeys()),
    t(`${F}needs.list`),
    NEEDS.map((n) => `  "${n.id}" — ${n.label}: ${n.use(choiceOf(n, undefined))}`).join('\n'),
    t(`${F}needs.minors`),
    t(`${F}example`),
    pretty(NEEDS_EXAMPLE),
    t(`${F}needs.wholeExample`),
    pretty(minorFormSample('birth'))
  ].join('\n'),
  samples: samples
};

/*
   2026-10-30 — WAS DIE APP MIT EINEM FORMULAR TUT, sobald es importiert ist: wo man es ausfüllt
   (`FormCard.tsx`, `Widget.tsx`, `Form.Submit.cs`), wer geradesteht (`Form.cs` → `Controllers`, `clause.ts`,
   `SignSheet.tsx`), wer die Antworten öffnet (`Form.Office.cs`, `intake.ts`, `entrySubject.tsx`), die Glocke
   (`Notify.cs`, `Push.cs`), der eigene Link (`Seat*.cs`, `parts/seat.tsx`), Rollen und Obszary osób
   (`Form.Members.cs`, `Form.Virtual.cs`, `useFormOffice.tsx`), Kroki (`steps/steps.ts`), die Karte der Seite
   (`pageLogic.ts`), Rozmowy (`Audience.cs`, `Chat.Ask.cs`) — und was der Import nicht anfasst (`moduleWish.ts`).
*/
const FORM_USAGE: JsonNode = { key: 'form.usage', get title() { return t(`${F}usage.title`); }, text: () => t(`${F}usage.text`) };

/** Das Formular im Dokument — Fragen, Aufbau, und was nur ein Formular trägt. */
export const FORM_FORMAT: JsonNode = {
  key: 'form',
  get title() { return t(`${F}form.title`); },
  text: () => `${t(`${F}form.intro`)}
${keyLines(QUESTION_KEYS)}
${formModuleLines()}
${t(`${F}example`)}
${pretty(QUESTION_EXAMPLE)}`,
  inside: () => [FORM_USAGE, NEEDS_FORMAT]
};
