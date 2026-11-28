# Opowieść, która liczy się w Cogicie — przewodnik dla AI

Ten przewodnik mówi, jak zbudować kurs w formie opowieści tak, żeby każda odpowiedź liczyła się w bazie wiedzy: w krajobrazie, na ścieżce, w powtórkach i w postępach. Kompletny przykład do zaimportowania: **example-story** (baza wiedzy) i **example-story-page** (strona). Formaty: **knowledge-base** (sekcja "flows") i **page** (prezentacja, "story", moduły "question" i "path").

> **Najpierw przeczytaj „guide-good-world”** (`get_import_format guide-good-world`) — co to jest dobry świat: jedna opowieść prowadzi do jednej wieży, krótka główna droga z pomocą po błędach, pytania oceniane tylko przez komputer, samodzielna nauka i lekcja z tej samej treści. Ten przewodnik mówi, jak to zapisać.

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

### Bez pustych slajdów decyzji

Slajd, na którym nie ma już nic do rozstrzygnięcia, się pomija — warunkiem, nie przyciskiem:

- **Prezentacja**: bramka przed slajdem — `{"key": "czy", "type": "condition", "when": {…}, "yes": "dalej", "no": "slajd"}` — i cel `gate:czy` w "go" poprzedniej sceny. "yes" prowadzi od razu dalej, "no" na slajd.
- **Własny graf przebiegu**: każdy krok "show", "opening", "line" i "scene" (bez pytania) przyjmuje `"skipWhen": {warunek}` — gdy warunek jest spełniony, opowieść idzie od razu dalej. Krok "choice", któremu zostaje dokładnie JEDNA obowiązująca możliwość (pozostałe mają "condition", który nie jest spełniony), sam ją wybiera (z jej "actions"); `"hold": true` zatrzymuje wybór mimo to. **Kiedy aplikacja wybiera sama** (2026-11-22) — tylko gdy wybór jest jasny: (a) jak wyżej, bez "of" i bez "hold"; (b) na prowadzonej drodze do celu („Prowadź mnie tutaj” na mapie świata, sprawdzanie, co już umiesz) na każdym rozwidleniu bierze gałąź, która prowadzi do celu; (c) gdy w aktywnym trybie (nauka samodzielna albo lekcja, §8h) pasuje tylko JEDNA gałąź — wtedy także z "of" i "hold", a ani uczący się, ani nauczyciel nie widzą wyboru.
- **Wybór z opisem w nim samym (2026-11-11)**: rozwidlenie to JEDEN krok — jego opis w `"of"` (wpis-slajd, jak w "show": tytuł, tekst ze wszystkimi znacznikami, przypisy, linki, także "@@świat:", wzory, `::: details`, "drawing"), a pod nazwą każdej możliwości jedna linia w `"hint"`. **Nie stawiaj osobnego slajdu przed wyborem tylko po to, żeby opisać możliwości** — uczący się czytałby je dwa razy na dwóch ekranach, a licznik liczyłby dwa kroki. Nazwa możliwości ("label") to nazwa linii na mapie — najwyżej 32 znaki; "hint" — najwyżej 100. Wybór z `"of"` nie wybiera sam (jak `"hold": true`) — chyba że rozstrzyga tryb (§8h). Przykład (rozwidlenie do dwóch wież): `{"id": "dokad", "type": "choice", "config": {"of": "@kurs/s/rozstaje", "title": "Dokąd teraz?", "options": [{"label": "Do warsztatów", "hint": "jak ksiądz Bosko uczył chłopców zawodu"}, {"label": "Do szkoły", "hint": "lekcje wieczorowe i pierwsi nauczyciele"}]}}`. **Nie pytaj na początku „Jak mam to opowiedzieć?”** i nie buduj trzech kopii drogi (dla dzieci, dla szkoły, dla dorosłych): formę wyjaśnienia uczący się wybiera dopiero po błędzie (§8g, „Formy wyjaśnienia”).
- **Warunki** (te same wszędzie): znajomość — `{"type": "knowness", "of": "@kurs/t/start", "band": "learned"}`; **niedawna powtórka** — `{"type": "answered", "of": "<pytanie>", "correct": true, "within": 7}` (dobrze odpowiedziano w ciągu ostatnich 7 dni; bez "within" czas nie gra roli); złożone "and", "or", "not". Warunek, którego nie da się odczytać, nigdy nie pomija kroku.

## 6. Ukończona opowieść i warunek „Przebieg”

- Koniec: scena, po której „dalej” prowadzi do "end" (albo krok "end" przebiegu). Opowieść jest wtedy „ukończona” — zostaje, także po „od początku”. Cele przebiegu ("goals") zapisują się jako osiągnięte i zostają osiągnięte.
- Warunek `{"type": "flow", "flow": "@kurs/opowiesc", "state": "done"}` ("started", "goal" z "goal": "id") działa w widokach ("filter.when"), powtórkach i krokach widoku krajobrazu.
- Postęp uczącego się jest prywatny: nie ma go w eksporcie ani w MCP.

## 7. Przegląd na końcu (nieobowiązkowy) — zdany zalicza opowieść

**Zalecane zakończenie** (guide-good-world §1.6): 2–4 pytania, które łączą kroki, i podsumowanie; po podsumowaniu nic — powtórki prowadzi wieża. Krok "review" jest **nieobowiązkowy**: użyj go, gdy opowieść ma się zaliczać przeglądem (np. jednostka w krajobrazie). Wtedy opowieść kończy się krótkim przeglądem tego, czego uczyła — W TYM SAMYM przebiegu, z TYMI SAMYMI pytaniami co w opowieści (ta sama historia kart). Przebieg z celami opuszcza jednostkę do doliny dopiero, gdy jest ukończony **i** każdy cel osiągnięty; bez celów — gdy ukończony.

**Najprościej (od 2026-11-05): jeden krok "review".** Zamiast kilku kroków na każde pytanie wstaw na końcu jeden krok:

