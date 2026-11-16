# Dzieło od całości do jednostki: przewodnik dla AI

Ten plik jest dla asystenta AI, który pomaga pisać **dzieło** w Skryptorium Recreatio: książkę (popularną albo
fabularną), pracę naukową, cykl krótkich tekstów (np. 100 kazań po 5 minut), lekcje kursu albo zbiór. Asystent czyta
przez połączenie MCP i **niczego nie zapisuje sam**: przygotowuje dokumenty JSON, użytkownik je importuje w aplikacji i
przegląda zmiany.

Treść (tytuły, cele, opisy, teksty) pisz w języku dzieła (pole projektu `lang`), zwykle po polsku.

---

## 1. Jak zbudowane jest dzieło

| część | gdzie | format importu |
|---|---|---|
| projekt (dzieło): typ, poziomy, wymiary, ścieżki, własne role, bazy wiedzy, druk | Skryptorium, rodzaj `project` | `scriptorium` |
| węzły struktury: części → rozdziały → … → jednostki | Skryptorium, rodzaj `node` | `scriptorium` |
| proza jednostki (plan + treść) | Skryptorium, rodzaj `text` (węzeł wskazuje go polem `text`) | `scriptorium` |
| reguły pisania (z uzasadnieniem i zakresem) | Skryptorium, rodzaj `rule` | `scriptorium` |
| szablony jednostek (np. „Kazanie 5 minut”) | Skryptorium, rodzaj `unittemplate` | `scriptorium` |
| wiedza dzieła: osoby, miejsca, terminy, idee, motywy, przedmioty, wydarzenia, fazy, notatki | baza wiedzy (Cogita) ze schematem `scheme-dzielo` | `knowledge-base` |
| źródła i cytaty (praca naukowa) | Biblioteka | `library` |

**Węzeł** istnieje, zanim powstanie proza. Ma: `title`, `purpose` (co czytelnik tu zyskuje i dlaczego to stoi tutaj),
`synopsis` (myśl przewodnia w 1–2 zdaniach), `role`, `brings` (co wnosi — albo co podsumowuje), `targetWords` lub
`targetMinutes` (mówione: ~130 słów na minutę), `status`, `notes`, `parent` (węzeł nad nim; puste = najwyższy poziom),
`order` (liczba; 1.5 stoi między 1 a 2). Identyfikator węzła nie zmienia się przy przenoszeniu.

**Role**: `new` (musi przynieść coś nowego), `summary` (nie przynosi niczego nowego; tylko przypomina), `introduction`,
`transition`, `example`, `exercise`, `conclusion` oraz role własne projektu (`roles` z `brings`: new / nothing / any).

**Wymiary** (`dimensions` projektu, np. odbiorcy: dzieci / młodzież / dorośli; poziom: podstawowy / zaawansowany).
Węzeł z `split: "audience"` dzieli się według wymiaru: jego dzieci mają `variant` (klucz wartości) albo nie mają go
wcale — wtedy są **wspólnym rdzeniem** dla wszystkich wartości. Podział może być w dowolnym miejscu drzewa i
zagnieżdżony (rozdział 7 według poziomu, a w nim 7.3 jeszcze według perspektywy). Wartość świadomie niepotrzebna:
`skip: [{ "value": "children", "note": "dla dzieci w osobnym cyklu" }]`.

**Ścieżka** (`paths` projektu) to jedno wydanie: jedna wartość na wymiar. Ścieżka czyta się jak jedno liniowe dzieło —
kontrola, kontekst pisania i druk działają **dla ścieżki**.

**Oznaczenia pojęć** — gdzie co jest wprowadzone, zdefiniowane, pokazane na przykładzie, użyte, przypomniane:
- przy węźle (działa przed prozą): `marks: [{ "entry": "@dzielo-rzeka/przymierze", "role": "intro" }]`;
- w zapisie planu i treści: `[[przymierze|@<id wpisu>|intro]]` — role `intro`, `def`, `ex`, `use`, `recall`; bez roli
  to użycie. W zapisie używaj **identyfikatora** wpisu (UUID z `search_entries` albo `get_work_briefing`); nazwy z „/”
  nie mieszczą się w zapisie.
