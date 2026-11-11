# Mapa świata — jak zbudować bazę wiedzy, żeby mapa była czytelna — przewodnik dla AI

Mapa świata to inny wygląd widoku „Krajobraz”: **miejsca** (tematy) stoją jako okrągłe filary, **opowieści** jeżdżą między nimi jak linie kolei, a uczący się widzi, co już umie, czego mu brakuje i jak tam dojść. Mapa powstaje wyłącznie z danych — z tematów, pytań, wymagań i przebiegów. Ten przewodnik mówi, jak je przygotować. Formaty: **knowledge-base** (rodzaje, wpisy, pytania, "flows", "views", "settings"), opowieści: **guide-stories** (templates/cogita/opowiesci-AI.md), schemat: **guide-schemes** (templates/cogita/schematy-AI.md).

## 0. Jak włączyć mapę świata

Widok w trybie "landscape" z `"style": "world"`; miejsca to wpisy rodzaju z kroku "source.kind":

```json
{"views": [{"ref": "@kurs/w/mapa", "name": "Mapa świata", "mode": "landscape",
  "steps": [{"type": "source.kind", "config": {"kind": "@kurs/temat"}}],
  "landscape": {"style": "world"}}]}
```

- Bez `"style"` widok zostaje krajobrazem z sześciokątów (tak jak dotąd).
- Bez kroku "source.kind" aplikacja sama wybiera rodzaje miejsc: te, o których są pytania ("about"), bez jednostek opowieści, slajdów i pytań.
- `"nest": "<pole>"` (jak w krajobrazie) barwi miejsca według węzłów właściciela; bez niego kolory dają obszary policzone z wymagań. Kolor to tylko barwa — nie zmienia linii ani położenia związanych miejsc.

## 1. Miejsca: jeden temat = jedno miejsce

- **Jeden temat, 10–15 pytań**, których "about" wskazuje ten temat. Wysokość filaru = karty, których jeszcze brakuje do tego miejsca (jego własne i całej jego podstawy); zdobyte miejsce jest płaskie.
- **Nie są miejscami**: jednostka opowieści ("unit" przebiegu), slajdy (pokazuje je krok "show"), pytania, węzły obszarów mapy ("nest").
- **Większy temat jako blok z częściami** — tylko wtedy, gdy schemat mówi to wprost: pole-odwołanie z `"part": "up"` w rodzaju części wskazuje blok, do którego część należy (czytane jak `"prerequisite": "up"`); `"part": "down"` w rodzaju bloku wskazuje jego części. Na mapie blok to płaski dysk tuż nad ziemią, a części stoją na nim jako stykające się filary.

```json
{"ref": "@kurs/temat", "name": "Temat", "label": "{nazwa}", "fields": [
  {"key": "nazwa", "label": "Nazwa", "type": "line"},
  {"key": "wymaga", "label": "Wymaga", "type": "ref", "to": ["@kurs/temat"], "multi": true, "prerequisite": "up"},
  {"key": "czesc", "label": "Część bloku", "type": "ref", "to": ["@kurs/temat"], "part": "up"}]}
```

- **Jedno pole nigdy nie ma jednocześnie `"part"` i `"prerequisite"`** — takie pole aplikacja czyta tylko jako wymaganie i zgłasza je autorom. Część należy do jednego bloku.
- Bez pola z `"part"` nie ma bloków (obszary "nest" i kolory to tylko barwy).

## 2. Wymagania: tylko to, czego treść naprawdę wymaga

- Pole z `"prerequisite": "up"` (np. „Wymaga”) wskazuje to, co trzeba znać BEZPOŚREDNIO wcześniej. Wymagania wyznaczają **wysokość** (suma brakujących kart w całej podstawie) i **położenie** (podstawa stoi blisko tego, co na niej buduje).
- Bez kół: koło aplikacja trzyma razem jako grupę i zgłasza autorom.
- `"needs"` pytań nie zmienia mapy ani wysokości — porządkuje tylko kolejność kart w miejscu i źródła biletów.