`{"id": "przeglad", "type": "review", "config": {"of": "story", "threshold": 0.9}}` → wyjścia "passed" (zdany) i "notyet" (jeszcze nie).

Pyta jeszcze raz o pytania tego przebiegu (kroki "question"), których uczący się jeszcze nie umie — każde raz w rundzie — i pokazuje wynik („Umiesz 9 z 10 (90 %)”). Co najmniej "threshold" → "passed", inaczej "notyet" (bez połączenia opowieść kończy się z przeglądem jeszcze niezdanym, a na końcu stoi „Powtórz przegląd”; albo połącz "notyet" z wyborem „Spróbuj jeszcze raz” / „Zakończ na razie” — nie z samym krokiem "review"). Przebieg bez "goals" dostaje sam cel „Przegląd zdany” ("goal": inna nazwa, np. „Durchsicht bestanden” w bazie niemieckiej), a „Powtórz przegląd” wraca do tego kroku. Na ścieżce to jeden węzeł „Przegląd”. "value" — gdzie zapisać wynik (domyślnie „<nazwa opowieści>.przeglad”: 1 / 0). Dawny sposób poniżej nadal działa:

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

**Opis i wybór na jednym ekranie (2026-11-11).** Wybór z `"of"` pokazuje swój slajd (tytuł, tekst, rysunek obok tekstu — na telefonie pod nim) NAD możliwościami; "title" wyboru jest wtedy nagłówkiem możliwości (bez "title" — bez osobnego nagłówka). Każda możliwość może mieć `"hint"`: jedną krótką linię pod nazwą (zwykły tekst ze znacznikami w linii, najwyżej 100 znaków — dłuższy daje ostrzeżenie przy imporcie); stoi nad tym, co czeka za możliwością, i nad powodem zamknięcia. "label" zostaje krótką nazwą drogi (najwyżej 32 znaki) — to nazwa linii na mapie świata. Na ścieżce taki wybór jest JEDNYM krokiem (węzeł rozwidlenia), jego slajd nie jest osobną częścią „slajdy do przeczytania”; licznik postępu liczy go raz; slajd liczy się jako pokazany (jego temat, jak przy "show"). W trybie przeglądania („Już za Tobą — tylko do przejrzenia”) widać tekst i możliwości z zaznaczoną wybraną; można też wybrać inną drogę.

## 8b. Drabina opowieści i zagłębienia (2026-11-04)

Opowieści układaj jak drabinę: **jedna ogólna** („Kim jest ksiądz Bosko?”), pod nią **krótkie przeglądy** etapów („Etap 1: Dzieciństwo i szkoły”), pod nimi **głębsze opowieści** („Dom w Becchi bez ojca”, …). Przegląd zostaw krótki. Głębszą treść daj do **własnej opowieści** (własny przebieg, zwykle z własnym "unit") i połącz ją w przeglądzie krokiem **"detour"** w miejscu, w którym pasuje:

```json
{"id": "z1", "type": "detour", "config": {"flow": "@bosko/becchi", "label": "Chcesz wiedzieć więcej: Dom w Becchi bez ojca", "optional": true}}
```

z krawędziami `{"from": "z1", "out": "done", "to": "s5"}` i `{"from": "z1", "out": "skip", "to": "s5"}` (zwykle oba wyjścia do tego samego następnego kroku).

- **Rysunek przy slajdzie**: krok "show" z "drawing" (ten sam JSON co moduł „Animacja” i pytanie "interactive": vars, controls — suwaki —, elements) pokazuje rysunek obok tekstu slajdu (na telefonie pod nim) — statyczny albo z suwakami, bez oceny: `{"id": "s7", "type": "show", "config": {"of": "@laag/folie/zwei-geraden", "drawing": {…}}}`; "drawing" może też być kluczem pola slajdu, które trzyma rysunek — albo grafiką bazy ("@…", z dodatkami tego slajdu, §8j), wspólną dla kilku slajdów, z płynnym przejściem.
- **Długi dowód zwinięty**: w treści slajdu blok `::: details Beweisidee` … `:::` (w polu "blocks": `{"type": "details", "summary": "Beweisidee", "text": "…"}`) — pokazany zwinięty z nagłówkiem.
- **W odtwarzaczu** krok pokazuje kartę: nazwę tamtej opowieści, co w niej czeka („7 slajdów · 16 pytań”), „Wejdź” i „Dalej bez tego”. Gdy tamta jest już ukończona — „już znasz”, „Przypomnij” i „Dalej”.
- **„Wejdź”** gra tamtą w środku: tytuł, ścieżka i liczniki są wtedy jej, nad nią pasek „Etap 1 › Dom w Becchi bez ojca” z „Wróć do: Etap 1” (powrót na krok zagłębienia, bez ukończenia). Jej „Koniec” wraca do przeglądu wyjściem "done". Kto wyjdzie z aplikacji w środku, po powrocie jest znów w środku.
- **Postęp należy do opowieści**, nie do drogi: głębsza jest ukończona raz, gdziekolwiek ją skończono (wprost albo przez zagłębienie); jej pytania liczą się jak zawsze. Przegląd przeglądu obejmuje tylko jego własne pytania.
- **Pominięte** ("optional": true, domyślnie) niczego nie blokuje — ani końca przeglądu, ani tego, co po nim; na ścieżce stoi jako przerobione (cienki obrys), a w „Co dalej” po końcu przeglądu jako pierwsze.
- **"optional": false** (rzadko) — tylko „Wejdź”, bez wyjścia "skip"; koniec przeglądu go wymaga.
- Najwyżej **3 zagłębienia** jedno w drugim. **Koło** (A → B → A) import odrzuca z nazwami obu opowieści.
- Głębsza opowieść jest też **własnym polem** w krajobrazie i można ją zacząć wprost. Jeśli jej jednostka wymaga jednostki przeglądu (pole z "prerequisite": "up", np. „Wymaga” → jednostka etapu), otwarta wprost przed ukończeniem przeglądu mówi „Najpierw: „Etap 1””; z przeglądu wchodzi się zawsze.

