# Localization

REcreatio speaks three languages: **English (the default)**, **German** and **Polish**. Every text the app shows
lives in one folder, [frontend/src/locales/](../frontend/src/locales/); translating the app means translating the
files of that folder. Nothing a person reads is written in the code.

These rules hold for every part of the app, old and new. `npm run app:i18n` (part of `npm run app:check`) enforces
them.

## Where the texts are

```
frontend/src/locales/
  en/  <file>.json     English — the original; every key exists here first
  de/  <file>.json     German  — same files, same keys
  pl/  <file>.json     Polish  — same files, same keys
  index.ts             loader: one bundle per language, fetched when needed
  bundle-<lang>.ts     collects the JSON files of one language
```

- **One file per part of the app** (a domain folder of `src/app/`, or a big sub-part of it): `calendar.json`,
  `chat.json`, `cogitaStory.json` … File names are camelCase words. The file name is the first part of every key:
  `t('calendar.dayHead.today')` reads `dayHead.today` from `<lang>/calendar.json`.
- `common.json` holds the words every part needs (Save, Cancel, Delete, Loading…, Today …). Use them before adding
  your own; don't put part-specific text into it.
- `i18n.json` holds the language settings themselves.
- Inside a file, group keys by screen or component (`"dayHead": { "today": … }`). Keys are short English camelCase
  names of what the text *is*, not the text itself (`saveFailed`, not `couldNotSaveTheEntry`).

### Values

| Kind | JSON | Call |
|---|---|---|
| Plain text | `"title": "Calendar"` | `t('calendar.title')` |
| With values | `"hello": "Hello, {name}"` | `t('calendar.hello', { name })` |
| Plural | `"cards": { "one": "{count} card", "other": "{count} cards" }` | `t('cogita.cards', { count: n })` |
| Marked parts | `"note": "Press <b>Save</b> to keep it"` | `rich(t('x.note'), { b: (s) => <strong>{s}</strong> })` |

