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

### 7a. Odtwarzacz pyta tylko o to, czego uczący się nie umie (2026-11-04)

- Pytanie, którego karta jest już **znana** (od 100 %, z całej historii uczącego się — opowieści, powtórki, ćwiczenia), odtwarzacz pomija po cichu wyjściem "right": bez odpowiedzi, bez zmiany planu karty. Slajdy pokazuje zawsze. **Nie dopisuj warunków „pomiń, gdy umie”** — reguła dotyczy każdej bazy i każdego przebiegu.
- Licznik przeglądu (§7) i tak rośnie: pominięte pytanie idzie przez "right" i jego krok "+1". Przegląd, w którym wszystko jest znane, kończy się od razu; opowieść z samymi znanymi pytaniami można przeczytać.
- Po złej odpowiedzi to samo pytanie nie wraca od razu: najpierw jedno znane („przerywnik” — z tego samego tematu albo opowieści). Przerywnik się nie liczy i nic nie zmienia, chyba że odpowiedź jest zła.
- Nad pytaniem: „Zostało N pytań” (tylko te, które naprawdę padną) i powód („nowe”, „do powtórki (78 %)”, „pomyłka przed chwilą”, „przerywnik”). Na ścieżce: „2 z 5 pytań do odpowiedzi”; część z samymi znanymi pytaniami — „tylko do przeczytania”.

## 8. Przycisk opowieści i ekran zamknięcia

- **Przycisk** (pole w krajobrazie, węzeł w Nauce → Ścieżka i w module "path"): „Zacznij opowieść” (nowa), „Kontynuuj opowieść” (w drodze — od miejsca, w którym uczący się skończył), „Powtórz przegląd” (ukończona, cel nieosiągnięty — od "review"), „Otwórz opowieść” (zaliczona). Nigdy nie ćwiczy kart jednostki.
- **Ekran zamknięcia** (odtwarzacz przed opowieścią — ta sama logika co krajobraz): czegoś przed jednostką brakuje — lista od podstaw z odnośnikami i „Ucz się” przy każdym, do tego „Ustaw jako cel” (cel w krajobrazie); wszystko poznane, ale w łańcuchu są słabe, już pytane karty — „Najpierw powtórz (N)” z dokładnie tymi kartami, potem od razu opowieść. Kto pisze w bazie, ma „Podgląd mimo to”.

## 8a. Ścieżka: początek, koniec, wybory (2026-11-04)

Obok opowieści stoi mapa jej **części**, liczona z samego grafu przebiegu — od dołu (początek) do góry (koniec):

- **slajdy do przeczytania** — kolejne kroki "show" (i "line", "expand", "opening", sceny bez pytań) to jedna część;
- **pytania do odpowiedzi** — kolejne "question" (sceny z pytaniami) to jedna część; nazwa: „Pytania — <slajd przed nimi>”;
- **przegląd** — pętla, która wraca do pytań, aż wszystkie umiesz (jak przegląd na końcu, §7), razem z krokiem "review" i pojedynczym slajdem „Przegląd” tuż przed nią;
- **wybór drogi** — "choice", "chapters" albo scena z kilkoma przyciskami: rysowany jako rozwidlenie; drogi stoją obok siebie;
- "condition" i "set" są przezroczyste (należą do części, w której stoją).

Ścieżka musi być logiczna, inaczej import ostrzega z nazwy kroku, a bez początku albo końca w ogóle nie zapisze przebiegu:

- **jeden początek** ("start"; pominięty — jedyny krok, do którego nic nie prowadzi) i **jeden koniec** (krok "end"; drogi wyboru mogą wracać do wyboru, ale jedna możliwość musi prowadzić dalej — np. „Kończę”);
- każdy krok osiągalny z początku (bez drugiego początku, bez luźnych kroków);
- z każdego kroku da się dojść do końca: pytanie ma OBA wyjścia "right" i "wrong", każda możliwość wyboru ma krok, każda pętla ma wyjście.

Kroki "condition" (np. „czy już to umiesz?” przed slajdem) są **automatyczne**: ścieżka rysuje tylko gałąź, która dotyczy uczącego się, a bez uczącego się — obie gałęzie jako jedną część ze znakiem „automatycznie”. Nie są wyborem i nie liczą się do „wybierz 1 z N”. Droga, która wraca do wyboru, ma na ścieżce strzałkę z powrotem do niego (pętla, nie koniec). Ukończona opowieść liczy tylko to, co jej dotyczyło („ukończono N z N”); drogi wyboru, którymi uczący się nie szedł, są bledsze i się nie liczą.

Po „Koniec” ścieżka i ekran zamknięcia same pokazują, co dalej: tematy i opowieści, które w kolejności nauki („Najpierw trzeba znać”) przychodzą po jednostce tej opowieści — gotowe do wybrania, a te, na które jeszcze za wcześnie, bledsze, z tym, czego brakuje albo co trzeba najpierw powtórzyć; gdy nic nie jest gotowe — najbliższe pole, którego można się uczyć, albo „Wróć do mapy”. Nie dodawaj do opowieści ręcznych odnośników „następna opowieść”.

Przy wyborze opowieść się zatrzymuje: uczący się widzi wszystkie drogi z nazwy i z tym, co czeka za każdą („3 slajdy do przeczytania · 5 pytań do odpowiedzi”), zamknięte z powodem (warunek "condition" możliwości; "not" — „Zamknięte, bo: …”), i sam wybiera. Nadaj możliwościom nazwy, które mówią, dokąd prowadzą („Droga A: młodość”), a wyborowi "title".

## 8b. Drabina opowieści i zagłębienia (2026-11-04)