## 8c. Inne światy: linki i zagłębienia do innej bazy wiedzy (2026-11-05)

Opowieść może zaprosić do **innej bazy wiedzy** („świata”) — Fizyka przy prawach Newtona do Historii przy chwalebnej rewolucji. To zawsze **oferta, nigdy wymaganie**. Odwołanie ma postać `"@@<nazwa bazy>:<@trwała/nazwa albo identyfikator>"`:

```json
{"settings": {"handle": "fizyka", "worlds": [{"id": "<identyfikator bazy Historia>", "handle": "historia", "name": "Historia"}]}}
```

- **Nazwa bazy** to `"handle"` z jej Ustawień (`{"settings": {"handle": "historia"}}` w tamtej bazie) — małe litery, cyfry, „-”. Lista `"worlds"` mówi, którą bazę ta nazwa oznacza; jeśli jej nie podasz, import sam dopisze świat, gdy wśród baz, które czyta użytkownik, jest baza o tej nazwie.
- **Link w tekście slajdu** (w każdym polu z zapisem): `Newton żył w czasach [[chwalebnej rewolucji|@@historia:@historia/rewolucja-1688]].` — klik otwiera kartę: nazwa świata, jedno zdanie, stan uczącego się tam, „Otwórz”.
- **Zagłębienie w innym świecie** — krok `detour`, którego `"flow"` wskazuje opowieść tamtej bazy:

```json
{"id": "z2", "type": "detour", "config": {"flow": "@@historia:@historia/f/rewolucja", "label": "Zagłębienie w innym świecie: Historia"}}
```
  krawędzie jak przy zwykłym zagłębieniu: `{"from": "z2", "out": "done", "to": "s4"}` i `{"from": "z2", "out": "skip", "to": "s4"}`. Jest **zawsze nieobowiązkowe** (`"optional": false` nie obowiązuje). „Wejdź” gra tamtą opowieść z paskiem „Fizyka › Prawa Newtona › Historia: Chwalebna rewolucja” i wraca na ten krok.
- **Pole wpisu** z `"external": true` (zob. schematy-AI.md) zbiera linki „W innych światach” przy temacie.

**Jak aplikacja używa tych danych:** na stronie wpisu i tematu stoi „W innych światach” (karty z nazwą bazy, zdaniem i stanem uczącego się w tamtej bazie); w krajobrazie przy polu znak portalu (z bliska) i lista w panelu tematu, bez linii między bazami. Widzi je tylko ten, kto może czytać tamtą bazę — inni nie widzą nic, właściciel widzi „niedostępne”. **Postęp zostaje tam, gdzie powstaje**: odpowiedzi w Historii liczą się w Historii, nie w Fizyce. Odwołania nie liczą się do znajomości, krajobrazu, celów, przeglądu ani powtórek tej bazy, a tamta baza sama decyduje, co jest w niej wcześniej („Najpierw: …”). Odwołanie, które się zerwało (wpis usunięty, nazwa nieznana), uczący się nie widzi; właściciel ma je w „Do zrobienia”. Import przyjmuje każde `@@…` i tylko ostrzega (nieznany świat, świat bez dostępu, brak wpisu, zagłębienie do czegoś, co nie jest opowieścią); eksport zapisuje je tak samo.

## 8d. Mapa świata: opowieści jako linie (2026-11-09)

W widoku z `"landscape": {"style": "world"}` każda opowieść jest **linią** między miejscami (tematami), rozwidlenie — **węzłem przesiadkowym**, a „Wymaga” jednostki, warunek opcji wyboru i krok "condition" — **biletem** odcinka. Żeby ta mapa była czytelna: każdy slajd i każde pytanie wskazuje właściwy temat, przebieg zaczyna się od pierwszego slajdu, etykiety opcji są krótkie (to nazwy gałęzi), a zagłębienia wołają opowieści, które naprawdę należą do wątku. Wszystko o miejscach, blokach (`"part": "up"`), przystankach, biletach, poziomach i liście dla autorów: **guide-world-map** (templates/cogita/weltkarte-AI.md).

## 8e. Einstufung — „Sprawdź, ile już umiesz” (2026-11-12)

W dużym świecie uczący się nie musi przechodzić przez wieże, które już umie. Krok **"explore"** sprawdza jeszcze nie zdobyte wieże zakresu **prawdziwymi pytaniami bazy** (każda odpowiedź liczy się jak zawsze, z `via: "placement"`) i idzie dalej do wież, które na nich budują — tak daleko, jak uczący się sięga. Jeden węzeł w opowieści (jak "detour"), wyjście "done"; ten sam krok może stać w kilku opowieściach (stan jest wspólny dla zakresu).

```json
{"id": "sprawdz", "type": "explore", "config": {
  "title": "Sprawdź, ile już umiesz",
  "scope": ["@kurs/dziedzina/mechanika"], "downTo": "@kurs/t/swobodny-spadek",
  "modes": ["adaptive", "target"], "default": "adaptive", "targetLevels": [1, 2],
  "streak": 3, "errors": 2, "recheck": 2, "once": true, "push": true}}
```

