# Opowieść, która liczy się w Cogicie — przewodnik dla AI

Ten przewodnik mówi, jak zbudować kurs w formie opowieści tak, żeby każda odpowiedź liczyła się w bazie wiedzy: w krajobrazie, na ścieżce, w powtórkach i w postępach. Kompletny przykład do zaimportowania: **example-story** (baza wiedzy) i **example-story-page** (strona). Formaty: **knowledge-base** (sekcja "flows") i **page** (prezentacja, "story", moduły "question" i "path").

## 1. Jedna opowieść = jedna jednostka + jeden przebieg (+ ewentualnie strona)

- **Jednostka** (np. rodzaj „Lekcja”): jeden wpis na opowieść, z polem-odwołaniem `"prerequisite": "up"` (np. „Wymaga”) wskazującym tematy, które trzeba znać PRZED opowieścią. Dopóki ich nie umiesz, opowieść jest zamknięta: w krajobrazie stoi jako góra z ponumerowaną drogą, a odtwarzacz pokazuje, czego brakuje.
- **Przebieg w bazie** wskazuje na jednostkę: `"unit": "@kurs/lekcja"`. Opowieść z własnym grafem: kroki "show", "line", "question", "chapters" (sekcja "flows"). Opowieść jako strona-prezentacja: `{"ref": "@kurs/opowiesc", "name": "…", "look": "scenes", "presentation": "<adres strony>", "unit": "@kurs/lekcja"}` — bez własnego "graph", nie kopiuj storyboardu: jego mapą jest strona.
- **Strona-prezentacja** (gdy opowieść ma sceny): w "show.story" stoi "base": id bazy wiedzy — bez niego wszystko zostaje tylko w przeglądarce. W Nauce przebieg gra tę prezentację; miejsce i odpowiedzi są te same co na stronie.
- **"unit"** w krajobrazie to jedno pole (także gdy sama nie ma kart); „Pokaż ścieżkę” pokazuje kroki opowieści; gdy opowieść jest zaliczona (patrz 7), pole opada do doliny.

## 2. Co się liczy — pytania o tematach, nigdy o jednostce

- **Pytanie na scenie** (moduł "question") albo krok "question" przebiegu:
  - `"question": "@kurs/q/parowanie"` — PRAWDZIWE pytanie bazy (wpis rodzaju "question"). Odpowiedź leży na jego karcie: liczy się dla jego "about" i dzieli historię z powtórkami — nigdy kopia.
  - własne pytanie strony z `"about": ["@kurs/t/chmury"]` — liczy się dla tych wpisów; nigdy nie trafia do powtórki jako karta.
  - bez obu — liczy się tylko w opowieści (bramka "answered" z id modułu).
- **"about" pytań wymienia TEMATY, nigdy jednostkę.** Jednostka opowieści nie ma własnych kart: jej stan to opowieść i przegląd. Gdyby pytania były o jednostce, miałaby karty — opadłaby po kilku dobrych odpowiedziach bez opowieści, a jej przycisk ćwiczyłby karty zamiast grać opowieść.
- **Laboratoria**: "physics" z celem sceny ("goal": ciało w obszarze) i "animation" z regułą `"goal": true` — osiągnięty cel to dobra odpowiedź na "question" albo "about" modułu (raz na każde wejście w scenę). "particles" i "lab2d" nie mają celu — nic nie zapisują.
- **Kto się uczy**: zalogowany — jako własna osoba (albo ta wybrana u góry strony), odpowiedzi idą tam, gdzie każe baza (jak w Nauce). Bez konta — w przeglądarce.

## 3. Kolejność nauki to ścieżka

