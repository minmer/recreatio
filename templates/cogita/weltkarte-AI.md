# Mapa świata — jak zbudować bazę wiedzy, żeby mapa była czytelna — przewodnik dla AI

Mapa świata to inny wygląd widoku „Krajobraz”: **miejsca** (tematy) stoją jako okrągłe filary, **opowieści** jeżdżą między nimi jak linie kolei, a uczący się widzi, co już umie, czego mu brakuje i jak tam dojść. Mapa powstaje wyłącznie z danych — z tematów, pytań, wymagań i przebiegów. Ten przewodnik mówi, jak je przygotować. Formaty: **knowledge-base** (rodzaje, wpisy, pytania, "flows", "views", "settings"), opowieści: **guide-stories** (templates/cogita/opowiesci-AI.md), schemat: **guide-schemes** (templates/cogita/schematy-AI.md).

> **Najpierw przeczytaj „guide-good-world”** — co to jest dobry świat; ten przewodnik mówi, jak go zapisać, żeby mapa była czytelna.

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

- **Jeden temat = ok. 4–8 minut nauki**: liczba pytań zależy od czasu jednego pytania, zwykle 10–15; ich "about" wskazuje ten temat. Wysokość filaru = karty, których jeszcze brakuje do tego miejsca (jego własne i całej jego podstawy); zdobyte miejsce jest płaskie.
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

- **Jedna opowieść prowadzi do jednej wieży** (albo kończy się rozwidleniem do kilku wież), nigdy przez kilka wież.
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
- **Formy wyjaśnienia, nie kopie** (guide-good-world §1.6): wybór formy („Z przykładem”, „Krok po kroku”, „Krótko”) dopiero po błędzie — `wrong:<znacznik>` → "choice" z "of" i "hint", gałęzie to kroki pomocy (`"remedial": true`), które wracają na drogę do **tej samej** wieży. To nie rozwidlenie: mapa rysuje jedną drogę, pomoc — małą pętlę przy wieży. Nie trzy kopie drogi (dzieci, szkoła, dorośli) wybierane na początku.
- Jeśli gałęzie rozwidlenia się później schodzą, kończą się na najbliższym wspólnym przystanku.
- Miejsce, w którym zatrzymuje się kilka linii, to **węzeł przesiadkowy** (pierścień wokół filaru). Panel wieży i panel rozwidlenia wymieniają wszystkie kierunki: linia, gałąź, cel, liczba slajdów i pytań, bilet. Uczący się wybiera na mapie, a opowieść otwiera się od razu w wybranej gałęzi.
- Etykieta opcji wyboru jest nazwą gałęzi („Do warsztatów”, „Z Dominikiem Savio”) — najwyżej 32 znaki.
- **Opis rozwidlenia (2026-11-11)**: co czeka na drogach, opisz w samym wyborze — `"of"` (slajd nad możliwościami) i `"hint"` przy możliwości (jedna linia, najwyżej 100 znaków). Etykiety zostają nazwami linii; węzeł przesiadkowy pokazuje w swoim panelu przy każdej drodze jej "hint". Nie dodawaj osobnego slajdu przed wyborem tylko do opisu — slajd drogi przed rozwidleniem leży na torze do węzła i liczyłby się jak każdy inny slajd.

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

## 5a. Pomoc po złej odpowiedzi to nie linia (2026-11-20)

Przebieg adaptacyjny (guide-stories §8g: "onWrong", "retry", "wrong:<znacznik>", "partial", "rightOnRetry", kroki z `"remedial": true`) nie rysuje nowych torów ani rozwidleń: pomoc to **mała przerywana pętla przy wieży pytania**, a panel wieży mówi „N kroków pomocy po złych odpowiedziach (nie liczą się)”. Kroki pomocy nie robią przystanków, nie wprowadzają kart i nie liczą się do postępu ani do liczników dróg. Kroki "condition" z warunkami na odpowiedzi przejścia (`"session"`, `"lastAnswer"`, `"streak"`) — tak jak "set" — są niewidoczne: nie są bramkami ani biletami (rozstrzygają się dopiero w drodze). Slajdy pomocy łącz z tematem pytania, żeby pętla stała przy właściwej wieży. Kroki z `"use": "lesson"` i przewidywania (`"predict": true`) nie są krokami linii ucznia (guide-stories §8h).

