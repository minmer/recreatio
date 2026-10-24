/**
 * 2026-10-24 — DIE WYMAGANIA EINES FORMULARS IM JSON ("needs").
 *
 * <b>Im Dokument steht, WAS gewollt ist, nicht wie es gebaut ist.</b> Ein
 * Wymaganie ist sein Name und seine Einstellungen —
 * `{ "id": "minor", "age": "ask", "ways": ["parent", "consent"] }`, oder nur
 * `"health"`. Der Import legt die Fragen, Gruppen und die Logik selbst an
 * (`importNeeds` in `formTemplates.ts`), stellt ein eingeschaltetes um und
 * lässt eines, das schon so ist, wie es ist.
 *
 * <b>Was es im Formular hält, geht als `holds` mit</b> (Schlüssel des Wzór →
 * Kennung): wer ein Formular exportiert und anderswo importiert, bekommt die
 * mitgebrachten Fragen und Gruppen übernommen, statt sie doppelt. Die
 * Einstellung `needs` der Tafel (die Sperren) steht dagegen NICHT im JSON —
 * sie gehört dem Formular und folgt aus diesem Schlüssel.
 */

import { choiceOf, choiceWords, needOf, NEEDS, sameChoice, type NeedChoice, type NeedId } from './needs';
import { choiceOfOn, keysOfOn, type NeedOn } from './needPlan';

/** Ein Wymaganie, wie ein Dokument es will. */
export interface NeedWish {
  readonly id: NeedId;
  readonly choice: NeedChoice;
  /** Was es im Formular des Dokuments hielt — Schlüssel → Kennung im Dokument. */
  readonly holds?: Readonly<Record<string, string>>;
}

/** Ein eingeschaltetes Wymaganie im JSON: Name, Einstellungen, was es hält. */
export function needOut(on: NeedOn): Record<string, unknown> {
  const need = needOf(on.id);
  const choice = choiceOfOn(on);
  const settings: Record<string, unknown> = {};
  for (const s of need?.settings ?? []) {
    const values = choice[s.key] ?? [];
    settings[s.key] = s.many ? [...values] : values[0];
  }
  const holds = keysOfOn(on);
  return { id: on.id, ...settings, ...(Object.keys(holds).length === 0 ? {} : { holds }) };
}

export const needsOut = (needs: readonly NeedOn[]): Record<string, unknown>[] =>
  needs.filter((on) => needOf(on.id) !== undefined).map(needOut);

/** Was ein Eintrag ausser seinen Einstellungen tragen darf. */
const OWN_KEYS = ['id', 'holds'];

/**
 * "needs" eines Dokuments, duldsam gelesen. `undefined`: das Dokument sagt
 * nichts darüber (dann bleibt alles, wie es ist); `null` oder `[]`: keines.
 */
export function readNeedWishes(value: unknown, warnings: string[]): NeedWish[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) {
    warnings.push('"needs" to nie lista — wymagania zostają bez zmian.');
    return undefined;
  }
  const out: NeedWish[] = [];
  value.forEach((entry, index) => {
    const said = typeof entry === 'string' ? { id: entry } : typeof entry === 'object' && entry !== null && !Array.isArray(entry) ? entry as Record<string, unknown> : null;
    if (said === null) { warnings.push(`"needs" ${index + 1}: to nie wymaganie — pominięte.`); return; }
    const id = typeof said.id === 'string' ? said.id.trim() : '';
    const need = needOf(id);
    if (need === undefined) {
      warnings.push(`"needs" ${index + 1}: nie ma wymagania „${id}” — możliwe: ${NEEDS.map((n) => `"${n.id}"`).join(', ')}.`);
      return;
    }
    if (out.some((w) => w.id === need.id)) { warnings.push(`"needs": „${need.label}” drugi raz — pominięte.`); return; }
    for (const key of Object.keys(said)) {
      if (!OWN_KEYS.includes(key) && !need.settings.some((s) => s.key === key)) warnings.push(`„${need.label}”: nieznany klucz "${key}" — pominięty.`);
    }
    let holds: Record<string, string> | undefined;
    if (said.holds !== undefined) {
      if (typeof said.holds === 'object' && said.holds !== null && !Array.isArray(said.holds)) {
        holds = {};
        for (const [key, one] of Object.entries(said.holds as Record<string, unknown>)) if (typeof one === 'string' && one.trim() !== '') holds[key] = one.trim();
      } else {
        warnings.push(`„${need.label}”: "holds" to nie obiekt — pominięte.`);
      }
    }
    out.push({ id: need.id, choice: choiceOf(need, said, 'start', warnings), ...(holds === undefined || Object.keys(holds).length === 0 ? {} : { holds }) });
  });
  return out;
}

