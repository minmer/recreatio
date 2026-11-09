# Liturgical Library

Liturgia is a parallel collection **inside Library**, alongside source/book collections. It is not a book, a separate application, or a Cogita knowledge base. Create it at **Library → New collection → Liturgia**. The collection uses the current account, area permissions, encryption, and versioned Library entry store.

The implementation is a resource and composition system. It does **not** ship a complete approved Polish liturgical corpus or a reviewed calendar for every diocese. The supplied templates are structural drafts. Calendar coverage and incomplete compositions remain visible until the appropriate content and reviewed configuration have been imported.

## Model and storage

`frontend/src/app/library/liturgy/schema.ts` defines the nine kinds (zod); every stored entity carries `schema_version` "2.0" (records stored as "1.0" are read through the migration and written as "2.0" on their next change) and its `revision`, both kept by the app. The normalized entities are:

| Entity | Stored Library kind | Responsibility |
| --- | --- | --- |
| `canonical_work` | `lit_work` | Identity, alternative names, explicit numbering mappings; optional source-book entry |
| `text_edition` | `lit_edition` | Language, translation/publication, license, allowed usage; optional source-book entry |
| `text_resource` | `lit_text` | One full wording in its edition; its structure (units, divisions, performance, notes, variants) beside it, never inside it |
| `passage_definition` | `lit_passage` | Work/edition/source and verse ranges, a named division and its part; no copied text |
| `liturgical_template` | `lit_template` | Ordered slots for an hour or Mass, applicability and per-slot selection policies |
| `calendar_observance` | `lit_observance` | Date rule, scope, precedence, rank, color, first Vespers and authority |
| `liturgical_assignment` | `lit_assignment` | Conditions, slot, resource/antiphon references, source layer and authority |
| `liturgical_rule` | `lit_rule` | Explicit date override, transfer, slot replacement or omission |
| `calendar_profile` | `lit_calendar` | Selected scopes, timezone, language, edition/cycle and reviewed coverage |

Canonical IDs are stable within a collection. Storage UUIDs are deterministic and collection-specific. A canonical work may refer to a Library book using `library_entry_id`. Numbering mappings are explicit, not inferred by subtracting one from a psalm number. Editions have independent IDs, so another translation never overwrites an existing text.

All entities use individual encrypted `app.library_entry` envelopes. Import receipts are `lit_import` entries. Migration **0139_liturgical_library.sql** adds `liturgy` to the collection-kind constraint. No plaintext corpus tables, new authentication system, or new publication channel are introduced. The migration must run through the normal backend migration/deployment process before the deployed service can create this collection type.

The trusted browser validates the decrypted graph. The backend enforces area authorization, envelope limits, optimistic concurrency, atomic writes, and revision history; it cannot inspect private plaintext references. A different client writing envelopes directly must implement the same validation contract.

Code in `frontend/src/app/library/liturgy/`: `names.ts` (the `lit_*` kind names, no validator) and `kinds.ts` (their Library kind definitions) are the only files the Library's first bundle loads. Everything else — `schema.ts` (zod), `text.ts` (the wording and its units: versions, placing pieces, the two views), `migrate.ts` (earlier formats → version 2), `defaults.ts`, `resources.ts`, `calendar.ts`, `compose.ts`, `persistence.ts`, `projection.ts` (computed text for Cogita and AI snapshots), `liturgyJson.ts` (the JSON format) and the screens (`LiturgyHome.tsx`, `LiturgyText.tsx` for both views, `LiturgyJsonPanel.tsx`) — arrives with an opened Liturgia, a Cogita base or AI access.

## Texts: one wording, two views (version 2)

A `text_resource` holds its wording **once**, in `text`, exactly as read — paragraphs separated by an empty line, nothing else added. Verse numbers, pause marks (`*`, `†`), V./R. markers, rubrics, headings, sources and repetition instructions are never written into it; they are structure that points into the wording. Two views read the same record:

