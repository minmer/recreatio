# Appointment schemes, liturgy and mass plans

*Design for decision, 2026-10-26. Nothing here is built. Each decision ends with a line **Your decision:** — fill it
in (or choose on the decision page) and the build plan follows from it.*

## 1. What is asked

Appointments should have a small generic core. Everything else — what makes an appointment a mass, an intention,
a confirmation meeting — should be a **scheme** added on top, defined as data and not hard-coded. Examples:

- a **mass** with **intentions**: single or collective, with its own fields;
- **people attached to an appointment**: confirmation candidates choose an appointment, say whether they come,
  take a function;
- the **liturgy of the day**: feast, rank, colour, season; feasts tied to a date, to a Sunday of the liturgical year,
  to Easter; masses tied to an hour (Wednesday evening = Matka Boża Nieustającej Pomocy when there is no feast, with
  its own colour, while the morning mass that day follows the day);
- a **rule drawn as a graph (React Flow)** that creates the masses for the next weeks: which masses exist, what each
  one is, which colour, and fixed parts — e.g. every Sunday 12:13 the intention *za parafian*;
- the rule differs a little **per diocese**;
- **which scheme fields exist in which area**, and who may read them.

## 2. What exists today

| piece | today | hard-coded where |
|---|---|---|
| core | `calendar_item`: time, repeat rule, calendar, `visibility_area_id`, sealed fields title/location/notes/link (`calendar_field`, each sealed under the key of an area), program parent (0070), pinned people with a duty (0058) | — |
| kind | `kind` ∈ appointment, task, mass, confession, visit, devotion (`ck_item_kind`); calendar `item_kind` | C# checks, `LITURGY`, editor chips |
| public title | `title_public` only for mass/confession/devotion (shown in the gablota without a key) | `isLiturgy` |
| intentions | `mass_intention` (+ `mass_intention_field`): per (item, occurrence), `kind` single/collective, `status` accepted/cancelled/celebrated, public text, celebrant, sealed fields | `Mass.Intentions.cs` ("Tylko msza ma intencje"), handover "ten i następne" |
| booking | `item_slot` + `claim` (0029, 0057): capacity, approval, who may book | resources and calendars |
| candidates | form steps of kind `task` (0098/0099): dates from a calendar, będę / nie wiem / nie będę, functions with capacity | form steps |
| liturgy | nothing: no feasts, no colours, no seasons | — |
| own types elsewhere | Cogita kinds (`cogita/schema.ts`: `KindDef`, `FieldDef` with types, choices, refs, units), Scriptorium text types, form questions | — |
| rule graphs | React Flow already used: page logic, form logic, form map, Cogita flows, dependency maps | — |

So three things already are "records hung on one occurrence": intentions, claims, attendance. They were built three
times. That is the strongest argument for a generic layer.

## 3. The proposed shape (to be confirmed by the decisions)

```
Appointment core            time · repeat · calendar · who sees · title/place/notes/link · program · people
   └─ schemes (0..n)        defined as data, in an area, inherited by sub-areas
        ├─ fields           values on the appointment (the series) — e.g. "Rodzaj nabożeństwa"
        ├─ day fields       values per occurrence — e.g. feast, colour, readings (often filled by a rule)
        └─ record lists     records per occurrence, each with its own fields and rules:
                            Intencje (single/collective, capacity, public text),
                            Zapisy (person, będę/nie wiem/nie będę, function, capacity), Obsada …
Liturgical day              computed for every date: season, week, celebration(s), rank, colour — not stored
Plan rule (React Flow)      per calendar: day + liturgical day + slot → appointments with scheme values
```

A "mass" is then only a **scheme preset** ("Msza" = public title + liturgy day fields + record list "Intencje"),
shipped with the app and editable.

## 4. Decisions

Each decision: the question, the options, a recommendation, and what it depends on / affects.

### D1 — Where does the core end?

- **A (recommended).** Core = time, repeat, calendar, who sees, title/place/notes/link, program, pinned people,
  occurrence exceptions. Everything else is a scheme.
- **B.** Smaller core: people and program also become schemes.
- **C.** Larger core: keep `kind` and intentions in the core, schemes only for extra fields.

