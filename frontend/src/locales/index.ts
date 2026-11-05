/**
 * 2026-11-05 — DER LADER DER SPRACHEN. Jede Sprache ist ein eigenes Bündel (`bundle-<sprache>.ts`), das erst
 * geholt wird, wenn jemand sie braucht. Wer diese Datei importiert, meldet den Lader an (`setLangLoader`);
 * `startI18n()` lädt dann die Sprache der Anwendung.
 */
import { setLangLoader, type Dictionary, type Lang } from '../app/core/i18n';

const BUNDLES: Record<Lang, () => Promise<{ default: Record<string, Dictionary> }>> = {
  en: () => import('./bundle-en'),
  de: () => import('./bundle-de'),
  pl: () => import('./bundle-pl')
};

setLangLoader(async (lang) => (await BUNDLES[lang]()).default);
