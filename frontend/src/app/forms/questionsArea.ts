/**
 * 0133 — DIE FRAGEN EINES FORMULARS UNTER DEM SCHLÜSSEL EINES ANDEREN BEREICHS
 * (`Form.QuestionsArea.cs`).
 *
 * Die Antworten gehen in den Bereich des Formulars — dort liegen seine Annahme
 * und sein Administrator danych. Die FRAGEN müssen dort lesbar sein, wo das
 * Formular gezeigt wird: für ein öffentliches Formular einer Gruppe mit eigenen
 * Schlüsseln (die Rocket Challenge) unter dem Schlüssel des jawnen Bereichs, in
 * dem sie veröffentlicht ist („Wydarzenia"). Das ist der Normalfall eines
 * Wydarzenie — und bleibt änderbar.
 *
 * Alles wird hier geöffnet und neu versiegelt und dann in EINEM Schritt
 * abgelegt: nie liegt eine Frage unter dem alten und eine unter dem neuen
 * Schlüssel. Verlegen darf, wer beide Bereiche führt (der Dienst prüft es).
 */

import { aad, Field, fromBase64Url, openText } from '../core/crypto';
import type { Ring } from '../core/keys';
import { call, WorkspaceError } from '../core/session';
import { areaKeys, newestKey } from '../chat/chat';
import { loadModules } from '../modules/module';
import { labelAad, loadFields, optionsAad, sealQuestion, type SealedField } from './form';
import { openDesign, sealDesign } from './formDesign';

/* Dieselbe AAD wie `form.ts` (dort nicht ausgeführt). */
const helpAad = (fieldId: string) => aad('form', 'field', fieldId, Field.EventFieldHelp, 1);

/** Der offengelegte Schlüssel einer Epoche — wenn der Bund ihn nicht hält. */
async function publishedKey(areaId: string, epoch: number): Promise<Uint8Array | null> {
  try {
    const found = await call<{ key: string }>(`/area/${encodeURIComponent(areaId)}/key?epoch=${epoch}`);
    return fromBase64Url(found.key);
  } catch {
    return null;
  }
}

/** Der Schlüssel, unter dem etwas versiegelt wurde: erst der eigene, dann der offengelegte. */
async function keyAt(ring: Ring, areaId: string, epoch: number): Promise<Uint8Array | null> {
  const held = (await areaKeys(ring, areaId).catch(() => new Map<number, Uint8Array>())).get(epoch);
  return held ?? publishedKey(areaId, epoch);
}

async function openQuestion(ring: Ring, f: SealedField): Promise<{ label: string; help: string | null; options: string[] }> {
  const key = await keyAt(ring, f.labelAreaId ?? f.areaId, f.labelEpoch ?? f.epoch);
  if (key === null) throw new WorkspaceError('Nie każde pytanie da się teraz odczytać — brakuje klucza obszaru, pod którym leży.');
  try {
    const label = await openText(key, labelAad(f.fieldId), fromBase64Url(f.labelSealed));
    const help = f.helpSealed === null ? null : await openText(key, helpAad(f.fieldId), fromBase64Url(f.helpSealed));
    const options = f.optionsSealed === null ? []
      : (await openText(key, optionsAad(f.fieldId), fromBase64Url(f.optionsSealed))).split('\n').filter((o) => o !== '');
    return { label, help, options };
  } catch {
    throw new WorkspaceError('Nie każde pytanie da się teraz odczytać — bez tego nie da się ich przepieczętować.');
  }
}

/**
 * Alle Fragen (auch die genommenen) und den Aufbau eines Formulars neu versiegeln — unter
 * dem neuesten Schlüssel von `toAreaId` (`null`: zurück unter den eigenen Bereich) — und in
 * einem Schritt ablegen.
 */
export async function moveQuestions(ring: Ring, moduleId: string, toAreaId: string | null): Promise<{ fields: number }> {
  const row = (await loadModules()).modules.find((m) => m.moduleId === moduleId);
  const own = row?.areaId ?? null;
  if (own === null) throw new WorkspaceError('Formularz nie ma jeszcze własnego obszaru.');
  const target = toAreaId ?? own;

  const newest = newestKey(await areaKeys(ring, target, true));
  if (newest === null) throw new WorkspaceError('Nie masz klucza obszaru, w którym mają być widoczne pytania.');

  const { fields, design } = await loadFields(moduleId);

  const sealed: { fieldId: string; labelSealed: string; helpSealed: string | null; optionsSealed: string | null; epoch: number }[] = [];
  for (const f of fields) {
    const open = await openQuestion(ring, f);
    sealed.push({ fieldId: f.fieldId, ...(await sealQuestion(newest.key, f.fieldId, open)), epoch: newest.epoch });
  }

  let designOut: { epoch: number; sealed: string } | null = null;
  if (design !== null) {
    const doc = await openDesign(design, (await keyAt(ring, design.areaId, design.epoch)) ?? undefined, moduleId);
    if (doc === null) throw new WorkspaceError('Układu formularza nie da się teraz odczytać — bez tego nie da się go przepieczętować.');
    designOut = { epoch: newest.epoch, sealed: await sealDesign(doc, newest.key, moduleId) };
  }

  const done = await call<{ fields: number }>(`/workspace/form/${encodeURIComponent(moduleId)}/questions-area`, {
    method: 'POST',
    body: JSON.stringify({ areaId: target === own ? '' : target, fields: sealed, design: designOut })
  });
  return { fields: done.fields };
}