## 3. Opowieści to linie

- **Jeden przebieg = jedna linia**; nazwa przebiegu to nazwa linii („Z Ruą”). Linie nie mają własnych kolorów — kolor znaczy tylko stan i wybraną drogę. Tor jest rysowany na trzy sposoby: **gruby** — już przebyty, **cienki ciągły** — można nim iść, ale nie przynosi nic nowego (karty są już znane skądinąd), **przerywany** — przynosi nową wiedzę (im mniej nowego, tym gęstsze kreski). Każdy tor ma strzałkę kierunku.
- **Gdzie stoi krok**: slajd pokazuje miejsce (krok "show" z "of" — wprost temat, albo slajd, który polem-odwołaniem wskazuje temat, np. „O czym”, albo przez pytania, które go objaśniają, "explain"); pytanie stoi tam, o czym jest ("about"). Dlatego **łącz każdą scenę i każde pytanie z właściwym tematem**.
- **Przystanki** powstają tylko z tego, co pokazane. Pytanie „pożyczone” (o innym temacie) wprowadza swoją kartę na tym odcinku, ale nie robi przystanku. Krok "review" (Przegląd) nie robi przystanku i niczego nie wprowadza; **to, co przychodzi po nim** (slajd na zakończenie, rozwidlenie), jest rysowane jak wszystko inne. Przebieg, który nie pokazuje żadnego miejsca, staje w miejscach swoich pytań.
- **Każdy slajd i każde pytanie to kropka na torze** (pytanie inną figurą) — na torze wybranym (kliknięta wieża lub tor, prowadzona droga); niewybrane tory są rysowane zgrubnie, bez kropek. Nie rysujemy pionka.
- **Slajd drogi**: slajd bez tematu (puste „thema”) po treści wieży należy do drogi **dalej** — do następnego przystanku albo do rozwidlenia, nie do przyjazdu do wieży.
- **Początek linii**: pierwszy odcinek wychodzi z miejsca, którego wymaga jednostka (najgłębszego; wymagana jednostka z własną opowieścią — z ostatniego przystanku jej linii), a bez wymagań z domu („Start”). Linia, która zaczyna się w środku świata, robi tam węzeł przesiadkowy.
- **Zagłębienie** (krok "detour", zob. guide-stories §8b) jest rysowane jako **pętla dokładnie przy kroku, który je woła**. Opowieść z własną jednostką zachowuje przy tym swój własny tor (swój początek); opowieść bez jednostki, wołana tylko jako zagłębienie, zaczyna i kończy się w miejscu, które ją woła.

## 4. Rozwidlenia leżą między wieżami

- Krok "choice", "chapters" albo scena z kilkoma przyciskami: **każde wyjście to gałąź linii** (także `choice → subflow`).
- **Rozwidlenie** — wybór, którego gałęzie prowadzą do różnych wież — jest **własnym węzłem na drodze**, nie wieżą: droga przychodzi od wieży przez slajdy drogi do węzła, a z węzła do każdej wieży gałęzi biegnie osobny tor. Węzeł mówi, ile slajdów leży przed nim i ile dróg z niego wychodzi („1 slajd, potem rozwidlenie: 2 drogi”). Leży między wieżą a celami gałęzi, blisko wieży: tym dalej, im więcej slajdów jest przed nim w stosunku do długości gałęzi (10–45 % wolnej drogi do najbliższego celu). Gałąź nosi nazwę swojego celu. Wybór z `"hold": true` czeka zawsze na decyzję uczącego się.
- **Te same karty w innym opakowaniu** (wyjaśnienie dla dzieci, dla szkoły, dla dorosłych): wybór, którego gałęzie prowadzą do **tej samej** wieży i schodzą się przed wspólnymi pytaniami — to nie rozwidlenie; mapa rysuje jedną drogę i pozostałe opakowania jako małą pętlę obok niej.
- Jeśli gałęzie rozwidlenia się później schodzą, kończą się na najbliższym wspólnym przystanku.
- Miejsce, w którym zatrzymuje się kilka linii, to **węzeł przesiadkowy** (pierścień wokół filaru). Panel wieży i panel rozwidlenia wymieniają wszystkie kierunki: linia, gałąź, cel, liczba slajdów i pytań, bilet. Uczący się wybiera na mapie, a opowieść otwiera się od razu w wybranej gałęzi.
- Etykieta opcji wyboru jest nazwą gałęzi („Do warsztatów”, „Z Dominikiem Savio”) — pisz ją krótko.