- pojęcie oznaczone gdziekolwiek w dziele jest rozpoznawane także bez linku — po swoich „Formach w tekście”.

**Reguła**: `rule` (sama reguła), `why` (dlaczego), `weight` (`must` / `should`), zakres — wszystkie podane warunki
razem: `node` (węzeł i wszystko pod nim), `role`, `template`, `dimension` + `value` (np. tylko dla dzieci), `entity`
(tam, gdzie występuje dany wpis wiedzy) — oraz `good`, `bad`, `check` + `param` (sprawdzanie automatyczne:
`sentenceWords` N, `maxWords` N, `minWords` N, `forbid` „a, b”, `require` „a, b”, `needsDefinition`, `needsExample`,
`oneNew`). Reguła **bez** `project` należy do własnego zbioru reguł i obowiązuje w każdym projekcie tego Skryptorium.

**Szablon jednostki**: `parts` po kolei (`id`, `title`, `kind`: thought / quote / example / question / application,
`words` albo `minutes`, `note`), `targetWords` / `targetMinutes`, `role`. Plan tekstu jednostki ma punkty o
identyfikatorach `tpl-<id części>` — tak kontrola wie, czy jednostka ma kształt szablonu.

**Wiedza dzieła** to baza wiedzy z ustawieniem „Do czego służy: Wiedza dzieła” i schematem `scheme-dzielo`:
Osoba, Miejsce, Termin (definicja, jak używać, forma zalecana, zakazane synonimy i formy, formy w tekście, wymaga,
część, przeciwieństwo), Idea, Motyw, Przedmiot, Wydarzenie, Faza, Notatka do tematu. **Faza** opisuje osobę albo
miejsce w części dzieła: `czego` (wpis), `od` / `do` (węzeł albo tekst dzieła — wtedy baza musi mieć Skryptorium wśród
źródeł), czas opowieści, `opis`. Projekt wskazuje bazę: `knowledge: [{ "base": "<id bazy>" }]` (id z `list_collections`).

---

## 2. Praca krok po kroku

1. **Przeczytaj reguły i strukturę**: `get_work_briefing` (projekt po id, kluczu albo tytule). Zobacz zbiór reguł z
   uzasadnieniami, drzewo z celami i rolami, wymiary, ścieżki, szablony i wiedzę dzieła.
2. **Przeczytaj kontekst węzła**, który masz pisać: `get_work_context` (węzeł po id, numerze na ścieżce „2.3” albo
   tytule; ścieżka). Dostajesz: cel, rolę, myśl przewodnią, łańcuch nadrzędnych, myśli przewodnie przed i po, sąsiednie
   komórki (ten sam rozdział dla innych odbiorców), **co już jest wprowadzone** (tylko z tego korzystaj swobodnie),
   **co ten węzeł ma wprowadzić**, reguły w zasięgu, fazy osób i miejsc obowiązujące tutaj, otwarte uwagi kontroli.
3. **Napisz** dokument `scriptorium`: tekst jednostki (plan i treść) z oznaczeniami `[[…|@id|intro]]` przy tym, co
   wprowadzasz, i węzeł z `text` wskazującym ten tekst (i `status`). Nic, czego nie ma w „już wprowadzone” albo w
   „ma wprowadzić”, nie powinno być używane bez wprowadzenia. Podsumowanie (`summary`) tylko przypomina (`recall`).
4. **Użytkownik importuje** (Skryptorium → Import / eksport) i przegląda zmiany.
5. **Sprawdź się**: `get_work_checks` (ten sam raport, który liczy aplikacja; odpis odświeża się po imporcie). Popraw
   to, co ma wagę `must`, potem `should`.

Nowa struktura (szkielet przed prozą): najpierw całość, potem części, potem coraz mniejsze fragmenty — każdy węzeł z
celem, rolą i myślą przewodnią. Dopiero potem proza.

**Kolejność importów**, gdy wszystko powstaje od zera:
1. baza wiedzy: schemat `scheme-dzielo`, potem wpisy (`knowledge-base`) — **bez** pól `od`/`do` faz;
2. Skryptorium (`scriptorium`): szablony, projekt (z `knowledge`), węzły z `marks`, teksty, reguły;
3. baza wiedzy jeszcze raz: fazy z `od`/`do` wskazującymi klucze węzłów („@r1-5”) — baza musi mieć Skryptorium
   wśród źródeł (Ustawienia → Źródła).

