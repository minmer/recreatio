# Cogita Storyboard JSON Import Constraints

This document describes how to prepare JSON for storyboard import in Cogita.

Endpoint (authenticated):
- `POST /cogita/libraries/{libraryId}/storyboard-imports`

Request wrapper:
```json
{
  "projectId": "optional-guid",
  "name": "optional project name",
  "json": { "... storyboard payload ..." }
}
```

The `json` object is described below.

## 1. Accepted top-level shapes

## 1.1 Full import envelope (recommended)
```json
{
  "schema": "cogita_storyboard_import",
  "version": 1,
  "project": {
    "projectId": "optional-guid",
    "name": "optional name",
    "description": "optional description"
  },
  "notions": [ ... ],
  "storyboard": { ... }
}
```

## 1.2 Nested storyboard without envelope
```json
{
  "projectId": "optional-guid",
  "name": "optional name",
  "storyboard": { ... }
}
```

## 1.3 Direct storyboard graph object
```json
{
  "schema": "cogita_storyboard_graph",
  "version": 2,
  "description": "...",
  "rootGraph": { ... }
}
```

Also supported:
- legacy graph where `nodes`/`edges` are directly under `storyboard` (without `rootGraph`)

## 2. Project routing behavior

- If `projectId` is given (in request or JSON), importer updates that project.
- If no `projectId` is provided, importer creates a new storyboard project.
- Name resolution order:
  1) request `name`
  2) `json.project.name`
  3) `json.name`
  4) auto-generated import name

## 3. Notion import block (`notions`)

You can create or reuse notions before graph parsing.

Each notion item:
```json
{
  "ref": "local-reference-key",
  "notionId": "optional-existing-guid",
  "infoType": "question",
  "payload": { ... },
  "links": { ... optional ... }
}
```

Rules:
- if `notionId` is provided, importer reuses existing notion (must belong to the same library)
- otherwise `infoType` + `payload` are required to create a notion
- `ref` can be used later by card nodes via `notionRef`
- `infoType` must be a supported Cogita info type for the environment

Important:
- question notion payload normalization uses the same rules as:
  - `COGITA_QUESTION_JSON_CONSTRAINTS.md`
- if a free-input question already contains multiple accepted answers, importer should preserve all of them
- importer must not silently drop alternate accepted answers when they are present
- from the importer perspective, all provided accepted answers are equally valid
- importer does not need to explain or reinterpret why those answers are equivalent; it only preserves the authored question data

## 4. Storyboard document structure

```json
{
  "schema": "cogita_storyboard_graph",
  "version": 2,
  "description": "optional",
  "script": "optional",
  "steps": ["optional", "optional"],
  "rootGraph": { ... }
}
```

If `steps`/`script` are missing, importer can generate them from graph content.

## 5. Graph format