## 5. Bilety: kiedy odcinek jest otwarty

Bilet odcinka powstaje tylko z trzech źródeł:

1. **„Wymaga” jednostki** — na pierwszym odcinku linii: wymagane tematy muszą być **zdobyte** (to samo „zdobyte” co wszędzie: przy poziomach — ostatni poziom, bez poziomów — „knownShare” kart umianych), wymagana jednostka z własną opowieścią — zaliczona.
2. **Warunek opcji**, od której zaczyna się gałąź (`"condition"` w opcji kroku "choice").
3. **Bramka**: krok "condition", którego jedno wyjście opuszcza linię.

Żeby odcinek otwierał się dopiero po pewnej wiedzy, postaw tam warunek "knowness" (na temat z `"band": "known"` znaczy: temat zdobyty; na pojedyncze karty — że te karty są umiane):

```json
{"id": "ch2", "type": "choice", "config": {"options": [
  {"label": "Do warsztatów"},
  {"label": "Do studentów", "condition": {"type": "knowness", "of": "@kurs/temat/comollo", "band": "known"}},
  {"label": "Z Dominikiem Savio"}]}}
```

- **Bramy**: gałąź z własnym warunkiem nosi na początku **małą kłódkę z nazwą wymaganej wieży**; przy „Wymaga” z kilkoma wieżami linia zaczyna się **węzłem bramy**. Tory od wymaganych wież do bramy (i do zamkniętej wieży) mapa pokazuje, gdy wybrany cel prowadzi przez tę bramę — w zwykłym widoku ich nie ma.
- **Wieża stoi na krążkach**: jeden krążek (zawsze tej samej wysokości) na każdą wieżę, którą trzeba zdobyć wcześniej — także pośrednio, każdą raz; na dole to, co przychodzi najpierw, na górze wymaganie bezpośrednie. Zdobyta wieża znika z krążków wszystkich wież, które jej wymagają; wieża bez krążków jest gotowa do zdobycia. Z bliska krążki to paski z nazwami ich wież; kliknięcie krążka płynnie przenosi do jego wieży (z drogą powrotną).
- Panel i dymek **zamkniętej wieży** wymieniają każdą brakującą wieżę, także pośrednią, z jej stanem (otwarta, zamknięta, zdobyta).
- Panel biletu pokazuje przy każdej brakującej karcie jej **źródło**: odcinek, który ją wprowadza (otwarty teraz albo czego sam wymaga), albo „bez slajdu”.
- **Nieznany typ warunku** bilet traktuje jako niespełniony („nieznany typ”) i zgłasza autorom; sam przebieg działa dalej jak dotąd.

## 6. Karty bez slajdu

Karta jest wprowadzona, gdy w opowieści **pada po slajdzie, który ją wyjaśnia** — jako krok "question" albo przez swoje `"explain"` wskazujące slajd, który jest pokazany. Karta, której nie wprowadza żadna opowieść, jest uczona **bezpośrednio** („Ucz się bezpośrednio”) — ale tylko taka: gdzie opowieść istnieje, droga prowadzi przez nią. Miejsce bez żadnej linii stoi wolno.