People and program are used by every kind of appointment and have server logic (followParent, presence). Moving them
out costs much and gains little; keeping intentions in the core (C) keeps the problem the owner wants gone.
Affects D2–D5, D12.

**Your decision:**

### D2 — How is a scheme defined and stored?

- **A (recommended).** Reuse the field model of Cogita kinds (`FieldDef`: text, number with unit, choice, date,
  bool, ref, media …) for scheme definitions. Definitions are **plain** (not sealed) rows of a new table
  `app.appointment_scheme` (JSON definition, area, version). Values are stored per field, each sealed or public
  (D7).
- **B.** Definitions sealed under the area key like Cogita kinds. The server then cannot check anything (capacity,
  single vs collective, required fields) — every rule would live only in browsers.
- **C.** A fixed list of field types in the database (columns per type).

The structure of a scheme ("an intention has a text and a kind") is not a secret; its values are. Plain definitions
let the service enforce record rules (D4). JSON export/import and a description beside it, as for every feature.
Depends on D1. Affects D3, D4, D7, D13.

**Your decision:**

### D3 — On which level does a value live?

- **A (recommended).** Three levels: **appointment** (the series — "Rodzaj"), **day** (one occurrence — feast,
  colour; stored only when it differs from what a rule or the liturgical day gives), **record** (many per
  occurrence — intentions, sign-ups).
- **B.** Only appointment and record; day values always computed, never stored.
- **C.** Only per occurrence (every value per day).

Intentions already hang on (item, occurrence); a feast is per day; "Msza niedzielna" is per series. B forbids a
manual colour change for one day; C multiplies data for series. Depends on D2. Affects D4, D9, D11.

**Your decision:**

### D4 — Record lists: one generic engine or built-in kinds?

- **A (recommended).** One generic "lista wpisów przy terminie" with parameters per scheme: fields of a record;
  how many per occurrence (or per person); a **mode field** with rules — e.g. intention kind *pojedyncza* (alone on
  the mass) / *zbiorowa* (many, with a limit per week); who may add (area role, form role 0091/0120, link, office
  only); approval; which field is public (read at the mass, shown in the gablota); what happens on cancel/move
  (follows the day, like intentions in 0079). Intentions, claims and attendance become configurations of it.
- **B.** Keep intentions, claims and attendance as built-in modules; schemes only add fields to them.
- **C.** Records are free data without server rules.

A gives the openness asked for and removes three parallel builds, but it is the largest piece and must carry every
current rule (handover "ten i następne", intention only on a mass that takes place, booking capacity). C would accept
two single intentions on one mass. Depends on D2, D3. Affects D5, D10, D14, D15.

**Your decision:**

### D5 — What happens to existing intentions and claims?

- **A (recommended).** New generic tables (`occurrence_record`, `occurrence_record_field`); a migration copies
  `mass_intention` into records of the preset "Intencje"; old endpoints answer from the new tables for one step,
  then go (the step-3 pattern of 2026-10-17). Claims/slots follow in a later phase.
- **B.** Keep `mass_intention` and `claim` as they are; the generic engine only for new record lists.
- **C.** Big switch in one migration.

B leaves two ways of doing the same thing for good. C on the one production database is the risk the owner has
avoided so far. Depends on D4. Affects the phases (§6).

**Your decision:**

### D6 — Where does the liturgical calendar come from?

- **A (recommended).** Computed in the app: Easter (computus), seasons, Sundays and weeks of the liturgical year,
  the General Roman Calendar and the Polish national proper as **data files in the repository** (date or Easter-
  relative or Sunday-relative, rank, colour, title); **diocesan and parish propers as data in an area** (patron,
  dedication, diocesan feasts), inherited by sub-areas. Precedence by the table of liturgical days (13 levels),
  with transfer rules (e.g. a solemnity on a Sunday of Lent moves).
- **B.** Only data entered by users per year.
- **C.** An outside service or feed.