## 5b. Tagi: sieć tematów do filtrowania mapy (2026-11-22)

Duży świat uczący się ogląda **po kawałku**: wybiera tag, mapa rysuje tylko wieże pod nim (wyspa i położenia te same). Tagi wybierają autorzy.

- **Jak:** pole odwołania z `"tag": "up"` — to, na co wskazuje, to tagi wpisu. Tag to dowolny wpis, zwykle rodzaju „Tag”; jego pola tagu wskazują tagi **nadrzędne** (sieć z poziomami; podtag może mieć **kilku** rodziców).
- **Wieża** nosi tagi swojego wpisu i tagi swojego bloku (`"part": "up"`).
- **Tag nadrzędny pokazuje wszystkie wieże pod sobą** (wszystkie poziomy); uczący się zawęża podtagiem; przy tagu: zdobyte / wszystkie.
- **Bez kół** (tag nie leży nad samym sobą) — import ostrzega, aplikacja tnie koło.
- Krok `"explore"` z tagiem w `"scope"` i „Sprawdź, co wiesz” przy wybranym tagu sprawdzają tylko wieże pod nim.
- **Najpierw przeczytaj tagi świata:** `get_knowledge_setup`, sekcja `"tags"` (`ref, name, parents, level, towers, towersBelow`) — używaj istniejących.
- To nie **znaczniki błędów** pytania (pole `"tags"`, guide-stories §8g).

```json
{"kinds": [
  {"ref": "@k/tag", "name": "Tag", "label": "{name}", "fields": [{"key": "name", "label": "Nazwa", "type": "line"}, {"key": "nad", "label": "Należy do", "type": "ref", "multi": true, "tag": "up", "to": ["@k/tag"]}]},
  {"ref": "@k/temat", "name": "Temat", "label": "{name}", "fields": [{"key": "name", "label": "Nazwa", "type": "line"}, {"key": "tagi", "label": "Tagi", "type": "ref", "multi": true, "tag": "up", "to": ["@k/tag"]}]}
 ],
 "entities": [
  {"ref": "@tag/mechanika", "kinds": ["@k/tag"], "data": {"name": "Mechanika"}},
  {"ref": "@tag/energia", "kinds": ["@k/tag"], "data": {"name": "Energia"}},
  {"ref": "@tag/energia-mechaniczna", "kinds": ["@k/tag"], "data": {"name": "Energia mechaniczna", "nad": ["@tag/mechanika", "@tag/energia"]}},
  {"ref": "@temat/hustawka", "kinds": ["@k/temat"], "data": {"name": "Huśtawka", "tagi": ["@tag/energia-mechaniczna"]}}
 ]}
```

## 6. Karty bez slajdu

Karta jest wprowadzona, gdy w opowieści **pada po slajdzie, który ją wyjaśnia** — jako krok "question" albo przez swoje `"explain"` wskazujące slajd, który jest pokazany. Karta, której nie wprowadza żadna opowieść, jest uczona **bezpośrednio** („Ucz się bezpośrednio”) — ale tylko taka: gdzie opowieść istnieje, droga prowadzi przez nią. Miejsce bez żadnej linii stoi wolno.

## 7. Bez położeń, kolorów i wysokości w imporcie

Nie zapisuj w imporcie współrzędnych, kolorów ani wysokości. Położenie liczy aplikacja ze struktury (zawsze tak samo dla tych samych danych); przeglądarka osoby, która pisze w bazie, zapisuje je sama w dokumencie "worldmap" po każdej zmianie (oraz po „Ułóż mapę od nowa”) — nowe miejsca dochodzą, stare się nie przesuwają. Dokument "worldmap" nie wchodzi do eksportu kursu.