- **Zakres**: dziedziny (z ich wieżami), wieże, jednostki (to, czego wymagają, z podstawą, i przystanki ich linii); `"downTo"` — cała podstawa wieży razem z nią. Wszystko liczy aplikacja z grafu wymagań ("prerequisite": "up").
- **Czoło**: wieże zakresu jeszcze nie zdobyte, których wszystkie warunki są przejezdne (jak wszędzie, od "openAt"). Następne pytanie losuje się z całego czoła — uczący się skacze między obszarami. Pytania, które odtwarzacz pominąłby jako znane (7a), liczą się jako dobre — wieża może zostać zaliczona bez jednego pytania.
- **Adaptacyjnie** ("adaptive"): "streak" dobrych z rzędu zalicza wieżę; "errors" błędów w jednej wieży kończy ją w tym sprawdzaniu (jej następcy nie wchodzą) i cofa o krok: jej warunki zaliczone w TYM sprawdzaniu są sprawdzane jeszcze raz, po kolei ("recheck" dobrych z rzędu potwierdza; jeden błąd cofa zaliczenie i sprawdza jego warunki zaliczone w tym sprawdzaniu — i tak w dół). Wieże zdobyte wcześniej prawdziwymi odpowiedziami nie są nigdy sprawdzane ponownie.
- **Zaliczenie** daje poziom potrzebny do pójścia dalej: "openAt" bazy (co najmniej 1; bez "openAt" — wszystkie poziomy); bez poziomów: „zdobyta (zaliczona sprawdzeniem)”. Wyższe poziomy i gwiazdki dają tylko przebiegi. Zaliczenie to prywatna wartość uczącego się (`~placed.<wieża>`), nie odpowiedź; ważne tylko, dopóki warunki wieży są przejezdne (cofnięte zaliczenie odbiera je też następcom). Znajomość kart się nie zmienia.
- **Do poziomu** ("target"): uczący się wybiera poziom z "targetLevels"; wieża jest pytana jak prawdziwe zdobycie tego poziomu (procent i zasada prób), losowo bez powtórzeń, kończy się wcześniej, gdy wynik jest przesądzony; zdobyta — zwykły przebieg; nie — jej następcy nie wchodzą (także gdy "openAt" by ich otworzył). Tylko z poziomami i gdy serwer zapisuje przebiegi.
- „Zakończ na razie” zachowuje stan, „Kontynuuj” go wznawia. Na końcu: ile zaliczono, luki z „Ucz się” i „Ustaw jako cel” przy pierwszej. Z "once" sprawdzanie jest potem zrobione; „Sprawdź jeszcze raz” pyta tylko o to, co zostało otwarte. „Dalej bez sprawdzania” zapamiętuje pominięcie dla zakresu. Gdy w zakresie nic nie jest otwarte, krok przechodzi sam dalej.
- **Zachęta** ("push"): przy wyborze możliwość, której droga ma niezrobione sprawdzanie z otwartymi wieżami (krok "explore" przed następnym wyborem albo "detour"/"subflow" do opowieści, która się nim zaczyna), stoi pierwsza z „Zalecane: najpierw sprawdź, ile już umiesz”.
- Ścieżka i mapa świata pokazują krok jako jeden krok.

## 8f. Opowieść jako krok drogi do pytania (2026-11-12)

Opowieść (albo jej część od kroku "from") może być krokiem **drogi do pytania** ("paths", guide-world-map §10): `{"flow": "@opowieść", "from": "<id kroku>", "why": "…"}`. Krok jest zrobiony, gdy odcinki opowieści na mapie są przejechane. Kotwica `{"flow": "@opowieść", "step": "<id>"}` stawia drogowskaz przy rozwidleniu (krok "choice") albo przy kroku na torze. Opowieść niczego tu nie zmienia — droga tylko ją proponuje; dlatego trwałe identyfikatory kroków ("id") są ważne: "from" i "step" wskazują na nie.

## 8g. Przebieg adaptacyjny: odpowiedź decyduje, co dalej (2026-11-20)

Pytanie ma dziś nie tylko „dobrze” i „źle”. Każde nowe wyjście bez krawędzi wraca do starego — przebieg bez nich działa jak dotąd. Nie buduj liczników ani kroków "set" po każdym pytaniu: wystarczy kilka linii przy samym kroku.

- **Znaczniki błędów w pytaniu** (`"tags"`): jeden na możliwość (one, many), parę (match), lukę (gap) albo pozycję (order, build), w tej samej kolejności; pusty = bez znacznika. Przykład: `"options": ["Autor", "Chłopiec, który mówi „ja”", "Matka"], "correct": [1], "tags": ["myli-narratora-z-autorem", "", "myli-narratora-z-postacia"]`. Nazwy krótkie, małymi literami, z łącznikami — opisują BŁĄD MYŚLENIA, nie możliwość.
- **Wyjścia kroku "question"**: `"right"`, `"wrong"`, `"wrong:<znacznik>"` (zła odpowiedź z tym znacznikiem), `"partial"` (wynik ≥ `"partialAt"`, np. `{"partialAt": 0.5}` — ma sens przy many, match, gap, order, build), `"rightOnRetry"` (dobrze w drugiej próbie), `"pick:<i>"` (wybrano możliwość i — pytania diagnostyczne i o opinię). Podpowiedzi już obniżają wynik.
- **Jeszcze raz**: `{"retry": {"after": ["@slajd"], "max": 1}}` — po złej odpowiedzi slajdy, potem to samo pytanie (bez przerywnika). Obie próby trafiają do historii karty. `"max"` 1, najwyżej 2. Używaj tylko na wyraźne życzenie właściciela: to samo pytanie drugi raz od razu nuży; pytanie sprawdzające i powtórki wieży robią to lepiej.
- **Skrót pomocy** — zwykle wystarczy:

```json
{"id": "sonda", "type": "question", "config": {"of": "@kurs/q/kto",
  "onWrong": {"show": ["@kurs/s/prosciej"], "byTag": {"myli-narratora-z-autorem": ["@kurs/s/autor"]},
              "check": "@kurs/q/latwe", "then": "continue"},
  "onRight": {"skip": ["@kurs/s/podstawy"]}}}
```

  Po złej odpowiedzi: slajdy (dla znacznika — jego własne zamiast ogólnych), potem łatwiejsze pytanie sprawdzające, potem `"then"`: `"continue"` (domyślnie; dalej: stara krawędź "wrong", inaczej tam, dokąd prowadzi "right") albo `"retry"` (to samo pytanie jeszcze raz; wyjścia "right", "rightOnRetry", "wrong" — tylko na życzenie właściciela). `"onRight.skip"`: po dobrej odpowiedzi te slajdy są pomijane. Aplikacja sama rozwija skrót w kroki; eksport oddaje skrót.

  **Pomoc to własne slajdy** (2026-11-26): slajdy w `"show"`, `"byTag"` i `"retry.after"` są slajdami pomocy napisanymi dla tego błędu (`…/h1`, `…/h2`), których główna droga nie pokazuje. Nigdy nie wskazuj tam slajdu głównej drogi (`…/s1`): uczący się właśnie go przeczytał albo przeczyta za chwilę — dostaje go dwa razy. Import ostrzega („pomoc … pokazuje jeszcze raz …”).
