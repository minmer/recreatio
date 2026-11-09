# Liturgical Library

Liturgia is a parallel collection **inside Library**, alongside source/book collections. It is not a book, a separate application, or a Cogita knowledge base. Create it at **Library → New collection → Liturgia**. The collection uses the current account, area permissions, encryption, and versioned Library entry store.

The implementation is a resource and composition system. It does **not** ship a complete approved Polish liturgical corpus or a reviewed calendar for every diocese. The supplied templates are structural drafts. Calendar coverage and incomplete compositions remain visible until the appropriate content and reviewed configuration have been imported.

## Model and storage

`frontend/src/app/library/liturgy/schema.ts` defines the nine kinds (zod); every stored entity carries `schema_version` "1.0" and its `revision`, both kept by the app. The normalized entities are:

| Entity | Stored Library kind | Responsibility |
| --- | --- | --- |
| `canonical_work` | `lit_work` | Identity, alternative names, explicit numbering mappings; optional source-book entry |
| `text_edition` | `lit_edition` | Language, translation/publication, license, allowed usage; optional source-book entry |
| `text_resource` | `lit_text` | One actual text in its edition, with structured blocks and provenance |
| `passage_definition` | `lit_passage` | Work/edition/source and verse ranges; no copied text |
| `liturgical_template` | `lit_template` | Ordered slots for an hour or Mass, applicability and per-slot selection policies |
| `calendar_observance` | `lit_observance` | Date rule, scope, precedence, rank, color, first Vespers and authority |
| `liturgical_assignment` | `lit_assignment` | Conditions, slot, resource/antiphon references, source layer and authority |
| `liturgical_rule` | `lit_rule` | Explicit date override, transfer, slot replacement or omission |
| `calendar_profile` | `lit_calendar` | Selected scopes, timezone, language, edition/cycle and reviewed coverage |

Canonical IDs are stable within a collection. Storage UUIDs are deterministic and collection-specific. A canonical work may refer to a Library book using `library_entry_id`. Numbering mappings are explicit, not inferred by subtracting one from a psalm number. Editions have independent IDs, so another translation never overwrites an existing text.

All entities use individual encrypted `app.library_entry` envelopes. Import receipts are `lit_import` entries. Migration **0139_liturgical_library.sql** adds `liturgy` to the collection-kind constraint. No plaintext corpus tables, new authentication system, or new publication channel are introduced. The migration must run through the normal backend migration/deployment process before the deployed service can create this collection type.

The trusted browser validates the decrypted graph. The backend enforces area authorization, envelope limits, optimistic concurrency, atomic writes, and revision history; it cannot inspect private plaintext references. A different client writing envelopes directly must implement the same validation contract.

Code in `frontend/src/app/library/liturgy/`: `names.ts` (the `lit_*` kind names, no validator) and `kinds.ts` (their Library kind definitions) are the only files the Library's first bundle loads. Everything else — `schema.ts` (zod), `defaults.ts`, `resources.ts`, `calendar.ts`, `compose.ts`, `persistence.ts`, `projection.ts` (computed text for Cogita and AI snapshots), `liturgyJson.ts` (the JSON format) and the screens (`LiturgyHome.tsx`, `LiturgyJsonPanel.tsx`) — arrives with an opened Liturgia, a Cogita base or AI access.

## Import and export (JSON)

Since 2026-11-09 the Liturgia imports like every other part of the app ([JSON.md](JSON.md)): the **Import / export** tab is the shared JSON panel (`ui/JsonPanel.tsx` via `LiturgyJsonPanel.tsx`) — export, import with the list of changes and warnings before the button, and the format's description beside it, copyable for an assistant, with a sample to insert. Each resource page has the same panel for that one entity. Format, plan and description: `liturgyJson.ts`; saving: `persistence.ts`.

```json
{
  "format": "recreatio/liturgy",
  "version": 1,
  "name": "Liturgia parafii",
  "provenance": "Where the texts and changes come from",
  "entities": [
    { "entity_type": "text_edition", "id": "edition.pl", "title": "…", "language": "pl-PL", "license": "…", "permitted_usage": ["private", "print"] },
    { "id": "psalm.51.pl", "title": "Corrected title" },
    { "id": "old.antiphon", "remove": true }
  ]
}
```