Opowieści układaj jak drabinę: **jedna ogólna** („Kim jest ksiądz Bosko?”), pod nią **krótkie przeglądy** etapów („Etap 1: Dzieciństwo i szkoły”), pod nimi **głębsze opowieści** („Dom w Becchi bez ojca”, …). Przegląd zostaw krótki. Głębszą treść daj do **własnej opowieści** (własny przebieg, zwykle z własnym "unit") i połącz ją w przeglądzie krokiem **"detour"** w miejscu, w którym pasuje:

```json
{"id": "z1", "type": "detour", "config": {"flow": "@bosko/becchi", "label": "Chcesz wiedzieć więcej: Dom w Becchi bez ojca", "optional": true}}
```

z krawędziami `{"from": "z1", "out": "done", "to": "s5"}` i `{"from": "z1", "out": "skip", "to": "s5"}` (zwykle oba wyjścia do tego samego następnego kroku).

- **W odtwarzaczu** krok pokazuje kartę: nazwę tamtej opowieści, co w niej czeka („7 slajdów · 16 pytań”), „Wejdź” i „Dalej bez tego”. Gdy tamta jest już ukończona — „już znasz”, „Przypomnij” i „Dalej”.
- **„Wejdź”** gra tamtą w środku: tytuł, ścieżka i liczniki są wtedy jej, nad nią pasek „Etap 1 › Dom w Becchi bez ojca” z „Wróć do: Etap 1” (powrót na krok zagłębienia, bez ukończenia). Jej „Koniec” wraca do przeglądu wyjściem "done". Kto wyjdzie z aplikacji w środku, po powrocie jest znów w środku.
- **Postęp należy do opowieści**, nie do drogi: głębsza jest ukończona raz, gdziekolwiek ją skończono (wprost albo przez zagłębienie); jej pytania liczą się jak zawsze. Przegląd przeglądu obejmuje tylko jego własne pytania.
- **Pominięte** ("optional": true, domyślnie) niczego nie blokuje — ani końca przeglądu, ani tego, co po nim; na ścieżce stoi jako przerobione (cienki obrys), a w „Co dalej” po końcu przeglądu jako pierwsze.
- **"optional": false** (rzadko) — tylko „Wejdź”, bez wyjścia "skip"; koniec przeglądu go wymaga.
- Najwyżej **3 zagłębienia** jedno w drugim. **Koło** (A → B → A) import odrzuca z nazwami obu opowieści.
- Głębsza opowieść jest też **własnym polem** w krajobrazie i można ją zacząć wprost. Jeśli jej jednostka wymaga jednostki przeglądu (pole z "prerequisite": "up", np. „Wymaga” → jednostka etapu), otwarta wprost przed ukończeniem przeglądu mówi „Najpierw: „Etap 1””; z przeglądu wchodzi się zawsze.

## 9. Kolejność importu

1. Utwórz stronę (sam adres), jeśli opowieść jest prezentacją — przebieg musi znać jej adres.
2. Zaimportuj bazę wiedzy (knowledge-base): tematy, jednostkę z „Wymaga”, pytania ("about" — tematy), przebieg z "unit", "review" i "goals" (i "presentation").
3. Zaimportuj stronę (page): w "show.story.base" id bazy, w module "path" — "library" i "flow" (id przebiegu).
4. Sprawdź stronę narzędziami podglądu (check_page, preview_page), a bazę — get_knowledge_setup: przebiegi stoją tam w całości, a "landscapes" pokazuje stałą mapę każdego krajobrazu (komórki, obszary, regiony — bez wysokości). Odpis bazy powstaje w przeglądarce kogoś, kto w niej pisze — 45 s po ostatniej zmianie, póki karta jest otwarta, i od razu po imporcie; "SnapshotCurrent": false mówi, że baza zmieniła się później.

### Poprawki i usuwanie w tym samym imporcie

Jeden dokument może też zmieniać i usuwać to, co już jest — wszystko w jednym zapisie (albo nic):

```json
{"format": "recreatio.cogita.entities", "version": 1, "name": "Poprawki opowieści",
 "entities": [
  {"ref": "<id jednostki>", "data": {"wymaga": ["<id tematu A>", "<id tematu B>"]}},
  {"ref": "<id starego pytania>", "remove": true},
  {"ref": "@opowiesc/pytanie-nowe", "kinds": ["question"], "data": {"form": "one", "prompt": "…", "options": ["…", "…"], "correct": [0], "about": ["<id tematu A>"]}}
 ],
 "flows": [{"ref": "<id starego przebiegu>", "remove": true}]}
```

- Zmiana po identyfikatorze: tylko wymienione pola; "kinds" można pominąć; lista (tu "wymaga") zastępuje całą starą.
- Usunięcie: `{"ref": "<id>", "remove": true}`; podgląd wymienia każde z nazwą (można odznaczyć). Odwołania w polach innych wpisów ("about" pytań, "wymaga") znikają w tym samym zapisie; jeśli na wpis wskazuje przebieg ("unit", krok), zapis nie przejdzie — usuń albo popraw przebieg w tym samym dokumencie.
- Odpowiedzi uczących się zostają; karty usuniętego pytania przestają się liczyć (postępy, przegląd, krajobraz).

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
- Długi przegląd z całą głęboką treścią w środku — rozdziel: przegląd krótki, głębsze w osobnych opowieściach przez "detour".
- Zagłębienie bez krawędzi "done" (albo "skip" przy "optional": true) — ścieżka ma ślepy zaułek; dwie opowieści, które przez zagłębienia wchodzą jedna w drugą — import odrzuca koło.
