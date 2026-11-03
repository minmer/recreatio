# Opowieść, która liczy się w Cogicie — przewodnik dla AI

Ten przewodnik mówi, jak zbudować kurs w formie opowieści tak, żeby każda odpowiedź liczyła się w bazie wiedzy: w krajobrazie, na ścieżce, w powtórkach i w postępach. Kompletny przykład do zaimportowania: **example-story** (baza wiedzy) i **example-story-page** (strona). Formaty: **knowledge-base** (sekcja "flows") i **page** (prezentacja, "story", moduły "question" i "path").

## 1. Jedna opowieść = jedna strona + jeden przebieg

- **Strona-prezentacja** niesie opowieść: sceny, przyciski (moduły z "go"), pytania, bramki ("story.gates"), wartości. W "show.story" stoi "base": id bazy wiedzy — bez niego wszystko zostaje tylko w przeglądarce.
- **Przebieg w bazie** wskazuje na nią: `{"ref": "@kurs/opowiesc", "name": "…", "look": "scenes", "presentation": "<adres strony>", "unit": "@kurs/lekcja"}` — bez własnego "graph". Nie kopiuj storyboardu: jego mapą jest strona. W Nauce ten przebieg gra prezentację, a miejsce i odpowiedzi są te same co na stronie.
- **"unit"**: jednostka (lekcja), którą jest ta opowieść. W krajobrazie to jedno pole (także gdy sama nie ma kart); „Pokaż ścieżkę” pokazuje jej kroki; gdy opowieść dobiegnie końca, pole opada do doliny.
- Prostsza opowieść bez strony: przebieg w samej bazie z krokami "show", "question", "chapters" (sekcja "flows") — liczy się tak samo.

## 2. Co się liczy

- **Pytanie na scenie** (moduł "question"):
  - `"question": "@kurs/q/parowanie"` — PRAWDZIWE pytanie bazy (wpis rodzaju "question"). Scena pokazuje je samo, odpowiedź leży na jego karcie: liczy się dla jego "about" i dzieli historię z powtórkami. Pozostałe pola modułu są wtedy zbędne.
  - własne pytanie strony z `"about": ["@kurs/t/chmury"]` — liczy się dla tych wpisów (odpowiedź niesie "about"); nigdy nie trafia do powtórki jako karta.
  - bez obu — liczy się tylko w opowieści (bramka "answered" z id modułu).
- **Laboratoria**: "physics" z celem sceny ("goal": ciało w obszarze) i "animation" z regułą `"goal": true` — osiągnięty cel to dobra odpowiedź na "question" albo "about" modułu (raz na każde wejście w scenę). "particles" i "lab2d" nie mają celu — nic nie zapisują.
- **Kto się uczy**: zalogowany — jako własna osoba (albo ta wybrana u góry strony), odpowiedzi idą tam, gdzie każe baza (jak w Nauce), więc widać je od razu w Nauce, krajobrazie i na ścieżce. Bez konta — w przeglądarce.

## 3. Kolejność nauki to ścieżka

- Tematy z polem „Wymaga” (`"prerequisite": "up"`) tworzą ścieżkę: kilka tematów wymagających tego samego to **rozwidlenie**, temat wymagający kilku to **miejsce spotkania** („2 z 3 ścieżek”).
- Ścieżka stoi w Nauce → Ścieżka, obok opowieści (w Nauce, mała, zwijana) i jako moduł strony "path": `{"title", "library": "<id bazy>", "flow": "<id przebiegu>"}` (albo "entry" — części jednostki, "view" — widok, nic — cała baza).
- **Sceny mówią, czego dotyczą**: scena z pytaniem liczy jego wpisy; scena bez pytania (wstęp, miejsce spotkania) dostaje `"about": ["@kurs/t/start"]` w "show.scenes". Jednostka sama nie jest krokiem.
- Na ścieżce „teraz” to scena, na której jest uczący się; wybrana droga świeci; klik w wolny krok przenosi prezentację do jego sceny.

## 4. Rozwidlenie, które się schodzi

