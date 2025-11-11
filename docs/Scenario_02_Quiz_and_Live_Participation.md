# Scenario 02 – Quiz and Live Participation

> This document specifies the **business flow, data model and security / key model** for quizzes and live participation in ReCreatio.

We focus on:

- teacher‑driven quizzes,
- live participation with immediate feedback,
- anonymous and logged‑in participants,
- QR / link based access to personal results,
- aggregation and visualisation (time vs correctness).

---

## 1. Domain Overview

### 1.1 Actors

- **Teacher** – creates quizzes, starts live sessions, sees full results.
- **Student (logged in)** – participates with a user account, results are linked to their profile.
- **Participant (anonymous)** – participates without account, results are accessible via QR / link.
- **Organisation / Class** – groups of students, used for scoping quizzes.

### 1.2 Core Objects

- **Quiz**
  - metadata (title, subject, difficulty),
  - questions (static or generated),
  - configuration (time limits, scoring).

- **Question**
  - text and possible answers,
  - correct answer(s),
  - optionally parameters for random generation.

- **Live Session**
  - bound to a specific Quiz,
  - start and end time,
  - optional group (class).

- **Answer**
  - reference to Live Session and Question,
  - participant identifier (user id or anonymous token),
  - answer content,
  - response time,
  - correctness flag.

---

## 2. Data Model (Logical)

```text
Quiz(Id, OwnerTeacherRoleId, Title, ConfigJsonEnc, ...)
Question(Id, QuizId, TemplateJsonEnc, IsGenerated, ...)
LiveSession(Id, QuizId, ClassRoleId?, StartedAt, FinishedAt?, ...)
Answer(Id, LiveSessionId, QuestionId, ParticipantKey, AnswerEnc, ResponseTimeMs, IsCorrectEnc, ...)
ParticipantView(Id, LiveSessionId, ParticipantKey, SharedViewId?, ...)
```

- `ConfigJsonEnc`, `TemplateJsonEnc`, `AnswerEnc`, `IsCorrectEnc` are **encrypted**.
- `ParticipantKey` is a stable identifier **within a session** (not necessarily a user id).
- `ParticipantView` ties a participant in a session to a **SharedView** for QR / link access.

---

## 3. Security & Key Model for Scenario 02

### 3.1 Roles

For each organisation / class:

- `TeacherRole` – represents a specific teacher.
- `ClassRole` – represents a specific class or group.
- `TeacherAdminRole` – can administer quizzes for a teacher or school.

Roles for quizzes:

- `QuizOwnerRole` – technical role owning quiz configuration and questions.
- `QuizSessionRole` – technical role for a specific Live Session.

### 3.2 DataKeys

Typical DataKeys:

- `DK_QuizConfig` – encrypts quiz-level configuration (`ConfigJsonEnc`).
- `DK_QuestionTemplate` – encrypts question templates (`TemplateJsonEnc`).
- `DK_Answer` – encrypts answers and correctness (`AnswerEnc`, `IsCorrectEnc`).
- `DK_Analytics` – optional, encrypts aggregated analytics tables (if stored).

Ownership and access:

- All quiz-related DataKeys belong to the teacher’s organisation and are reachable from:
  - `TeacherRole` for the owner,
  - `TeacherAdminRole` as needed,
  - possibly `ClassRole` for restricted result views.

Students / participants **do not** get direct access to these DataKeys. They access their slice of data via **SharedViews**.

### 3.3 Generated Questions

Some questions are generated at runtime by choosing random parameters from allowed sets.

- The template is stored in `TemplateJsonEnc` and decrypted for the teacher.
- For students:
  - the server generates concrete instantiations,
  - the concrete question text is sent in clear for the session,
  - the correct answer is kept secret and verified server-side.

No additional cryptography is required beyond standard DataKeys.

---

## 4. Live Participation Flow

### 4.1 Starting a Live Session

1. Teacher logs in and selects a quiz.
2. Frontend sends “start session” request.
3. Backend:
   - verifies teacher’s role and access to this quiz,
   - creates `LiveSession` record,
   - creates a `QuizSessionRole` with its own RoleKey,
   - ensures that:
     - `QuizSessionRole` can decrypt `DK_Answer`,
     - teacher’s roles can decrypt both `DK_Answer` and `DK_QuizConfig`.
4. Backend generates a **session join code / link** and a general QR to join the live session.

### 4.2 Joining as Logged-In Student

1. Student logs in normally (multi-hash, MasterKey, etc.).
2. Student enters the session code or scans QR.
3. Backend:
   - verifies that student belongs to the relevant `ClassRole` (if required),
   - creates a `ParticipantKey` unique within this session,
   - creates a `ParticipantView` record that:
     - binds `ParticipantKey` to Student’s MasterRole,
     - optionally creates a SharedView (see 5) for personal results.