## 8. Poziomy: zdobywanie miejsc (ustawienie bazy)

```json
{"settings": {"levelsSetup": {"levels": 2, "rules": [
  {"pct": 75, "attempts": "any"},
  {"pct": 90, "attempts": "one"}], "knownShare": 1, "openAt": 1}}}
```

- **Zalecane (guide-good-world §1.3)**, każda nowa baza zaczyna od tego. Inne ustawienie (np. 3 poziomy 75/85/95) zostaje, dopóki właściciel nie zdecyduje; zmianę (3 → 2) objaśnia podgląd importu — nic, co dają nowe reguły, nie przepada (poziomy liczy się z przebiegów).
- **Bez ustawienia — 0 poziomów**: nic się nie zmienia, miejsce jest osiągnięte, gdy jego karty są umiane ("knownShare" — jaka część, domyślnie wszystkie). Wysokość samej wieży (nad krążkami) liczy wtedy jej karty jeszcze nieumiane, a nie wszystkie karty: wieża maleje z każdą umianą kartą.
- **1–5 poziomów**: zdobyć miejsce = odpowiedzieć na jego karty w jednym **przebiegu**; poziom na próg ("pct"), co się liczy ("attempts": "any" — w ogóle dobrze, "one" — po jednej poprawce, "first" — za pierwszym razem) — bez odstępu między poziomami: jeden przebieg podnosi o każdy poziom, którego próg spełnia; **wszystko dobrze za pierwszym razem** daje od razu wszystkie poziomy i wyróżnienie „Mistrzowsko”. Wtedy **powtarzane są tylko zdobyte miejsca** — strona ustawień pokazuje przed zapisem, ile kart wyjdzie z powtórek.
- **"openAt" — kiedy otwierają się ścieżki wieży** (ustawienie autora; uczący się go nie zmieniają): pominięte = dopiero gdy wieża jest **całkiem zdobyta** (domyślnie); `0` = **od razu**, bez zdobywania (ścieżki wychodzące z wieży są otwarte, choć wieża nie jest zdobyta); `1`…(liczba poziomów − 1) = **od tego poziomu** (np. `1` przy 2 poziomach: ścieżki otwierają się po poziomie 1, a wieża jest zdobyta dopiero po 2). Wartość równa liczbie poziomów albo większa oznacza zdobycie (jak pominięta). Przy 0 poziomów ma sens tylko `0`. Ścieżki wychodzące z „Startu” są zawsze otwarte. **Ten sam próg obowiązuje wieże, które jej wymagają**: wieża „przejezdna” (zdobyta albo z poziomem "openAt") nie jest już krążkiem pod nimi, nie blokuje ich przebiegu ani bram i droga nie wraca, by ją dokończyć.
- **Wieżę wolno zdobywać zawsze**, gdy zdobyte są jej wymagania (nie trzeba najpierw zobaczyć wszystkich kart). Panel daje **dwie drogi**: „Zdobywaj teraz” — przebieg po wszystkich kartach, z informacją, ile z nich nigdy jeszcze nie padło — albo „Najpierw powtórz (N)” — tylko karty już wyjaśnione, które jeszcze nie siedzą (i te, których nie wyjaśnia żadna opowieść). Jeśli opowieść wyjaśnia jeszcze nieznane karty, trzecia droga: „Najpierw odkryj drogę”.
- "pillarWidth" (0,4–1) to domyślna szerokość filarów; uczący się zmienia ją i poziomy dla siebie („Moje ustawienia”), chyba że `"locked": true`.