- **Warunki na odpowiedzi tego przejścia** — w kroku "condition", w "condition" możliwości wyboru i w "skipWhen":
  - `{"type": "session", "since": "unit" | "flowStart" | "<id kroku>", "wrong": {"op": "ge", "than": 3}}` (także "right", "partial", "hintsUsed"),
  - `{"type": "lastAnswer", "correct": false}` · `{"type": "lastAnswer", "tag": "zbyt-doslownie"}` · `{"type": "lastAnswer", "hintsUsed": {"op": "ge", "than": 1}}`,
  - `{"type": "streak", "right": 3}` — ostatnie 3 odpowiedzi dobre (skrót dla pewnych siebie).
  Typowo: na końcu `condition` z `"session"` ≥ 3 błędów → slajd podsumowania.
- **Pomoc się nie liczy**: kroki pomocy (wygenerowane, z `"remedial": true` albo osiągalne tylko przez "wrong:<znacznik>", "partial", "rightOnRetry") nie wchodzą do postępu, liczników przy wyborach ani linii na mapie — ścieżka i mapa pokazują je jako małą pętlę przy tej samej części/wieży („3 kroki pomocy”). Własny slajd pomocy za "wrong:<znacznik>" oznacz `"remedial": true`.
- **Formy wyjaśnienia po błędzie, nie kopie drogi** (guide-good-world §1.6): jedna krótka główna droga; dopiero gdy pojawi się trudność, `wrong:<znacznik>` prowadzi do wyboru formy (`"choice"` z `"of"` i `"hint"`), a jego gałęzie to kroki pomocy (`"remedial": true`), które wracają na drogę. Formy różnią się naprawdę (narracja, długość, przykłady), ale wszystkie używają tych samych faktów i pytań; ich liczbę i nazwy wybiera autor:

```json
{"nodes": [
  {"id": "q", "type": "question", "config": {"of": "@kurs/q/hustawka"}},
  {"id": "jak", "type": "choice", "config": {"of": "@kurs/s/jak-wyjasnic", "title": "Jak to wyjaśnić?", "remedial": true, "options": [
    {"label": "Z przykładem", "hint": "brat i siostra na huśtawce"}, {"label": "Ze wzorem — pomyślę sam", "hint": "jeden wzór, jedno pytanie"},
    {"label": "Krok po kroku", "hint": "trzy krótkie slajdy"}, {"label": "Krótko", "hint": "jedno zdanie"}]}},
  {"id": "f1", "type": "show", "config": {"of": "@kurs/s/hustawka-przyklad", "remedial": true}},
  {"id": "f2", "type": "show", "config": {"of": "@kurs/s/hustawka-wzor", "remedial": true}},
  {"id": "f3", "type": "show", "config": {"of": "@kurs/s/hustawka-kroki", "remedial": true}},
  {"id": "f4", "type": "show", "config": {"of": "@kurs/s/hustawka-krotko", "remedial": true}},
  {"id": "check", "type": "question", "config": {"of": "@kurs/q/hustawka-latwe", "remedial": true}},
  {"id": "dalej", "type": "show", "config": {"of": "@kurs/s/rownowaga"}},
  {"id": "koniec", "type": "end"}],
 "edges": [
  {"from": "q", "out": "right", "to": "dalej"}, {"from": "q", "out": "wrong", "to": "dalej"},
  {"from": "q", "out": "wrong:myli-mase-z-ramieniem", "to": "jak"},
  {"from": "jak", "out": "o0", "to": "f1"}, {"from": "jak", "out": "o1", "to": "f2"}, {"from": "jak", "out": "o2", "to": "f3"}, {"from": "jak", "out": "o3", "to": "f4"},
  {"from": "f1", "out": "next", "to": "check"}, {"from": "f2", "out": "next", "to": "check"}, {"from": "f3", "out": "next", "to": "check"}, {"from": "f4", "out": "next", "to": "check"},
  {"from": "check", "out": "right", "to": "dalej"}, {"from": "check", "out": "wrong", "to": "dalej"}, {"from": "dalej", "out": "next", "to": "koniec"}]}
```
- **Slajdy pomocy przy temacie**: niech wskazują ten sam temat co pytanie ("about" pytania ↔ pole-odwołanie slajdu, np. "o_czym") — inaczej import ostrzega.
- **Podgląd importu** wymienia przy każdym pytaniu jego drogi i ostrzega: znacznik bez krawędzi, krawędź do znacznika, którego pytanie nie ma, pomoc bez powrotu, "max" > 2, slajd pomocy poza tematem. Autorzy widzą później (zsumowane, nigdy dla jednej osoby), jak często wybrano każdą drogę, ile następnych sprawdzeń było dobrych i które znaczniki są najczęstsze — tam warto poprawić wyjaśnienie.
- Pełny przykład: „example-adaptive” (templates/cogita/przyklad-adaptacyjny.json).

## 8h. Lekcja i nauka samodzielna: przewidywania i tryby (2026-11-22)

Samodzielnie: najpierw wyjaśnienie, potem pytanie, które sprawdza, czy dotarło. Na lekcji: najpierw sytuacja **bez** odpowiedzi i pytanie-przewidywanie (wszyscy głosują, rozkład pokazuje, jakie błędy siedzą w klasie), potem wyjaśnienie zależne od odpowiedzi, potem pytanie sprawdzające zrozumienie (guide-good-world §1.7). Lekcja zbudowana inaczej to **osobna ścieżka do lekcji** (`"use": "lesson"` na górze opowieści, §8i) przez te same wieże; ten rozdział opisuje kroki takiej ścieżki oraz małe różnice wewnątrz ścieżki wspólnej dla obu trybów.