/** Was ein Import mit diesen Wymagania täte — in Worten, für die Vorschau. */
export function needWishLines(wishes: readonly NeedWish[], current: readonly NeedOn[], replace: boolean): string[] {
  const lines: string[] = [];
  for (const wish of wishes) {
    const need = needOf(wish.id)!;
    const on = current.find((one) => one.id === wish.id);
    const how = need.settings.length === 0 ? '' : ` — ${choiceWords(need, wish.choice)}`;
    if (on === undefined) lines.push(`Wymaganie „${need.label}”: zostanie włączone${how}${wish.holds === undefined ? '' : ' (z pytaniami z dokumentu)'}.`);
    else if (!sameChoice(need, choiceOfOn(on), wish.choice)) lines.push(`Wymaganie „${need.label}”: nowe ustawienia${how}.`);
  }
  for (const on of current.filter((one) => !wishes.some((w) => w.id === one.id))) {
    lines.push(replace
      ? `Wymaganie „${on.label}” zostanie wyłączone (nie ma go w dokumencie).`
      : `Wymaganie „${on.label}” zostaje włączone — nie ma go w dokumencie, ale wyłącza je dopiero „Usuń pytania i wymagania, których nie ma w dokumencie”.`);
  }
  return lines;
}

/* -- Die Beschreibung ------------------------------------------------------------------- */

const quoted = (values: readonly string[]): string => values.map((v) => `"${v}"`).join(', ');

/** Was jeder Schlüssel bedeutet — aus den Wymagania selbst erzeugt: ein neues Wymaganie, eine neue Einstellung steht sofort darin. */
export function needsKeys(): Record<string, string> {
  const keys: Record<string, string> = {
    needs: 'Wymagania formularza — lista. Każde włączone wymaganie dodaje swoje pytania, grupy i logikę; dopóki jest włączone, jego pytań nie da się usunąć (przesuwać i przeredagować — tak). Pominięte: wymagania zostają, jak są; [] — żadnego (wyłącza je dopiero „Usuń pytania i wymagania, których nie ma w dokumencie”)',
    'needs[].id': `Które: ${NEEDS.map((n) => `"${n.id}" (${n.label})`).join(', ')}. Wymaganie bez ustawień można podać samym identyfikatorem, np. "health"`
  };
  for (const need of NEEDS) {
    for (const s of need.settings) {
      keys[`needs[].${s.key}`] = `Tylko "${need.id}" — ${s.label.toLocaleLowerCase('pl')}: `
        + s.choices.map((c) => `"${c.value}" (${c.label.toLocaleLowerCase('pl')} — ${c.says})`).join('; ')
        + (s.many ? `. Lista, co najmniej jedna wartość; gdy jest tylko jedna, uczestnik nie wybiera — ona obowiązuje` : '. Jedna wartość')
        + `. Pominięte: ${s.many ? `[${quoted(s.start)}]` : quoted(s.start)}`;
    }
  }
  keys['needs[].holds'] = 'Z eksportu: co w tym formularzu należy do wymagania (klucz → identyfikator pytania, grupy, tekstu, węzła albo połączenia logiki). Zostaw bez zmian; dzięki temu import do innego formularza przejmie pytania z dokumentu zamiast dodawać je drugi raz. Pisząc od nowa — pomiń: import sam doda pytania, grupy i logikę';
  return keys;
}

/** Ein ausgefülltes Beispiel — dieselben Schlüssel wie oben. */
export const NEEDS_EXAMPLE = {
  needs: [{ id: 'minor', age: 'birth', ways: ['parent', 'adult', 'consent'] }, 'health', { id: 'rules' }]
} as const;