- **Zaliczone sprawdzeniem (2026-11-12)**: wieża zaliczona krokiem "explore" („Sprawdź, ile już umiesz”, zob. guide-stories §8e) ma na mapie przerywany pierścień wokół wierzchu, a w panelu „zaliczona sprawdzeniem — karty jeszcze do potwierdzenia”. Bramy, bilety, drogi i "openAt" traktują ją jak zdobytą na poziomie "openAt". Jej jeszcze nie pytane karty wchodzą do powtórki przy domu, ale najwyżej 20 na jedną powtórkę (najpierw ostatnio zaliczonych wież). Przy rozwidleniu możliwość, która prowadzi do niezrobionego sprawdzania z otwartymi wieżami, stoi pierwsza jako „Zalecane”.

## 10. Drogi do pytań ("paths", 2026-11-12)

Uczący się często przychodzi z pytaniem, nie z miejscem. **Droga do pytania** prowadzi go po mapie do odpowiedzi: szerokie pytanie („Kim był ksiądz Bosko?”) albo konkretne („Dlaczego ksiądz Bosko założył salezjanów?”). Lista "paths" w kursie, każda droga z trwałą nazwą ("ref"; zmiana i usuwanie jak przy innych dokumentach: {"ref", "remove": true}).

```json
{
  "ref": "@bosko/p/dlaczego-salezjanie",
  "name": "Dlaczego ksiądz Bosko założył salezjanów?",
  "promise": "Potem powiesz, dlaczego powstało Zgromadzenie i kto do niego należał.",
  "anchors": [
    "@bosko/t/1855",
    {
      "flow": "@bosko/f/glowna",
      "step": "w5"
    }
  ],
  "steps": [
    {
      "place": "@bosko/t/1854",
      "why": "Tu pada nazwa „salezjanie”."
    },
    {
      "flow": "@bosko/f/zgromadzenie",
      "from": "s3",
      "why": "Wątek Zgromadzenia aż do 18 grudnia 1859."
    },
    {
      "place": "@bosko/t/1854",
      "level": 2,
      "why": "Druga runda: szczegóły."
    }
  ],
  "check": {
    "questions": [
      "@bosko/q/zgromadzenie-1",
      "@bosko/q/zgromadzenie-2"
    ]
  },
  "deeper": "@bosko/p/najwazniejsze"
}
```

- **"name"** — samo pytanie (tekst drogowskazu i panelu); **"promise"** — jedno zdanie, co uczący się potem umie.
- **"steps"** w kolejności, każdy z jednym zdaniem **"why"**: `{"place": "@miejsce"}` — temat; zrobiony, gdy wieża jest przejezdna (jej "openAt"); `{"place": "@miejsce", "level": 2}` — **spirala**: to samo miejsce drugi raz, głębiej (zrobione dopiero na tym poziomie; pierwsza runda = przegląd, druga = wyższy poziom); `{"flow": "@opowieść", "from": "<id kroku>"}` — opowieść albo jej część od tego kroku (zrobiona, gdy jej odcinki na mapie są przejechane).
- **"anchors"** — gdzie droga jest proponowana; aplikacja stawia **drogowskaz** obok kotwicy (mały słupek z tabliczką „?”, bez własnych kart; kilka dróg przy jednej kotwicy dzieli jeden drogowskaz, na tabliczce ich liczba): `"home"` (Start — Start i tak wymienia wszystkie drogi: „Czego chcesz się dowiedzieć?”), `"@miejsce"` (wieża albo węzeł przesiadkowy; panel miejsca też ją wymienia), `{"flow": "@opowieść", "step": "<id>"}` — rozwidlenie (krok "choice") albo krok na torze. **Bez współrzędnych.**
- **"check"** — zakończenie: 1–3 pytania bazy (`{"questions": [...]}`; zaliczone, gdy każde ostatnio w pełni dobrze) albo slajd (`{"slide": "@slajd"}`: „Teraz możesz odpowiedzieć…”). **"deeper"** — głębsza droga, proponowana, gdy ta jest zrobiona („Głębiej”).
- **Stan** (u każdego uczącego się): nie zaczęta / w drodze (jakiś krok zrobiony) / zrobiona (kroki zrobione i zakończenie zaliczone; bez "check": kroki zrobione) — znak na drogowskazie. Wybrana droga świeci jak każda wybrana trasa.
- **„Idź tą drogą”** prowadzi jak „Prowadź mnie tutaj”: najpierw drogi do kolejnych otwartych kroków, opowieści jako przejazdy ich odcinków, znane pomija; na końcu sprawdzenie. **„Ustaw jako cel”** ustawia drogę jako cel.
- **Zasady:** droga jest ofertą — nigdy nie zmienia wymagań, kolejności, wysokości wież, znajomości ani poziomów; kto ją pomija, nic nie traci. Dobra droga ma 3–8 kroków, pytanie, które uczący się naprawdę zadaje, i obietnicę, którą zakończenie sprawdza.
- **Import ostrzega** (z nazwą drogi): nieznane miejsce, opowieść albo krok "from"; kotwica, której nie ma; pętla ("deeper" wraca do tej drogi, ten sam krok dwa razy z rzędu); więcej niż 3 pytania zakończenia. Na mapie autor widzi też krok, którego nie ma na mapie świata (nie da się tam poprowadzić).
- **Dla AI:** get_knowledge_setup ma sekcję "paths" (dokładnie jak w imporcie), a mapa świata w "landscapes" — "signs": kotwica, drogi i miejsce drogowskazu [x, y].