A is the only one that works offline, on the public page and in the print sheet; it needs maintenance when the
calendar changes (new memorials are added every few years) — in the repository, not per parish. B means retyping
every year. C: no reliable, licensed Polish feed is known; texts of readings are copyrighted — store only references
(sigla), never texts. Affects D7, D8, D16.

**Your decision:**

### D7 — Liturgical day: stored or computed? and the mass colour

- **A (recommended).** The liturgical day is **computed, never stored**: season, week, celebrations of the day with
  rank and colour. A mass takes the day's celebration and colour **unless** its rule or a manual day value says
  otherwise (votive mass, a second celebration in the evening).
- **B.** Stored per day (a table filled by a job).

Computing keeps one truth and costs nothing; storing gives a second copy that can drift. Depends on D6. Affects D8.

**Your decision:**

### D8 — The plan rule (React Flow): what does it decide, in what order?

- **A (recommended). Two stages per calendar:**
  1. **Which masses exist** — slots: "Niedziela 7:30 · 9:00 · 10:30 · 12:13 · 18:00", "Dni powszednie 7:00, 18:00";
     exceptions by day type: holy day of obligation → Sunday slots; Triduum, Christmas Eve, All Souls → own slots.
  2. **What each mass is** — per (date, slot): a graph of condition nodes (weekday, slot, season, week, rank ≥ / <,
     celebration is, date range, "pierwszy piątek miesiąca", parish proper) leading to result nodes (formula/title,
     colour, public title, scheme values, fixed records — *za parafian* at Sunday 12:13).
  Evaluated top-down; the first matching path wins; an "inaczej" exit is required.
- **B.** One flat graph that both creates masses and decides what they are.
- **C.** No graph: a form with a table of slots and a list of "if … then …" lines.

Two stages match how a parish thinks ("which hours" vs "which mass at that hour") and keep each graph small. C is
simpler to build and to read, and could be the first step with the graph added later; the owner asked for the graph.
A starting template ("Typowa parafia — diecezja X") is needed in every case — nobody should draw it from nothing.
Depends on D6, D7. Affects D9, D10, D14.

**Your decision:**

### D9 — Generate appointments, or compute them on reading?

- **A (recommended). Generate** concrete appointments for N weeks ahead (e.g. 8), with a **preview and a diff**
  before saving ("dodane 54, zmienione 3, bez zmian 120, nie usunięte 1 — ma intencję").
- **B.** Compute on every reading from the rule; store only exceptions and records.

