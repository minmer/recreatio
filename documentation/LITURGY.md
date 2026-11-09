# Liturgical Library

Liturgia is a parallel collection **inside Library**, alongside source/book collections. It is not a book, a separate application, or a Cogita knowledge base. Create it at **Library → New collection → Liturgia**. The collection uses the current account, area permissions, encryption, and versioned Library entry store.

The implementation is a resource and composition system. It does **not** ship a complete approved Polish liturgical corpus or a reviewed calendar for every diocese. The supplied templates are structural drafts. Calendar coverage and incomplete compositions remain visible until the appropriate content and reviewed configuration have been imported.

## Model and storage

`frontend/src/app/library/liturgy/schema.ts` is the source of truth for the import contract: batch version **1.1**, canonical entity version **1.0**. Legacy 1.0 imports remain supported. The Import tab downloads the generated JSON Schema and the complete guide from `description.ts`; the MCP catalog embeds the same documents. The normalized entities are:

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

Code in `frontend/src/app/library/liturgy/`: `names.ts` (the `lit_*` kind names, no validator) and `kinds.ts` (their Library kind definitions) are the only files the Library's first bundle loads. Everything else — `schema.ts` (zod), `defaults.ts`, `resources.ts`, `calendar.ts`, `compose.ts`, `persistence.ts`, `projection.ts` (computed text for Cogita and AI snapshots), `description.ts` and the screens (`LiturgyHome.tsx`, `ImportPanel.tsx`) — arrives with an opened Liturgia, a Cogita base or AI access. The example collection loads only when "Preview an example" is pressed.

## Import and revision workflow

1. Open the collection's **Import / export** tab and paste/upload a document. **Preview an example** loads `templates/liturgy/complete-example.json`: 132 entities covering all nine types, all eight hours and Mass. All text is explicitly synthetic and all resources are drafts.
2. Inspect new records, unchanged records, before/after updates, explicit removals, default resets and errors. Previewing saves nothing.
3. Confirm the import. Resources, deletions and their checksum/provenance receipt are written in one existing Library batch transaction. Existing authorized AI snapshots refresh immediately after a successful import; a refresh failure is reported separately from the saved import.
4. Browse resources or open Calendar and reading. A passage resolves the canonical text at read time. The resource's usage view includes assignments reached through a passage.

A batch has this envelope:

```json
{
  "format": "recreatio.liturgy",
  "schema_version": "1.1",
  "mode": "update",
  "provenance": "Source publication or reason for this import",
  "entities": [],
  "operations": []
}
```

One entity may also be imported without the batch envelope. Full entities are complete replacements; omitted entities in a batch are always kept. Each entity still carries `schema_version: "1.0"`. The smaller `templates/liturgy/example.json` remains available; `maintenance-example.json` demonstrates additions, full-text corrections, dependent edits and explicit removals against the complete example.

Imports are additive by default. Identical re-imports do nothing. Controlled updates need the same ID and entity type, a higher revision, and provenance; changing an approved entity additionally requires the explicit approved-update checkbox. Existing dependants are revalidated, so shortening a psalm cannot leave an existing passage outside its verse range. A changed server/store state invalidates the import preview. Concurrent writes to the same canonical ID encounter the existing version checks.

Version 1.1 adds explicit operations, which can be combined with full entities in one document:

| Operation | Fields | Effect |
| --- | --- | --- |
| `patch` | `id`, `expected_revision`, `patch` | Recursively merge objects, remove fields with `null`, replace arrays in full, and increment the canonical revision when changed. Omitted fields are preserved. |
| `remove` | `id`, `expected_revision` | Soft-delete the stored resource without cascading. Remaining dependants must be corrected or removed in the same valid final graph. |
| `reset_default` | `id`, `expected_revision` | Discard a stored override and reveal the bundled default. A storage marker preserves its UUID/version for future overrides. |

Operations require `mode: "update"`, provenance and an exact current revision. Approved records also require the approved-update checkbox. A canonical ID can occur only once across `entities` and `operations`; identity/type/schema/revision and internal fields cannot be patched. Bundled defaults cannot be removed. Deletions retain version history but the importer does not automatically resurrect deleted records. References from other collections, including Cogita, must be checked separately.