Szeroka droga ze Startu:

```json
{
  "ref": "@bosko/p/kim-byl",
  "name": "Kim był ksiądz Bosko?",
  "promise": "Potem opowiesz jego życie w ośmiu etapach.",
  "anchors": [
    "home"
  ],
  "steps": [
    {
      "flow": "@bosko/f/glowna",
      "why": "Przegląd całego życia."
    },
    {
      "place": "@bosko/t/etap-1",
      "why": "Dzieciństwo."
    },
    {
      "place": "@bosko/t/etap-2"
    },
    {
      "place": "@bosko/t/etap-8",
      "why": "Ostatnie lata."
    }
  ],
  "check": {
    "slide": "@bosko/s/kim-byl-koniec"
  }
}
```

## 9. Jak aplikacja używa tych danych

Widok `"style": "world"` rysuje mapę: filary w kolorze tematu (nasycenie: nigdy nie widziane, częściowo, pełne) na krążkach brakujących wymagań, wysokość wieży = jej brakujące karty, łuki poziomów i pierścień wiedzy na zdobytych, chorągiewka przy zdobytych z kartami do powtórki; linie na torach (gruby — przebyty, cienki — nic nowego, przerywany — nowa wiedza), pierścienie węzłów, dom „Start”. Kliknięcie wieży lub toru pokazuje drogę do niej (reszta szarzeje). Panele: miejsce (poziom, brakujące wieże, kolejność zdobywania, źródła kart, linie), odcinek (bilet), rozwidlenie (drogi z celem), węzeł. „Prowadź mnie tutaj” (w tej sesji) prowadzi **łańcuchem**: do pierwszej brakującej wieży, potem do następnej (w porządku wymagań), na końcu do celu — wzdłuż torów, przez każde rozwidlenie, bez skoków; przy rozwidleniu sama wybiera gałąź, która prowadzi do celu. Autorzy (kto pisze w bazie) widzą pod mapą listę uwag do danych. Przez MCP (`get_knowledge_setup`, sekcja "landscapes") widok mapy świata ma postać `{"style": "world", "places": [[x, y, "@temat", "@blok" | null], …], "home": [x, y], "lines": [{"flow", "name", "stops", "deepening", "branches"}], "stations"}` — współrzędne w jednostkach ziemi (promień filaru 28), do wglądu, nie do importu.

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
- [ ] Poziomy: 2 zalecane (75 % "any", 90 % "one", "openAt": 1) albo inne z decyzji właściciela.
- [ ] Tagi (jeśli są): pole z `"tag": "up"`; istniejące tagi z `get_knowledge_setup` → "tags" użyte ponownie; bez kół; podtag może mieć kilku rodziców.