- **continuous** — the wording as paragraphs (`paragraphs`), as one reads it;
- **liturgical** — lines built from the units (`resourceLines`/`unitLines`): verse numbers, `*` and `†` at their places, roles, headings and rubrics, repetitions written out from references, `/` instead of `*` when an antiphon returns.

`modeOf` picks the layout: psalm, canticle and doxology by verses, hymn by stanzas, the rest as prose with roles. Both views are in the resource page, the calendar reader and every composed hour (`LiturgyText.tsx`, `ViewSwitch`), and in the printed and offline output (`export.ts`).

**Units.** `layout.units` are character ranges `[at, to)` of the wording, in order, without gaps (only spaces between them) and without overlap. A unit can carry: `id` (for references), `verse` (internal, stable number — ranges and passages use it) and `label` (how the edition prints it: "2a", "116"), `end` (`mediant` = `*`, `flex` = `†`, `line`, `verse`, `stanza`, `part`), `role` (`presider`, `cantor` = V., `reader`, `all` = R., `choir1`, `choir2`), `kind` (`intro`, `petition`, `petition_response`, `response`, `body`, `conclusion`, `incipit`, `title`), `cross` (✠) and `style`.

**Versions.** `text_version` is a hash of the wording (`textVersion`, the app computes it). Every division records the version it was made for (`layout.on`, `layouts[].on`, `passage_definition.on`). When the wording changes, a division made for the old one is reported (`layout_stale`, `division_stale`) instead of silently cutting the new text in the wrong places.

**In a JSON document** units are written as **pieces of the text**, not offsets: `"layout": [{"text": "…", "verse": 1, "label": "1", "end": "mediant"}, …]`. The import finds each piece in the wording in order (spaces and line breaks may differ) and turns it into offsets; a piece that is not there stops the import with the piece and what stands at that place (`layout_mismatch`). `text` may be left out — then the pieces are the wording. Export writes pieces again.