## 7. Bez położeń, kolorów i wysokości w imporcie

Nie zapisuj w imporcie współrzędnych, kolorów ani wysokości. Położenie liczy aplikacja ze struktury (zawsze tak samo dla tych samych danych); przeglądarka osoby, która pisze w bazie, zapisuje je sama w dokumencie "worldmap" po każdej zmianie (oraz po „Ułóż mapę od nowa”) — nowe miejsca dochodzą, stare się nie przesuwają. Dokument "worldmap" nie wchodzi do eksportu kursu.

## 8. Poziomy: zdobywanie miejsc (ustawienie bazy)

```json
{"settings": {"levelsSetup": {"levels": 3, "rules": [
  {"pct": 75, "attempts": "any"},
  {"pct": 85, "attempts": "one"},
  {"pct": 95, "attempts": "first"}], "knownShare": 1, "pillarWidth": 1, "openAt": 2}}}
```

- **Domyślnie 0 poziomów**: nic się nie zmienia, miejsce jest osiągnięte, gdy jego karty są umiane ("knownShare" — jaka część, domyślnie wszystkie). Wysokość samej wieży (nad krążkami) liczy wtedy jej karty jeszcze nieumiane, a nie wszystkie karty: wieża maleje z każdą umianą kartą.
- **1–5 poziomów**: zdobyć miejsce = odpowiedzieć na jego karty w jednym **przebiegu**; poziom na próg ("pct"), co się liczy ("attempts": "any" — w ogóle dobrze, "one" — po jednej poprawce, "first" — za pierwszym razem) — bez odstępu między poziomami: jeden przebieg podnosi o każdy poziom, którego próg spełnia; **wszystko dobrze za pierwszym razem** daje od razu wszystkie poziomy i wyróżnienie „Mistrzowsko”. Wtedy **powtarzane są tylko zdobyte miejsca** — strona ustawień pokazuje przed zapisem, ile kart wyjdzie z powtórek.
- **"openAt" — kiedy otwierają się ścieżki wieży** (ustawienie autora; uczący się go nie zmieniają): pominięte = dopiero gdy wieża jest **całkiem zdobyta** (domyślnie); `0` = **od razu**, bez zdobywania (ścieżki wychodzące z wieży są otwarte, choć wieża nie jest zdobyta); `1`…(liczba poziomów − 1) = **od tego poziomu** (np. `2` przy 3 poziomach: ścieżki otwierają się po poziomie 2, a wieża jest zdobyta dopiero po 3). Wartość równa liczbie poziomów albo większa oznacza zdobycie (jak pominięta). Przy 0 poziomów ma sens tylko `0`. Ścieżki wychodzące z „Startu” są zawsze otwarte. **Ten sam próg obowiązuje wieże, które jej wymagają**: wieża „przejezdna” (zdobyta albo z poziomem "openAt") nie jest już krążkiem pod nimi, nie blokuje ich przebiegu ani bram i droga nie wraca, by ją dokończyć.
- **Wieżę wolno zdobywać zawsze**, gdy zdobyte są jej wymagania (nie trzeba najpierw zobaczyć wszystkich kart). Panel daje **dwie drogi**: „Zdobywaj teraz” — przebieg po wszystkich kartach, z informacją, ile z nich nigdy jeszcze nie padło — albo „Najpierw powtórz (N)” — tylko karty już wyjaśnione, które jeszcze nie siedzą (i te, których nie wyjaśnia żadna opowieść). Jeśli opowieść wyjaśnia jeszcze nieznane karty, trzecia droga: „Najpierw odkryj drogę”.
- "pillarWidth" (0,4–1) to domyślna szerokość filarów; uczący się zmienia ją i poziomy dla siebie („Moje ustawienia”), chyba że `"locked": true`.

## 9. Jak aplikacja używa tych danych