A gives real appointments that can carry intentions, sign-ups and manual changes, print and show on the public page
like today. B never runs out of weeks, but every view (public, print, office, widgets, the server's "only on a mass
that takes place") would need the rule engine. Depends on D8. Affects D10, D11, D12.

**Your decision:**

### D10 — Who runs the generation?

- **A (recommended).** The **browser** of someone who writes in the calendar, on demand ("Zaplanuj kolejne tygodnie")
  and reminded by the digest when the planned horizon gets short — like mirrored certificates (0120) and renewals.
- **B.** The **server**, every night. It holds no area keys, so it could fill only public values (time, public title,
  colour), never sealed ones.

Sealed fields (notes, sealed record fields) need a key, so only a browser can write them. Depends on D9.

**Your decision:**

### D11 — Re-running the rule after manual changes

- **A (recommended).** Every generated appointment carries its origin (rule, slot, date). A re-run updates only
  what it still owns; a field changed by hand is marked and kept; an appointment with records (intentions) is never
  deleted by a re-run — it is listed for a person to decide.
- **B.** Re-run replaces everything in the horizon.
- **C.** Generate once; never update.

B destroys manual work; C makes a changed rule useless for weeks already planned. Depends on D3, D9.

**Your decision:**

### D12 — Generated masses: single appointments or series?

- **A (recommended).** One appointment per date and slot, grouped by rule and slot. Series remain for manual,
  simple repetition (a choir rehearsal).
- **B.** One series per slot with per-day values and exceptions.

Per-day values (feast, colour, title) are the normal case for masses, so series would carry an exception almost
every day. With A the "ten i następne" of masses becomes "change the rule from date X" — the handover of 0079 is
still needed for manual series. Depends on D9. Affects D5.

**Your decision:**

### D13 — Schemes and fields per area

- **A (recommended).** A scheme belongs to an area and is inherited by its sub-areas (like the data controller).
  A calendar says which schemes its appointments may carry. Each field says **who reads it** — public, or sealed under
  the key of a chosen area (the area of the calendar, the office, a sub-area) — and **who writes it** (the calendar's
  writers, a form role, a link). A sub-area may **add** fields to an inherited scheme, not remove them.
- **B.** Schemes global for the whole platform, fields switched on/off per area.
- **C.** Schemes per calendar only.

Changing who reads a field later means re-sealing existing values in a writer's browser (like key rotation).
Depends on D2. Affects D4, D14.

**Your decision:**

### D14 — Fixed parts from a rule (e.g. *za parafian*)

- **A (recommended).** A result node "Dodaj wpis" creates a record in a record list (an intention with a given text
  and kind), marked "z reguły": the office sees it, cannot double-book the mass, may remove it for one day.
- **B.** A plain field on the mass ("Intencja stała"), not a record.

A keeps one place where intentions are counted (a single intention excludes others). Depends on D4, D8.

**Your decision:**

### D15 — Collective intentions and their limits

- **A (recommended).** Rules are **parameters of the record list**, not code: single = alone on the mass; collective
  = many records, one announcement; limits ("najwyżej 2 msze zbiorowe w tygodniu", "ogłoszone publicznie") set per
  scheme. The preset uses the current Polish practice as default, editable by the parish.
- **B.** Hard-coded rules.

Depends on D4.

**Your decision:**

### D16 — What the app stores about readings and texts

- **A (recommended).** Only references (sigla, e.g. "Iz 7,10-14; Ps 24; Rz 1,1-7; Mt 1,18-24") and the celebration's
  name; links to the Library's Bible text where the user has one.
- **B.** Full texts of the readings.

Lectionary texts are copyrighted (Pallottinum). Depends on D6.

**Your decision:**

## 5. Problems to expect

1. **Precedence is subtle.** Solemnities falling on Sundays of Advent/Lent/Easter or in Holy Week move; two
   solemnities on one day; the Polish moves (Ascension on the 7th Sunday of Easter, Epiphany kept on 6 January).
   This needs a test set of known years (e.g. 2025–2030) checked against the printed ordo.
2. **Calendars change.** New memorials are added (several since 2019); the data files need an update path and a
   version, and generated weeks need a re-run when the data changes.
3. **Diocesan differences** are many but small; they need a place (area data, D6) and an owner per diocese.
4. **Migration on the one production database** (D5). Must go in steps with compatibility, tested on LocalDB.
5. **Every view must understand schemes**: editor, details, office, public plan and gablota, print sheet, widgets,
   page modules, JSON import/export with its description, the AI link and MCP.
6. **Sealed vs public.** The server can enforce only what it can read: counts and modes, never sealed contents.
   Re-sealing when "who reads" changes is browser work.
7. **The graph must stay usable.** Without templates and a live preview ("pokaż, co powstanie w grudniu") a parish
   will not draw it. Each node should show which days of the next weeks reach it.
8. **Generated volume.** 8 weeks × ~25 masses = ~200 appointments per run, each with sealed fields — fine in a
   browser, but the diff must be cheap (compare by origin key, not by content).
9. **Schemes versioning.** Changing a scheme with existing values: added fields are empty, removed fields keep their
   values hidden until deleted; renamed labels keep their keys.

## 6. Phases (if the recommendations are taken)

1. **Liturgical day engine** (D6, D7): data files, computus, precedence, colours; shown in the calendar and the mass
   plan; tests for known years. Useful on its own.
2. **Schemes and fields** (D2, D3, D13): definitions, values on appointment and day level, editor ("+ …" extras
   already exist), JSON.
3. **Generic record lists** (D4, D15) with the preset "Intencje"; migration of `mass_intention` (D5); then claims and
   attendance.
4. **Plan rule** (D8, D9, D10, D11, D12, D14): stage 1 slots, stage 2 graph, preview/diff, templates per diocese.

Each phase ends usable; phase 1 needs no migration.
