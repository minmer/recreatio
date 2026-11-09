/** Shared by the app and the generated MCP catalog; field details follow the runtime schema. */
import { z } from 'zod';
import { EntitySchema, jsonSchema } from './schema';
import { BUILTINS } from './defaults';
import { exportEntities } from './persistence';
const GUIDE = `# Liturgical Library — complete JSON import and maintenance contract (1.1)

Liturgia is a parallel collection INSIDE Library, with collection kind \`liturgy\`. It is not a book, a Cogita knowledge base, an appointment calendar, or the parish Mass-intention register. Its texts can be source material for Cogita. It stores reusable texts and editions separately from references, assignments, calendar configuration, and composition rules. This format manages the WHOLE collection and all nine entity types, not just psalm fragments.

## Jak aplikacja używa tych danych (how the app uses this data)

- **Storage**: every entity becomes one entry of kind \`lit_*\` in this collection, sealed in the browser with the area's key; each import adds one \`lit_import\` receipt (the Import history tab). The collection's area decides who reads: its members, and everyone only when the area is public and its rule for collections is confirmed.
- **In the collection**: Resources (list, one resource with its text, references and everything that uses it, revision history), Calendar and reading (the liturgical day and the composed hours and Mass, computed at read time from texts, passages, templates, assignments, rules and the bundled defaults), print/PDF, resolved JSON and an offline HTML file.
- **Elsewhere**: a Cogita knowledge base that adds the collection under Settings → Sources sees its entries as read-only material, passages with their computed text; other Library collections can refer to its entries; an AI link that includes the collection carries the exact canonical entities (\`get_liturgy_library\`) and the computed texts (\`search_entries\`).
- **What an import does not do**: it never deletes an entity the document omits, never changes a bundled default in place (a stored entity with the same id overrides it; \`reset_default\` returns to it), never fetches text from outside, never writes into Cogita or another collection; in a public area it is refused while any edition lacks \`share\` in \`permitted_usage\`.

## 1. Read the actual collection before editing it

1. Call \`list_collections\` and choose the exact UUID whose \`part\` is \`liturgy\`. Check \`Ready\`, \`SnapshotCurrent\`, and \`SnapshotMadeAt\`.
2. Call \`get_liturgy_library(collection, offset: 0)\`. It returns exact canonical JSON, full structured texts and revisions. Search snippets and derived passage text are not an export.
3. While \`nextOffset\` is non-null, call again with that offset and the same \`snapshotId\`. Concatenate every \`Document.entities\` array. A response with \`Complete: false\` is a page, not the whole collection. If the snapshot changed, restart; if stale or missing canonical data, open the updated app with write access and use “Refresh existing MCP snapshots” in the Liturgia Import / export tab. Successful imports also refresh existing snapshots immediately. This creates no new access.
4. Read \`get_import_format("liturgy")\` through all its \`nextPart\` values. \`liturgy-schema\` is the generated JSON Schema; concatenate its raw text parts with newlines to reconstruct the schema. \`liturgy-defaults\` contains the structural defaults bundled with the app. \`example-liturgy\` and \`example-liturgy-maintenance\` are a complete synthetic collection and a subsequent mixed edit of that same collection.
5. Inspect the full dependency graph before removing or merging resources. Preserve canonical IDs and edition/provenance information. Do not invent official translations, licensing terms or liturgical approval.
6. Return one JSON document suitable for **Library → collection of type Liturgia → Import / export** (\`#/workspace/library/<collection UUID>/import\`). The app shows all additions, before/after revisions, removals, default resets and validation errors before its existing confirmation button writes anything.

The MCP authorization is read-only; it reads actual data and supplies this import contract. Preparing JSON does not claim a server-side write. The import applies corrections and removals to the actual encrypted Library store with its existing area permissions and optimistic concurrency. Reading a liturgical collection does not grant access to any linked collection.

## 2. Batch envelope and complete entities

\`\`\`json
{
  "format": "recreatio.liturgy",
  "schema_version": "1.1",
  "mode": "update",
  "provenance": "Checked against the named edition; describe the correction and its source",
  "entities": [],
  "operations": []
}
\`\`\`

\`entities\` and \`operations\` default to empty arrays. They may be used together in the same transaction, provided a canonical ID appears only once across both arrays. Array order does not determine dependency resolution. Omitted entities are KEPT: this is never an implicit replace/delete-all operation.

- \`mode: "add"\` is the default if neither JSON nor the UI specifies a mode. New entities are created; identical records are unchanged. Conflicting existing entities are refused.
- \`mode: "update"\` allows creation, documented full-entity replacement, patches, explicit removals and resets. The document's mode is reflected in the UI. A nonempty \`provenance\` is required for changes to existing records.
- Each full entity carries \`schema_version: "1.0"\` (the entity schema has not changed), \`entity_type\`, stable \`id\`, \`title\`, \`revision\`, \`status\`, and its type-specific fields. The envelope's 1.1 adds maintenance operations; it does not change entity versions. Legacy 1.0 envelopes and standalone entities still import, but maintenance operations require envelope version 1.1.
- An unknown ID creates a record. For a known ID, a changed full entity must have the same type and a strictly greater \`revision\`. Identical entities are no-ops even in an entire exported collection.
- A full entity is a COMPLETE replacement, not a partial patch: omitted optional fields disappear, and defaults apply. Use \`op: "patch"\` to preserve omitted fields.
- Never rename \`id\` or change \`entity_type\` to polish wording. Change \`title\` or the relevant metadata. Intentional identity replacement requires creating the replacement, updating every dependant, and explicitly removing the old record in the same valid final graph.
- \`status\` is \`draft\` (default), \`approved\` or \`incomplete\`. Changes, removals and resets of approved records additionally need the UI's explicit approved-update checkbox. JSON cannot switch that review control off. Do not mark drafts approved merely to pass validation.

## 3. Patch existing records without copying unrelated fields

\`\`\`json
{
  "format": "recreatio.liturgy",
  "schema_version": "1.1",
  "mode": "update",
  "provenance": "Corrected punctuation and bibliographic attribution against the source edition",
  "operations": [
    {
      "op": "patch",
      "id": "example.prayer",
      "expected_revision": 3,
      "patch": {
        "title": "Corrected title",
        "source_citation": "Edition, volume, page",
        "metadata": { "editorial_note": "Source checked", "obsolete_note": null }
      }
    }
  ]
}
\`\`\`

Patches use JSON Merge Patch semantics: object fields merge recursively, \`null\` removes a field, and arrays replace in full. Omitted fields remain untouched. To correct one verse, supply the COMPLETE \`structured_content\` array including every other verse; an array containing one verse would replace the whole text. Do not turn a passage into copied text. Removing a required field fails schema validation; removing an optional field with a default restores that default when parsed.

\`expected_revision\` must equal the current canonical revision. A changed patch automatically increments it by one. An unchanged patch writes nothing. The patch cannot set \`id\`, \`entity_type\`, \`schema_version\`, \`revision\`, internal \`_…\` fields, or prototype-related keys. Type-specific constraints and all existing dependants are checked after merging.

For large editorial revisions, include one patch per changed entity in the same operations array. Read all current records first, preserve wording that is outside the requested editorial scope, and provide real source corrections rather than generated official text. The same operation works for editions, psalms, divisions, templates, assignments, observances, calendar profiles and rules.

## 4. Explicit removal, reassignment and default reset

\`\`\`json
{
  "format": "recreatio.liturgy",
  "schema_version": "1.1",
  "mode": "update",
  "provenance": "Replaced an obsolete assignment; the remaining resources keep their IDs",
  "operations": [
    { "op": "remove", "id": "obsolete.assignment", "expected_revision": 2 }
  ]
}
\`\`\`

Removal requires an existing stored record and its exact revision. It is a soft deletion through the existing Library transaction, with version history and an import receipt retained. It does not cascade. If any remaining passage, assignment, template, condition, rule or calendar profile refers to the removed entity, the whole import is rejected. Include the necessary dependent edits or removals in this same document. Both explicit passage source IDs and implicit work/edition passage sources are validated.

To consolidate duplicates: choose the canonical record to retain; patch all references to it; remove the duplicate. A referenced edition cannot disappear while its texts remain. Check external Cogita references separately: references in other collections are outside this import's transaction, so preserve IDs where possible and correct those links using their own format.

Bundled defaults are configuration supplied by the app, separate from stored collection data. They cannot be removed with \`remove\`. A changed default is stored as a collection override. To discard that override and reveal the bundled default, use:

\`\`\`json
{"op":"reset_default","id":"roman.template.lauds","expected_revision":2}
\`\`\`

The preview displays both the discarded override and the restored default. Resetting a non-default, or a default with no stored override, is rejected. Correcting a default instead uses a full entity or patch, respecting its current revision and approval status. Download/read \`liturgy-defaults\` first; do not guess its fields or IDs.

## 5. The normalized resource graph

| Entity type | Stored kind | Purpose and links |
| --- | --- | --- |
| \`canonical_work\` | \`lit_work\` | Stable identity of a psalm, canticle, biblical work or other canonical work. Explicit numbering-system mappings; optional bibliographic Library UUID. |
| \`text_edition\` | \`lit_edition\` | Language, publisher, translator, publication, license and permitted usage. Optional bibliographic Library UUID. |
| \`text_resource\` | \`lit_text\` | One actual text in one edition, in ordered structured blocks. Required edition; optional canonical work. Psalms require a work and numbered verses. |
| \`passage_definition\` | \`lit_passage\` | Work, edition, optional explicit text resource, ordered non-overlapping verse ranges and authorized omissions. No copied verses. |
| \`liturgical_template\` | \`lit_template\` | Hour/Mass, applicability, priority, ordered named slots, required/optional flags, conditions, per-slot source order and optional direct references. |
| \`calendar_observance\` | \`lit_observance\` | Date rule, one scope, 13-level precedence, rank, color, first Vespers, common and optional explicit replacement. |
| \`liturgical_assignment\` | \`lit_assignment\` | Slot plus context, a text/passage reference, optional antiphon and explicit fallbacks, priority, source layer and authority. |
| \`liturgical_rule\` | \`lit_rule\` | Calendar scope and conditions, with date override, transfer, slot replacement or omission; explicit authority. |
| \`calendar_profile\` | \`lit_calendar\` | Active scopes, timezone, country, language, edition/cycle and partial/reviewed coverage interval. |

Canonical IDs are case-sensitive strings, up to 160 characters, matching \`[A-Za-z0-9][A-Za-z0-9._:-]*\`. They are NOT storage UUIDs, not Cogita \`@ref\` names, and not titles. Ordinary resource references within this format use canonical IDs in this collection. \`library_entry_id\` alone names the storage UUID of a readable bibliographic source in another Library collection. Scope/common identifiers are names for configuration, not implicit resource references.

A second translation needs its own edition and text IDs. A different division points to the existing text. Reuse antiphons, hymns and prayers by reference. Do not manufacture a resource per civil day or duplicate a psalm into every office. Full entity fields and their nested objects are enumerated below from the actual schema.

## 6. Calendar, assignments and composition

Hours are \`invitatory\`, \`readings\`, \`lauds\`, \`terce\`, \`sext\`, \`none\`, \`vespers\`, \`compline\`, \`mass\`. Mass uses its own templates/assignments and lectionary, sharing the calendar with the Office. The source layers are \`psalter\`, \`time\`, \`saints\`, \`common\`, \`ordinary\`, \`lectionary\`, \`local\`. A slot may set its own \`source_order\`; do not impose one invented universal fallback rule.

Conditions may constrain exact dates, seasons, weekdays (Monday 1 to Sunday 7), weeks, psalter weeks, observances, commemorations, scopes, hours, Sunday/weekday cycles, first/second Vespers, current/complementary psalmody, common, Te Deum, following the Invitatory, edition, language, office cycle, and date interval. Omitted conditions do not restrict that dimension. Lists of scopes require every listed scope to be active; other lists match an included value. Empty lists match nothing. Observance, commemoration and edition IDs must resolve to the correct entity type. Do not use a source-book UUID where a canonical resource ID is required.

Priorities are explicit. A more specific/higher-priority compatible template can replace the structural draft. Assignment decisions use the slot's source order, then assignment priority and condition specificity. Equal winning assignments/rules produce diagnostics. Proper-of-saints assignments must name the selected observance or an explicitly chosen commemoration; commons must name the selected common. Commemorations require a matching template. Complementary daytime psalmody is explicit. A local scope only participates when selected by the profile.

Date rules include fixed dates, Easter/Advent offsets, Sunday within Christmas, Baptism, nth/last weekday, Sunday after a date, and an exact date. A transfer is an explicit rule for a solemnity with direction and bounded search; do not encode a change of one year's date by overwriting the canonical text. All thirteen precedence classes are retained. A profile's \`reviewed\` coverage requires approved status and a valid reviewed interval. The baseline is a limited calendar and structural templates, not a complete approved corpus.

## 7. Provenance, validation, history and limits

Every import is validated as a complete final graph before writes. Missing and wrong-type references, duplicate IDs, two psalms for the same work/edition, language mismatch, verse problems, invalid ranges, undocumented omissions, duplicate slots, invalid dates, replacement cycles and invalid review intervals block the entire operation. Text marked approved must be complete and have source provenance. A complete psalm declares its verse count and supplies every numbered verse. License metadata and explicit private/print/share permissions belong to the edition; private-only editions cannot be imported into a public area by this workflow.

The importer rechecks the store state before committing, then sends creates, replacements, patches, deletes and resets with one audit receipt through the existing atomic Library batch API. A failure writes nothing. The receipt records each action, canonical ID, storage versions and checksum. Deletions retain backend version history but are not resurrected automatically by this format. Back up the full exported JSON before a broad cleanup.

A whole-collection document may carry up to 50,000 entities; unchanged entities do not consume write operations. The existing storage API permits 5,000 operations per transaction, so a liturgical import allows at most 4,999 changed/deleted entities plus its receipt. The UI file limit is 16 MiB; encrypted entry/batch byte limits also apply. These are explicit errors, never silent truncation. For a larger initial corpus or maintenance job, prepare multiple dependency-safe transactions from the full graph (works/editions/texts before their assignments; reassign dependants before removing old targets). Do not present a single page or a partial export as a complete backup.

There is no implicit machine approval, arbitrary code execution, network fetch of copyrighted texts, or direct MCP mutation endpoint. JSON describes stored data and explicit changes. Once imported, resources, usage links, calendars, composition, printing and Cogita source projections all use the revised canonical data.
`;
type JsonShape = { type?: string | string[]; enum?: unknown[]; const?: unknown; default?: unknown; description?: string; properties?: Record<string, JsonShape>; required?: string[]; items?: JsonShape; anyOf?: JsonShape[]; oneOf?: JsonShape[]; additionalProperties?: boolean | JsonShape; [key: string]: unknown };
function fields(shape: JsonShape, depth = 0): string {
  const variants = shape.anyOf ?? shape.oneOf;
  if (variants) return variants.map((v, i) => `${'  '.repeat(depth)}Variant ${i + 1}:\n${fields(v, depth + 1)}`).join('\n');
  return Object.entries(shape.properties ?? {}).map(([key, value]) => {
    const constraints = Object.entries(value).filter(([k]) => ['minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'minItems', 'maxItems', 'format'].includes(k)).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
    const type = value.const !== undefined ? JSON.stringify(value.const) : value.enum ? value.enum.map(v => JSON.stringify(v)).join(' | ') : value.type ?? (value.anyOf || value.oneOf ? 'one of' : 'value');
    const line = `${'  '.repeat(depth)}- ${key}: ${type}; ${shape.required?.includes(key) ? 'required' : 'optional'}${value.default === undefined ? '' : `; default ${JSON.stringify(value.default)}`}${constraints ? `; ${constraints}` : ''}`;
    const nested = value.items ?? value;
    const children = fields(nested, depth + 1);
    return line + (children ? `\n${children}` : '');
  }).join('\n');
}
export function liturgyDescription(): string {
  const definitions = EntitySchema.options.map(schema => {
    const shape = z.toJSONSchema(schema) as JsonShape;
    return `### ${shape.properties?.entity_type?.const}\n\n${fields(shape)}\n\nUnknown fields are rejected. Metadata is an open JSON object.`;
  });
  return `${GUIDE}\n## 8. All entity fields (generated from the implementation)\n\n${definitions.join('\n\n')}\n\n## 9. Machine-readable contract\n\nThe complete JSON Schema is available as get_import_format("liturgy-schema") and in the app's Download schema action. It also defines operations and the batch envelope. No field above grants approval or authorization.\n`;
}
export const liturgySchemaText = () => JSON.stringify(jsonSchema(), null, 2);
export const liturgyDefaultsText = () => JSON.stringify(exportEntities(BUILTINS, 'Bundled structural defaults; not a complete approved calendar or textual corpus'), null, 2);