- **Przewidywanie**: `"predict": true` na kroku "question", np. `{"id": "p", "type": "question", "config": {"of": "@kurs/q/ktora-kula", "predict": true}}`. Pytanie pokazuje się i ma wyjścia jak każde (`"right"` → krótkie potwierdzenie dlaczego, `"wrong:<znacznik>"` → wyjaśnienie dokładnie tego błędu, `"wrong"`), na lekcji otwiera głosowanie i rozkład — ale **nigdy się nie liczy**: nie trafia do historii karty, znajomości, poziomów, zdobycia ani powtórek (także uczniom klasy). Odtwarzacz mówi przed odpowiedzią i po niej „To pytanie się nie liczy — to przewidywanie”. Na ścieżce i mapie świata liczy się jak krok pomocy. Pytanie-przewidywanie patrzy w przód („Co się stanie, gdy…?”, „Która kula spadnie pierwsza?”), a jego złe możliwości to typowe przedsądy klasy, każda ze znacznikiem. **Pytania klasy nie należą do wież** (2026-11-26): głosowanie, przewidywanie, opinia to osobny wpis pytania z `"use": "lesson"` i **bez "about"** — nie ma go w przebiegu wieży, jej poziomach ani powtórkach (mapa i tak nie bierze pytania "lesson" do wieży; kontrola świata zgłasza `question.classInTower`). **Nigdy to samo pytanie jako przewidywanie i jako pytanie sprawdzające zrozumienie** — import ostrzega.
- **Kto gra krok — `"use"`**: `"self"` (tylko samodzielnie), `"lesson"` (tylko na lekcji), `"both"` (domyślnie). Na wpisie — klucz w jego "data" (`{"tytul": …, "tekst": …, "use": "lesson"}`; pytanie ma też pole "use") — albo w "config" kroku (wygrywa; ten sam slajd może służyć inaczej w dwóch opowieściach). Krok, którego tryb nie gra, jest pomijany jak przy "skipWhen" (slajd przez "next", pytanie przez "right", objazd przez "skip").
- **Gałęzie według trybu**: gałąź "choice" albo "chapters", której PIERWSZY krok nie pasuje do trybu, w tym trybie nie obowiązuje i nikt jej nie widzi. Gdy pasuje tylko jedna, aplikacja bierze ją sama (§5, (c)) — nauczyciel nigdy nie widzi przełącznika, a opowieść idzie za trybem.
- **Warunek trybu**: `{"type": "mode", "is": "lesson"}` (albo `"self"`) w krokach "condition", w "condition" możliwości wyboru i w "skipWhen" — na to, czego nie pokrywają oznaczenia, np. pytanie na wyjście tylko na lekcji. Nigdy bilet na mapie.
- **Tryb** to nie znacznik: "self" ma każdy, kto uczy się sam; "lesson" — lekcja prowadzona przez nauczyciela (tryb „Prowadzę”, tylko z rolą nauczyciela albo administratora w obszarze klasy). Ścieżka, mapa i liczniki pokazują tylko to, co gra aktywny tryb; kroki pominięte przez tryb nigdy nie „brakują”.
- **Projektor**: każdy krok da się pokazać na ekranie klasy — slajd zrozumiały bez klikania, pytanie mieści się na ekranie; lekcja kończy się trzema pytaniami indywidualnymi (bilet na wyjście).
- **Import** ostrzega przed nieznanym "use" albo "is", gałęzią, do której żaden tryb nie wchodzi, i opowieścią, z której w jednym trybie nic nie zostaje.

Wzór drogi (zwykle tak):

```
sytuacja (both) → wyjaśnienie (use: self) → przewidywanie (predict, use: lesson)
   right → „tak — dlaczego” (lesson)      wrong:<znacznik> → wyjaśnienie tego błędu (lesson)
→ doświadczenie: wybór „Razem w klasie” (lesson) / „Sam w domu” (self) — aplikacja bierze sama
→ pytanie sprawdzające zrozumienie (both, liczy się) → {"type": "mode", "is": "lesson"} → bilet na wyjście
```

Pełny przykład: „example-lesson” (templates/cogita/przyklad-lekcja.json).

## 8i. Ścieżki do samodzielnej nauki i ścieżki do lekcji (2026-11-26)

**Wieże są wspólne, ścieżki nie.** Cała opowieść (przebieg) może mieć na górze `"use"`:

- bez "use" — ścieżka dla obu trybów (domyślnie);
- `"use": "self"` — ścieżka tylko do samodzielnej nauki: nie ma jej na mapie, gdy nauczyciel uczy;
- `"use": "lesson"` — ścieżka tylko do lekcji: widzi ją wyłącznie nauczyciel w trybie „Prowadzę” na mapie świata (Nauka → Mapa świata) i klasa, która za nim podąża na żywo. Uczeń sam jej nigdy nie widzi — ani na mapie, ani na liście przebiegów.

`{"ref": "@kurs/f/lekcja-ulamki", "name": "Ułamki — lekcja", "use": "lesson", "start": "s1", "graph": {…}}`

Mapa ma dwa tryby: „Samodzielna nauka” i „Lekcja” (dla nauczyciela wybór „Prowadzę / Uczę się” w menu ☰ mapy). Te same wieże stoją w tych samych miejscach, a linie są w każdym trybie inne. Kiedy co wybierać:

