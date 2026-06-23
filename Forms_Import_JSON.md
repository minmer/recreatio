# Forms_Import_JSON.md

## Overview

The **Formularze** module allows an admin to import a fully prepared form — including all questions — by pasting a single JSON document. This is faster than building a form question by question through the UI, and makes it easy to prepare forms in a text editor or version-control them.

The import is available in the admin panel under **Importuj JSON** on the forms list screen. After a successful import the form is created as a **draft** (not yet published) and the editor opens immediately so you can review and adjust before publishing.

---

## 1. Top-level structure

```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "questions": [ ...array of question objects... ]
}
```

| Field | Type | Required | Max length | Notes |
|---|---|---|---|---|
| `title` | string | yes | 200 chars | Name of the form shown to respondents |
| `description` | string | no | 800 chars | Subtitle / instructions shown below the title |
| `questions` | array | no | — | Can be empty; questions can be added later in the editor |

---

## 2. Question object

Each element of the `questions` array must be an object with the following fields:

```json
{
  "text": "string (required)",
  "type": "text | multiselect | scale",
  "options": ["string", ...],
  "isRequired": true | false,
  "conditionQuestionIndex": null | integer,
  "conditionValue": null | "string"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `text` | string | yes | The question label shown to the respondent. Max 600 chars. |
| `type` | string | yes | One of the three supported types (see section 3). |
| `options` | string array | only for `multiselect` | List of selectable answers. Ignored for `text` and `scale`. |
| `isRequired` | boolean | no | Defaults to `false` if omitted. When `true` the respondent must answer before submitting. |
| `conditionQuestionIndex` | integer or null | no | 0-based index of a **preceding** question in this array. When set, this question is only shown if that question has the answer specified in `conditionValue`. |
| `conditionValue` | string or null | required when index set | The expected answer value. For `scale` questions use a string like `"3"`; for `multiselect` use one of the option strings. |

Questions are created in the **order they appear** in the array. SortOrder is assigned 0, 1, 2, … automatically.

---

## 3. Question types

### 3.1 `text` — free-text answer

The respondent types an answer in a multi-line text box. Use this for open-ended questions.

```json
{
  "text": "Co chciałbyś zmienić na następnej edycji?",
  "type": "text",
  "isRequired": false
}
```

The `options` field is ignored when `type` is `text`. Text questions **cannot** be used as a condition source for other questions (only `scale` and `multiselect` can).

---

### 3.2 `multiselect` — multiple choice (checkboxes)

The respondent can tick any number of the provided options. The `options` array is **required** and must contain at least one non-empty string.

```json
{
  "text": "Które warsztaty Cię interesują?",
  "type": "multiselect",
  "options": ["Muzyka liturgiczna", "Śpiew gregoriański", "Organy", "Dyrygowanie"],
  "isRequired": true
}
```

Constraints:
- Each option is a plain string (no HTML).
- Duplicate values in `options` are allowed but discouraged.
- There is no upper limit on the number of options, but keep the list readable.

---

### 3.3 `scale` — numeric scale 1–5

The respondent picks a single value from 1 (lowest) to 5 (highest) by clicking a button. Use this for satisfaction or agreement ratings.

```json
{
  "text": "Oceń poziom organizacji wydarzenia (1 = bardzo słaby, 5 = doskonały)",
  "type": "scale",
  "isRequired": true
}
```

The `options` field is ignored when `type` is `scale`.

---

## 4. Conditional questions

A question can be made **conditional** — shown only when a preceding question has a specific answer.

Set `conditionQuestionIndex` to the 0-based array index of the trigger question, and `conditionValue` to the expected answer:

- For a `scale` trigger: `conditionValue` is a string like `"1"`, `"2"`, … `"5"`.
- For a `multiselect` trigger: `conditionValue` is one of the option strings (exact match).

**Rules:**
- `conditionQuestionIndex` must be less than the current question's index (can only reference preceding questions).
- If `conditionQuestionIndex` is set, `conditionValue` is required.
- Only `scale` and `multiselect` questions can be used as triggers.
- Conditions can be chained: if Q3 depends on Q2 and Q2 is hidden, Q3 is also hidden.

**Example — follow-up on a low rating:**

```json
[
  {
    "text": "Oceń organizację logistyczną (1 = bardzo słaba, 5 = doskonała)",
    "type": "scale",
    "isRequired": true
  },
  {
    "text": "Co poszło nie tak z organizacją?",
    "type": "text",
    "isRequired": false,
    "conditionQuestionIndex": 0,
    "conditionValue": "1"
  }
]
```

The second question only appears when the respondent selected 1 on the scale.

---

## 5. Full example

```json
{
  "title": "Ankieta po rekolekcjach 2026",
  "description": "Twoje odpowiedzi są anonimowe i pomogą nam lepiej przygotować kolejną edycję.",
  "questions": [
    {
      "text": "Skąd dowiedziałeś się o rekolekcjach?",
      "type": "multiselect",
      "options": ["Od znajomego", "Media społecznościowe", "Plakat / ogłoszenie", "Strona internetowa", "Inne"],
      "isRequired": true
    },
    {
      "text": "Oceń ogólną atmosferę rekolekcji (1 = bardzo słaba, 5 = doskonała)",
      "type": "scale",
      "isRequired": true
    },
    {
      "text": "Co sprawiło, że atmosfera była słaba?",
      "type": "text",
      "isRequired": false,
      "conditionQuestionIndex": 1,
      "conditionValue": "1"
    },
    {
      "text": "Oceń poziom konferencji (1 = bardzo słaby, 5 = doskonały)",
      "type": "scale",
      "isRequired": true
    },
    {
      "text": "Oceń organizację logistyczną (noclegi, posiłki, harmonogram)",
      "type": "scale",
      "isRequired": false
    },
    {
      "text": "Które elementy programu były dla Ciebie najcenniejsze?",
      "type": "multiselect",
      "options": ["Konferencje", "Adoracja", "Msza Święta", "Czas wolny", "Praca w grupach", "Warsztaty"],
      "isRequired": false
    },
    {
      "text": "Co chciałbyś zmienić lub dodać na kolejnej edycji?",
      "type": "text",
      "isRequired": false
    },
    {
      "text": "Czy poleciłbyś te rekolekcje znajomemu?",
      "type": "scale",
      "isRequired": true
    }
  ]
}
```

Questions 0, 1, 3, 4, 5, 6, 7 are always shown. Question 2 (follow-up on atmosphere) only appears when the respondent selects 1 for question 1.

---

## 6. Validation rules

The following checks are performed before the form is created. If any check fails the import is rejected with an error message.

| Rule | Detail |
|---|---|
| `title` must be present | An empty or whitespace-only title is rejected. |
| `type` must be valid | Any value other than `text`, `multiselect`, or `scale` causes an error. |
| `text` must be present on every question | An empty or whitespace-only question text is rejected. |
| `options` for `multiselect` | The backend stores whatever strings are provided; empty strings in the array are silently ignored. |
| `conditionQuestionIndex` range | Must be a non-negative integer less than the current question's index in the array. |
| `conditionValue` when index is set | Must be a non-empty string. |

Client-side validation (in the browser) mirrors these rules and gives immediate feedback before the request is sent to the server.

---

## 7. After import

- The form is created as a **draft** (`isPublished: false`). Respondents cannot fill it until it is published.
- A unique **fill token** is generated automatically. The shareable link is displayed in the editor.
- All questions can be edited, reordered, or deleted in the editor before publishing.
- Conditions can be modified or removed in the question editor after import.
- To publish, click **Opublikuj** in the editor header.