**Other divisions** of the same wording (another edition's verse breaks, an attested other mediant of an antiphon) are `layouts: [{id, title, source, units}]` — never a second copy of the text. An assignment chooses one with `antiphon_layout` / `main_layout`.

**Performance.** `performance` is the order of delivery when it is not simply the units once: steps `{say: [unit ids]}`, `{resource: id, units?}` (another text, e.g. a common response), `{rubric}`, each with an optional `role`. A short responsory is written once and its repeats are steps; the intercessions' common response is one `response` text, referenced by `response_ref` and repeated by steps. A `performance` on a psalm, canticle or doxology is refused (`performance_unsupported`) — verse texts are delivered by their units.

**Notes** (`heading`, `subtitle`, `sentence`, `rubric`, `source`, `part`) stand before a unit (`at`, default `start`) and are shown only in the liturgical view.

**Per kind:**

| Kind | What is structure |
| --- | --- |
| antiphon | Its pause (`end: mediant`); one record per identical antiphon — the assignment decides where it returns; other attested pauses as `layouts` |
| hymn | Lines (`end: line`) and stanzas (`end: stanza`, the stanza number as `label`); the doxology strophe is part of the wording (its lines `kind: conclusion`); an attested other strophe is a `variant` that replaces it under `when`, line by line |
| psalm, canticle | One full wording; `verse` + `label` on every half; `canonical_work.numbering_systems` maps edition numbering (Hebrew/Vulgate); parts and named divisions are `passage_definition`s (`division`, `part`, `order`, `ranges`, `omitted_verses`) — Psalm 119 in 22 parts reads from one wording; `doxology: 'after'` (default) or `'none'`, `doxology_ref`. The psalm's own view never shows the doxology. |
| reading | `origin` (the line "Z Listu…"), `reference`, `incipit` (`{text}` its own words, or `{unit}` when the incipit is the beginning of the wording — then it is not printed twice), `intro_formula` separately |
| responsory, dialog, versicle | `role` per unit; repeats are `performance` steps; the opening dialog, versicle, blessing and dismissal are reusable texts |
| intercessions | Units `intro`, `petition`, `petition_response` (the second part after "—"); the common response once (`response_ref`), its repetition in `performance` |
| prayer | `body`, `conclusion` (belongs to the prayer), `response` (Amen, role `all`); other endings are `variants: [{id, replaces: "conclusion", text, when}]` — e.g. the short ending at daytime hours, chosen by the hour's conditions |
| doxology | Stored once; appended after psalms and canticles by the slot rule |

**What is missing.** `missing` lists codes of what a record lacks or what was inferred and needs checking; a `draft` with anything in `missing` is `incomplete`. Structural codes are recomputed on every import: `verses` (psalm/canticle without verse units), `work`, `lines` (hymn), `origin`, `reference` (reading), `roles` (responsory/dialog), `response`, `petitions` (intercessions), `conclusion` (prayer). Inferred codes stay until a reviewed layout replaces them: `verses_inferred`, `lines_inferred`, `roles_inferred`, `incipit_unverified`, `performance_inferred`, `doxology_removed`, `marks_unverified`. Others: `full_text` (only part of the wording), `possibly_truncated`, `links_pending`, `resource_type`. The resource page lists them in words.

**Identical wording is one text.** On import, texts of the same edition and kind whose normalized wording is equal are merged: the stored (or alphabetically first) id is kept, the others become `aliases` — every reference to them keeps resolving (`indexOf` maps aliases) — and their titles, sources, notes and metadata go to `metadata.merged_from`; a different division of theirs stays as an attested layout `attested-<id>`. The preview names each merge.

**Similar is never merged.** Texts that begin with the same five words and share at least 75% of their words, or where one wording is the beginning of the other, are listed as candidates to compare; the shorter one of a prefix pair is marked `possibly_truncated`. Nothing else happens to them.

**Links that wait.** A reference to a doxology or common response that is not in the collection yet (it comes in a later file) does not stop the import: the text keeps it in `metadata` (`doxology_resource_id`, `refrain_resource_id`) and carries `links_pending`; an import that brings the target connects it and clears the code.

## Import and export (JSON)

Since 2026-11-09 the Liturgia imports like every other part of the app ([JSON.md](JSON.md)): the **Import / export** tab is the shared JSON panel (`ui/JsonPanel.tsx` via `LiturgyJsonPanel.tsx`) — export, import with the list of changes and warnings before the button, and the format's description beside it, copyable for an assistant, with a sample to insert. Each resource page has the same panel for that one entity. Format, plan and description: `liturgyJson.ts`; saving: `persistence.ts`.

```json
{
  "format": "recreatio/liturgy",
  "version": 2,
  "name": "Liturgia parafii",
  "provenance": "Where the texts and changes come from",
  "entities": [
    { "entity_type": "text_edition", "id": "edition.pl", "title": "…", "language": "pl-PL", "license": "…", "permitted_usage": ["private", "print"] },
    { "entity_type": "text_resource", "id": "ant.1", "title": "…", "resource_type": "antiphon", "edition_id": "edition.pl", "language": "pl-PL",
      "complete": true, "layout": [{ "text": "First half,", "end": "mediant" }, { "text": "second half." }] },
    { "id": "psalm.51.pl", "title": "Corrected title" },
    { "id": "old.antiphon", "remove": true }
  ]
}
```

- A known `id` (stored or built in) changes **in place**: only the fields named change, `null` clears one, the rest stays. A changed built-in entity becomes the collection's own. The app counts `revision` and `text_version` (export leaves them out, import ignores them); `schema_version` is not written.
- An unknown `id` creates an entity (`entity_type` and the required fields). `layout` is written as pieces (see above); `verses: [{number, text}]` on a psalm is a shorthand for a layout by verses.
- `{"id", "remove": true}` deletes; on a changed built-in it returns to the default (a `lit_default_reset` marker keeps the entry id for a later override). Nothing else is deleted.
- Unknown and internal (`_…`) fields are warned about and ignored; `__proto__`/`constructor`/`prototype` keys stop the import. Changing an `approved` entity is allowed — the preview warns.
- The whole final graph is validated (`validateEntities`): missing or wrong-type references, duplicate ids or complete psalms, language/edition mismatches, verse numbering, full-psalm verse counts, ranges (with the psalm's last verse in the message), omissions, replacement cycles, dates, time zones, review intervals; and for texts: pieces not found in the wording, units out of bounds, overlapping or with gaps, divisions made for another wording, steps and notes pointing to units that do not exist, an unknown division chosen by an assignment, and a performance a verse text cannot have. Any problem stops the import; the panel lists them under the plan (as Cogita's review does) and the import throws them.
- Then one `LibraryStore.saveAll` writes everything plus a `lit_import` receipt (actions, versions, SHA-256) for the **Import history** tab — at most 4,999 changes. In a public area the import is refused while an edition lacks `share`. AI snapshots refresh right after.
- Earlier documents are still read, with a warning, and written as version 2 (see **Migration**): version 1 of `recreatio/liturgy`, and the first format (`recreatio.liturgy`, `schema_version` 1.0/1.1 with `mode` and `operations` patch/remove/reset_default) — full entities and patches change the named fields, removals and resets become `remove`.
- **Revision history** on a resource page restores an earlier version through the same import (keys the old version lacks are cleared), as a new revision.

The description (`LITURGY_JSON`, localized in `locales/*/liturgy.json` under `json`) has the document, the common keys, one section per kind with every field and what the schema knows about it (required, allowed values, default — from `zod` via `toJSONSchema`), the parts (blocks, ranges, references, slots, conditions, date rules, rule actions), the built-in ids and „Jak aplikacja używa tych danych”. Checks: `app-json-liturgy-check.mjs` (format) and `app-liturgy-check.mjs` (model, calendar, composition, saving).

## Migration from earlier formats

`migrate.ts` (`upgradeText`) turns a text of the earlier formats into version 2. It runs on import and when a stored "1.0" record is read; the record is rewritten as "2.0" on its next change. Nothing is guessed silently: whatever is inferred is named in `missing`.

- **Blocks → one wording.** `structured_content` blocks are joined into `text`: stanzas and paragraphs separated by an empty line, lines by a line break, the original spacing inside a block kept. Rubric and heading blocks become `notes`.
- **Marks → units.** `*` and `†` written inside a text, and `metadata.performance_markers` (`{at, mark}` per block), become unit ends (`*` mediant, `†` flex, `/` the mediant shown on repetition, ✢ ✣ a cross) and leave the wording. A mark inside a word adds `marks_unverified`. Other attested positions (`recitation_mark_variants`, antiphons) become `layouts`.
- **Roles and repeats.** Speakers P/K/V become `cantor` (V.), W/R become `all` (R.) (`roles_inferred`). A line that repeats an earlier one becomes a `performance` step pointing to it instead of a second copy.
- **Psalms and hymns.** Psalms without verse boundaries get verses from the pauses (`verses_inferred`); hymns get lines from capital letters when their count matches the print (`lines_inferred`), otherwise `lines`. A "Chwała Ojcu … Amen." embedded in a psalm text is taken out and the text before it ends a part (`doxology_removed`) — the doxology is appended by the hour.
- **Intercessions.** The introduction up to the colon, the common response, petitions split at " — " into petition and second part; the refrain (`refrain_resource_id`) becomes `response_ref`, its repetition `performance`.
- **Prayers.** Body, conclusion (from the first known ending: "Przez naszego Pana…", "Przez Chrystusa…", "Przez Niego…", "Który żyje…" and their variants, Polish and English) and Amen (`kind: response`, `role: all`); `introduction_formula` becomes `intro_formula`.
- **Readings.** `origin`, `reference`, the title as a heading; heading lines that continue into the text become the incipit (`incipit_unverified`).
- **Kinds.** psalm_fragment → psalm, gospel_canticle → canticle, intercession_refrain → response, blessing_and_conclusion → blessing, office_rubric → dialog (with speakers) or rubric; slot-named kinds (opening, reading_1/2, te_deum, marian_antiphon, collect …) map to what the text is.
- `metadata` stays as it was (sources, usages, attested differences).

**The two semantic files** (`LITURGIA_SEMANTYCZNA_IMPORT_01_z_02.json`, `…_02_z_02.json`, first format): import 01, then 02, each through the normal panel (each stays below 4,999 changes). File 01 refers to doxologies and refrains that only file 02 brings: those texts carry `links_pending` and file 02 connects them (275 texts of file 01 change). Checked in an in-memory test collection through the real planner and save:

| | File 01 | File 02 |
| --- | --- | --- |
| Entities in the file | 2,719 | 3,672 |
| Created / changed | 2,719 / 0 | 3,665 / 275 |
| Merged into an identical wording | — | 7 |
| Problems | 0 | 0 |

After both: 6,238 texts (psalm 341, canticle 4, antiphon 2,031, reading 1,198, hymn 345, responsory 779, intercessions 305, prayer 777, dialog 74, response 153, blessing 167, rubric 63, doxology 1); 2,549 `incomplete`, 3,689 `draft`; no `*` or `†` left in any wording; every psalm and canticle has verse units, 304/305 intercessions petitions, 774/777 prayers a conclusion, 777/779 responsories roles, 312/345 hymns lines; 1,724 texts with an attested other division; export → import changes nothing. Most frequent open items: `possibly_truncated` 682, `roles_inferred` 583, `incipit_unverified` 534, `verses_inferred` 345, `reference` 327, `full_text` 183.

The files are a private transcription (`permitted_usage: private`): they stay out of the repository and out of public areas.

## MCP

- `get_import_format("liturgy")` — the description above (generated by `frontend/scripts/import-formats.mjs`, Polish); `get_import_format("example-liturgy")` — `templates/liturgy/complete-example.json` (version 2): 132 entities, all nine kinds, every hour and Mass, invented texts.
- `get_liturgy_library(collection, offset, limit, snapshotId)` — the collection exactly, as the app exports it (`recreatio/liturgy`, without `revision`): complete structured texts, never clipped. Follow `nextOffset` until null with the first response's `snapshotId` and concatenate `Document.entities`; `Complete` means one response held everything. Snapshots made before canonical data existed answer `snapshot_needs_refresh`; the next import or change in the app rebuilds them.
- The connection only reads: an assistant prepares the JSON, the user imports it in the app after the preview.

## Calendar and composition

The calendar resolves civil dates with date-only arithmetic, independent of browser timezone and DST. A profile chooses scopes such as `roman`, `PL`, `diocese.example`, `parish.example` or a religious institute. Local observances can explicitly replace inherited observances. The supported date range is 1583–4099.

All thirteen precedence classes are represented. The engine retains optional memorial choices, reduces memorials on privileged weekdays to commemorations, resolves first/second Vespers by precedence, and reports equal-priority conflicts. Transfers require explicit sourced rules; an unspecified transfer is reported, not guessed. Calendar cache keys include configuration and are replaced with the entity graph when its revision changes.

Sunday A/B/C follows the liturgical year at Advent. The Ordinary Time weekday I/II property uses the civil year's parity independently; seasonal and proper lectionary assignments must specify their own applicability. Christmas psalter directions are left to the proper instead of assigning a guessed week. A `reviewed` calendar profile must state its approved date interval and scopes; this marks owner/importer review, not independent certification by Recreatio.

The defaults contain a limited set of major Roman/Polish observances and explicit transfer rules, including the Polish Queen of Poland decree for 2026. They are **not a complete General Roman or Polish particular calendar**. Import the remaining observances and authorized local rules before declaring coverage reviewed.

Composition functions are ordinary typed application services:

- `resolveLiturgicalDay(date, context, entities)` and `calendarRange(...)`
- `composeOffice(date, hour, context, entities, options)`
- `composeMass(date, context, entities, options)`
- `composeAllHours(date, context, entities)`

Templates cover the Invitatory, Office of Readings, Lauds, Terce, Sext, None, Vespers, Compline and a separate Mass formulary/lectionary structure. They are drafts requiring rubrical review. Imported templates can replace them with more specific applicability and higher priority. Special Triduum Mass rites require such a specific template; the standard Mass skeleton is not used for Good Friday.

Each slot declares its own source order. Assignments can constrain dates, season, week, psalter week, weekday, observance, scopes, hour, first/second Vespers, psalmody, lectionary cycles, language and edition. A saint's proper prayer changes only its slot. Explicit common assignments require the selected common. Complementary daytime psalmody cannot silently reuse the current psalms. All-hours composition includes the Invitatory once and omits the duplicate opening immediately after it.

A composed slot is a list of shown parts (`antiphon`, `main`, `doxology`, `antiphon_repeat`), each with its lines for the liturgical view and paragraphs for the continuous one:

- **Antiphon.** Where it returns is `antiphon_repeat` of the assignment, else of the slot: `around` (default: before and after), `before`, `after`, `none`, `strophes` (the Invitatory: after every strophe and once more after the doxology — OWLG 34). The repeated antiphon shows `/` instead of `*`. `antiphon_layout` picks an attested other division.
- **Doxology.** A slot marked `doxology: true` (psalmody, gospel canticle, invitatory) appends it after a psalm or canticle — also after each part of a divided psalm (OWLG 123–125). It is omitted when the text says `doxology: "none"` (attested without it) or the assignment says `doxology: false`; it is taken from `doxology_ref`, else the doxology of the same edition, else of the language. Missing, it leaves the slot unreviewed.
- **Main text.** A passage gives its verse units and its part as a heading; `main_layout` picks another division. A prayer variant whose `when` matches the hour (the short ending at daytime, the Compline ending) replaces the conclusion; the Amen stays. `intro_formula` stands before the prayer; `performance` is followed when the whole text is shown.

Resolved slots expose their canonical text, passage, edition, assignment/rule, source layer, authority, selected celebration, actual selection reason, explicit fallback, and rejected alternatives. Equal-priority assignments are reported as ambiguous. No text is generated to fill a gap. Draft inputs and missing required material prevent a composition from being marked complete. Commemoration-specific composition requires a template explicitly scoped through `applicability.commemorations`; its assignments can target the same commemoration. Until that reviewed structure is supplied, the output retains a diagnostic. The baseline does not claim comprehensive rubrical coverage.

## Cogita and other Library connections

In a Cogita knowledge base, open **Settings → Sources** and select the liturgical collection. Its resource kinds become available as reference targets and learning material. Questions, templates, views and revision sessions can use them through the existing source mechanism. The collection remains the owner of its texts; Cogita computes text projections for passages without storing another canonical copy. It never makes these foreign resource kinds locally editable as ordinary Cogita entries.

Bibliographic links use existing readable Library peers and entry UUIDs. AI access recognizes the new collection kind within the existing explicit access mechanism; creating a liturgical collection creates no AI connection. The relevant snapshot includes canonical data and computed text for reading. All access still follows the selected areas/collections and their permissions.

Resource routes are `#/workspace/library/<collection>/resource/<canonical-id-or-entry-uuid>`. Existing cross-module links using the entry UUID directly also resolve. Resource IDs cannot take over navigation tabs.

## Offline and output

Resources are local, imported content; reading and composition never fetch daily text from an external publisher. The Library's encrypted device cache follows existing account settings. The new resource view also downloads a standalone HTML file containing texts, resolved divisions, metadata and re-importable JSON, which opens without a connection.

Calendar output supports one hour, all hours, Mass, and consecutive dates (up to 366), A4/A5 printing, browser **Save as PDF**, and resolved JSON with provenance. Printing checks the editions used by both main texts and antiphons. Private-only editions cannot be imported through this workflow into a public area.

The offline HTML resource archive does not run the composition engine. It does not make account login or a fresh application launch available offline; those remain subject to the existing app shell/cache. There is no separate server-side PDF renderer.

## Validation and sources

Run from `frontend`:

```sh
node scripts/app-liturgy-check.mjs
node scripts/app-liturgy-hours-check.mjs
node scripts/app-json-liturgy-check.mjs
npx tsc -p tsconfig.json --noEmit
```

The focused checks cover the JSON format (every field described, unchanged export, changes in place, removal, the first format), graph validation, passages and source reuse, the one atomic save with its receipt, calendars and exceptions, per-slot composition, export escaping and Cogita learning material. `app-liturgy-hours-check.mjs` imports the test collection `templates/liturgy/hours-test.json` (110 entities, invented texts) and checks both views of an antiphon (division, attested other division, two uses), a hymn (lines, stanzas, a doxology strophe by condition) and a psalm (whole, two and three parts, Psalm 119 in 22 parts); Lauds, the Office of Readings, Sext, Compline and the Invitatory; the doxology appended and omitted; prayer endings; export → import without change; readable preview messages for a bad range, a broken reference, an unsupported performance, a mismatching piece and a stale division; the React views; and the 1.0 → 2.0 migration. The text fixtures are synthetic, not official translations. Backend `Api.Tests` checks include the new collection kind and cross-kind move restrictions, alongside existing authorization and atomic-storage tests.

The following sources informed calendar reference fixtures and structural rules. The code has not received an independent liturgical review:

- [General Norms for the Liturgical Year](https://kkbids-old.episkopat.pl/index.php?id=300) and [precedence/occurrence/concurrence](https://kkbids-old.episkopat.pl/index.php?id=301): thirteen classes, Advent/year structure and transfers. Fixtures include Easter 2026 (5 April), Ash Wednesday (18 February), Annunciation 2024 (8 April), and Joseph 2008 (15 March).
- [Polish Bishops' Conference decree for 2026](https://episkopat.pl/doc/229149.Uroczystosc-NMP-Krolowej-Polski-w-roku-2026-2-maja): Queen of Poland on 2 May, distinct from the usual 3 May date.
- [General Instruction of the Liturgy of the Hours](https://liturgyoffice.org.uk/Resources/Rites/GILH.pdf) (OWLG): hours, psalter structure, festive Lauds, memorials and Invitatory repetition; chapters II and III for the text structure — the Invitatory antiphon after each strophe (34), the doxology after each psalm and part (123–125), intercessions with introduction, petitions and a common response (190–193).
- [brewiarz.pl](https://brewiarz.pl): how the Polish office prints its texts — V./R. (K./W.), `*` and `†` in psalms, `/` in a repeated antiphon, "Chwała Ojcu" after each psalm and canticle, reading origin and reference above the text, the short prayer ending at daytime hours and "Który żyje…" at Compline. Only the structure was compared; no text was taken. Tests include psalter week I at Advent/Lent and the resumption of numbered Ordinary Time after Pentecost.
- [Lectionary for Mass introduction, weekday arrangements](https://www.liturgyoffice.org/Resources/GIRM/Opportunities/Others/I092-Readings.pdf) and [USCCB lectionary questions](https://www.usccb.org/faq/questions-about-lectionary): separate Sunday and weekday cycles; weekdays of seasonal periods require their own assignments.

No source's official Polish liturgical translations are bundled. Populate and review licensed editions, complete calendars, and particular rubrical templates before treating assembled output as an approved office or Mass formulary.
