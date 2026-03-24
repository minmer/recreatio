# Cogita Question JSON Constraints

This document defines the JSON constraints used by Cogita for question definitions.

The same normalization rules are used for:
- question import in notion editor flow
- question creation through storyboard JSON import

All examples below use the normalized target format.

## 1. Core rules

- A question definition is an object.
- `type` is required logically (if missing/unknown, it falls back to `selection`).
- `question` should be a string (may be empty but should be provided).
- Answer indexing is 0-based.

## 2. Supported canonical types

- `selection`
- `truefalse`
- `text`
- `number`
- `date`
- `ordering`
- `matching`

## 3. Accepted aliases (auto-normalized)

- `single_select` -> `selection`
- `multi_select` -> `selection`
- `selection_single` -> `selection`
- `selection_multiple` -> `selection`
- `boolean` -> `truefalse`
- `order` -> `ordering`
- `short` -> `text`
- `open` -> `text`
- `short_text` -> `text`

## 4. Accepted wrapper shapes

Question definition can be provided as:

1. direct object:
```json
{ "type": "selection", "question": "...", "options": ["A"], "answer": [0] }
```

2. nested in payload definition:
```json
{ "definition": { "type": "selection", "question": "...", "options": ["A"], "answer": [0] } }
```

3. `definition` as JSON string:
```json
{ "definition": "{\"type\":\"selection\",\"question\":\"...\",\"options\":[\"A\"],\"answer\":[0]}" }
```

4. from `questionTypes[]` (object or JSON string); first valid entry is used.

## 5. Type-specific constraints

## 5.1 Selection

Required:
- `options: string[]` (fallback from `answers`)
- `answer: number[]` (fallback from `correct`)

Also supported:
- `correctAnswers: string[]` (mapped to option indices by exact trimmed text, case-insensitive)

Normalization:
- invalid indices are removed
- duplicates are removed
- for single-select aliases, only the first valid answer is kept

Example:
```json
{
  "type": "selection",
  "question": "Who was the first king of Israel?",
  "options": ["Samuel", "Saul", "David", "Solomon"],
  "answer": [1]
}
```

## 5.2 True/False

Required:
- `answer: boolean` (fallback from `expected`)

If missing/unreadable: defaults to `true`.

Example:
```json
{
  "type": "truefalse",
  "question": "Israel asked for a king to be like other nations.",
  "answer": true
}
```

## 5.3 Text (short/open answer)

Required:
- `answer: string` (fallback from `expected`)

Aliases `short`, `open`, `short_text` normalize to this type.

Example:
```json
{
  "type": "text",
  "question": "Name the Philistine deity from the Ark narrative.",
  "answer": "Dagon"
}
```

## 5.4 Number

Required:
- `answer` as number or string (fallback from `expected`)

If missing: empty string is used.

Example:
```json
{
  "type": "number",
  "question": "How many books are in the Pentateuch?",
  "answer": 5
}
```

## 5.5 Date

Required:
- `answer: string` (fallback from `expected`)

Example:
```json
{
  "type": "date",
  "question": "When did the event happen?",
  "answer": "2026-03-24"
}
```

## 5.6 Ordering

Required:
- `options: string[]` (fallback from `items`)

Normalization:
- `answer` is removed (ordering truth is canonical order of `options`).

Example:
```json
{
  "type": "ordering",
  "question": "Arrange in sequence.",
  "options": ["Step 1", "Step 2", "Step 3"]
}
```

## 5.7 Matching

Required:
- `columns: string[][]` (fallback from `left` + `right`)
- `answer.paths: number[][]` (fallback from `correctPairs`)

Rules:
- at least 2 columns are required (if fewer, fallback columns are created)
- each path must have exactly `columns.length` entries
- each path index must be within the target column range
- duplicate paths are removed

Supports:
- 2+ columns
- many-to-many mappings
- reused nodes across paths

Example:
```json
{
  "type": "matching",
  "question": "Create all correct connections.",
  "columns": [
    ["Saul", "David"],
    ["Pride", "Humble trust"],
    ["Brought low", "Exalted"]
  ],
  "answer": {
    "paths": [
      [0, 0, 0],
      [1, 1, 1]
    ]
  }
}
```

## 6. Validation guidance

- `selection`: non-empty `options`, `answer` indices valid for `options`.
- `truefalse`: `answer` boolean.
- `text`: `answer` string.
- `number`: `answer` number or numeric string.
- `date`: `answer` string in expected app format.
- `ordering`: non-empty `options`.
- `matching`: `columns.length >= 2`; all path widths match and indices are valid.

## 7. Important compatibility note

For highest compatibility with runtime and checkcards:
- use canonical `type` values from section 2
- for short-answer questions, prefer `text` (not `short`) even though aliases are accepted.