- Tematy z polem „Wymaga” (`"prerequisite": "up"`) tworzą ścieżkę: kilka tematów wymagających tego samego to **rozwidlenie**, temat wymagający kilku to **miejsce spotkania** („2 z 3 ścieżek”).
- Ścieżka stoi w Nauce → Ścieżka, obok opowieści i jako moduł strony "path": `{"title", "library": "<id bazy>", "flow": "<id przebiegu>"}` (albo "entry" — części jednostki, "view" — widok, nic — cała baza; wtedy jednostki-opowieści stoją na niej jak kroki, z przyciskiem opowieści).
- **Sceny mówią, czego dotyczą**: scena z pytaniem liczy jego wpisy; scena bez pytania (wstęp, miejsce spotkania) dostaje `"about": ["@kurs/t/start"]` w "show.scenes". Jednostka sama nie jest krokiem ścieżki opowieści.

## 4. Rozwidlenie, które się schodzi

- **Prezentacja**: scena rozwidlenia z przyciskami (`"go": {"rozwidlenie": "parowanie"}`) do pierwszej sceny każdej drogi. Pytanie na końcu drogi: `"go": {"parowanie:right": "gate:wszystko", "parowanie:wrong": "parowanie"}`. Bramka sprawdza, czy wszystkie drogi są poznane, i wraca do rozwidlenia, dopóki nie są:
  `{"key": "wszystko", "type": "condition", "when": {"type": "and", "items": [{"type": "knowness", "of": "@kurs/t/parowanie", "band": "learned"}, …]}, "yes": "razem", "no": "rozwidlenie"}`
- **Przebieg w bazie**: krok "chapters" (każdy rozdział to droga), "chapterEnd" na końcu każdej drogi, wyjście "done" do kroku spotkania.

## 5. Bramki czytają znajomość

- `{"type": "knowness", "of": "@kurs/t/start", "band": "learned"}` — "of" może być @nazwą wpisu bazy: liczy jego karty i pytania o nim (także odpowiedzi ze stron). Pasma: "learned" (poznane — już po jednej dobrej odpowiedzi), "known" (umie — po powtórkach), "due", "unknown".

## 6. Ukończona opowieść i warunek „Przebieg”

- Koniec: scena, po której „dalej” prowadzi do "end" (albo krok "end" przebiegu). Opowieść jest wtedy „ukończona” — zostaje, także po „od początku”. Cele przebiegu ("goals") zapisują się jako osiągnięte i zostają osiągnięte.
- Warunek `{"type": "flow", "flow": "@kurs/opowiesc", "state": "done"}` ("started", "goal" z "goal": "id") działa w widokach ("filter.when"), powtórkach i krokach widoku krajobrazu.
- Postęp uczącego się jest prywatny: nie ma go w eksporcie ani w MCP.

## 7. Przegląd na końcu — dopiero zdany zalicza opowieść

Opowieść kończy się krótkim przeglądem tego, czego uczyła — W TYM SAMYM przebiegu, z TYMI SAMYMI pytaniami co w opowieści (ta sama historia kart). Przebieg z celami opuszcza jednostkę do doliny dopiero, gdy jest ukończony **i** każdy cel osiągnięty; bez celów — gdy ukończony.

1. **Licznik z nazwą opowieści na początku**: `"deszcz.przeglad"` (wartości należą do uczącego się, nie do jednej opowieści — bez nazwy dwie opowieści dzieliłyby licznik).
2. **Początek przeglądu zeruje licznik** (krok "set" `{"type": "set", "value": "deszcz.przeglad", "to": 0}`) i jest oznaczony w przebiegu: `"review": "<id tego kroku>"` (w prezentacji: klucz sceny początku przeglądu). Tam prowadzi „Powtórz przegląd”.
3. **Każde pytanie**: "right" → krok "set" `{"type": "add", "value": "deszcz.przeglad", "by": 1}` → następne pytanie; "wrong" → od razu następne pytanie.
4. **Warunek na końcu**: `{"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3}` — "yes" → koniec, "no" → wraca na początek przeglądu, dopóki wynik jest za niski (albo do sceny z wyborem „Spróbuj jeszcze raz” / „Zakończ na razie” — opowieść zakończona bez zdanego przeglądu zostaje na równinie jako „przegląd jeszcze niezdany”).
5. **Cel z tym samym warunkiem**: `"goals": [{"id": "przeglad", "title": "Przegląd zdany", "condition": {"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3}}]`.