- opowieść, którą da się przejść samemu, i lekcja, która ją powtarza → jedna opowieść bez "use", z krokami "use" i przewidywaniami (§8h);
- lekcja zbudowana inaczej (głosowania na początku, praca w grupach, doświadczenie w klasie, dyskusja) → osobna opowieść z `"use": "lesson"` przez te same wieże; jej pytania klasy mają `"use": "lesson"` i nie mają "about" (§8h);
- droga, która ma sens tylko w pojedynkę (powtórka, ćwiczenia w domu) → `"use": "self"`.

Każda wieża potrzebuje ścieżki w trybie samodzielnym — inaczej uczeń samodzielnie do niej nie dojdzie. Import ostrzega przed nieznanym "use".

## 8j. Jedna grafika na kilku slajdach i przejścia (2026-11-26)

**Grafika bazy** (`"graphics"` w JSON kursu) to rysunek (ten sam JSON co "drawing": size, elements, vars, controls…), który pokazuje kilka slajdów. Części, które slajdy zmieniają, mają `"id"`:

```json
"graphics": [{ "ref": "@kurs/g/atom", "name": "Atom",
  "drawing": { "size": [400, 240], "alt": "Jądro i elektrony",
    "elements": [ { "id": "jadro", "type": "circle", "x": 200, "y": 120, "r": 24, "fill": "accent" },
                  { "id": "e1", "type": "circle", "x": 280, "y": 120, "r": 6, "fill": "muted" } ] } }]
```

W kroku "show" (albo "choice" z "of"):

- `"drawing": "@kurs/g/atom"` — grafika taka, jaka jest;
- `"drawing": {"graphic": "@kurs/g/atom", "add": [ {część}, … ], "change": {"e1": {"x": 120, "fill": "ok"}}, "hide": ["e1"], "set": {"vars": {"n": 3}}}` — grafika i to, co dodaje TEN slajd: nowe części na wierzchu ("add"), zmiana części o danym "id" ("change" — wartości zastępują, także "motion"), części pominięte ("hide"), wartości na górze ("set"; "vars" łączą się z vars grafiki).

**Przejście między slajdami z tą samą grafiką** dzieje się samo: obraz zostaje, a tekst slajdu wchodzi na nowo. Część o tym samym "id" (albo o identycznej treści) zostaje — jej jednorazowe ruchy (wejście) nie grają drugi raz, pętle grają dalej; część w innym miejscu, rozmiarze, obrocie albo kolorze **płynnie przechodzi** ze starego stanu w nowy (0,7 s); nowa część gra swój ruch ("motion"), a bez niego się pojawia; część, której już nie ma, znika. Części z wyrażeniami ("=x0 + v*t") ruszają się same — nie przechodzą płynnie. Krok bez grafiki pomiędzy przerywa ciąg (następny slajd pokazuje grafikę od nowa, z jej wejściem).

Dobry wzór: najpierw slajd z gołą grafiką, potem kolejne slajdy, z których każdy dodaje albo przesuwa jedną rzecz (`"add"`/`"change"`) — uczący się widzi, co się zmieniło. Nie kopiuj rysunku do każdego kroku; nie zmieniaj na jednym slajdzie więcej niż dwóch–trzech części.

**Jak wchodzi slajd**: `"transition"` w "config" kroku albo na górze przebiegu (dla wszystkich jego kroków): `"fade"` (domyślnie, przenikanie), `"slide"` (wsuwa się z prawej), `"zoom"` (rośnie ze środka), `"none"` (od razu). Przy „mniej ruchu” (Wygląd) zawsze od razu. Import ostrzega przed nieznaną wartością i przed "@…", którego nie ma.

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

### Cały świat w jednym pliku ("wholeWorld", "part", 2026-11-22)

Gdy plik opisuje CAŁY świat (całą bazę), nie trzeba wypisywać usunięć: w nagłówku kursu `"wholeWorld": true` — to, co jest w pliku, zachowuje identyfikatory, a wszystko inne z bazy (wpisy i struktury: przebiegi, widoki, powtórki, szablony, zbiory, formularze, wejścia, nagrody, drogi, wyglądy, reguły, wartości) jest usuwane w tym samym zapisie. Nigdy: rodzaje, ustawienia, uwagi, odpowiedzi i postępy.

```json
{"format": "recreatio.cogita.course", "version": 1, "name": "Fizyka — mechanika",
 "wholeWorld": true, "part": "mechanika",
 "kinds": [ … ], "entities": [ … ], "flows": [ … ], "views": [ … ]}
```

- Podgląd zaczyna się od wiersza „CAŁY ŚWIAT: … zostanie usunięte” i wymienia każde usunięcie (można odznaczyć); serwerowe sprawdzenie importu (MCP) pokazuje to samo, zanim cokolwiek się zapisze.
- `"part"`: wszystko, co plik tworzy albo zmienia, należy do tej części; z `"wholeWorld": true` usuwane jest tylko to, co należy do TEJ części. To, co nigdy nie przyszło z częścią, zostaje (podgląd je liczy) — zaimportuj część raz z `"part"`, żeby jej istniejące elementy do niej należały. Duży świat (fizyka) dziel tak na części, jedna część = jeden plik.
- To, czego nie ma w pliku, ale plik na to wskazuje (id albo trwała nazwa), zostaje — z ostrzeżeniem. Odwołania jak przy `"remove": true`: przebieg innej części, który wskazuje na usuwany wpis, zatrzymuje zapis.
- Eksport bazy zaimportowany z `"wholeWorld": true` niczego nie usuwa. Do 20 000 elementów w jednym zapisie (duży idzie w częściach, ale zapisuje się w jednej transakcji).

### Kolor w tekście slajdu (2026-11-21)

Słowa na slajdzie można pokolorować: `[te słowa]{.red}` (kolory `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray`, a `mark` — zakreślacz). Stała paleta, czytelna w jasnym i ciemnym wyglądzie; nieznany kolor — tekst bez koloru i ostrzeżenie w imporcie. Szczegóły: „guide-visuals” §6a.

## 10. Typowe błędy