- A known `id` (stored or built in) changes **in place**: only the fields named change, `null` clears one, the rest stays. A changed built-in entity becomes the collection's own. The app counts `revision` (export leaves it out, import ignores it); `schema_version` is not written.
- An unknown `id` creates an entity (`entity_type` and the required fields). Shorthands still read: `psalm_text` with `verses`, a prayer with `text`.
- `{"id", "remove": true}` deletes; on a changed built-in it returns to the default (a `lit_default_reset` marker keeps the entry id for a later override). Nothing else is deleted.
- Unknown and internal (`_…`) fields are warned about and ignored; `__proto__`/`constructor`/`prototype` keys stop the import. Changing an `approved` entity is allowed — the preview warns.
- The whole final graph is validated (`validateEntities`): missing or wrong-type references, duplicate ids or psalms, language/edition mismatches, verse numbering, full-psalm verse counts, ranges, omissions, replacement cycles, dates, time zones, review intervals. Any problem stops the import; the panel lists them under the plan (as Cogita's review does) and the import throws them.
- Then one `LibraryStore.saveAll` writes everything plus a `lit_import` receipt (actions, versions, SHA-256) for the **Import history** tab — at most 4,999 changes. In a public area the import is refused while an edition lacks `share`. AI snapshots refresh right after.
- The first format (`recreatio.liturgy`, `schema_version` 1.0/1.1 with `mode` and `operations` patch/remove/reset_default) is still read, with a warning: full entities and patches change the named fields, removals and resets become `remove`.
- **Revision history** on a resource page restores an earlier version through the same import (keys the old version lacks are cleared), as a new revision.

The description (`LITURGY_JSON`, localized in `locales/*/liturgy.json` under `json`) has the document, the common keys, one section per kind with every field and what the schema knows about it (required, allowed values, default — from `zod` via `toJSONSchema`), the parts (blocks, ranges, references, slots, conditions, date rules, rule actions), the built-in ids and „Jak aplikacja używa tych danych”. Checks: `app-json-liturgy-check.mjs` (format) and `app-liturgy-check.mjs` (model, calendar, composition, saving).

## MCP

- `get_import_format("liturgy")` — the description above (generated by `frontend/scripts/import-formats.mjs`, Polish); `get_import_format("example-liturgy")` — `templates/liturgy/complete-example.json`: 132 entities, all nine kinds, every hour and Mass, invented texts.
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
node scripts/app-json-liturgy-check.mjs
npx tsc -p tsconfig.json --noEmit
```

The focused checks cover the JSON format (every field described, unchanged export, changes in place, removal, the first format), graph validation, passages and source reuse, the one atomic save with its receipt, calendars and exceptions, per-slot composition, export escaping and Cogita learning material. The text fixtures are synthetic, not official translations. Backend `Api.Tests` checks include the new collection kind and cross-kind move restrictions, alongside existing authorization and atomic-storage tests.

The following sources informed calendar reference fixtures and structural rules. The code has not received an independent liturgical review:

- [General Norms for the Liturgical Year](https://kkbids-old.episkopat.pl/index.php?id=300) and [precedence/occurrence/concurrence](https://kkbids-old.episkopat.pl/index.php?id=301): thirteen classes, Advent/year structure and transfers. Fixtures include Easter 2026 (5 April), Ash Wednesday (18 February), Annunciation 2024 (8 April), and Joseph 2008 (15 March).
- [Polish Bishops' Conference decree for 2026](https://episkopat.pl/doc/229149.Uroczystosc-NMP-Krolowej-Polski-w-roku-2026-2-maja): Queen of Poland on 2 May, distinct from the usual 3 May date.
- [General Instruction of the Liturgy of the Hours](https://liturgyoffice.org.uk/Resources/Rites/GILH.pdf): hours, psalter structure, festive Lauds, memorials and Invitatory repetition. Tests include psalter week I at Advent/Lent and the resumption of numbered Ordinary Time after Pentecost.
- [Lectionary for Mass introduction, weekday arrangements](https://www.liturgyoffice.org/Resources/GIRM/Opportunities/Others/I092-Readings.pdf) and [USCCB lectionary questions](https://www.usccb.org/faq/questions-about-lectionary): separate Sunday and weekday cycles; weekdays of seasonal periods require their own assignments.

No source's official Polish liturgical translations are bundled. Populate and review licensed editions, complete calendars, and particular rubrical templates before treating assembled output as an approved office or Mass formulary.