---

## 2a. Przegląd autora: zaakceptowane, do poprawy, do usunięcia — i notatki dla ciebie

Autor czyta strukturę (często przygotowaną przez ciebie) w zakładce „Przebieg” część po części i przy każdym węźle
zostawia ocenę (`review`) i notatki (`thread`). **Zanim napiszesz albo poprawisz tekst, przeczytaj je:**
`get_work_review` (wszystkie węzły po kolei; `status: "notes"` — tylko z otwartymi notatkami, `"revise"`, `"remove"`,
`"none"`), a przy jednym węźle `get_work_context` (pola `review` i `thread` węzła, ocena rozdziału nad nim w `chain`).

- `"accepted"` — zostaw, jak jest (nie przebudowuj struktury tego węzła).
- `"revise"` — popraw według otwartych notatek autora (`by: "author"`, `done` puste).
- `"remove"` — nie pisz tego węzła; nie przenoś jego treści gdzie indziej bez notatki, która o to prosi.
- puste — autor jeszcze nie przejrzał; pisz według celu i myśli przewodniej.
- Notatka z `"para": 3` dotyczy trzeciego akapitu tekstu tego węzła.

**Odpowiadasz w imporcie „scriptorium”**: przy węźle w `"thread"` tylko twoje nowe notatki — `"by": "ai"`, `"reply"`: id
notatki autora, na którą odpowiadasz, `"text"`: co zrobiłeś albo o co pytasz. Import **dokłada** notatki do rozmowy
(ten sam `id` zastępuje jedną) — nie musisz przepisywać notatek autora i nie możesz ich usunąć. Nie zmieniaj `review`:
to decyzja autora.

```json
{ "format": "recreatio/scriptorium", "version": 1, "entries": [
  { "kind": "node", "key": "r1-2-1", "data": { "thread": [
    { "id": "ai-r1-2-1-1", "by": "ai", "reply": "n3f9a2c1", "text": "Dopisałem w akapicie 3 wyjaśnienie anamnezy; definicja jest teraz przed pierwszym użyciem." }
  ] } }
] }
```

## 3. Mały kompletny przykład

Baza wiedzy (format `knowledge-base`, po zaimportowaniu `scheme-dzielo`):

```json
{
  "format": "recreatio.cogita.course", "version": 1, "name": "Rzeka — wiedza dzieła",
  "entities": [
    { "ref": "@rzeka/anna", "kinds": ["@dzielo/osoba"], "data": { "imie": "Anna", "kim": "bohaterka", "formy": ["Anny", "Annie", "Anię"] } },
    { "ref": "@rzeka/przymierze", "kinds": ["@dzielo/termin"], "data": { "termin": "przymierze", "definicja": "Trwała więź, którą Bóg sam ustanawia i której dotrzymuje.", "zalecana": "przymierze", "zakazane": ["kontrakt", "umowa z Bogiem"], "formy": ["przymierza", "przymierzu"] } }
  ]
}
```

Skryptorium (format `scriptorium`):