Widok `"style": "world"` rysuje mapę: filary w kolorze tematu (nasycenie: nigdy nie widziane, częściowo, pełne) na krążkach brakujących wymagań, wysokość wieży = jej brakujące karty, łuki poziomów na krawędzi i pierścień wiedzy na zdobytych, chorągiewka przy zdobytych z kartami do powtórki; linie na torach (równolegle, ze strzałką kierunku; gruby — przebyty, cienki — nic nowego, przerywany — nowa wiedza), pierścienie węzłów, dom „Start”. Kliknięcie wieży lub toru pokazuje drogę do niej: reszta mapy szarzeje, zrobione części cienkie, otwarte wyraźne, bieżący krok najwyraźniejszy. Dymek pokazuje nazwę, „jeszcze N kart” i drogę z domu. Panele: miejsce (poziom, przebieg, brakujące wieże ze stanem, kolejność zdobywania, źródła kart, linie tutaj), odcinek (bilet ze źródłami), rozwidlenie (drogi z celem, slajdami i pytaniami), węzeł (wybór kierunku). „Prowadź mnie tutaj” prowadzi tylko w tej sesji (podwójne kliknięcie wieży otwiera najpierw przegląd całej drogi: kroki po kolei z zawartością, na początku potrzebna powtórka), **łańcuchem**: do pierwszej brakującej wieży, potem do następnej (w porządku wymagań), na końcu do celu — każda wzdłuż swojego toru, przez każde rozwidlenie, bez skoków; przejechane tory zostają w drodze (są tańsze, wolno po nich też wracać). Cała droga świeci jako jedna linia; dymek i panel liczą z tego samego planu. Rozkład jazdy (2 kroki zrobione, bieżący, 4 następne), „Tu możesz też skręcić” z innymi drogami do tej samej wieży, chorągiewka „Zacznij tutaj” i flaga celu. Autorzy (kto pisze w bazie) widzą pod mapą listę uwag do danych. Przez MCP (`get_knowledge_setup`, sekcja "landscapes") widok mapy świata ma postać `{"style": "world", "places": [[x, y, "@temat", "@blok" | null], …], "home": [x, y], "lines": [{"flow", "name", "stops", "deepening", "branches"}], "stations"}` — współrzędne w jednostkach ziemi (promień filaru 28), takie, jakie widzi każdy; do wglądu, nie do importu.

## 10. Lista kontrolna (to samo, co lista dla autorów)

- [ ] Każdy temat ma swoje pytania ("about" = ten temat); żadne pytanie nie jest o jednostce opowieści.
- [ ] Wymagania tylko bezpośrednie, bez kół; żadne odwołanie nie prowadzi donikąd.
- [ ] Bloki tylko przez `"part": "up"` (albo `"down"`), nigdy na polu z `"prerequisite"`; każda część w jednym bloku.
- [ ] Każda opowieść pokazuje swoje miejsca (slajd z tematem albo pytania o tematach) — opowieść bez rozpoznawalnych miejsc nie jest rysowana.
- [ ] Opowieść zaczyna się od swojego pierwszego slajdu ("start" przebiegu = pierwszy krok, nie gdzieś w środku); żaden krok nie jest nieosiągalny.
- [ ] Warunki tylko znanych typów ("knowness", "value", "answered", "visited", "flow", "time", "place", "zone", "and", "or", "not", "xor").
- [ ] Wątek, który wymienia swoje części, ma do każdej zagłębienie; jednostka wymaga etapu, a nie wymagań etapu sąsiedniego.
- [ ] „Wymaga” jednostki wskazuje istniejące tematy albo jednostki; "unit" przebiegu istnieje.
- [ ] Miejsca bez linii i karty bez slajdu są zamierzone (uczy się ich bezpośrednio).
- [ ] Obszary kolorów mają sensowne nazwy (obszar nazwany od innego tematu niż jego środek — nazwij go w widoku).
- [ ] Bez współrzędnych, kolorów i wysokości w imporcie.
