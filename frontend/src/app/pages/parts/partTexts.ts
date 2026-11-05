/**
 * 2026-11-05 — TEXTE EINER BAUSTEIN-ART, ERST BEIM LESEN ÜBERSETZT (documentation/LOCALIZATION.md).
 *
 * Die Arten werden beim Laden des Moduls beschrieben (`definePart`), also bevor die Sprache geladen ist —
 * und die Bezeichnungen sollen der Sprache folgen, die gerade gilt. Deshalb tragen Felder, Optionen,
 * `strip`, Beispiel und Art ihre Texte als Getter aus `texts()`: `withTexts(basis, texts({ label: 'ns.key' }))`.
 * `defineTextPart` hält auch Name, Zweck und das flache JSON (`flatJson`) lebendig.
 */

import { appLang, langLoaded, texts, type Lang } from '../../core/i18n';
import { definePart, flatJson, type FieldDef, type PartJson, type PartModule } from '../part';

type Spec<C> = Parameters<typeof definePart<C>>[0];

export { texts };

/** Ein Objekt mit Texten aus `texts()` — die Getter bleiben Getter, übersetzt wird erst beim Lesen. */
export function withTexts<O extends object, K extends string>(base: O, labels: Readonly<Partial<Record<K, string>>>): O & Readonly<Record<K, string>> {
  return Object.defineProperties({ ...base }, Object.getOwnPropertyDescriptors(labels)) as O & Readonly<Record<K, string>>;
}

/** Ein Feld, dessen Bezeichnung (und Hinweis, „leer heisst") erst beim Lesen übersetzt wird. */
export function field(
  base: Omit<FieldDef, 'label' | 'hint' | 'none'>,
  labels: Readonly<Record<'label', string>> & Partial<Readonly<Record<'hint' | 'none', string>>>
): FieldDef {
  return withTexts(base, labels) as FieldDef;
}

/** Eine Möglichkeit einer Auswahl (`hide`) mit übersetztem Satz. */
export const option = (value: string, labels: Readonly<Record<'label', string>>): { readonly value: string; readonly label: string } =>
  withTexts({ value }, labels);

/**
 * `definePart` mit Name und Zweck (und `retired`) aus `texts()`. Ohne eigenes `json` wird das flache JSON
 * je Sprache neu gebaut — seine Beschreibung nennt die Bezeichnungen der Felder.
 */
export function defineTextPart<C>(
  spec: Omit<Spec<C>, 'label' | 'use' | 'retired'>,
  labels: Readonly<Record<'label' | 'use', string>> & Partial<Readonly<Record<'retired', string>>>
): PartModule {
  const mod = withTexts(definePart<C>({ ...spec, label: '', use: '' } as Spec<C>), labels) as PartModule;
  if (spec.json === undefined) {
    let at: { lang: Lang; json: PartJson } | null = null;
    Object.defineProperty(mod, 'json', {
      enumerable: true,
      get: (): PartJson => {
        const lang = appLang();
        if (at !== null && at.lang === lang) return at.json;
        const json = flatJson(spec.fields, spec.extra ?? [], spec.example, spec.own ?? []);
        if (langLoaded(lang)) at = { lang, json };
        return json;
      }
    });
  }
  return mod;
}

/**
 * Eine Art, die je Sprache neu beschrieben wird — für Bauarten, deren Beschreiber die Texte beim Anlegen liest
 * (`defineEventPart`): `export const costsPart = lazyPart(() => defineEventPart({ label: t('…'), … }))`.
 * Gebaut wird erst beim ersten Lesen, danach wieder, wenn die Sprache wechselt (oder erst jetzt geladen ist).
 */
export function lazyPart<M extends object>(build: () => M): M {
  let at: { lang: Lang; mod: M } | null = null;
  const now = (): M => {
    const lang = appLang();
    if (at !== null && at.lang === lang) return at.mod;
    const mod = build();
    if (langLoaded(lang)) at = { lang, mod };
    return mod;
  };
  return new Proxy({} as M, {
    get: (_target, key) => Reflect.get(now(), key),
    has: (_target, key) => Reflect.has(now(), key),
    ownKeys: () => Reflect.ownKeys(now()),
    getOwnPropertyDescriptor: (_target, key) => {
      const one = Reflect.getOwnPropertyDescriptor(now(), key);
      return one === undefined ? undefined : { ...one, configurable: true };
    }
  });
}

/** Dasselbe mit Name und Zweck vorn — `textPart(texts({ label, use }), { kind, … })`. */
export const textPart = <C>(
  labels: Readonly<Record<'label' | 'use', string>> & Partial<Readonly<Record<'retired', string>>>,
  spec: Omit<Spec<C>, 'label' | 'use' | 'retired'>
): PartModule => defineTextPart<C>(spec, labels);
