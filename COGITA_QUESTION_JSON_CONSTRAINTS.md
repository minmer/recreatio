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
- Question payloads must contain only the question and answer structure needed for checking.
- Explanations, teaching text, and narrative context do **not** belong in question definitions.
- If more than one learner input should be considered correct, **all valid answer forms must be explicitly listed**. Do not assume the runtime will infer equivalence between formats.
- If the requested response is only a year, the question must ask only for a year, not for a full date.

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

## 5. Cross-type answer normalization

### 5.1 Accepted answer variants

For free-input question types (`text`, `number`, `date`), the normalized definition may include:

- `answer`: the primary canonical correct answer
- `acceptedAnswers`: array of all additional valid answer forms

Supported fallback aliases for `acceptedAnswers`:
- `answers`
- `accepted`
- `acceptedVariants`
- `aliases`
- `alternatives`

Normalization rules:
- `acceptedAnswers` is optional but strongly recommended whenever more than one input form is valid.
- If `acceptedAnswers` is missing, importer/runtime may derive `[answer]` as the only accepted form.
- Duplicate variants are removed after trimming.
- Empty variants are removed.
- The first valid entry becomes canonical `answer` if `answer` is missing.
- Authors should include every intended equivalent form explicitly, e.g. `"25%"`, `"25 percent"`, `"0.25"`, `"1/4"`.
- Do **not** assume that `25%`, `25`, `0.25`, and `1/4` will be treated as equivalent unless each form is explicitly listed and intended by the question.

### 5.2 Year-only rule

If the learner is expected to provide only a year:
- the prompt must ask for a year only,
- the stored answer should represent only the year,
- authors should prefer `number` for year-only input unless the project explicitly supports `date` with `precision: "year"`.

Correct:
```json
{ "type": "number", "question": "In what year was the isotope concept named?", "answer": 1913 }
```

Also acceptable when date precision is supported:
```json
{ "type": "date", "question": "In what year was the isotope concept named?", "answer": "1913", "precision": "year" }
```

Incorrect:
```json
{ "type": "date", "question": "In what year was the isotope concept named?", "answer": "1913-01-01" }
```

## 6. Type-specific constraints

## 6.1 Selection

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

## 6.2 True/False

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

## 6.3 Text (short/open answer)

Required:
- `answer: string` (fallback from `expected`)

Optional:
- `acceptedAnswers: string[]`

Aliases `short`, `open`, `short_text` normalize to this type.

Recommended usage:
- use when the expected response is a word, phrase, symbol, or several explicitly accepted textual forms,
- list all valid variants if spelling, notation, symbols, abbreviations, or equivalent forms may differ.

Example:
```json
{
  "type": "text",
  "question": "Write the fraction equivalent of 25%.",
  "answer": "1/4",
  "acceptedAnswers": ["1/4", "¼"]
}
```

## 6.4 Number

Required:
- `answer` as number or numeric string (fallback from `expected`)

Optional:
- `acceptedAnswers: (number|string)[]`

If missing: empty string is used.

Recommended usage:
- use for counts, quantities, and year-only answers,
- if multiple numeric surface forms are intentionally valid, include them explicitly.

Example:
```json
{
  "type": "number",
  "question": "In what year did the event happen?",
  "answer": 1949,
  "acceptedAnswers": [1949, "1949"]
}
```

## 6.5 Date

Required:
- `answer: string` (fallback from `expected`)

Optional:
- `acceptedAnswers: string[]`
- `precision: "year" | "month" | "day"`

Normalization:
- if `precision` is missing, default precision is `day`
- when `precision` is `year`, `answer` should be in `YYYY` form
- when `precision` is `month`, `answer` should be in `YYYY-MM` form
- when `precision` is `day`, `answer` should be in `YYYY-MM-DD` form

Recommended usage:
- use only when calendar precision matters,
- for year-only questions, prefer `number` unless the environment explicitly wants `date` with `precision: "year"`.

Example:
```json
{
  "type": "date",
  "question": "In what year was the event formalized?",
  "answer": "1913",
  "precision": "year",
  "acceptedAnswers": ["1913"]
}
```

## 6.6 Ordering

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

## 6.7 Matching

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

## 7. Validation guidance

- `selection`: non-empty `options`, `answer` indices valid for `options`.
- `truefalse`: `answer` boolean.
- `text`: `answer` string; if multiple correct forms are allowed, all should appear in `acceptedAnswers`.
- `number`: `answer` number or numeric string; if multiple surface forms are accepted, all should appear in `acceptedAnswers`.
- `date`: `answer` string in the expected app format for the declared `precision`.
- `ordering`: non-empty `options`.
- `matching`: `columns.length >= 2`; all path widths match and indices are valid.

## 8. Important compatibility note

For highest compatibility with runtime and checkcards:
- use canonical `type` values from section 2,
- for short-answer questions, prefer `text` (not `short`) even though aliases are accepted,
- for year-only questions, prefer `number` unless `date` with `precision: "year"` is explicitly supported end-to-end,
- if the runtime cannot truly accept multiple free-input variants, rewrite the question to require one exact format or convert it into `selection`.