```json
{
  "format": "recreatio/scriptorium", "version": 1, "name": "Skryptorium",
  "entries": [
    { "kind": "project", "key": "rzeka", "data": {
      "projectType": "book", "title": "Rzeka", "lang": "pl", "status": "writing",
      "levels": [ { "name": "Część", "latex": "part" }, { "name": "Rozdział", "latex": "chapter" }, { "name": "Podrozdział", "latex": "section" } ],
      "dimensions": [ { "key": "level", "name": "Poziom", "ordered": "yes", "values": [ { "key": "basic", "name": "Podstawowy" }, { "key": "advanced", "name": "Zaawansowany" } ] } ],
      "paths": [ { "key": "basic", "name": "Dla początkujących", "choose": [ { "dimension": "level", "value": "basic" } ] },
                 { "key": "advanced", "name": "Dla zaawansowanych", "choose": [ { "dimension": "level", "value": "advanced" } ] } ],
      "knowledge": [ { "base": "<id bazy wiedzy>" } ]
    } },
    { "kind": "node", "key": "r1", "data": { "project": "@rzeka", "order": 1, "title": "Część I. Dzieciństwo", "role": "introduction",
      "purpose": "Czytelnik poznaje Annę i dom nad rzeką.", "synopsis": "Świat, z którego wyrasta Anna." } },
    { "kind": "node", "key": "r1-1", "data": { "project": "@rzeka", "parent": "@r1", "order": 1, "title": "Dom nad rzeką", "role": "new",
      "purpose": "Wprowadzić Annę.", "synopsis": "Anna ma siedem lat i nie boi się rzeki.", "targetWords": 3000, "status": "planned",
      "marks": [ { "entry": "@rzeka/anna", "role": "intro" } ] } },
    { "kind": "node", "key": "r1-2", "data": { "project": "@rzeka", "parent": "@r1", "order": 2, "title": "Pierwsze słowo o przymierzu", "role": "new",
      "split": "level", "purpose": "Wprowadzić pojęcie przymierza.", "synopsis": "Babcia opowiada o tęczy.",
      "marks": [ { "entry": "@rzeka/przymierze", "role": "intro" } ] } },
    { "kind": "node", "key": "r1-2a", "data": { "project": "@rzeka", "parent": "@r1-2", "order": 1, "title": "Wspólny rdzeń: opowieść babci" } },
    { "kind": "node", "key": "r1-2b", "data": { "project": "@rzeka", "parent": "@r1-2", "order": 2, "variant": "advanced", "title": "Przymierze w Biblii",
      "marks": [ { "entry": "@rzeka/przymierze", "role": "def" } ] } },
    { "kind": "node", "key": "r1-3", "data": { "project": "@rzeka", "parent": "@r1", "order": 3, "title": "Podsumowanie części I", "role": "summary",
      "brings": "Anna, dom, przymierze", "marks": [ { "entry": "@rzeka/anna", "role": "recall" }, { "entry": "@rzeka/przymierze", "role": "recall" } ] } },
    { "kind": "rule", "data": { "project": "@rzeka", "rule": "Narracja w czasie przeszłym, trzecia osoba.", "why": "Jedna perspektywa opowiadającego.", "weight": "must" } },
    { "kind": "rule", "data": { "project": "@rzeka", "rule": "Dla początkujących: zdania najwyżej 18 słów.", "why": "Czytelnik bez przygotowania gubi długie zdania.",
      "weight": "should", "dimension": "level", "value": "basic", "check": "sentenceWords", "param": "18" } },
    { "kind": "rule", "data": { "rule": "Każde pojęcie z definicją.", "why": "Mój zbiór reguł: czytelnik ma wiedzieć, o czym mowa.", "weight": "should", "check": "needsDefinition" } }
  ]
}
```

Na ścieżce „basic” kontrola zgłosi m.in.: przymierze wprowadzone w 1.2, ale bez definicji (definicja stoi tylko w wersji
dla zaawansowanych) — reguła „Każde pojęcie z definicją” (i to samo o Annie, póki nie ma miejsca z rolą `def`). Na ścieżce „advanced” przymierze jest zdefiniowane.

Cykl jednostek z szablonu (np. 100 kazań, co dziesiąte podsumowaniem) tworzy się w aplikacji przyciskiem „Cykl z
szablonu”; w JSON — jako węzły z `template` wskazującym szablon i `role: "summary"` co dziesiąty.

---

## 4. Czego nie robić

- Nie zmieniaj identyfikatorów ani kluczy istniejących węzłów — zmieniaj je przez `"id"` albo `"key"` w dokumencie
  (import zmienia tylko podane pola).
- Nie wymyślaj wpisów wiedzy ani cytatów; czego brakuje, zaproponuj jako nowy wpis bazy wiedzy albo Biblioteki.
- Nie używaj w tekście osób, miejsc i pojęć spoza „już wprowadzone”, chyba że je właśnie wprowadzasz (`intro`).
- Nie wpisuj do bazy wiedzy dzieła kart ani powtórek — ona służy strukturze dzieła, nie nauce.
- Usuwa tylko właściciel w aplikacji; import niczego nie usuwa.