The parser accepts up to 50,000 full entities; unchanged records do not consume write operations. The existing atomic storage limit permits at most 4,999 changed/deleted resources plus the import receipt. The file upload limit is 16 MiB, with the existing encrypted entry and batch byte limits also enforced. Larger jobs need dependency-safe transactions prepared from the complete graph; no entity or text is silently truncated.

Validation includes missing/wrong-type references, duplicate IDs, duplicate psalms in one work/edition, language/edition mismatches, verse numbering, full-psalm verse counts, overlapping or unavailable ranges, documented omissions, replacement cycles, invalid dates, timezone names and calendar review intervals. Reference-only assignments can be imported separately once their dependencies exist. A batch may list dependencies in any order.

A resource's **Revision history** uses the existing Library version endpoints. Restoring an earlier revision opens a new controlled-update preview; it does not erase history. The import-history tab lists each action, changed canonical IDs, stored versions and SHA-256 checksums.

## Complete MCP description and actual-data export

The read-only MCP server advertises Liturgia through its instructions, collection listing and import-format catalog:

- `get_import_format("liturgy")`: the full workflow and all entity fields generated from the runtime schemas.
- `get_import_format("liturgy-schema")`: the complete JSON Schema, including full entities and maintenance operations.
- `get_import_format("liturgy-defaults")`: every bundled default, separate from the collection's stored resources.
- `get_import_format("example-liturgy")` and `get_import_format("example-liturgy-maintenance")`: the complete collection example and its mixed maintenance document.

Read every `nextPart` and concatenate raw parts with newlines for JSON documents. `frontend/scripts/import-formats.mjs` generates the embedded catalog; `--check` detects drift.

`get_liturgy_library(collection, offset, limit, snapshotId)` exports exact canonical data from an authorized liturgical collection, including complete structured texts and current canonical revisions. Search projections remain separate. Follow `nextOffset` until null, passing the first response's `snapshotId`, and concatenate `Document.entities`. Pages never clip an entity, even when one text exceeds the normal page budget. `Complete` means that one response alone contains the whole collection, not merely the last page. Snapshot changes invalidate continuation; stale snapshots are explicitly marked. Older snapshots without canonical data require a refresh instead of reconstruction from search text.

The Import / export tab's **Refresh existing MCP snapshots** action upgrades already-authorized snapshots even when no resources have changed. It creates no access. The MCP connection remains read-only: an assistant reads the actual collection and prepares a complete import document; the application's preview and confirmation apply it to the encrypted store. Resource links from MCP now open the Library resource route.

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
npx tsc -p tsconfig.json --noEmit
```

The focused checks cover import integrity, revisions/idempotency, passages and source reuse, atomic persistence/stale previews, calendars and exceptions, per-slot composition, export escaping and Cogita learning material. The text fixtures are synthetic, not official translations. Backend `Api.Tests` checks include the new collection kind and cross-kind move restrictions, alongside existing authorization and atomic-storage tests.

The following sources informed calendar reference fixtures and structural rules. The code has not received an independent liturgical review:

- [General Norms for the Liturgical Year](https://kkbids-old.episkopat.pl/index.php?id=300) and [precedence/occurrence/concurrence](https://kkbids-old.episkopat.pl/index.php?id=301): thirteen classes, Advent/year structure and transfers. Fixtures include Easter 2026 (5 April), Ash Wednesday (18 February), Annunciation 2024 (8 April), and Joseph 2008 (15 March).
- [Polish Bishops' Conference decree for 2026](https://episkopat.pl/doc/229149.Uroczystosc-NMP-Krolowej-Polski-w-roku-2026-2-maja): Queen of Poland on 2 May, distinct from the usual 3 May date.
- [General Instruction of the Liturgy of the Hours](https://liturgyoffice.org.uk/Resources/Rites/GILH.pdf): hours, psalter structure, festive Lauds, memorials and Invitatory repetition. Tests include psalter week I at Advent/Lent and the resumption of numbered Ordinary Time after Pentecost.
- [Lectionary for Mass introduction, weekday arrangements](https://www.liturgyoffice.org/Resources/GIRM/Opportunities/Others/I092-Readings.pdf) and [USCCB lectionary questions](https://www.usccb.org/faq/questions-about-lectionary): separate Sunday and weekday cycles; weekdays of seasonal periods require their own assignments.

No source's official Polish liturgical translations are bundled. Populate and review licensed editions, complete calendars, and particular rubrical templates before treating assembled output as an approved office or Mass formulary.