- **Plurals** use the forms of `Intl.PluralRules`: `en` and `de` need `one` + `other`; `pl` needs `one`, `few`,
  `many` and `other` (`other` is the fraction form: „1,5 dnia"). The count goes in as `count`.
- Placeholders `{name}` and tags `<b>…</b>` must be the same in all three languages (the check compares them).
- Whole sentences, never glued fragments: `"{count} left"` — not `t('left')` after a number. Word order differs
  between the languages.
- Texts in Polish keep the platform's Polish names where they are names (Cogita, Scriptorium); in English and
  German, translate descriptive names (Kalendarz → Calendar / Kalender).

## In the code

```tsx
import { useT, t, tIn, rich, fmtDate } from '../core/i18n';

function DayHead({ day }: { day: Date }) {
  const t = useT();                       // follows the nearest language scope
  return <h2>{t('calendar.dayHead.title', { date: fmtDate(day, { weekday: 'long', day: 'numeric' }, t.lang) })}</h2>;
}

export const saveError = () => t('calendar.saveFailed');   // outside components: language of the app
```

- **In components: `const t = useT()`** — it follows a page's, a part's or a section's own language. Name it `t`
  (the check finds keys by `t('…')`).
- **Outside components: `t(key)`** (the app's language) or **`tIn(lang, key)`** (a given language). Helpers that
  build text for a scoped part take a `t: T` or `lang: Lang` parameter.
- **Never call `t()` at module top level** (`const LABELS = { a: t('x.a') }`): it would run once, before a scope
  or a changed language. Keep keys in constants and translate when drawing: `const LABELS = { a: 'x.a' }` …
  `t(LABELS.a)`, or make it a function. A table that other modules import and read as text keeps its shape with
  `texts()`: `export const VIEWS = texts({ calendar: 'workspace.view.calendar' })` — each property is translated
  when it is read.
- **Don't change exported signatures** just to pass a language through; a helper that returns text uses `t()`
  inside, or takes an optional `lang` / `t` as its last parameter.
- **Keys from data** (`t(\`calendar.kind.${kind}\`)`) are fine; the check then requires the group `calendar.kind`
  to exist. Use `tOr(key, fallback)` when the value may be unknown.
- **Dates and numbers**: `fmtDate(d, opts, t.lang)`, `fmtNumber(n, opts, t.lang)`, or `toLocaleString(t.locale)`.
  Never a hard-coded `'pl-PL'`. Weekday and month names come from `Intl`, not from lists in the code.
- **Error messages shown to people** (`WorkspaceError`, `toast`, `setFailed`) are texts like any other.
- **Not translated** (stays in the code): JSON field names and enum values of formats, address words in routes
  (`#/workspace/account/jezyk`), CSS classes, ids, data content written by people, and language-specific logic
  (Polish plural rules, PESEL, address norms). Mark a line that looks like text but is data with
  `// i18n-ignore`; a whole data file with `/* i18n-ignore-file */` at the top.
- **Content belongs to its author.** A page, a knowledge base, a form, a calendar entry is written in whatever
  language its author writes; the app does not translate it. Only the app's own words around it change.

## Choosing the language

Three levels, the most specific wins:

1. **The app** — chosen per device on *Account → Language* (`#/workspace/account/jezyk`); without a choice, the
   browser's language when it is one of the three, otherwise English. Stored as `recreatio.lang`; changing it
   reloads the page.
2. **A part of the app** — on the same page, each section (Calendar, Learning, Library …, `SECTIONS` in
   `core/i18n.tsx`) may have its own language (`recreatio.lang.sections`). The workspace wraps every view in
   `<LangScope section=…>`; a new view gets an entry in `SECTION_OF` (`workspace/Workspace.tsx`), a new section
   an id in `SECTIONS` and a name in `i18n.section.*`.
3. **A page and a module of a page** — the page's author sets `"lang"` on the page and, if needed, on single
   modules (page editor, page JSON). Visitors see that language whatever their own is. A knowledge base speaks
   its `language` setting on the learning screens.

Any subtree can get its own language with `<LangScope lang={…}>`; the language is loaded on demand and the
subtree gets `lang="…"` for screen readers and hyphenation.

## Adding a new part

1. Create `en/<part>.json`, `de/<part>.json`, `pl/<part>.json` with the same keys. English first; German and
   Polish complete — the check fails on a missing key in any language.
2. Write every visible text through `t(…)`: headings, buttons, labels, placeholders, `title`/`aria-label`,
   empty states, confirmations, toasts, error messages, units, export/print sheets, notifications.
3. Run `npm run app:i18n`. It fails when a key is missing, a placeholder differs, a plural lacks a form, a key
   named in code does not exist — or when a file has more hard-coded text than before.
4. A new file must have **no** hard-coded text. Old files have a per-file allowance in
   `scripts/i18n-baseline.json`; it may only go down. After removing text from a file, lower it with
   `node scripts/app-i18n-check.mjs --update`. See what is left in a file with
   `node scripts/app-i18n-check.mjs --list <part of the path>`.

## Scripts and checks in Node

Check scripts and generators bundle app modules with esbuild; the dictionaries live on `globalThis`, so call
`await useLocale('pl')` from `scripts/i18n-node.mjs` before importing a bundle (every script that bundles app code
already does — checks compare Polish texts). The preview (`preview.html`) takes `?lang=en|de|pl`.

## Translating

Translators edit only `frontend/src/locales/<lang>/*.json`. Keep the keys, the `{placeholders}` and the
`<tags>`; translate the rest. Adding a fourth language: a folder `xx/` with all files, `bundle-xx.ts`, an entry in
`locales/index.ts`, and `'xx'` in `Lang`, `LANGS`, `LANG_NAME`, `localeOf` (`core/i18n.tsx`) and `FORMS`
(`scripts/app-i18n-check.mjs`).