- Pytania z jednostką w "about" — jednostka dostaje karty, opada bez opowieści, a jej przycisk ćwiczy karty.
- Licznik bez nazwy opowieści ("przeglad") — dwie opowieści dzielą jeden licznik.
- Przegląd bez zerowania na początku — „Powtórz przegląd” liczy dalej od starego wyniku.
- Cel z innym warunkiem niż bramka wyniku — opowieść idzie do końca, a pole nie opada (albo odwrotnie).
- Przegląd bez kroku "review" (gdy opowieść ma się nim zaliczać) — „Powtórz przegląd” zaczyna całą opowieść od początku.
- Trzy kopie drogi (dla dzieci, dla szkoły, dla dorosłych) wybierane przed jakąkolwiek trudnością — zamiast nich formy wyjaśnienia po błędzie (§8g).
- Pytanie `"flash"` (samoocena) — w świecie wiedzy każdą odpowiedź ocenia komputer.
- Blok 10+ pytań na końcu albo linia przez kilka wież — zamknięcie to 2–4 pytania łączące kroki, a jedna opowieść prowadzi do jednej wieży.
- Strona bez "story.base" — odpowiedzi zostają w przeglądarce, Nauka ich nie widzi.
- "unit" wskazuje temat zamiast jednostki.
- Bramka z "band": "known" zaraz po jednej odpowiedzi — "known" wymaga powtórek; do „przeszedł drogę” użyj "learned".
- Rozwidlenie bez powrotu — po pierwszej drodze opowieść idzie dalej i reszta dróg przepada; użyj bramki z powrotem albo "chapters".
- Kopia storyboardu w "graph" przebiegu — dwa grafy rozjeżdżają się; wystarczy "presentation".
- Sceny wstępu i spotkania bez "about" — ścieżka nie ma ich kroków.
- Długi przegląd z całą głęboką treścią w środku — rozdziel: przegląd krótki, głębsze w osobnych opowieściach przez "detour".
- Zagłębienie bez krawędzi "done" (albo "skip" przy "optional": true) — ścieżka ma ślepy zaułek; dwie opowieści, które przez zagłębienia wchodzą jedna w drugą — import odrzuca koło.
- Cytat wpisany w akapit jako „**Cytat (T. Bosco):** „…”” — pokazuje się jak zwykły tekst. Cytat to osobny akapit z „> ” (rozdział 11).

## 11. Tekst kroku: akapity, cytaty, przypisy (2026-11-05)

Pola "markup" (tekst wpisu, który krok pokazuje) czyta się na ekranie kroku — od lewej, w szerokości do czytania. Żeby wyglądały czysto:

- Krótkie akapity (2–4 zdania), oddzielone pustą linią; śródtytuł `## …` tylko przy dłuższym tekście.
- **Cytat** — osobny akapit, każda linia od `> `; słowa w cudzysłowie, źródło jako przypis na końcu słów; ostatnia linia `> — Kto` to podpis pod cytatem:

  ```
  > „Wszystkie następne lata zostały głęboko naznaczone tym snem.” [@bosco-biografia, s. 5]
  > — Teresio Bosco
  ```

  Pokazuje się jako wyróżniony blok z podpisem po prawej.
- **Źródło** — `[@klucz-dzieła, s. 12]` na końcu zdania (dzieło w bibliotece, z której baza korzysta); przypisy numerują się same i stoją pod tekstem, kolejne z tego samego dzieła jako „Tamże”. Nie pisz numerów, list „Przypisy” ani źródeł w nawiasach ręcznie.
- Odesłanie do innej części opowieści albo innego wpisu — `[[słowa|@wpis]]` (link), nie cudzysłów z nazwą.
- Przejście dalej daje przycisk „Dalej →” pod tekstem — nie kończ tekstu zdaniem „kliknij dalej”.

## Slajdy i pytania (2026-11-05)

- **Pytanie → slajd.** Zacznij "explain" każdego pytania od 1–2 slajdów opowieści (wpisów z „Treścią w blokach”, które pokazuje krok "show"), potem temat. Po odpowiedzi uczący się widzi te slajdy pierwsze, narysowane jak w odtwarzaczu (zwinięte), a pod nimi „Zobacz w opowieści” — podgląd opowieści na tym slajdzie, który niczego nie zapisuje (nawet gdy opowieść jest zamknięta lub nie zaczęta; nad nią drabina zagłębień, np. „Etap 1 › Sen dziewięciolatka”).
- **Slajd → pytania.** Każdy slajd pokazuje „Pytania do tego slajdu (N)” (pytania, których "explain" go wymienia) z „Ćwicz”: w odtwarzaczu w menu „⋯”, we wpisie slajdu obok odwołań.
- **Mapa „Pytania”.** Obok mapy opowieści: jedno pole na grupę pytań o tych samych początkowych slajdach, przy swojej opowieści, w kolejności slajdów. Pytanie o całą opowieść (np. oś czasu) ma w "explain" JEDNOSTKĘ opowieści — stoi w polu „Cała opowieść”.
- **Tytuł slajdu.** Odtwarzacz pokazuje "title" kroku "show"; bez niego — nazwę slajdu (jego etykietę, np. „tytul”). Nie powtarzaj tytułu w tekście.
- **Pisownia bloków.** Pusta linia w akapicie = nowy akapit. Cytat: wiersze „> …” i ostatni „> — Autor, Dzieło”. Przypisy: [^1] w tekście i „[^1]: …” na końcu (lista „Przypisy” powstaje sama). Import ostrzega przed: „Cytat (…):”, ręcznie pisaną listą „Przypisy”, „kliknij dalej”, cytatem bez „> —” i cytowaniem [@…] w treści pytania.
- **Miejsce w opowieści** jest w postępie uczącego się (krok, odwiedzone, ukończona, cele). Import, który zmienia identyfikatory kroków, nie kasuje postępu: odtwarzacz zaczyna od pierwszego nieodwiedzonego kroku, „ukończona”, cele i przebyte drogi zostają. Dawaj krokom stałe "id" (np. "s<klucz slajdu>").