```json
{
  "startNodeId": "optional-start-id",
  "endNodeId": "optional-end-id",
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

## 6. Node constraints

Common node fields:
- `nodeId` (or `id`) optional; auto-generated if missing
- `title` (or `name`) optional
- `kind` (or `nodeType`) -> normalized node kind
- `description` optional
- `position: { "x": number, "y": number }` optional

Kind normalization:
- `start` -> `start`
- `end` -> `end`
- `card` -> `card`
- `group` -> `group`
- `text`/`video`/`audio`/`image`/`revision`/unknown -> `static`

## 6.1 Static node fields

- `staticType` (`text` | `video` | `audio` | `image` | `other`)
- `staticBody` (aliases: `text`, `body`)
- `mediaUrl` (aliases: `videoUrl`, `url`)

Narration media (encrypted data item references):
- `narrationImageEnabled: boolean`
- `narrationImageFileId: string` (DataItemId GUID)
- `narrationAudioEnabled: boolean`
- `narrationAudioFileId: string` (DataItemId GUID)

Alternative nested narration object is supported:
```json
"narration": {
  "imageEnabled": true,
  "imageFileId": "guid",
  "audioEnabled": true,
  "audioFileId": "guid"
}
```

## 6.2 Card node fields

- `notionId` (GUID) optional
- `notionRef` (or `ref`) optional
- `notion` inline notion object optional
- `cardCheckType` (alias: `checkType`) optional
- `cardDirection`: `front_to_back` or `back_to_front` (default `front_to_back`)

Notion resolution order for card:
1) valid `notionId`
2) `notionRef` mapped from imported `notions`
3) inline `notion` object creation

If notion is unresolved, warning is returned.

## 6.3 Group node fields

- `groupGraph` optional nested graph (same schema recursively)

## 7. Edge constraints

Edge fields:
- `edgeId` (or `id`) optional
- `fromNodeId` (or `source`) required
- `toNodeId` (or `target`) required
- `sourcePort` (or `sourceHandle`) optional
- `targetPort` (or `targetHandle`) optional
- `kind` optional
- `label` (aliases: `buttonLabel`, `edgeLabel`) optional
- `displayMode`: `new_screen` or `expand` (default `new_screen`)

Port normalization:
- source: `out-path` | `out-right` | `out-wrong`
- target: `in-path` | `in-dependency`

Derived edge kind:
- `in-dependency` -> `dependency`
- `out-right` -> `card_right`
- `out-wrong` -> `card_wrong`
- otherwise `path`

## 8. Import normalization and cleanup behavior

Importer automatically:
- removes duplicate `nodeId`
- ensures exactly one start and one end node (creates if missing)
- removes edges that reference missing nodes
- removes self-loop edges
- blocks incoming edges to start and outgoing edges from end
- removes duplicate edges by `(from,sourcePort,to,targetPort)`
- creates default start->end path edge if no valid edges remain

For question notions on card nodes:
- card check type is normalized to `question` when necessary
- question definitions should remain structurally minimal
- explanation text should remain in static nodes, not be reintroduced into the question definition during import

## 9. Multiple accepted answers in input mode

If a free-input question is authored with more than one accepted answer, importer should preserve all of them.

Rules:
- importer should keep every provided accepted answer
- importer should not choose a preferred answer among them
- importer should not silently collapse the list to one value
- from the importer's perspective, all provided accepted answers are equally correct
- importer does not need to document or understand why the answers are equivalent

Example:
```json
{
  "type": "text",
  "question": "Write the fraction equivalent of 25%.",
  "answer": "1/4",
  "acceptedAnswers": ["1/4", "¼", "25/100"]
}
```

## 10. Warnings and partial success

Import is tolerant:
- invalid fragments are skipped/normalized where possible
- warnings are returned in response
- project is still created/updated when remaining graph is valid

Recommended warning cases:
- explanation text is found in a question definition instead of static nodes
- a malformed multiple-answer field is present but cannot be preserved safely

## 11. Minimal working example

```json
{
  "schema": "cogita_storyboard_import",
  "version": 1,
  "project": {
    "name": "Example storyboard"
  },
  "notions": [
    {
      "ref": "q1",
      "infoType": "question",
      "payload": {
        "label": "Question 1",
        "definition": {
          "type": "text",
          "question": "Write the fraction equivalent of 25%.",
          "answer": "1/4",
          "acceptedAnswers": ["1/4", "¼", "25/100"]
        }
      }
    }
  ],
  "storyboard": {
    "schema": "cogita_storyboard_graph",
    "version": 2,
    "description": "Simple flow",
    "rootGraph": {
      "startNodeId": "start-1",
      "endNodeId": "end-1",
      "nodes": [
        { "nodeId": "start-1", "kind": "start", "title": "Start", "position": { "x": 80, "y": 200 } },
        {
          "nodeId": "s1",
          "kind": "static",
          "title": "Narration",
          "staticType": "text",
          "staticBody": "Read this first.",
          "position": { "x": 300, "y": 200 }
        },
        {
          "nodeId": "c1",
          "kind": "card",
          "title": "Question card",
          "notionRef": "q1",
          "cardCheckType": "question",
          "cardDirection": "front_to_back",
          "position": { "x": 540, "y": 200 }
        },
        { "nodeId": "end-1", "kind": "end", "title": "End", "position": { "x": 780, "y": 200 } }
      ],
      "edges": [
        { "edgeId": "e1", "fromNodeId": "start-1", "toNodeId": "s1", "displayMode": "new_screen" },
        { "edgeId": "e2", "fromNodeId": "s1", "toNodeId": "c1", "displayMode": "new_screen" },
        { "edgeId": "e3", "fromNodeId": "c1", "toNodeId": "end-1", "sourcePort": "out-right", "kind": "card_right", "displayMode": "new_screen" }
      ]
    }
  }
}
```