W prezentacji to samo na stronie: wartość w `"story.values"` (`{"id": "deszcz.przeglad", "label", "start": 0, "min": 0, "max": 3}`), bramki "set" (zero na początku, +1 przy "right") i bramka "condition" z wynikiem, przyciski sceny „Jeszcze nie” z `"go"`. Cel przebiegu w bazie liczy się z wartości strony. Strona otwiera się na scenie z adresu `?scena=<klucz>`.

## 8. Przycisk opowieści i ekran zamknięcia

- **Przycisk** (pole w krajobrazie, węzeł w Nauce → Ścieżka i w module "path"): „Zacznij opowieść” (nowa), „Kontynuuj opowieść” (w drodze — od miejsca, w którym uczący się skończył), „Powtórz przegląd” (ukończona, cel nieosiągnięty — od "review"), „Otwórz opowieść” (zaliczona). Nigdy nie ćwiczy kart jednostki.
- **Ekran zamknięcia** (odtwarzacz przed opowieścią — ta sama logika co krajobraz): czegoś przed jednostką brakuje — lista od podstaw z odnośnikami i „Ucz się” przy każdym, do tego „Ustaw jako cel” (cel w krajobrazie); wszystko poznane, ale w łańcuchu są słabe, już pytane karty — „Najpierw powtórz (N)” z dokładnie tymi kartami, potem od razu opowieść. Kto pisze w bazie, ma „Podgląd mimo to”.

## 9. Kolejność importu

1. Utwórz stronę (sam adres), jeśli opowieść jest prezentacją — przebieg musi znać jej adres.
2. Zaimportuj bazę wiedzy (knowledge-base): tematy, jednostkę z „Wymaga”, pytania ("about" — tematy), przebieg z "unit", "review" i "goals" (i "presentation").
3. Zaimportuj stronę (page): w "show.story.base" id bazy, w module "path" — "library" i "flow" (id przebiegu).
4. Sprawdź stronę narzędziami podglądu (check_page, preview_page), a bazę — get_knowledge_setup: przebiegi stoją tam w całości, a "landscapes" pokazuje stałą mapę każdego krajobrazu (komórki, obszary, regiony — bez wysokości). Odpis bazy powstaje w przeglądarce kogoś, kto w niej pisze — 45 s po ostatniej zmianie, póki karta jest otwarta, i od razu po imporcie; "SnapshotCurrent": false mówi, że baza zmieniła się później.

## 10. Typowe błędy

- Pytania z jednostką w "about" — jednostka dostaje karty, opada bez opowieści, a jej przycisk ćwiczy karty.
- Licznik bez nazwy opowieści ("przeglad") — dwie opowieści dzielą jeden licznik.
- Przegląd bez zerowania na początku — „Powtórz przegląd” liczy dalej od starego wyniku.
- Cel z innym warunkiem niż bramka wyniku — opowieść idzie do końca, a pole nie opada (albo odwrotnie).
- Brak "review" — „Powtórz przegląd” zaczyna całą opowieść od początku.
- Strona bez "story.base" — odpowiedzi zostają w przeglądarce, Nauka ich nie widzi.
- "unit" wskazuje temat zamiast jednostki.
- Bramka z "band": "known" zaraz po jednej odpowiedzi — "known" wymaga powtórek; do „przeszedł drogę” użyj "learned".
- Rozwidlenie bez powrotu — po pierwszej drodze opowieść idzie dalej i reszta dróg przepada; użyj bramki z powrotem albo "chapters".
- Kopia storyboardu w "graph" przebiegu — dwa grafy rozjeżdżają się; wystarczy "presentation".
- Sceny wstępu i spotkania bez "about" — ścieżka nie ma ich kroków.
