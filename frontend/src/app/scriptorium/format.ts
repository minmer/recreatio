/**
 * Was die Kästen des Skryptorium von ihm wissen müssen (2026-10-23): wohin
 * eine Art gehört (der Reiter) und wie es seine Einträge als JSON nimmt und
 * gibt — mit Nauka, soweit die Linse sie schon sieht.
 */

import type { EntryFormat } from '../library/LibraryEntryBoxes';
import type { LibraryStore } from '../library/libraryStore';
import { entryByNameIn, entryRefIn, kindRefIn, type ScriptoriumLens } from './lens';
import { exportScriptorium, planScriptoriumImport, scriptoriumDescription } from './scriptoriumJson';

/** Die Liste, zu der eine Art gehört (`#/workspace/scriptorium/<id>/<reiter>`). */
/* 2026-11-15 — Knoten, Regeln und Vorlagen stehen im Werk ihres Projekts (`work/`); ihre Liste ist die der Projekte. */
export const SCRIPTORIUM_TAB: Readonly<Record<string, string>> = { text: 'teksty', delivery: 'wyglaszenia', project: 'projekty', texttype: 'rodzaje', node: 'projekty', rule: 'reguly', unittemplate: 'szablony' };

export const scriptoriumFormat = (store: LibraryStore, name: string, lens: ScriptoriumLens | null): EntryFormat => ({
  plan: (doc) => planScriptoriumImport(doc, store, { kindRef: kindRefIn(lens), entryByName: entryByNameIn(lens), entryRef: entryRefIn(lens) }),
  exportDoc: (entries) => exportScriptorium(name, entries, store),
  describe: scriptoriumDescription
});