- **Prezentacja**: scena rozwidlenia z przyciskami (`"go": {"rozwidlenie": "parowanie"}`) do pierwszej sceny każdej drogi. Pytanie na końcu drogi: `"go": {"parowanie:right": "gate:wszystko", "parowanie:wrong": "parowanie"}`. Bramka sprawdza, czy wszystkie drogi są poznane, i wraca do rozwidlenia, dopóki nie są:
  `{"key": "wszystko", "type": "condition", "when": {"type": "and", "items": [{"type": "knowness", "of": "@kurs/t/parowanie", "band": "learned"}, …]}, "yes": "razem", "no": "rozwidlenie"}`
  Moduł "path" na scenie rozwidlenia pokazuje, ile dróg już za nim.
- **Przebieg w bazie**: krok "chapters" (każdy rozdział to droga), "chapterEnd" na końcu każdej drogi, wyjście "done" do kroku spotkania. Opowieść sama oferuje tylko drogi otwarte i liczy jako przerobione także te, których każdy krok uczący się już umie — opowieść i ścieżka mówią to samo „2 z 3”.

## 5. Bramki czytają znajomość

- `{"type": "knowness", "of": "@kurs/lekcja", "band": "learned"}` — "of" może być @nazwą wpisu bazy: liczy jego karty i pytania o nim (także odpowiedzi ze stron). Pasma: "learned" (poznane — już po jednej dobrej odpowiedzi), "known" (umie — po powtórkach), "due", "unknown".
- Przykłady: pomiń wstęp, gdy lekcja poznana; wróć do rozwidlenia, dopóki droga nie jest poznana; dodatkowa scena tylko dla tych, którzy czegoś jeszcze nie umieją.

## 6. Ukończona opowieść i warunek „Przebieg”

- Koniec: scena, po której „dalej” prowadzi do "end" (albo krok "end" przebiegu). Uczący się ma wtedy opowieść „ukończoną” — zostaje, także po „od początku”. Cele przebiegu ("goals") zapisują się jako osiągnięte.
- Warunek `{"type": "flow", "flow": "@kurs/opowiesc", "state": "done"}` ("started", "goal" z "goal": "id") działa w widokach ("filter.when"), powtórkach i krokach widoku krajobrazu — np. tematy pojawiają się dopiero po ukończonej opowieści.
- Postęp uczącego się jest prywatny: nie ma go w eksporcie ani w MCP.

## 7. Kolejność importu

1. Utwórz stronę (sam adres) — przebieg musi znać jej adres.
2. Zaimportuj bazę wiedzy (knowledge-base) z przebiegiem `"presentation": "<ten adres>"` i jednostką "unit".
3. Zaimportuj stronę (page): w "show.story.base" id bazy, w module "path" — "library" i "flow" (id przebiegu).
4. Sprawdź stronę narzędziami podglądu (check_page, preview_page), a bazę — get_knowledge_setup: przebiegi stoją tam w całości, a "landscapes" pokazuje stałą mapę każdego krajobrazu (komórki, obszary, regiony — bez wysokości). Odpis bazy powstaje w przeglądarce kogoś, kto w niej pisze — 45 s po ostatniej zmianie, póki karta jest otwarta, i od razu po imporcie; "SnapshotCurrent": false mówi, że baza zmieniła się później.

## 8. Typowe błędy

- Strona bez "story.base" — odpowiedzi zostają w przeglądarce, Nauka ich nie widzi.
- Pytanie bez "question" i bez "about" — liczy się tylko w opowieści.
- "unit" wskazuje temat zamiast jednostki; jednostka w "about" pytań jest dobra (zbiera całość), ale nie jest krokiem ścieżki.
- Bramka z "band": "known" zaraz po jednej odpowiedzi — "known" wymaga powtórek; do „przeszedł drogę” użyj "learned".
- Rozwidlenie bez powrotu — po pierwszej drodze opowieść idzie dalej i reszta dróg przepada; użyj bramki z powrotem albo "chapters".
- Kopia storyboardu w "graph" przebiegu — dwa grafy rozjeżdżają się; wystarczy "presentation".
- Sceny wstępu i spotkania bez "about" — ścieżka nie ma ich kroków (rozwidlenie bez początku i bez spotkania).