All answers submitted by this student use the same `ParticipantKey`.

### 4.3 Joining as Anonymous Participant

1. Participant scans the **session QR**.
2. Backend:
   - creates a random `ParticipantKey`,
   - creates a **SharedView** specific to this participant + session:
     - view scope: “answers with this ParticipantKey in session S”,
     - defines a view role and `ViewRoleKey`,
     - derives `SharedViewKey` from QR/link secret,
     - stores `EncViewRoleKey = Enc(ViewRoleKey, SharedViewKey)`,
   - creates `ParticipantView` linking `ParticipantKey` and `SharedViewId`.

Participant never needs an account to submit answers.

---

## 5. SharedViews for Quiz Results

### 5.1 What Anonymous Participants See

When an anonymous participant scans **their personal result QR**:

1. Client sends the QR secret to the backend.
2. Backend:
   - reconstructs `SharedViewKey`,
   - decrypts `EncViewRoleKey` to get `ViewRoleKey`,
   - uses `ViewRoleKey` to decrypt only answers in the view scope (this participant in this session).
3. Backend returns:
   - questions text (non-sensitive),
   - whether each answer was correct,
   - overall score,
   - optionally a time vs correctness graph.

The participant cannot see any data belonging to other people.

### 5.2 Attaching SharedView to a Logged-In Account

If the same participant later creates or logs into an account:

1. While logged in, they use the same QR/result link.
2. Backend recognises that:
   - the QR secret corresponds to an existing SharedView,
   - the user is authenticated.
3. Backend:
   - creates membership between user’s MasterRole and the view role of this SharedView,
   - stores this in **Key Ledger** and **Business Ledger**.
4. From now on, the user can open their results from the account **without QR**.

This behaviour is identical to Scenario 01 (intentions and offerings) at the cryptographic level.

---

## 6. Time vs Correctness Analytics

### 6.1 Required Data

For each answer:

- `ResponseTimeMs` (plain or lightly obfuscated),
- `IsCorrectEnc` decrypted using `DK_Answer` for analytics.

The analytics service:

1. Runs under teacher’s roles, with access to `DK_Answer` (and `DK_Analytics` if used).
2. Loads answers for:
   - single question,
   - group of questions,
   - whole quiz.
3. Computes aggregated structures such as:
   - histogram `ResponseTimeMs` vs `% correct`,
   - per-student evolution over time.

### 6.2 Storage of Aggregates

Aggregated metrics (not tied to individual participants) may be stored as:

- plain values (if sufficiently anonymised),
- or encrypted with `DK_Analytics` if the results themselves are sensitive.

Because aggregation is done on the server side, this does not require new keys – only read access to the existing question/answer DataKeys.

---

## 7. Frontend / API Interaction (High Level)

### 7.1 Answer Submission

For each question:

1. Client sends answer and current local timestamp.
2. Backend records:
   - `AnswerEnc` encrypted with `DK_Answer`,
   - `IsCorrectEnc` derived server‑side (correct / wrong),
   - `ResponseTimeMs` (clear or derived from timestamps).

Immediate feedback:

- backend can return “correct / incorrect” without exposing the correct answer,
- frontend can update UI (colours, messages, etc.).

### 7.2 Live Teacher View

Teacher’s live view shows:

- number of participants who answered each question,
- distribution of correctness and times,
- potentially per‑participant details (depending on settings).

Backend for this view:

- works under teacher’s RoleKeys,
- uses decrypted values from `DK_Answer`,
- never exposes raw keys to the client.

---

## 8. Ledgers and Auditability

For this scenario:

- **Auth Ledger**
  - teacher logins and logout,
  - student logins,
  - mode switches (Normal / Secure).

- **Key Ledger**
  - creation of DataKeys for quizzes,
  - creation of QuizOwnerRole and QuizSessionRole RoleKeys,
  - creation of SharedViews for participants,
  - rotations if ownership changes.

- **Business Ledger**
  - `QuizCreated`, `LiveSessionStarted`, `LiveSessionFinished`,
  - `AnswerSubmitted` (optionally aggregated),
  - `SharedViewCreated`, `SharedViewUsed`, `SharedViewAttachedToUser`.

This allows reconstructing the history of quiz sessions and access to results.

---

## 9. Summary

Scenario 02 uses the same foundation as Scenario 01:

- teachers and organisations are roles with RoleKeys,
- quiz data is encrypted with DataKeys,
- participants (especially anonymous) access only their slice via SharedViews with wrapped role keys,
- time vs correctness analytics are computed server‑side using authorised keys,
- all security relevant events are written to Auth, Key and Business ledgers.

No additional cryptographic primitives are needed; the scenario is a concrete instance of the generic roles-and-keys design.
