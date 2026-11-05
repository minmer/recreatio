# Książka → Biblioteka i Cogita: przewodnik dla KI

Ten przewodnik dostaje Twoja KI (Claude, ChatGPT…) razem z dziełem: książką w PDF-ie, skanem albo plikiem. Prowadzi ją w dwóch krokach: najpierw dzieło trafia do **Biblioteki** Recreatio — opis bibliograficzny i cały tekst — a potem, po przeczytaniu całości i po Twoim wyborze z menu, powstaje część **Cogita**: wiedza z dzieła w porządku od ogółu do szczegółu, pytania i powtórki. Aplikacja nie woła żadnej KI — KI odpowiada dokumentami JSON, które wklejasz w aplikacji (każdy import pokazuje najpierw, co zmieni).

**Przewodnik nie zakłada rodzaju książki.** Każde dzieło opisują te same warstwy wiedzy, a każda warstwa ma jeden ogólny schemat (plik w `templates/cogita/`, importowany raz do bazy wiedzy):

| warstwa | schemat | przydaje się przy |
|---|---|---|
| przebieg dzieła i jego stałe elementy — części, wątki, wydarzenia, argumenty, osoby, miejsca, motywy | `wywod.json` | powieści, filmie, wywodzie, kazaniu, dokumencie |
| fakty i źródła — co dzieło mówi o prawdziwym świecie, kiedy i gdzie, i czy to się zgadza; okresy | `fakty.json` | powieści o prawdziwej osobie, podręczniku historii, reportażu, wspomnieniach, wywiadzie |
| zbiór pozycji do rozpoznania i rozróżnienia | `zbior.json` | mszale (prefacje, kolekty), modlitewniku, śpiewniku, psałterzu, kodeksie, katalogu dzieł |
| pojęcia i to, czego każde wymaga | `podstawy.json` | podręczniku, dokumencie, wykładzie |
| pytania każdego rodzaju | `pytania.json` | zawsze |

Dzieło zwykle łączy kilka warstw: powieść o prawdziwej osobie — przebieg, elementy i fakty; podręcznik historii — fakty, okresy i pojęcia; mszał albo śpiewnik — zbiór i pojęcia; kodeks — zbiór pozycji (artykuły) i pojęcia. Wszystko, czego tu nie ma, jest w dodatkach — wygenerowanych z aplikacji, więc zawsze zgodnych z tym, co aplikacja przyjmuje. Gdy żaden schemat nie pasuje do rodzaju wiedzy, nowy buduje się według `schematy-AI.md` (co aplikacja liczy sama, a co opisuje schemat).

## 0. Zasady dla KI

1. **Nic nie zmyślaj.** Tekst przepisujesz wiernie. Fakty bierzesz z dzieła i ze źródeł, które naprawdę sprawdziłaś(-eś); czego nie da się sprawdzić — oznaczasz. Lepiej puste pole niż zgadywanie.
2. **Dwa kroki, nie jeden.** Po kroku 1 zatrzymaj się, pokaż menu (krok 2) i czekaj na wybór.
3. **Odpowiadaj dokumentami JSON** w formatach z dodatków. Poza JSON-em — tylko krótki raport i pytania.
4. **Trwałe nazwy.** Każdy wpis, który tworzysz w Cogicie, dostaje `"ref"` z ukośnikiem: `"@<klucz dzieła>/<co>/<nazwa>"`, np. `"@kowalski2005/fakt/swiecenia"`, `"@mszal1986/pozycja/prefacja-adwent-1"`. Ten sam dokument zaimportowany drugi raz zmienia te same wpisy, a nie tworzy nowe — możesz więc poprawiać i doklejać.
5. **Duże dzieła w kawałkach.** Najwyżej ok. 150 wpisów albo kilka rozdziałów tekstu na jedną odpowiedź; następne odpowiedzi odwołują się do tych samych trwałych nazw.
6. **Język** treści — język dzieła; opisy, pytania i oceny — po polsku, chyba że użytkownik chce inaczej.

## 1. Krok pierwszy: dzieło do Biblioteki — opis i cały tekst

Przeczytaj dzieło i zrób **jeden dokument „Dzieło z tekstem”** (dodatek A): opis dzieła ze strony tytułowej i metryczki (tytuł, podtytuł, autorzy, wydawca, miejsce, rok, wydanie, ISBN, język, liczba stron, **gatunek** — np. „powieść biograficzna”, „podręcznik”, „mszał”, „śpiewnik”) oraz cały tekst w częściach.

**Jak wskazuje się miejsca** (`"scheme"` dokumentu i dzieła) — to sprawa Biblioteki; w Cogicie miejsce to zawsze dzieło i miejsce w nim, zapisane tak jak w książce:

- dzieło czytane stronami (powieść, wspomnienia, podręcznik) — `"pages"`; rozdział można dopisać w miejscu bloku: „rozdz. 3, s. 45”;
- dzieło z własną numeracją treści — `"numbered"` (dokumenty, kodeksy: nr 24, kan. 915), `"bible"`, `"aquinas"`, `"outline"` (tom, część, rozdział);
- **strony liczone osobno w częściach książki** (wstęp, dodatki, wkładki — np. w mszale, modlitewniku, podręczniku z aneksem): `"pages"`, a każdy blok `"page"` niesie stronę dokładnie tak, jak jest wydrukowana, z jej znakami — „xii”, „12*”, „3'”, „3''”, „(7)”, „A12”. Znaki mogą być dowolne; strona „12*” i strona „12” to dwie różne strony. W polu dzieła **„Serie stron”** (`"pageSeries"`) podaj po jednej przykładowej stronie z każdej serii, w kolejności książki, np. `"xii 12* 1 3'"`;
- **numer pozycji** (prefacja I, pieśń 112, art. 12) to nie strona — trafi do Cogity jako „Numer” i „Oznaczenie” pozycji (`zbior.json`). Miejscem zostaje strona albo numer w układzie dzieła.

**Części tekstu** (`"portions"`): po jednej na rozdział, dział albo grupę (np. „Rozdział 3”, „Prefacje adwentowe”), w kolejności książki. Strony zaznaczaj tam, gdzie wypadają — także w środku akapitu. Co nieczytelne — oznacz jako niepewne.

**Na koniec kroku 1** napisz krótki raport: tytuł i klucz dzieła, ile części i stron, jakie serie stron, co było niepewne. Potem pokaż menu z kroku 2 i czekaj.

## 2. Krok drugi: menu — jak zbudować część Cogita

Po przeczytaniu całości pokaż użytkownikowi tę listę (możesz krótko dopisać, co według Ciebie pasuje do tego dzieła). Użytkownik wybiera po jednej opcji z A, C, D i dowolnie z B, E, F — np. „A2, B1, B3, B4, C3, D1, E1, F2”. Dopiero potem generujesz.

**A. Zakres — co opisać** (jedna):

- **A1** Całość, ogólnie — najważniejsze części, wątki, osoby, pozycje; po kilka zdań. Szybki przegląd.
- **A2** Całość, dokładnie — każdy rozdział (każda pozycja zbioru), wszystkie ważne wydarzenia, osoby, myśli.
- **A3** Tylko wybrane części — użytkownik podaje rozdziały, strony albo działy.
- **A4** Głęboko jeden temat — jedna osoba, jeden okres, jedna grupa pozycji; wszystko, co dzieło o nim mówi.

**B. Warstwy — co zbudować** (dowolnie):

- **B1** Przebieg dzieła — części, wątki, wydarzenia, argumenty w kolejności dzieła (`wywod.json`: „Krok wywodu”).
- **B2** Elementy — osoby, miejsca, przedmioty, motywy, pojęcia dzieła, z tym, czy istnieją naprawdę (`wywod.json`: „Element stały”).
- **B3** Fakty i źródła — każde twierdzenie dzieła o prawdziwym świecie jako „Fakt”: kiedy, gdzie, o kim, jak je podaje dzieło, ocena po sprawdzeniu i inne źródła (`fakty.json`). Wymaga sprawdzania (opcje F).
- **B4** Chronologia — okresy z czasem trwania i fakty w czasie (`fakty.json`: „Okres”, „Kiedy”; przy samym przebiegu — „Czas opowieści” w `wywod.json`).
- **B5** Zbiór pozycji — gdy dzieło składa się z wielu podobnych części do rozpoznania (modlitwy, prefacje, pieśni, psalmy, artykuły, utwory): każda z numerem, oznaczeniem, początkiem, tym, o czym jest, znakami rozpoznawczymi, pozycjami łatwymi do pomylenia i różnicą; grupy z tym, co je łączy (`zbior.json`).
- **B6** Pojęcia z kolejnością nauki — pojęcia dzieła z tym, czego każde wymaga (`podstawy.json`).

**C. Pytania** (jedna, plus liczba):

- **C1** Bez pytań — tylko wiedza (karty i tak powstaną z szablonów rodzajów).
- **C2** Podstawowe — po 1–2 na ważną rzecz: prawda/fałsz i jedna z kilku.
- **C3** Pełny zestaw — wszystkie rodzaje pytań (dodatek B): odpowiedź słowami, liczba, data, jedna/kilka z kilku, prawda/fałsz, połącz w pary (długie listy po kilka par naraz), ułóż w kolejności, luka w tekście, fiszka.
- **C4** Tylko wybrane rodzaje — użytkownik je wymienia.
- Liczba: ile pytań na część, np. „C3, 4 na rozdział”.

**D. Kolejność nauki** (jedna):

- **D1** Od ogółu do szczegółu (zalecane) — najpierw okresy, grupy, pojęcia podstawowe; szczegół dopiero, gdy ogół jest opanowany.
- **D2** W kolejności dzieła — bez zależności; jak w książce.
- **D3** Bez kolejności.

**E. Powtórki** (dowolnie):

- **E1** Powtórka „Od podstaw” całości.
- **E2** Osobna powtórka dla każdej części (okresu, grupy, rozdziału).
- **E3** Sprawdzian — wszystko raz, w losowej kolejności.

**F. Sprawdzanie faktów** (przy B3, jedna):

- **F1** Tylko to, co wiesz na pewno; reszta — „nie do sprawdzenia”, z tym, czego brakuje.
- **F2** Każde twierdzenie sprawdzone w innych źródłach (wymienionych), sporne opisane po obu stronach.

## 3. Jak budować — zasady do wybranych opcji

### 3.1 Rodzaje biorą się z gotowych schematów

Rodzajów nie wymyślasz. Każda warstwa ma gotowy, ogólny schemat w repozytorium (dodatek C opisuje każde pole): `wywod.json` (B1, B2, B4), `fakty.json` (B3, B4), `zbior.json` (B5), `podstawy.json` (B6), `pytania.json` (pytania — jeden rodzaj „Pytanie” z rodzajami pytań). Użytkownik importuje potrzebne pliki w **Wiedza → Schematy → Rodzaje wpisów → „Schemat jako JSON”**. W swoim dokumencie wskazujesz rodzaje ich trwałymi nazwami: `"kinds": ["@fakty/fakt"]`, `"@czas/okres"`, `"@zbior/pozycja"`, `"@zbior/grupa"`, `"@wywod/element"`, `"question"`. Jeśli nie wiesz, czy schemat jest już zaimportowany, dołącz jego rodzaje w `"kinds"` — drugi import tylko je uzupełnia. Gdy dzieło potrzebuje czegoś, czego żaden schemat nie ma, nie twórz nowego rodzaju — napisz to w raporcie.

Dokument z wiedzą to **kurs** (`"format": "recreatio.cogita.course"`, dodatek B): `"entities"` (wpisy i pytania), `"revisions"` (powtórki); opcjonalnie `"kinds"`.

### 3.2 Fakty i źródła (B3, B4, F)

- **Co jest w dziele** — B1 i B2: „Kroki wywodu” (część utworu, wątek, wydarzenie) z miejscem w dziele; „Element stały” dla osób, miejsc, przedmiotów — z polem „Czy istnieje naprawdę” (`"rzeczywistosc"`: rzeczywisty, wzorowany, fikcyjny).
- **Co dzieło mówi o świecie** — B3: każde twierdzenie to jeden „Fakt”:
  - pierwsze zdanie „Treści” to sam fakt (jedno twierdzenie, krótko); dwa twierdzenia — dwa fakty;
  - „Hasło” — krótka nazwa bez daty i bez odpowiedzi („Bitwa pod Grunwaldem”, „Święcenia kapłańskie”): z niej powstają karty „Kiedy?” i „Co wiadomo?”;
  - „Rodzaj faktu” — zdarzenie, stan rzeczy, liczba, wypowiedź, przyczyna, opinia;
  - „O kim, o czym” — Element stały, Pojęcie, osoba z biblioteki; „Gdzie” — miejsce; „Okres”;
  - „Kiedy” — data z dokładnością, jaką znasz; niepewna — ze stanem (`approximate`, `disputed`) i notatką;
  - „Źródło” — dzieło z kroku 1 i miejsce w nim: tu dzieło jest **źródłem** informacji, nawet gdy ją upiększa;
  - „Jak podaje to źródło” — dosłownie, w skrócie, z wymyślonym dialogiem, z przesuniętą datą, z postacią złożoną z kilku osób;
  - „Czy się zgadza” — dopiero po sprawdzeniu: `potwierdzone`, `prawdopodobne`, `sporne`, `uproszczone`, `nieprawdziwe`, `fikcja`, `nieznane`;
  - „Inne źródła” — dzieła z biblioteki użytkownika (`"@klucz"`, z miejscem); „Źródła spoza biblioteki” — lista (hasło encyklopedii, archiwum, adres); nigdy nie podawaj źródła, którego nie widziałaś(-eś);
  - „Uzasadnienie” — co mówią inne źródła i czym różnią się od dzieła.
- Co dzieje się tylko w dziele (wymyślona rozmowa, myśli bohatera) nie jest faktem — chyba że dzieło przedstawia to jako prawdę: wtedy „Fakt” z oceną `fikcja`. W podręczniku albo dokumencie fakty są zwykle `potwierdzone`; bez sprawdzania (F1) „Czy się zgadza” zostaje puste.
- **Okresy** (B4): główne etapy albo epoki („Dzieciństwo”, „Okupacja”, „Średniowiecze”) z kolejnością (`"nr"`), czasem trwania (`"czas": {"segments": [{"from": "1939", "to": "1945"}]}`; przybliżony — `"fromState": "approximate"`) i opisem w 2–3 zdaniach; fakt wskazuje swój okres, okres — szerszy okres w „Należy do”.

### 3.3 Zbiór pozycji (B5)

- „Grupa” dla każdego działu albo rodzaju (np. „Prefacje adwentowe”, „Pieśni maryjne”, „Rozdział II”): kolejność i to, co łączy jej pozycje (ta karta przychodzi przed szczegółami); szerszy dział w „Należy do”.
- „Pozycja” dla każdej części zbioru: numer w kolejności, oznaczenie jak w źródle, **początek** — pierwsze słowa, po których się ją rozpoznaje (gdy wszystkie zaczynają się tą samą formułą, np. prefacje „Zaprawdę, godne to i sprawiedliwe…”, wpisz słowa PO formule, dokładnie jak w źródle), „O czym jest” (pierwsze zdanie — myśl przewodnia), znaki rozpoznawcze, grupa, **gdzie jest** — dzieło i miejsce w nim („s. 412”, „s. 12*”, „nr 24”), pozycje łatwe do pomylenia i czym się od nich różni, kiedy i do czego się jej używa.
- Różnice są najważniejsze: przy pozycjach łatwych do pomylenia wypełnij „Łatwo pomylić z” i „Czym się różni”.
- Obraz albo dźwięk (ilustracja, melodia) dodaje użytkownik w aplikacji — nie wymyślaj plików.

### 3.4 Pytania (C2–C4)

- Jeden rodzaj `"question"`; `"form"` mówi, jak się pyta (dodatek B wymienia rodzaje i ich pola).
- Każde pytanie coś sprawdza: `"about"` wskazuje wpisy, których dotyczy (fakt, pozycja, pojęcie) — wtedy liczy się do ich znajomości i czeka, aż opanowane będzie to, co trzeba znać przed nimi.
- Dobieraj rodzaj do treści:
  - twierdzenie do oceny, także „czy tak było naprawdę” — `"truefalse"`;
  - wybór z podobnych (inne pozycje tej samej grupy, inne osoby tej samej rodziny) — `"one"` albo `"many"` z wiarygodnymi dystraktorami z tego samego dzieła;
  - długie listy: rok ↔ wydarzenie, numer ↔ temat, początek ↔ oznaczenie — `"match"` z `"show"` (po 3–5 par naraz; każda para ma swoją kartę);
  - kolejność (chronologia, kolejność części) — `"order"`;
  - zdania kluczowe i początki — `"gap"` (luka `[[słowo]]`);
  - daty i liczby — `"date"`, `"number"`;
  - definicje i ogólne pytania — `"text"` albo `"flash"`.
- Pytanie nie zdradza odpowiedzi w treści. Dystraktory są prawdopodobne, nie śmieszne.

### 3.5 Kolejność nauki (D1)

- Ogólne przed szczegółowym: fakt wskazuje swój okres, pozycja — swoją grupę (te pola są już oznaczone jako „kolejność nauki”); pojęcie — w „Wymaga” — pojęcia, bez których go nie zrozumieć; fakt i pozycja — w „Najpierw trzeba znać”; pytanie — w `"needs"` — pytanie ogólniejsze, które powinno paść wcześniej.
- Tylko bezpośrednie zależności — dalsze aplikacja wylicza sama (poziomy od podstaw). Bez kół: A nie może wymagać B, jeśli B wymaga A.

### 3.6 Powtórki (E)

- **E1** „Od podstaw” — wszystkie karty, „Najpierw podstawy” ze zwykłych kroków: „Idź po kolejności nauki” (`"learning"`, brakujące podstawy dochodzą), „Filtr znajomości” (`"filter.when"`: karta wchodzi, gdy to, co trzeba znać wcześniej, jest znane) i kolejność „najpierw ogólne”, potem stos według tego, co umiesz:
  `{"ref": "@<klucz>/powtorka/od-podstaw", "name": "… — od podstaw", "graph": {"nodes": [{"id": "s", "type": "source.all", "x": 0, "y": 0, "config": {}}, {"id": "l", "type": "learning", "x": 230, "y": 0, "config": {"dir": "before", "keep": true}}, {"id": "w", "type": "filter.when", "x": 460, "y": 0, "config": {"when": {"type": "knowness", "rel": "before", "op": "ge", "than": 1}}}, {"id": "p", "type": "strategy", "x": 690, "y": 0, "config": {"mode": "temporal", "stackSize": 20, "minCorrectness": 1, "order": "general"}}], "edges": [{"id": "e1", "from": "s", "out": "cards", "to": "l", "in": "cards"}, {"id": "e2", "from": "l", "out": "cards", "to": "w", "in": "cards"}, {"id": "e3", "from": "w", "out": "cards", "to": "p", "in": "cards"}]}}`
- **E2** dla części — źródło `"source.list"` z trwałymi nazwami wpisów i pytań tej części: `{"id": "s", "type": "source.list", "config": {"ids": ["@<klucz>/fakt/…", "@<klucz>/pytanie/…"]}}` (dalej jak w E1; brakujące podstawy z innych części dochodzą same).
- **E3** sprawdzian — `"source.all"` → `{"type": "strategy", "config": {"mode": "once", "order": "random"}}`.
- **E4** „Od ogólnego do szczegółu” z widoku — schemat `fakty.json` niesie gotowy widok `"@fakty/w-ogolne"` (okresy i fakty z „Filtrem znajomości”) i powtórkę z niego (`"source.view"`); nowy uczący się widzi tylko to, co najogólniejsze, a etapy i lata — gdy zna to, co nad nimi.

### 3.7 Kolejność odpowiedzi

1. Krok 1: dokument „Dzieło z tekstem” (może w kilku odpowiedziach).
2. Menu, wybór użytkownika.
3. Kurs: najpierw ogólne (okresy, grupy, elementy stałe, pojęcia), potem szczegóły, potem pytania i powtórki; każda odpowiedź to osobny, poprawny dokument.

## 4. Po imporcie — dla użytkownika

- **Biblioteka**: dzieło z tekstem; czytnik pokazuje strony tak, jak są wydrukowane (także „12*”, „A12”).
- **Wiedza**: wpisy, widoki („Fakty według okresów”, „Oś czasu”, „Fakty według oceny”, „Według grup”, „Podobne i różnice”, „Od podstaw”); przy każdym wpisie — co trzeba znać wcześniej i co na nim buduje.
- **Nauka**: „Ścieżka” (poziomy od podstaw: co umiesz, co czeka), powtórki, „Postępy” — pytanie po pytaniu, z czasem nauki i trzema sposobami liczenia („Pamięć: odstępy i zapominanie”, „Z hierarchią”, „Ostatnia odpowiedź”).
- **Kurs dla innych**: obszar rodzaju „Kurs” (z administratorem danych — bez niego strona kursu nie powstanie), w jego zakładce po kolei: „Utwórz bazę”, w tej bazie Import i eksport (JSON) z tym kursem, „Utwórz stronę” (powtórka kursu staje na niej sama), rola „Uczący się” i „Link dla uczących się”. Kto otworzy link, uczy się na stronie (bez konta przedstawia się imieniem i nazwiskiem); Ty widzisz jego postępy w Nauce → Postępy.
- **Dalej z KI**: „Dostęp dla AI” (połączenie MCP, tylko do odczytu) pozwala KI czytać zaimportowane dzieło (także strony „s. 12*”, „s. A12”) i bazę wiedzy, żeby dopisać kolejne części.

## Dodatek A — Dzieło z pełnym tekstem (z aplikacji)

<!-- app:work-with-text:start -->
```text
# Dzieło z pełnym tekstem jako JSON ("recreatio/source-text", wersja 1)

Jeden dokument tworzy w Bibliotece wpis dzieła (książki, artykułu, rozdziału, dokumentu…), wpisy, na które ono wskazuje (autorzy, czasopismo, książka zbiorowa), i jego pełny tekst. Dzieło o kluczu, który już jest w bibliotece, zostaje uzupełnione (podane pola), nie zdublowane; tak samo autor albo czasopismo o istniejącym kluczu.

{
  "format": "recreatio/source-text",
  "version": 1,
  "work": { "key": "nazwisko2020", "data": { … pola dzieła … } },   — albo "@klucz" dzieła, które już jest
  "entries": [ { "kind": "person", "key": "…", "data": { … } }, { "kind": "work", "key": "…", "data": { "workType": "periodical", … } } ],
  "scheme": "pages",          — jak wskazuje się miejsca w tym dziele (niżej)
  "edition": { … },           — opcjonalnie: przesunięcie stron PDF, język
  "portions": [ { "portion": { "key", "label", "order" }, "blocks": [ … ] }, … ]
}

- Odwołania w polach dzieła ("authors", "editors", "translators", "container") to klucze z "@": do wpisów z "entries" albo do takich, które już są w bibliotece.
- Opis dzieła bierz ze strony tytułowej, metryczki albo nagłówka artykułu; czego tam nie ma, nie wpisuj.

## Pola dzieła i osoby
### "work" — Źródło
Dzieło, z którego się korzysta: książka, rozdział, artykuł, dokument Kościoła, Pismo Święte, strona — albo muzyka: utwór, nuty, nagranie, płyta. Ma klucz cytowania.
"data":
  "workType" — Rodzaj: Rodzaj: "book" (Książka), "chapter" (Rozdział w książce), "article" (Artykuł w czasopiśmie), "periodical" (Czasopismo), "document" (Dokument (Kościoła, urzędowy)), "bible" (Pismo Święte), "web" (Strona internetowa), "talk" (Wykład, kazanie, nagranie), "other" (Inne); muzyka: "piece" (Utwór muzyczny — sam utwór: kompozytor, słowa, tonacja, obsada), "score" (Nuty — wydanie nut, z plikami: partytura, głosy, zapis nutowy), "recording" (Nagranie — wykonanie: jeden plik albo kilka ścieżek (głosy i instrumenty, odtwarzane razem)), "album" (Płyta, album — zbiór nagrań). Rodzaj decyduje, które pola dzieło ma (jedna z wartości)
  "title" — Tytuł: Tytuł dzieła (utworu, nagrania, płyty) (tekst)
  "subtitle" — Podtytuł: Podtytuł (albo rodzaj dokumentu, np. "adhortacja apostolska") (tekst)
  "originalTitle" — Tytuł oryginału: Tytuł oryginału (oryginalny tytuł przekładu; przy utworze — tytuł w języku oryginału) (tekst)
  "authors" — Autorzy: Autorzy — odwołania do osób, w kolejności (przy muzyce: kompozytor, autor słów — pola niżej) (lista odwołań: kennungi albo "@klucze")
  "editors" — Redakcja: Redaktorzy — odwołania do osób (lista odwołań: kennungi albo "@klucze")
  "translators" — Tłumaczenie: Tłumacze — odwołania do osób (przy utworze: przekład słów) (lista odwołań: kennungi albo "@klucze")
  "container" — W (książka, czasopismo): Dla rozdziału: książka; dla artykułu: czasopismo — odwołanie do źródła (odwołanie: kennung albo "@klucz")
  "volume" — Tom / rocznik: Tom (książka, zbiór nut) albo rocznik (czasopismo) (tekst)
  "issue" — Numer: Numer czasopisma (tekst)
  "edition" — Wydanie: Które wydanie (tekst)
  "genre" — Gatunek: Jaki to utwór albo jaka to książka (powieść, powieść biograficzna, biografia, reportaż, mszał, modlitewnik, podręcznik…) (tekst)
  "publisher" — Wydawca: Wydawnictwo (przy nagraniu i płycie: wytwórnia) (tekst)
  "place" — Miejsce wydania: Miejsce wydania (tekst)
  "year" — Rok: Rok wydania (albo data dokumentu; przy utworze — rok powstania, przy nagraniu — rok nagrania) (tekst)
  "series" — Seria: Seria wydawnicza, z numerem tomu w serii (tekst)
  "pages" — Strony: Zakres stron rozdziału albo artykułu (tekst)
  "pageCount" — Liczba stron: Ile stron ma książka (liczba)
  "binding" — Oprawa: Oprawa: "soft" (Miękka), "soft-flaps" (Miękka ze skrzydełkami), "hard" (Twarda), "integrated" (Zintegrowana), "cloth" (Płócienna), "leather" (Skórzana), "spiral" (Spirala), "ebook" (E-book), "other" (Inna) (jedna z wartości)
  "height" — Wysokość (cm): Wysokość w centymetrach (liczba)
  "width" — Szerokość (cm): Szerokość w centymetrach (liczba)
  "length" — Grubość (cm): Trzeci wymiar — grubość (długość grzbietu w głąb) w centymetrach (liczba)
  "siglum" — Skrót przekładu: Dla Pisma Świętego: skrót przekładu, dopisywany do sigli (tekst)
  "isbn" — ISBN: Numer ISBN książki (z kreskami albo bez; kilka — po przecinku) (tekst)
  "libraryNumber" — Numer w bibliotece: Własny numer egzemplarza w tej bibliotece (numer inwentarzowy, sygnatura) — można po nim szukać i go zeskanować (tekst)
  "doi" — DOI: Identyfikator DOI publikacji (tekst)
  "url" — Adres: Adres w sieci (adres https://…)
  "accessed" — Dostęp: Kiedy strona była czytana (RRRR-MM-DD) (data RRRR-MM-DD)
  "language" — Język: Język (np. "pl", "la"; przy muzyce — język słów) (tekst)
  "scheme" — Układ miejsc: Jak wskazuje się miejsca w tym dziele: "pages" (Strony wydania), "bible" (Pismo Święte), "numbered" (Numery (dokumenty)), "aquinas" (Tomasz z Akwinu), "decimal" (Numeracja dziesiętna), "sections" (Paragrafy dzieła), "outline" (Podział dzieła); puste — z rodzaju (Pismo Święte: bible, dokument: numbered, nagranie: time — minuty i sekundy, inne: pages) (jedna z wartości)
  "pageSeries" — Serie stron: Gdy książka numeruje swoje części osobno (wstęp, dodatki, wkładki): po jednej przykładowej stronie z każdej serii, tak jak jest wydrukowana, w kolejności książki, oddzielone spacją — np. "xii 12* 1 3' (1) A1" (rzymskie, z gwiazdką, zwykłe, z apostrofem, w nawiasie, z literą; znaki mogą być dowolne). Strona "12*" i strona "12" to dwie różne strony. Puste — rzymskie, potem zwykłe, potem pozostałe (tekst)
  "psalms" — Numeracja psalmów: Dla Pisma Świętego: "hebrew" (hebrajska — Biblia Tysiąclecia, większość przekładów) albo "greek" (grecka — Septuaginta, Wulgata) (jedna z wartości)
  "editionOf" — Wydanie / przekład dzieła: To jest inne wydanie albo przekład tego dzieła — odwołanie do źródła. Miejsca w strukturze (werset, numer, paragraf) są wspólne dla wszystkich wydań; strony nie. (odwołanie: kennung albo "@klucz")
Przykład:
{
  "kind": "work",
  "key": "ratzinger2007",
  "data": {
    "workType": "book",
    "title": "Jezus z Nazaretu",
    "subtitle": "Część 1: Od chrztu w Jordanie do Przemienienia",
    "originalTitle": "Jesus von Nazareth",
    "authors": [
      "@ratzinger"
    ],
    "volume": "1",
    "publisher": "Wydawnictwo M",
    "place": "Kraków",
    "year": "2007",
    "series": "Dzieła wybrane, t. 1",
    "pageCount": 384,
    "binding": "hard",
    "height": 24,
    "width": 16.5,
    "length": 3,
    "isbn": "978-83-7595-061-8",
    "libraryNumber": "B-0042"
  }
}

### "person" — Osoba
Autor, redaktor, tłumacz — albo instytucja, która wydała dokument. Ma klucz cytowania.
"data":
  "personType" — Kto to: "person" — osoba, "organization" — instytucja (jedna z wartości)
  "name" — Jak się nazywa: Pełna nazwa, gdy nie dzieli się na imię i nazwisko (np. "Franciszek", "św. Augustyn", "Kongregacja Nauki Wiary") (tekst)
  "givenNames" — Imiona: Imiona — w przypisach skracane do inicjałów (tekst)
  "surname" — Nazwisko: Nazwisko — według niego układa się bibliografia (tekst)
  "years" — Lata: Lata życia albo działalności (tekst)
  "description" — Opis: Krótki opis osoby (biogram) — widoczny przy jej źródłach (tekst (może mieć wiele wierszy))
  "url" — Adres strony: Strona o tej osobie (np. biografia) (adres https://…)
Przykład:
{
  "kind": "person",
  "key": "ratzinger",
  "data": {
    "personType": "person",
    "givenNames": "Joseph",
    "surname": "Ratzinger",
    "years": "1927–2022",
    "description": "Papież Benedykt XVI."
  }
}

## Tekst

Tekst dzieła składa się z CZĘŚCI (np. księga Biblii, rozdział książki, cały krótki dokument albo artykuł). Dokument JSON zawiera jedną część ("portion" + "blocks") albo kilka naraz ("portions": [ … ] — także cały tekst). Część z tym samym "portion.key" zastępuje poprzednią, inne zostają — więc długie dzieło można przysyłać w kilku dokumentach po kolei, a powtórzony dokument niczego nie zdubluje.

{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@klucz-dzieła",          — klucz (albo identyfikator) wpisu dzieła w Bibliotece; tekst należy do TEGO wydania/przekładu
  "scheme": "pages",                — układ miejsc dzieła (niżej); musi zgadzać się z dziełem
  "edition": {                       — opcjonalnie
    "pdfPageOffset": 12,            — strona drukowana = strona PDF − 12 (gdy stały)
    "language": "pl",
    "psalms": "hebrew" | "greek",   — tylko Pismo Święte: numeracja psalmów (BT: hebrew; Wulgata: greek)
    "macros": { "\\R": "\\mathbb{R}" }  — własne makra autora we wzorach (niżej: Wzory)
  },
  "portion": { "key": "rozdz-1", "label": "Rozdział 1", "order": 1 },
  "blocks": [ … ]                    — bloki w kolejności oryginału
}

Albo kilka części (np. cały tekst) w jednym dokumencie — zamiast "portion" i "blocks":
  "portions": [
    { "portion": { "key": "wstep", "label": "Wstęp", "order": 1 }, "blocks": [ … ] },
    { "portion": { "key": "rozdz-1", "label": "Rozdział 1", "order": 2 }, "blocks": [ … ] }
  ]

## Bloki
  {"type": "heading", "level": 1-4, "text": "…", "loc": "…"}    nagłówek
  {"type": "paragraph", "text": "…", "loc": "…"}               akapit (także werset, punkt dokumentu, twierdzenie)
  {"type": "quote", "text": "…", "loc": "…"}                   cytat blokowy w źródle
  {"type": "list", "items": ["…", "…"], "ordered": true, "loc": "…"}
  {"type": "table", "columns": ["…"], "rows": [["…", "…"]], "loc": "…"}
  {"type": "note", "id": "1", "text": "…"}                     przypis (tekst przypisu); w tekście odwołanie {{note 1}}
  {"type": "page", "page": "46", "pdf": 52}                   tu zaczyna się strona 46 (drukowana) = strona 52 pliku PDF;
                                                              strona tak, jak jest wydrukowana — także ze znakami serii: "12*", "3'", "(7)", "A12", "xii"
  {"type": "statement", "kind": "theorem", "label": "Twierdzenie 2.3", "title": "…", "text": "…"}
                                                              definicja, twierdzenie, lemat, dowód, przykład… (niżej); dłuższa treść: "blocks": [ … ] zamiast "text"
  {"type": "figure", "label": "Rys. 2.1", "text": "podpis", "alt": "co pokazuje rysunek"}
                                                              rysunek, wykres, schemat — podpis z książki, a w "alt" krótki opis tego, co widać
  {"type": "code", "lang": "python", "text": "…"}             kod albo pseudokod — znak w znak, z wcięciami i podziałem wierszy
  {"type": "table", "label": "Tabela 2.1", "text": "podpis", "columns": […], "rows": […]}   tabela z etykietą i podpisem (oba opcjonalne)
  "uncertain": true                                           przy dowolnym bloku: odczyt niepewny

## Znaki w tekście
  {{page 46}}  albo  {{page 46 pdf 52}}    granica strony w środku akapitu (dokładnie tam, gdzie wypada)
  {{note 3}}                               odwołanie do przypisu "3"
  {{? słowo}}                              niepewny odczyt tego słowa;  {{?}} — nieczytelne
  {{gap}}                                  pominięty / brakujący fragment
  {{ref twierdzenia 2.3}}  {{ref (2.4)}}   odwołanie do twierdzenia, wzoru, rysunku, tabeli tego samego dzieła — napisane tak, jak w tekście
  $x^2$   $$\\int_0^1 f(x)\\,dx$$         wzór w zdaniu i wzór wystawiony (osobno) — LaTeX (niżej)
Wszystko inne jest zwykłym tekstem. Zachowaj dokładne brzmienie, kolejność, akapity i interpunkcję oryginału. Nie poprawiaj, nie streszczaj, nie tłumacz.

## Wzory (LaTeX)
- Każdy wzór, symbol i oznaczenie matematyczne (także pojedyncza litera-zmienna, indeks, jednostka w wyrażeniu) zapisz w LaTeX: w zdaniu między $ … $, wzór wystawiony (w osobnym wierszu) między $$ … $$ — w akapicie dokładnie tam, gdzie stoi w źródle; akapit może mieć kilka wzorów wystawionych i ciągnąć się dalej po nich.
- Po otwierającym $ i przed zamykającym $ nie ma spacji. Dosłowny znak dolara w tekście: \\$.
- W JSON każdy ukośnik LaTeX jest podwójny: "$\\frac{a}{b}$", "$$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$". Pojedynczy ukośnik psuje wzór (w JSON "\f", "\t", "\n" to znaki sterujące).
- Numer wzoru tak, jak wydrukowany: $$ … \\tag{2.4}$$ (w układzie wielu wierszy \\tag przy wierszu). Wzór bez numeru — bez \\tag. Nie numeruj sam.
- Wyprowadzenia krok po kroku i układy: \\begin{aligned} … \\end{aligned} (albo align*, gather*), przypadki: cases; macierze: pmatrix, bmatrix, vmatrix, array (z kreskami: {cc|c}, \\hline); diagramy przemienne: \\begin{CD}; chemia: \\ce{H2O}, jednostki: \\pu{9,81 m/s^2}.
- Nie zamieniaj wzorów na zwykły tekst ani znaki Unicode (x², α, √) — zawsze LaTeX ($x^2$, $\\alpha$, $\\sqrt{x}$). Nie upraszczaj, nie przekształcaj, nie poprawiaj — przepisz to, co jest wydrukowane, w tej samej postaci.
- Własne makra autora (np. \\R, \\norm{x}) podaj raz w "edition.macros" ({"\\norm": "\\left\\lVert #1 \\right\\rVert"}) i używaj ich we wzorach; zwykłe \\newcommand we wzorze też zadziała.
- Wzory czyta KaTeX. Nie ma w nim: \\label i \\ref (do odwołań służy {{ref …}}), tabular i \\multicolumn (tabela to blok "table"), tikz, \\includegraphics (rysunek to blok "figure"), \\sideset.
- Granica strony nigdy w środku wzoru — {{page …}} przed wzorem albo po nim.
- Wzory odczytuj z obrazu strony, nie z warstwy tekstowej PDF: warstwa tekstowa zwykle gubi indeksy, ułamki i znaki.

## Twierdzenia, definicje, dowody ("statement")
  {"type": "statement", "kind": "definition", "label": "Definicja 2.1", "text": "Ciąg $(a_n)$ jest zbieżny, gdy …"}
  {"type": "statement", "kind": "theorem", "label": "Twierdzenie 2.2", "title": "o trzech ciągach", "text": "…"}
  {"type": "statement", "kind": "proof", "label": "Dowód", "blocks": [ {"type": "paragraph", "text": "…"}, … ]}
- "kind": definition (Definicja), theorem (Twierdzenie), lemma (Lemat), proposition (Stwierdzenie), corollary (Wniosek), axiom (Aksjomat), conjecture (Hipoteza), fact (Fakt), property (Własność), example (Przykład), remark (Uwaga), exercise (Ćwiczenie), problem (Zadanie), solution (Rozwiązanie), answer (Odpowiedź), proof (Dowód), notation (Oznaczenie), algorithm (Algorytm), other (inne — wtedy liczy się "label").
- "label" — dokładnie tak, jak wydrukowane, z numerem ("Lemat 4.1", "Ćwiczenie 7*"); "title" — nazwa w nawiasie po etykiecie, jeśli jest (bez nawiasów).
- Treść jednym akapitem: "text". Dłuższa (kilka akapitów, wzory wystawione, listy, przypadki, granice stron): "blocks" — zwykłe bloki, także zagnieżdżone twierdzenia (np. lemat wewnątrz dowodu).
- Dowód, rozwiązanie, odpowiedź — osobny "statement" zaraz po tym, czego dotyczy. Znaku końca dowodu (□, ∎, c.n.d.) nie przepisuj: aplikacja stawia go sama.

## Odwołania i etykiety
- W tekście odwołanie do twierdzenia, wzoru, rysunku albo tabeli tego samego dzieła zapisz {{ref …}} — tymi słowami, co w źródle: "z {{ref twierdzenia 2.3}}", "na mocy {{ref (2.4)}}", "por. {{ref Rys. 1.2}}". Czytnik zrobi z nich odnośniki.
- Etykiety (label, \\tag) muszą być jednoznaczne w całym dziele — tak, jak w książce.

## "loc" — miejsce w strukturze dzieła
Podawaj "loc" przy każdym bloku, który ma własny numer w strukturze dzieła (werset, punkt, artykuł, twierdzenie, paragraf, rozdział). Bloki bez własnego numeru (np. akapit w środku rozdziału) nie mają "loc" — należą do miejsca podanego wcześniej. Strony NIE wpisuje się do "loc": strony to bloki "page" i znaki {{page …}}, bo należą do tego jednego wydania.
- "pages" — Strony wydania: Tylko strony tej konkretnej edycji (książki, artykuły bez własnej numeracji). Gdy książka numeruje swoje części osobno (wstęp „xii” albo „12*”, dodatek „3'”, wkładki „(7)”, „A12”), strona niesie znaki swojej serii tak, jak są wydrukowane — dowolne — a dzieło w polu „Serie stron” mówi, w jakiej kolejności serie stoją w książce. Przykłady: s. 23 · s. 23–25 · s. 23, 27 · s. xii · s. 12* · s. 45'–47' · s. (7) · s. A12
- "bible" — Pismo Święte: Księga, rozdział, werset — wspólne dla wszystkich przekładów (numeracja psalmów: hebrajska, grecka w nawiasie). Przykłady: J 21,15-17 · Ps 51(50),3 · Łk 1,26–2,5 · Mt 5,3-12; 6,1
- "numbered" — Numery (dokumenty): Numerowane punkty dokumentów Kościoła, katechizmu, kodeksów; paragraf w numerze po „§". Przykłady: nr 24 · nn. 24–26 · KKK 1234 · kan. 915 § 1
- "aquinas" — Tomasz z Akwinu: Część, kwestia, artykuł; zarzut (arg.), sed contra, odpowiedź (co.), odpowiedź na zarzut (ad). Przykłady: I, q. 2, a. 3 · I-II, q. 90, a. 1, ad 2 · II-II q. 23 a. 1 arg. 1 · III q. 75 a. 1 co.
- "decimal" — Numeracja dziesiętna: Twierdzenia numerowane dziesiętnie, jak w Traktacie logiczno-filozoficznym: każda cyfra po kropce to poziom niżej. Przykłady: 2.0121 · 4.1–4.116 · TLP 6.54
- "sections" — Paragrafy dzieła: Paragrafy (uwagi) numerowane w całym dziele, z częściami, jak w Dociekaniach filozoficznych. Przykłady: § 43 · §§ 1–5 · cz. II, xi
- "outline" — Podział dzieła: Tom, część, księga, rozdział, paragraf, akapit — tyle poziomów, ile ma dzieło. Przykłady: t. 2, cz. 1, rozdz. 3 · ks. II, rozdz. 4, § 2 · rozdz. 3, ak. 5

## Zasady
- Nie wymyślaj tekstu ani numerów: czego nie widać w źródle, tego nie ma w JSON. Niepewne oznacz {{? …}} albo "uncertain": true.
- Numery stron: drukowane, tak jak w książce (także rzymskie: "xii"); numer strony pliku PDF w "pdf", jeśli się różni.
- Przypisy dolne i końcowe: blok "note" (po akapicie albo na końcu części) i {{note …}} w miejscu odsyłacza.
- Jedna część — najwyżej ok. 2 mln znaków.
- Każda strona ma swoją granicę — także pusta albo zajęta w całości przez rysunek ({{page …}} albo blok "page"); import sprawdza, czy żadnej nie brakuje.

## Cały tekst
- Podziel tekst według jego własnego podziału: księgi Biblii (klucz: skrót księgi, np. "J"), rozdziały książki ("rozdz-1", "rozdz-2"), kwestie Sumy ("I-q2"), rozdziały dokumentu; krótki artykuł albo dokument może być jedną częścią.
- Klucze krótkie i stałe; "order" — kolejność w dziele (1, 2, 3…). Wstęp, przedmowa, spis treści, bibliografia, indeks — osobne części tylko wtedy, gdy są w źródle.
- Każdy rozdział to osobna część, z numerem i tytułem jako nagłówkami ("heading") — sprawdź na końcu, czy liczba części zgadza się ze spisem treści i czy żaden rozdział nie został w środku poprzedniego.
- Każda część zaczyna się blokiem "page" ze stroną, na której się zaczyna — także gdy poprzednia część kończy się na tej samej stronie (rozdział od połowy strony). Ta wspólna strona nie dubluje tekstu.
- Przypisy końcowe (na końcu książki albo rozdziału) wpisz w tej części, do której odsyłają.
- Gdy tekst nie mieści się w jednej odpowiedzi: przepisz kolejne części w kolejnych dokumentach (z tym samym "work", "scheme" i "edition"), zaczynając dokładnie tam, gdzie skończyłeś. Nigdy nie przerywaj części w połowie — dokończ ją albo zacznij od niej następny dokument (ta sama część drugi raz zastąpi poprzednią).
Zwróć JEDEN obiekt JSON, bez komentarzy.

## Przykłady
### Strony wydania ("pages")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@ratzinger2007",
  "scheme": "pages",
  "edition": {
    "pdfPageOffset": 12,
    "language": "pl"
  },
  "portion": {
    "key": "rozdz-1",
    "label": "Rozdział 1. Chrzest Jezusa",
    "order": 1
  },
  "blocks": [
    {
      "type": "page",
      "page": "33",
      "pdf": 45
    },
    {
      "type": "heading",
      "level": 1,
      "loc": "rozdz. 1",
      "text": "Rozdział pierwszy. Chrzest Jezusa"
    },
    {
      "type": "paragraph",
      "text": "Pierwsze zdanie akapitu na stronie 33, który przechodzi na następną {{page 34 pdf 46}} stronę i ma przypis.{{note 1}}"
    },
    {
      "type": "paragraph",
      "text": "Kolejny akapit, w którym jedno słowo jest {{? nieczytelne}}, a fragment pominięto {{gap}}.",
      "uncertain": true
    },
    {
      "type": "note",
      "id": "1",
      "text": "Por. J. Jeremias, Teologia Nowego Testamentu, s. 45."
    }
  ]
}

### Pismo Święte ("bible")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@bt",
  "scheme": "bible",
  "edition": {
    "language": "pl",
    "psalms": "hebrew"
  },
  "portion": {
    "key": "J",
    "label": "Ewangelia według św. Jana",
    "order": 43
  },
  "blocks": [
    {
      "type": "heading",
      "level": 1,
      "loc": "J 21",
      "text": "Rozdział 21"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "Jezus ukazuje się nad Jeziorem Tyberiadzkim"
    },
    {
      "type": "paragraph",
      "loc": "J 21,15",
      "text": "A gdy spożyli śniadanie, rzekł Jezus do Szymona Piotra: «Szymonie, synu Jana, czy miłujesz Mnie więcej aniżeli ci?»"
    },
    {
      "type": "paragraph",
      "loc": "J 21,16",
      "text": "I drugi raz powiedział do niego: «Szymonie, synu Jana, czy miłujesz Mnie?»"
    }
  ]
}

### Numery (dokumenty) ("numbered")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@dei-verbum",
  "scheme": "numbered",
  "edition": {
    "language": "pl"
  },
  "portion": {
    "key": "rozdz-2",
    "label": "Rozdział II. Przekazywanie Objawienia Bożego",
    "order": 2
  },
  "blocks": [
    {
      "type": "heading",
      "level": 1,
      "text": "Rozdział II. Przekazywanie Objawienia Bożego"
    },
    {
      "type": "paragraph",
      "loc": "nr 7",
      "text": "Bóg w swej łaskawości postanowił, aby to, co dla zbawienia wszystkich narodów objawił, trwało na zawsze nienaruszone."
    },
    {
      "type": "paragraph",
      "loc": "nr 8",
      "text": "Przeto przepowiadanie apostolskie, które w szczególniejszy sposób wyrażone jest w księgach natchnionych…"
    }
  ]
}

### Tomasz z Akwinu ("aquinas")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@sth",
  "scheme": "aquinas",
  "edition": {
    "language": "la"
  },
  "portion": {
    "key": "I-q2",
    "label": "I, q. 2. De Deo, an Deus sit",
    "order": 2
  },
  "blocks": [
    {
      "type": "heading",
      "level": 1,
      "loc": "I, q. 2",
      "text": "Quaestio 2. De Deo, an Deus sit"
    },
    {
      "type": "heading",
      "level": 2,
      "loc": "I, q. 2, a. 3",
      "text": "Articulus 3. Utrum Deus sit"
    },
    {
      "type": "paragraph",
      "loc": "I, q. 2, a. 3, arg. 1",
      "text": "Ad tertium sic proceditur. Videtur quod Deus non sit."
    },
    {
      "type": "paragraph",
      "loc": "I, q. 2, a. 3, sed contra",
      "text": "Sed contra est quod dicitur Exodi III, ex persona Dei, ego sum qui sum."
    },
    {
      "type": "paragraph",
      "loc": "I, q. 2, a. 3, co.",
      "text": "Respondeo dicendum quod Deum esse quinque viis probari potest."
    },
    {
      "type": "paragraph",
      "loc": "I, q. 2, a. 3, ad 1",
      "text": "Ad primum ergo dicendum quod, sicut Augustinus dicit in Enchiridio…"
    }
  ]
}

### Numeracja dziesiętna ("decimal")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@tractatus",
  "scheme": "decimal",
  "edition": {
    "language": "pl"
  },
  "portion": {
    "key": "2",
    "label": "Twierdzenie 2",
    "order": 2
  },
  "blocks": [
    {
      "type": "paragraph",
      "loc": "2",
      "text": "To, co zachodzi, fakt, to istnienie stanów rzeczy."
    },
    {
      "type": "paragraph",
      "loc": "2.01",
      "text": "Stan rzeczy jest połączeniem przedmiotów (rzeczy)."
    },
    {
      "type": "paragraph",
      "loc": "2.011",
      "text": "Dla rzeczy jest istotne, że może ona być składnikiem stanu rzeczy."
    },
    {
      "type": "paragraph",
      "loc": "2.012",
      "text": "W logice nic nie jest przypadkowe."
    },
    {
      "type": "paragraph",
      "loc": "2.0121",
      "text": "Wyglądałoby to na przypadek, gdyby rzeczy, która mogłaby występować samodzielnie, później miała przypaść w udziale sytuacja."
    }
  ]
}

### Paragrafy dzieła ("sections")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@dociekania",
  "scheme": "sections",
  "edition": {
    "language": "pl"
  },
  "portion": {
    "key": "cz-1-41-45",
    "label": "Część I, §§ 41–45",
    "order": 1
  },
  "blocks": [
    {
      "type": "paragraph",
      "loc": "§ 43",
      "text": "Dla wielkiej klasy przypadków użycia słowa „znaczenie\" — choć nie dla wszystkich — można to słowo objaśnić tak: znaczeniem słowa jest jego użycie w języku."
    },
    {
      "type": "paragraph",
      "loc": "§ 44",
      "text": "Powiedzieliśmy: zdanie „Excalibur ma ostre ostrze\" ma sens także wtedy, gdy Excalibur jest już rozbity."
    }
  ]
}

### Podział dzieła ("outline")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@wyznania",
  "scheme": "outline",
  "edition": {
    "language": "pl"
  },
  "portion": {
    "key": "ks-1",
    "label": "Księga I",
    "order": 1
  },
  "blocks": [
    {
      "type": "heading",
      "level": 1,
      "loc": "ks. 1",
      "text": "Księga pierwsza"
    },
    {
      "type": "paragraph",
      "loc": "ks. 1, rozdz. 1, ak. 1",
      "text": "Wielki jesteś, Panie, i godzien wielkiej chwały. Stworzyłeś nas dla siebie i niespokojne jest serce nasze, dopóki nie spocznie w Tobie."
    },
    {
      "type": "list",
      "loc": "ks. 1, rozdz. 1, ak. 2",
      "items": [
        "Najpierw wzywać Ciebie?",
        "Czy najpierw Ciebie poznać?"
      ]
    },
    {
      "type": "table",
      "columns": [
        "Łacina",
        "Polski"
      ],
      "rows": [
        [
          "inquietum est cor nostrum",
          "niespokojne jest serce nasze"
        ]
      ]
    }
  ]
}

### Podręcznik ze wzorami (twierdzenia, dowód, macierze, rysunek, tabela, kod)
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@analiza1",
  "scheme": "pages",
  "edition": {
    "language": "pl",
    "pdfPageOffset": 10,
    "macros": {
      "\\R": "\\mathbb{R}",
      "\\norm": "\\left\\lVert #1 \\right\\rVert"
    }
  },
  "portion": {
    "key": "rozdz-2",
    "label": "Rozdział 2. Ciągi liczbowe",
    "order": 2
  },
  "blocks": [
    {
      "type": "page",
      "page": "41",
      "pdf": 51
    },
    {
      "type": "heading",
      "level": 1,
      "text": "Rozdział 2. Ciągi liczbowe"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "2.1. Granica ciągu"
    },
    {
      "type": "statement",
      "kind": "definition",
      "label": "Definicja 2.1",
      "text": "Ciąg $(a_n)$ liczb rzeczywistych jest zbieżny do $g \\in \\R$, gdy $$\\forall_{\\varepsilon > 0}\\; \\exists_{N \\in \\mathbb{N}}\\; \\forall_{n \\geq N} \\quad |a_n - g| < \\varepsilon. \\tag{2.1}$$ Piszemy wtedy $\\lim_{n \\to \\infty} a_n = g$."
    },
    {
      "type": "statement",
      "kind": "theorem",
      "label": "Twierdzenie 2.2",
      "title": "o trzech ciągach",
      "text": "Jeżeli $a_n \\leq b_n \\leq c_n$ dla $n \\geq n_0$ oraz $\\lim a_n = \\lim c_n = g$, to $\\lim b_n = g$."
    },
    {
      "type": "statement",
      "kind": "proof",
      "label": "Dowód",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Niech $\\varepsilon > 0$. Z {{ref (2.1)}} dla ciągów $(a_n)$ i $(c_n)$ istnieje $N$ takie, że dla $n \\geq N$ {{page 42 pdf 52}} mamy $$\\begin{aligned} g - \\varepsilon &< a_n \\leq b_n \\\\ &\\leq c_n < g + \\varepsilon. \\end{aligned}$$"
        },
        {
          "type": "paragraph",
          "text": "Stąd $|b_n - g| < \\varepsilon$ dla $n \\geq N$.{{note 1}}"
        }
      ]
    },
    {
      "type": "statement",
      "kind": "example",
      "label": "Przykład 2.3",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Dla macierzy $$A = \\begin{pmatrix} 1 & 2 \\\\ 0 & 1 \\end{pmatrix}, \\qquad A^n = \\begin{pmatrix} 1 & 2n \\\\ 0 & 1 \\end{pmatrix}$$ ciąg $\\norm{A^n}$ nie jest zbieżny — por. {{ref twierdzenie 2.2}}."
        },
        {
          "type": "paragraph",
          "text": "Funkcja $f(x) = \\begin{cases} x^2, & x \\geq 0, \\\\ -x, & x < 0 \\end{cases}$ jest ciągła."
        }
      ]
    },
    {
      "type": "figure",
      "label": "Rys. 2.1",
      "text": "Wykres ciągu $a_n = \\frac{(-1)^n}{n}$.",
      "alt": "Punkty na przemian nad i pod osią poziomą, coraz bliżej zera."
    },
    {
      "type": "table",
      "label": "Tabela 2.1",
      "text": "Wyrazy ciągu $a_n = \\left(1 + \\frac{1}{n}\\right)^n$.",
      "columns": [
        "$n$",
        "$a_n$"
      ],
      "rows": [
        [
          "1",
          "$2$"
        ],
        [
          "10",
          "$2{,}5937\\ldots$"
        ]
      ]
    },
    {
      "type": "code",
      "lang": "pseudokod",
      "text": "dla n := 1, 2, …\n    jeśli |a(n) − g| < ε: zwróć n"
    },
    {
      "type": "note",
      "id": "1",
      "text": "Tak samo dowodzi się wersji dla funkcji: jeśli $f \\leq g \\leq h$ w otoczeniu punktu $x_0$, to granice też są uporządkowane."
    }
  ]
}

## Pełny przykład (artykuł w czasopiśmie, tekst w dwóch częściach)
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": {
    "key": "kowalski2020",
    "data": {
      "workType": "article",
      "title": "Miłość, która pyta",
      "subtitle": "O J 21,15-17",
      "authors": [
        "@kowalski"
      ],
      "container": "@przeglad",
      "year": "2020",
      "volume": "12",
      "issue": "2",
      "pages": "45–60",
      "language": "pl"
    }
  },
  "entries": [
    {
      "kind": "person",
      "key": "kowalski",
      "data": {
        "personType": "person",
        "givenNames": "Jan",
        "surname": "Kowalski"
      }
    },
    {
      "kind": "work",
      "key": "przeglad",
      "data": {
        "workType": "periodical",
        "title": "Przegląd Biblijny"
      }
    }
  ],
  "scheme": "pages",
  "edition": {
    "language": "pl",
    "pdfPageOffset": -44
  },
  "portions": [
    {
      "portion": {
        "key": "wstep",
        "label": "Wstęp",
        "order": 1
      },
      "blocks": [
        {
          "type": "page",
          "page": "45",
          "pdf": 1
        },
        {
          "type": "heading",
          "level": 1,
          "text": "Miłość, która pyta"
        },
        {
          "type": "paragraph",
          "text": "Trzykrotne pytanie Jezusa odpowiada trzykrotnemu zaparciu się Piotra.{{note 1}} Nie jest przesłuchaniem, lecz uzdrowieniem {{page 46 pdf 2}} pamięci."
        },
        {
          "type": "note",
          "id": "1",
          "text": "Por. J 18,15-27."
        }
      ]
    },
    {
      "portion": {
        "key": "rozdz-1",
        "label": "1. Słowa pytania",
        "order": 2
      },
      "blocks": [
        {
          "type": "heading",
          "level": 2,
          "text": "1. Słowa pytania"
        },
        {
          "type": "paragraph",
          "text": "W dwóch pierwszych pytaniach pada czasownik agapao, w trzecim — phileo."
        }
      ]
    }
  ]
}

## Jak aplikacja używa tych danych
- Dzieło i wpisy z "entries" trafiają do biblioteki, w której importuje się dokument; tekst — do biblioteki wybranej przy imporcie. Po zapisie otwiera się strona dzieła.
- Dzieło, autorzy i czasopismo to zwykłe wpisy Biblioteki (widzi je, kto widzi jej obszar): mają swoje strony i cytuje się je kluczem — [@kowalski2020, s. 47] w tekście Skryptorium, we wpisie bazy wiedzy albo w module strony „Tekst” staje się przypisem.
- Na stronie dzieła ramka „Tekst źródła” pokazuje, jakie teksty są (części, słowa, w której bibliotece), i otwiera czytnik („Czytaj”).
- Czytnik (#/workspace/library/<biblioteka>/<dzieło>/tekst/<miejsce>): spis części, miejsca na marginesie, granice stron, przypisy; „Przejdź” do miejsca, szukanie w całym tekście, „Obok” — inne wydanie albo przekład tego dzieła, wyrównane według miejsc w strukturze.
- Zaznaczony fragment można dodać jako cytat (z dziełem i miejscem) albo skopiować z miejscem.
- Każde miejsce, które już gdzieś zacytowano (przypis, cytat, odwołanie we wpisie bazy wiedzy, pole z miejscem), dostaje „pokaż w tekście”, jeśli jest w tym tekście: fragment otwiera się na miejscu, także na stronie. Nic się przy tym nie zapisuje — połączenie powstaje przy czytaniu.
- Miejsce w strukturze (werset, numer, artykuł) prowadzi też do tekstu innego wydania tego dzieła ("editionOf"); strona — tylko do tekstu tego wydania.
- „W Wiedzy” przy dziele i w czytniku: wejścia z baz wiedzy, które czytający może otworzyć, wskazujące to dzieło albo jego miejsca.
- Tekst jest zapieczętowany kluczem obszaru biblioteki, w której go zapisano — może to być inna (np. prywatna) biblioteka niż ta z dziełem. Kto jej nie czyta, nie widzi tekstu: ani w czytniku, ani w szukaniu, ani na stronie.
- „Dostęp dla AI” (link obszaru, serwer MCP), jeśli obejmuje bibliotekę z tekstem, daje go asystentowi do czytania: list_texts, read_text (według miejsca), search_text.
- Tekstu nie ma w JSON biblioteki ("recreatio/library"); oddaje go eksport w ramce „Tekst źródła” — w tym formacie.
- Wzory ($…$, $$…$$) czytnik składa jak w druku (KaTeX), także macierze, układy i numery wzorów; wzór, którego nie da się złożyć, zostaje widoczny jako kod LaTeX. Import sprawdza każdy wzór i mówi, które nie przechodzą.
- Twierdzenia, definicje, dowody, przykłady stoją w ramkach z etykietą; dowód kończy ∎. „Przejdź” przyjmuje też etykiety („Twierdzenie 2.3”, „(2.4)”, „Rys. 1.2”), a odwołanie {{ref …}} w tekście prowadzi do celu — także w innej części.
- Szukanie w tekście znajduje też wzory: po słowach i znakach („α”, „∫”, „sin”) i po LaTeX („\frac”, „x^2”). Zaznaczony fragment ze wzorem trafia do cytatu i schowka jako LaTeX ($…$).
- „Dostęp dla AI” oddaje wzory jako LaTeX w $…$ i $$…$$; read_text przyjmuje też etykietę („Twierdzenie 2.3”, „(2.4)”).
```
<!-- app:work-with-text:end -->

## Dodatek B — Cogita jako JSON (z aplikacji)

<!-- app:cogita-json:start -->
```text
# Cogita jako JSON

Formaty:
  "recreatio.cogita.course" — cały kurs: rodzaje, wpisy, szablony kart, powtórki, przebiegi, zbiory, wygląd, zasady, wartości
  "recreatio.cogita.schema" — rodzaje z ich szablonami kart i formularzami dodawania (niezależna kopia do innej bazy wiedzy); eksport schematu nie zawiera widoków, ale import przyjmuje je w każdym formacie, tak jak "anchors"
    schemat może nieść GOTOWE widoki i powtórki ("views", "revisions") — import tworzy je jak każde inne, użytkownik kopiuje je i zmienia; z trwałą nazwą ("@fakty/…") kolejny import schematu je uaktualnia;
    np. templates/cogita/fakty.json niesie widok i powtórkę „Od ogólnego do szczegółu”: {"views": [{"ref": "@fakty/w-ogolne", "name": "Od ogólnego do szczegółu", "steps": [{"type": "source.kind", "config": {"kind": "@czas/okres"}}, {"type": "source.kind", "config": {"kind": "@fakty/fakt"}}, {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "before", "op": "ge", "than": 1}}}]}], "revisions": [{"ref": "@fakty/p-ogolne", "name": "Od ogólnego do szczegółu", "graph": …}]}
  "recreatio.cogita.entities" — same wpisy (także wypowiedzi i pytania)
  "recreatio.cogita.flow" — przebieg razem z tym, co pokazuje

Wspólne:
  "format", "version": 1, "name" — nazwa
  "ref" — własna nazwa wpisu, np. "@dawid"; inne pola odwołują się do niej tak samo: "@dawid".
  Istniejące wpisy rozpoznaje się po identyfikatorze (z eksportu) albo po trwałej nazwie; import UZUPEŁNIA je w miejscu: pola, których dokument nie wymienia, zostają, a "pole": null usuwa pole; pole-lista podana w dokumencie zastępuje całą dotychczasową listę. Przed zapisem każdą zmianę w tym, co już jest, trzeba przyjąć (i można ją poprawić).
  ZMIANA PO IDENTYFIKATORZE: {"ref": "<identyfikator>", "data": {"nazwa": "Nowa nazwa"}} — "kinds" można pominąć (wpis zachowuje swoje rodzaje); "id" działa tak samo jak "ref".
  USUWANIE: {"ref": "<identyfikator albo @trwała/nazwa>", "remove": true} — w "entities" (wpis) i w listach dokumentów ("flows", "views", "revisions", "templates", "collections", "forms", "anchors", "looks", "rules", "values", "rewards"); rodzajów import nie usuwa (Schematy → „Usuń rodzaj”).
    Podgląd wymienia każde usunięcie z nazwą i tym, co na nie wskazuje; każde można odznaczyć; nic nie znika po cichu.
    Odwołania do usuwanego wpisu w polach-odwołaniach innych wpisów (np. "wymaga", "pole", "about" pytania) i w zbiorach zostają z nich usunięte w tym samym zapisie — podgląd mówi, z których. Jeśli wskazuje na niego coś innego (krok albo "unit" przebiegu, widok, powtórka, szablon, wejście, komórka wypowiedzi), zapis nie przejdzie: popraw to w tym samym dokumencie, usuń to też albo odznacz usunięcie.
    Odpowiedzi i historia uczących się zostają: karty usuniętych wpisów po prostu się nie liczą (postępy, statystyki, krajobraz); wpis da się przywrócić z historii wersji, a wtedy jego odpowiedzi liczą się znowu.
    Ten sam wpis zmieniany i usuwany w jednym dokumencie — zostaje tylko usunięty (z ostrzeżeniem).
  Zapis jest JEDEN: nowe rodzaje (z trwałymi nazwami), zmiany rodzajów, nowe wpisy, zmiany wpisów, widoki i reszta oraz usunięcia — wszystko albo nic. Identyfikatory nowych rzeczy w podglądzie to te, które się zapiszą.
  Rozmiar: jeden plik do ok. 20 MB JSON (najwyżej 5000 elementów razem z usunięciami; jeden wpis do 4 MB) — plik 4 MB to jeden podgląd i jeden zapis (ok. 6 MB przesyłu).
  Zapis nie przejdzie, jeśli coś wskazywałoby na rodzaj albo wpis, którego nie ma (np. pole "to" z nieznanym rodzajem, wartość z nieistniejącym identyfikatorem, odwołanie do nowej rzeczy odznaczonej w przeglądzie) — lista mówi, który element i które pole.
  Rodzaj można wskazać jego trwałą nazwą ("kinds": ["@wywod/krok"]) — znajdzie się także po zmianie nazwy.
  Nazwa z „/" jest TRWAŁA: zostaje przy wpisie (także przy widoku, wejściu, szablonie, formularzu, rodzaju), a ten sam dokument zaimportowany drugi raz zmienia te same rzeczy zamiast tworzyć nowe; wielkość liter nie ma znaczenia.
    Kroki rekonstrukcji: "@<klucz dzieła>/<rekonstrukcja>/<krok>", np. "@kowalski2020/calosc/pytanie", "@kowalski2020/wstep/arg1" — każda rekonstrukcja jednego dzieła ma własny środkowy człon.
    Trwałe nazwy są wspólne dla całej bazy: dokument, który trafia w nazwy wpisów z innego dokumentu, zmieni je (podgląd to mówi) — inna rekonstrukcja potrzebuje innego członu (np. "calosc-2").
    Nazwy bez „/" działają tylko w swoim dokumencie. Rodzaje i wpisy mają wspólne nazwy, każdy rodzaj dokumentów (widoki, wejścia, szablony…) własne: wejście "@q" nie zmieni wpisu "@q".
    W polu-odwołaniu i w odwołaniu komórki ("ref") nazwa, która nigdzie nie prowadzi, wypada (z ostrzeżeniem, które podaje wpis i pole); w polu tekstowym "@autor/rok" jest tekstem i zostaje.
  Dzieło, osobę, cytat z biblioteki wskazuje się jej kluczem albo identyfikatorem ("@kowalski2020") — tylko z bibliotek, z których korzysta ta baza (Więcej → Ustawienia → Źródła); nie tworzy się ich tutaj.
  Eksport zapisuje trwałe nazwy, a identyfikatory własnych wpisów, rodzajów i dokumentów w widokach, szablonach, powtórkach, przebiegach, zbiorach i formularzach jako "@nazwa" — da się go zaimportować do innej bazy.

Kto czyta: bazę czyta ten, kto czyta jej obszar. W obszarze jawnym (gdy baza jest otwarta: Ustawienia → Kto czyta) każdy, bez konta — cała baza, także odpowiedzi pytań i szkice.
  Pojedynczych wpisów się nie publikuje: to, co ma być publiczne, trafia do osobnej bazy w obszarze jawnym (wpis → Kto widzi → Przenieś; identyfikator zostaje). Moduły stron (powtórka, przebieg, karta wpisu) czytają bazę tak, jak widzi ją czytelnik strony.

"kinds" — rodzaje:
  "name" — nazwa, "label" — wzór etykiety, np. "{givenNames} {surname}", "tells" — pole, które odróżnia imienników,
  "reading" — tekst do czytania: jak uczący się widzi wpis tego rodzaju („Nowy temat” przed pierwszym pytaniem o ten wpis, wyjaśnienie po odpowiedzi) — zapis z polami w klamrach, jak "label",
    np. "{streszczenie}\n\n{opis}\n\n**Wydarzenia**\n{wydarzenia}\n\n*{czas}*"; pierwszy akapit to zapowiedź (krótko; reszta po „Czytaj dalej”);
    pole "markup" zostaje zapisem (pogrubienia, przypisy [@dzielo, s. 12]), "text" — tekstem, "list" sama w linii — punktami (pod pogrubionym śródtytułem zwinięta, aż uczący się ją otworzy),
    "ref" — link z nazwą wpisu, "ref" z "locator" — przypis do źródła z miejscem (z „pokaż w tekście”), data, liczba, wybór — tekstem; pliki i miejsca na mapie się nie pokazują;
    część wzoru do pustej linii, w której wszystkie pola są puste, znika razem ze swoim śródtytułem;
    bez "reading": streszczenie (pole "streszczenie" albo "summary") albo pierwszy akapit tekstu, potem pola z tekstem, daty i miejsca; "reading": "" usuwa wzór
  "builtin" — zmiana wbudowanego rodzaju (person, work, quote — z biblioteki; text, delivery, project — ze skryptorium; question);
    innych wbudowanych treści nie ma: rodzaje pisze właściciel bazy albo importuje gotowy schemat (niżej)
  "fields": [{"key", "label", "type", "multi", "uncertain", "unit", "quantity", "options", "to", "inverse", "symmetric", "locator", "structure", "prerequisite", "when", "media", "rangeOf", "says"}]
  "structure" (odwołanie) — połączenie w STRUKTURZE (np. wywód artykułu): "up" — ten wpis leży POD tym, na co wskazuje (krok → krok wyżej: „Należy do"); "down" — wskazane wpisy leżą pod nim („Argumenty za");
    widok „Struktura" z krokiem "structure" rysuje z tego drzewo w kolejności miejsc w dziele; takie pole nie czyni wypowiedzi „interpretacją"
  "prerequisite" (odwołanie) — KOLEJNOŚĆ NAUKI: "up" — to, na co wskazuje, trzeba znać WCZEŚNIEJ (pojęcie → „Wymaga": orbital wymaga elektronu i atomu); "down" — to, na co wskazuje, buduje na tym wpisie („Prowadzi do");
    z takich pól (i z pola "needs" pytań) aplikacja liczy poziomy od podstaw: karty szczegółu przychodzą, gdy podstawy są opanowane (widok albo powtórka z „Filtrem znajomości” "rel": "before" — np. gotowa „Najpierw podstawy”; Nauka → Ścieżka), z kolejnością "general" nowe karty idą od ogólnych do szczegółowych;
    to coś innego niż "structure" (co pod czym leży); koło (A wymaga B, B wymaga A) nie działa i stoi w „Do zrobienia"
    np. {"key": "wymaga", "label": "Wymaga", "type": "ref", "to": ["@pojecie"], "multi": true, "prerequisite": "up", "inverse": "Na tym budują"}
  "when" — pole tylko dla niektórych wartości pola-wyboru tego samego rodzaju: {"field": "typ", "values": ["bitwa", "traktat"]} — JEDEN rodzaj z polem „typ” zamiast osobnego rodzaju dla każdego typu; edytor pokazuje pole tylko przy tych wartościach
  "quantity" (liczba) — jaka wielkość (identyfikator z QUDT, np. "Torque", "Mass"); wtedy wartość wpisuje się w dowolnej jednostce tej wielkości, a zapisuje tak, jak wpisano, razem z SI:
    {"value": 1.5, "unit": "KiloN", "si": 1500} ("unit" — identyfikator jednostki z QUDT: "N", "KiloN", "N-M", "J", "KiloGM", "DEG_C" …; liczba bez jednostki — w jednostce pola);
    np. {"key": "moment", "label": "Moment obrotowy", "type": "number", "unit": "N·m", "quantity": "Torque"}, a we wpisie: "moment": {"value": 12, "unit": "N-M", "si": 12};
    bez "quantity" pole bierze wielkość z jednostki, gdy jest jednoznaczna ("kg" → Mass; "N·m" — moment siły albo energia — trzeba wybrać)
  pytanie z liczbą i wielkością: {"form": "number", "prompt": "Jaki moment siły…?", "answers": ["12"], "unit": "N·m", "quantity": "Torque", "tolerance": 0.1} — „12 N·m" i „0,012 kN·m" są dobre, „12 J" nie (energia, choć wymiar ten sam)
  wielkości i ich jednostki: Dimensionless (bez wymiaru): —, %; PlaneAngle (kąt): rad, °, obr; Length (długość): m, km, dm, cm, mm, µm, nm, in, ft, mi, ly; Area (pole powierzchni): m², dm², cm², mm², km², ha; Volume (objętość): m³, dm³, cm³, mm³, l, ml, hl; Mass (masa): kg, dag, g, mg, µg, t, lb; Time (czas): s, ms, µs, min, h, d, rok; Frequency (częstotliwość): Hz, kHz, MHz, GHz, 1/s, 1/min; AngularVelocity (prędkość kątowa): rad/s, °/s, obr/s, obr/min; Velocity (prędkość): m/s, cm/s, km/h, km/s, mph, kn; Acceleration (przyspieszenie): m/s², cm/s², g₀; Force (siła): N, mN, kN, MN, kgf, dyn; Momentum (pęd): kg·m/s, N·s; Energy (energia (praca, ciepło)): J, mJ, kJ, MJ, cal, kcal, W·h, kW·h, eV, N·m, mN·m, kN·m; Torque (moment siły): N·m, mN·m, kN·m; Power (moc): W, mW, kW, MW, KM; Pressure (ciśnienie): Pa, hPa, kPa, MPa, bar, mbar, atm, mmHg, psi; ThermodynamicTemperature (temperatura): K, °C, °F; Density (gęstość): kg/m³, g/cm³, g/l, kg/l, g/ml; DynamicViscosity (lepkość dynamiczna): Pa·s, mPa·s, cP; KinematicViscosity (lepkość kinematyczna): m²/s; SpecificEnergy (energia właściwa (entalpia na kilogram)): J/kg, kJ/kg; SpecificHeatCapacity (ciepło właściwe): J/(kg·K); ThermalConductivity (przewodność cieplna): W/(m·K); ElectricCurrent (natężenie prądu): A, mA, µA; ElectricCharge (ładunek elektryczny): C, mA·h, A·h; Voltage (napięcie): V, mV, kV; Resistance (opór elektryczny): Ω, kΩ, MΩ; Capacitance (pojemność elektryczna): F, µF, nF, pF; AmountOfSubstance (liczność materii): mol, mmol; AmountOfSubstanceConcentration (stężenie molowe): mol/m³, mol/l; MolarMass (masa molowa): kg/mol, g/mol; LuminousIntensity (światłość): cd
  "options" (wybór z listy) — [{"value", "label"}]
  "to" (odwołanie) — na jakie rodzaje wskazuje: ["@ref rodzaju z tego dokumentu", "Nazwa rodzaju", "work"]; puste — na dowolne
  "locator": true (odwołanie z miejscem) — każda wartość to {"value": "@dzielo", "locator": "Ps 110"}: psalm to Biblia z biblioteki + miejsce, hasło to leksykon + „s. 23"; miejsca w Piśmie aplikacja czyta (Ps 110 · Łk 1,46-55) i po nich szuka; tekstu Biblii się nie przechowuje
    np. {"key": "miejsce", "label": "Miejsce w Piśmie", "type": "ref", "to": ["work"], "locator": true}, a we wpisie: "miejsce": {"value": "@bt", "locator": "Ps 110,1-7"}
  "blocks" (treść w blokach) — lista bloków: {"type": "paragraph", "text": "zapis"} | {"type": "ordered"|"unordered", "items": [komórka, …]} | {"type": "table", "columns": ["nagłówek", …], "rows": [[komórka, …], …]} | {"type": "details", "summary": "Beweisidee", "text": "zapis"} (do rozwinięcia — zwinięty z nagłówkiem "summary");
    komórka to lista kawałków: {"text": "…"} albo {"ref": "@wpis", "locator": "Łk 1,35"} — prawdziwe odwołanie (do wpisu tej bazy, innej bazy albo źródła biblioteki), z miejscem albo bez
    każdy rodzaj z polem "blocks" jest rodzajem WYPOWIEDZI (np. Komentarz): teza = pierwsze zdanie pierwszego akapitu (najwyżej 200 znaków) — nazwa wpisu i pierwsza strona karty;
    teza zakończona „?” czyni wpis pytaniem — odpowiedzią jest wypowiedź, która się do niego odwołuje; „informacja” (odwołuje się tylko do źródeł biblioteki) albo „interpretacja” (do innej wypowiedzi albo do żadnego źródła) liczy się z odwołań i nie zapisuje się
  gotowe schematy to pliki w repozytorium, importowane jak każdy schemat (Wiedza → Schematy → Rodzaje wpisów → „Schemat jako JSON” → Import): templates/cogita/komentarz.json (Komentarz: „O czym” — odwołania z miejscem do dowolnego wpisu, „Treść” — bloki; z szablonami kart „Teza” i „Tabela z treści”),
    templates/cogita/slownik.json (Język, Słowo, Tłumaczenie, Synonimy, Antonimy — z szablonami „Słówka”), templates/cogita/psalterz.json (psalm z miejscem w Piśmie, miejsca brewiarza),
    templates/cogita/komentarz-biblijny.json (Komentarz z argumentami za i zarzutami, Komentarz biblijny do fragmentu Pisma),
    templates/cogita/pytania.json (jeden schemat pytań: wbudowany rodzaj „Pytanie” z jego rodzajami pytań i polami, sposoby dodawania wielu pytań naraz — prawda/fałsz, odpowiedź słowami, fiszki — i widok „Pytania według rodzaju”),
    templates/cogita/podstawy.json (kolejność nauki: „Pojęcie” z polem „Wymaga” — "prerequisite": "up" —, karty „czym jest”, widok „Od podstaw” i sposób dodawania pojęć z tym, czego wymagają; przykład z atomem do zaimportowania jako kurs: templates/cogita/przyklad-atom.json),
    templates/cogita/fakty.json (fakty i źródła — z dowolnego źródła: powieści o prawdziwej osobie, podręcznika, reportażu, wspomnień, nagrania: „Fakt” — jedno twierdzenie o świecie z hasłem, rodzajem, kiedy, gdzie, o kim, okresem, źródłem z miejscem, tym, jak je podaje źródło, oceną po sprawdzeniu (potwierdzone, sporne, uproszczone, nieprawdziwe, fikcja…) i innymi źródłami; „Okres” — epoka albo etap z czasem trwania; karty „Kiedy?”, „Co wiadomo?”, „Czy to się zgadza?”; widoki według okresów, oś czasu, według oceny i rodzaju, od podstaw),
    templates/cogita/zbior.json (zbiór pozycji do rozpoznania i rozróżnienia — prefacje i modlitwy, pieśni, psalmy, artykuły ustawy, utwory, obrazy: „Pozycja” z numerem, oznaczeniem, początkiem, tym, o czym jest, znakami rozpoznawczymi, obrazem albo dźwiękiem, grupą, miejscem w dziełach, pozycjami łatwymi do pomylenia i różnicą, użyciem; „Grupa” — dział z tym, co go wyróżnia; karty „Która to?” po początku albo obrazie, początki ↔ oznaczenia, „Czym się różni?”; widoki według numeru, grup, podobnych i różnic),
    templates/cogita/ksiazka-AI.md (jak przygotować dowolną książkę z KI w dwóch krokach: Biblioteka z całym tekstem, potem menu wyboru — zakres, warstwy, pytania, kolejność nauki, powtórki — i kurs Cogita),
    templates/cogita/wywod.json (opis dzieła: „Krok wywodu” — rola (pytanie, teza, argument, zarzut… albo wątek, część utworu, wydarzenie, etap, opis), miejsce w dziele, treść, ważny fragment, „Należy do” — połączenie w strukturze, także w kilku strukturach naraz, czas opowieści; „Element stały” — pojęcie, postać, miejsce, motyw… w dziele albo ponad dziełami („Ogólnie”); Komentarz — własna uwaga; widoki „Wywód” (drzewo, kolejność tekstu, czas opowieści), „Elementy stałe”; karty ze ścisłym sprawdzaniem: fragmenty ↔ tezy, teza do fragmentu, dzieło tezy, znaczenie elementu; jak przygotować tekst i strukturę dzieła dla KI w dwóch krokach: templates/cogita/wywod-AI.md)
  typy pól: "line" (Wiersz tekstu), "text" (Dłuższy tekst), "markup" (Tekst z przypisami), "blocks" (Treść w blokach (akapity, listy, tabele)), "number" (Liczba z jednostką), "date" (Data (rok, miesiąc albo dzień)), "bool" (Tak / nie / nie wiadomo), "choice" (Wybór z listy), "ref" (Odwołanie), "media" (Obraz, dźwięk, film, dokument), "url" (Adres strony), "list" (Lista w kolejności), "geo" (Miejsce na mapie), "range" (Zakres z kilku odcinków)
  wartość niepewna: {"value": …, "state": "known|approximate|disputed|unknown|na|pending", "source": {"work": "@dzielo", "locator": "s. 23"}, "note": "…"}
  data: "1999", "1999-05", "1999-05-03", "-1000" (przed Chr.); zakres: {"segments": [{"from": 992, "to": 1000}]}

"entities" — wpisy: {"ref", "kinds": ["person", "Postać"], "data": {pole: wartość}}
  wypowiedź — wpis rodzaju z polem "blocks", np. komentarz z templates/cogita/komentarz.json:
    "kinds": ["Komentarz"], "data": {"about": [{"value": "@bt", "locator": "Łk 1,35"}], "content": [{"type": "paragraph", "text": "Duch Święty zstępuje na Maryję jak na Apostołów. Łukasz opisuje oba wydarzenia tymi samymi słowami."}, {"type": "table", "columns": ["Zwiastowanie", "Pięćdziesiątnica"], "rows": [[[{"ref": "@bt", "locator": "Łk 1,35"}], [{"ref": "@bt", "locator": "Dz 1,8"}]]]}]}
    rodzaju „wiedza” ("knowledge") już nie ma — stare takie wpisy stoją w Wiedzy pod „Stare wpisy”
    tematów i perspektyw nie ma — porządek dają własne rodzaje (np. "Tajemnica" z polami "numer" i "czesc" → rodzaj "Część"; "Obszar" z polem "grupa"), a wpisy wskazują na nie polami-odwołaniami (komentarz: "about"; kazanie: pola swojego rodzaju tekstu, np. "tajemnica", "obszar")
    rodzaj tekstu ze skryptorium, z którego korzysta baza, jest tu rodzajem: tekst ma jego pola obok stałych (tytuł, data, plan…) — widoki grupują i macierze ustawiają teksty według nich
    karty z wypowiedzi: szablon z "kinds": ["@rodzaj z polem blocks"] i węzłami "statement.thesis" (teza), "statement.part" ({"n": 2} — drugi kawałek; puste: akapity), "statement.table" ({"table": 1, "left": 1, "right": 2} — pary z kolumn), "statement.subjects" (o czym: wartości pól-odwołań, z miejscem)
    zapis tekstu w akapicie i w polach "markup" (ten sam co w Skryptorium): akapity oddziela pusta linia, "## śródtytuł", **pogrubienie**, *kursywa*, [opis](https://…), ^[przypis], "> cytat", "- punkt";
    [[słowo|@wpis]] — link do wpisu (tej bazy, innej bazy albo biblioteki) z tymi słowami; nigdy przypis;
    [@dzielo, s. 23] — źródło: dzieło, cytat, osoba z biblioteki staje się przypisem; ten sam zapis na wypowiedź, wpis czy tekst daje w tekście link „(zob. etykieta)”
    CYTAT — osobny akapit, każda linia od "> "; słowa w cudzysłowie, źródło jako przypis na końcu słów; ostatnia linia od "> — " to podpis (kto mówi) pod cytatem:
      "> „Wszystkie następne lata zostały głęboko naznaczone tym snem.” [@bosco-biografia, s. 5]\n> — Teresio Bosco"
      — pokazany jako wyróżniony blok z podpisem; NIGDY „**Cytat (T. Bosco):** „…”” w zwykłym akapicie (wtedy to zwykły tekst); przypisy zbierają się same pod tekstem — nie pisz ich ręcznie ani listy „Przypisy”
    BLOK DO ROZWINIĘCIA (długi dowód, szczegóły): w zapisie "::: details Beweisidee" w osobnej linii, potem treść (akapity, wzory, listy), na końcu ":::" w osobnej linii — pokazany zwinięty, z tym nagłówkiem; w polu "blocks" także jako blok {"type": "details", "summary": "Beweisidee", "text": "zapis treści"} (zapisuje się jako akapit z tym zapisem)
  pytanie — JEDEN rodzaj "question"; "form" (rodzaj pytania) mówi, jak się pyta, i od niego zależy, które pola się wypełnia:
    "text" — Odpowiedź słowami: Uczący się wpisuje odpowiedź; liczy się podobieństwo — literówka daje część punktów. Dobrych odpowiedzi może być kilka. Pola: "prompt" (pytanie), "answers" (poprawne odpowiedzi, np. ["siedem", "7"])
    "number" — Liczba: Uczący się wpisuje liczbę, może z jednostką; tolerancja mówi, ile wolno się pomylić. Pola: "prompt" (pytanie), "answers" (poprawne odpowiedzi, np. ["12"]), "unit" (jednostka, np. "N·m"), "quantity" (wielkość, np. "Torque"), "tolerance" (tolerancja, np. 0.5), "relative" (tolerancja względna, np. false)
    "date" — Data: Uczący się wpisuje datę — z dokładnością do roku, miesiąca albo dnia. Pola: "prompt" (pytanie), "answers" (poprawne odpowiedzi, np. ["1410-07-15"]), "precision" (dokładność daty, np. "year"), "tolerance" (tolerancja, np. 0)
    "gap" — Luka w tekście: Tekst z zakrytym słowem — w treści [[słowo]] (albo „…” i dobre odpowiedzi niżej); uczący się wpisuje, czego brakuje. Kilka luk: każda osobno; luka z „Do wyboru” jest listą do wybrania (może mieć wzory), bez — polem do wpisania. Pola: "prompt" (tekst z luką), "answers" (poprawne odpowiedzi, np. ["Ojczyzno"]), "choices" (do wyboru w lukach, np. [["Satz 2.1", "Lemma 3.4"], []])
    "one" — Jedna z kilku: Kilka możliwości, dobra jest jedna; kolejność miesza się przy każdym pytaniu. Do każdej możliwości można dopisać zdanie, które uczący się zobaczy po odpowiedzi. Pola: "prompt" (pytanie), "options" (do wyboru, np. ["Pięć", "Siedem", "Dwanaście"]), "correct" (które są dobre, np. [1]), "feedback" (zdanie do każdej możliwości, np. ["Za mało — policz też zbiór pusty.", "", "Tak: 2^3 = 8.", "Za dużo."])
    "many" — Kilka z kilku: Kilka możliwości, dobrych może być kilka — trzeba zaznaczyć wszystkie. Każde zdanie liczy się osobno (dobrze zaznaczone albo dobrze pominięte), wynik to ich średnia; każde jest też osobnym faktem, więc liczy się na każdej karcie, na której stoi. Długa lista z „Ile naraz” — każde zdanie ma swoją kartę. Do każdej możliwości można dopisać zdanie na po odpowiedzi. Pola: "prompt" (pytanie), "options" (do wyboru, np. ["Pięć", "Siedem", "Dwanaście"]), "correct" (które są dobre, np. [1]), "feedback" (zdanie do każdej możliwości, np. ["Za mało — policz też zbiór pusty.", "", "Tak: 2^3 = 8.", "Za dużo."]), "show" (ile naraz, np. 4)
    "truefalse" — Prawda czy fałsz: Jedno zdanie; uczący się mówi, czy jest prawdziwe. Pola: "prompt" (zdanie), "value" (prawda?, np. true)
    "match" — Połącz w pary: Dwie kolumny (np. rok — wydarzenie); uczący się łączy je w pary. Długa lista pokazuje się po kilka par naraz. Pola: "prompt" (polecenie), "left" (lewa strona, np. ["1410", "1569", "1791"]), "right" (prawa strona, np. ["Bitwa pod Grunwaldem", "Unia lubelska", "Konstytucja 3 maja"]), "leftLabel" (nagłówek lewej strony, np. "Rok"), "rightLabel" (nagłówek prawej strony, np. "Wydarzenie"), "show" (ile naraz, np. 4)
    "order" — Ułóż w kolejności: Elementy pomieszane; uczący się układa je po kolei (przeciąga). Z „Podglądem” nad listą widać ułożone razem — jako wzór albo tekst. Pola: "prompt" (polecenie), "items" (w dobrej kolejności, np. ["1s", "2s", "2p", "3s"]), "extra" (kafelki zbędne, np. ["$\\forall a\\in A$", "$P(a)$"]), "preview" (podgląd, np. "math"), "join" (między kafelkami, np. " ")
    "build" — Zbuduj z kafelków: Uczący się składa odpowiedź z kafelków (wzór, zaprzeczenie, wyrażenie, linijkę dowodu) i od razu widzi ją złożoną; są kafelki zbędne, może być kilka dobrych kolejności. Pola: "prompt" (polecenie), "items" (w dobrej kolejności, np. ["$\\exists a\\in A$", "$:$", "$\\neg P(a)$"]), "extra" (kafelki zbędne, np. ["$\\forall a\\in A$", "$P(a)$"]), "alternatives" (inne dobre kolejności, np. [["…", "…"]]), "preview" (podgląd, np. "math"), "join" (między kafelkami, np. " ")
    "flash" — Fiszka (sam oceniasz): Przód i odwrotna strona; uczący się odwraca kartę i sam mówi, czy umiał. Pola: "prompt" (przód fiszki), "back" (odwrotna strona, np. ["Najmniejsza część pierwiastka"])
    "point" — Miejsce na mapie: Uczący się wskazuje punkt na mapie; liczy się, czy trafił w promień. Pola: "prompt" (pytanie), "place" (miejsce, np. {"lat": 53.49, "lon": 20.1}), "radius" (promień (m), np. 20000)
    "code" — Kod (Python): Uczący się pisze funkcję transform(x) w Pythonie; sprawdzają ją widoczne przykłady (wejście → wynik), potem ukryte przypadki porównane z rozwiązaniem wzorcowym. Każdy przypadek ma 2 sekundy. Pola: "prompt" (pytanie), "task" (zadanie, np. "…"), "starter" (początek kodu, np. "def transform(x): …"), "tests" (przykłady, np. [{"input": [3, 1, 2], "output": [1, 2, 3], "note": "rosnąco"}]), "createInput" (dane testowe, np. "def create_input(seed): …"), "reference" (rozwiązanie wzorcowe, np. "def reference(x): …"), "cases" (ile przypadków, np. 5)
    "interactive" — Rysunek do poruszania: Uczący się ustawia rysunek (suwaki, przeciąganie) i sprawdza; dobrze, gdy symulacja osiąga cel. Pola: "prompt" (pytanie), "drawing" (rysunek (JSON), np. "{… JSON rysunku …}"), "goal" (cel (wyrażenie), np. "abs(x - cel) < 0.5"), "solution" (rozwiązanie, np. "v0 = 12"), "goals" (cele po kolei, np. …), "check" (kiedy sprawdzać, np. …)
    wspólne dla każdego: "form" (rodzaj pytania), "prompt" (pytanie), "hints" (podpowiedzi), "explanation" (wyjaśnienie (tekst)), "explain" (wyjaśnienie (wpisy)), "about" (o czym), "needs" (najpierw trzeba znać), "params" (parametry), "let" (wartości liczone), "require" (warunki losowania), "share" (wspólne części), "fact" (o jaki fakt pyta), "core" (pytanie kluczowe);
      "about": ["@wpis"] — co pytanie sprawdza: jego wynik liczy się do znajomości tych wpisów, a pytanie czeka, aż opanujesz to, co trzeba znać przed nimi;
      "needs": ["@wpis albo @pytanie"] — co trzeba opanować przed tym pytaniem (pytanie ogólne przed szczegółowym)
      "core": true — pytanie kluczowe tematów z "about": „Sprawdź, co wiesz” pyta o nie raz (temat bez pytania kluczowego: jego pierwsze pytanie), po nim widać „lukę” (filtr „Luki” na krajobrazie, warunek "rel": "core"), karta nosi znak „kluczowe”, a w panelu tematu stoi na górze; np. {"ref": "@q/becchi-1", "kinds": ["question"], "data": {"form": "one", "prompt": "Gdzie urodził się Jan Bosko?", "options": ["Becchi", "Turyn", "Chieri"], "correct": "Becchi", "about": ["@t/becchi"], "core": true}}
    pary: lewa i prawa strona w tej samej kolejności; długa lista z "show" (2–12) — na karcie tyle par, każda para ma swoją kartę, wracają te, których uczący się jeszcze nie umie
    części (2026-11-01): każde pytanie pyta o części, a każda część jest faktem liczonym osobno — para (match), zdanie (many: dobrze zaznaczone albo dobrze pominięte, wynik to średnia; z "show" każde zdanie ma swoją kartę), słowo w luce (gap z kilkoma lukami); pytanie bez części (text, number, date, one, truefalse, flash, order…) ma jedną część tylko z "fact" (nazwa faktu; "#strona" = ta strona wpisu z "about", ten sam fakt co karta szablonu z "asks"); "share" (nazwa) sprawia, że pytania z tą samą nazwą dzielą te same części — jedna odpowiedź liczy się dla każdej karty, która o nią pyta; "truefalse" z "share" to zdanie, to samo co w "many" z tym samym "share"
    np. {"ref": "@q-lata", "kinds": ["question"], "data": {"form": "match", "prompt": "Połącz rok z wydarzeniem", "left": ["1410", "1569", "1791", "1918"], "right": ["Bitwa pod Grunwaldem", "Unia lubelska", "Konstytucja 3 maja", "Odzyskanie niepodległości"], "leftLabel": "Rok", "rightLabel": "Wydarzenie", "show": 3}}
    np. {"ref": "@q-atom", "kinds": ["question"], "data": {"form": "one", "prompt": "Co jest w jądrze atomu?", "options": ["Elektrony", "Protony i neutrony", "Tylko neutrony"], "correct": [1], "about": ["@atom"]}}
    np. {"ref": "@q-orbital", "kinds": ["question"], "data": {"form": "truefalse", "prompt": "Na jednym orbitalu mogą być najwyżej dwa elektrony.", "value": true, "about": ["@orbital"], "needs": ["@q-atom"]}}
    "gap" — w treści [[słowo]] to luka (uczący się widzi „…”), a bez "answers" dobrą odpowiedzią jest to słowo; kilka luk — każda osobno (wynik: część dobrych luk);
      "choices" — do każdej luki po kolei lista ZŁYCH możliwości: luka z listą jest do wybrania (dobre słowo dochodzi samo, mogą być wzory), z pustą [] — do wpisania
    WZORY: $…$ w zdaniu, $$…$$ osobno — w pytaniu, możliwościach, parach, elementach, kafelkach, podpowiedziach, wyjaśnieniu; \$ to zwykły dolar; wpisywanie odpowiedzi nigdy nie wymaga LaTeX-a
    "hints" — podpowiedzi przed odpowiedzią (1–3, od łagodnej do konkretnej): każda odsłonięta obniża najwyższy wynik tej odpowiedzi o 0,25 (jedna — najwyżej 0,75);
    "explanation" — wyjaśnienie (zapis, 2–4 zdania, wzory, źródła [@dzieło, s. 12]) zaraz po odpowiedzi, rozwinięte; "explain" — wpisy po nim, zwinięte;
      slajdy opowieści na początku "explain" (wpisy rodzaju z polem „Treść w blokach”, które pokazuje krok "show" przebiegu) stoją po odpowiedzi PIERWSZE, narysowane jak w odtwarzaczu (tytuł, tekst, cytaty z „> — Autor”, wzory, przypisy), zwinięte; pod rozwiniętym: „Zobacz w opowieści” (podgląd opowieści na tym slajdzie: niczego nie zapisuje; najpierw opowieść już zaczęta, potem głębsza przed przeglądem, z drabiną zagłębień „Etap 1 › Sen dziewięciolatka”) i „Pytania do tego slajdu (N)” z „Ćwicz”; pytania o tych samych początkowych slajdach to jedno pole mapy „Pytania” obok „Opowieści”; "explain" wskazujące JEDNOSTKĘ opowieści („Część opowieści”, gdy pytanie obejmuje całą opowieść, np. oś czasu) — pole „Cała opowieść” tej opowieści, a „Zobacz w opowieści” otwiera ją od początku; [@klucz] cytowania nie wpisuj w "prompt" (import ostrzega) — źródło należy do "explanation";
    "feedback" (one, many) — po jednym zdaniu do każdej możliwości, w kolejności "options" ("" — bez zdania): po odpowiedzi stoi pod wybraną i pod dobrymi
    "build" — kafelki dobrej odpowiedzi po kolei w "items", zbędne w "extra", inne dobre kolejności w "alternatives" (lista list), "preview": "math" (całość jako jeden wzór; kafelek $…$ wchodzi bez dolarów) albo "text", "join" — co stoi między kafelkami (domyślnie spacja);
      np. {"form": "build", "prompt": "Bilden Sie die Negation von $\\forall a\\in A: P(a)$.", "items": ["$\\exists a\\in A$", "$:$", "$\\neg P(a)$"], "extra": ["$\\forall a\\in A$", "$P(a)$"], "preview": "math"}
      "order" z "preview" pokazuje nad listą ułożone razem (jak "build"); "extra" przy "order" nic nie zmienia — zmiana "form" na "build" je włącza
    "code" — "tests": widoczne przykłady [{"input": …, "output": …, "note": "…"}] (wartości JSON albo tekst JSON), sprawdzane przed ukrytymi przypadkami z "createInput"/"reference"; każdy przypadek ma 2 s; wynik: część zdanych
    GENERATOR — PARAMETRY (każdy rodzaj; zadanie losowane od nowa przy każdym pokazaniu karty; ten sam mechanizm ma szablon w węźle "generate"):
      "params" — losowane po kolei: {"name": "a", "random": [20, 99], "step": 1} (liczba z przedziału; całe granice — krok 1) · {"name": "f", "values": ["sin", "cos"]} (jedna z listy; element może być listą)
        · {"name": "kation", "entry": {"kind": "@rodzaj", "where": "it.ladunek > 0"}} — jeden wpis z bazy · {"name": "zd", "entries": {"kind": "@rodzaj", "count": 4}} — kilka RÓŻNYCH (bez "count": wszystkie pasujące, w ich kolejności);
        "where" — wyrażenie z "it" (kandydat), może czytać wcześniejsze parametry (anion pasujący do kationu); "rule" — reguła jak w zbiorach ({"op": "and", "items": [{"field": "data", "cmp": "filled"}]}); wpis wylosowany już w tym zadaniu nie wraca ("repeat": true — może);
        wylosowany wpis to rekord: kation.label, kation.id, kation.kind i każde pole po kluczu — liczba (z wielkością: pole_si w SI, pole_unit), tekst, wybór (pole_label — nazwa), tak/nie jako 1/0, data jako liczba rrrrmmdd do porównań (pole_text — słowami), odwołanie jako rekord jeden krok dalej (zd[0].okres.label)
      "let": [{"name": "n", "value": "lcm(kation.ladunek, -anion.ladunek)"}] — liczone po kolei (język wyrażeń niżej); "require": ["isint(x)", "a != b"] — losuje od nowa (do 60 razy), aż wszystkie są spełnione; gdy się nie da — karta NIE powstaje (nigdy zepsuta), a autor widzi powód w edytorze, w „Do zrobienia” i w podglądzie importu
      w tekstach (prompt, options, answers, items, left, right, back, hints, explanation, feedback, extra, choices) {wyrażenie} to wartość — liczby z przecinkiem, we wzorze {,}, wpis — jego nazwa, lista — przez przecinek;
        cały element listy jako jedna lista: "options": ["{dobra}", "{zle}"] — gdy {zle} to lista, każdy jej element jest osobną możliwością (tak samo items, left, right, answers); "correct": ["{k}"], "value": "{a.data < b.data}" (prawda/fałsz), "tolerance": "{tol}" — też liczone;
        {…} z nazwą spoza parametrów to zwykły tekst (LaTeX: \mathbb{N}, x^{2}); kto chce literę parametru jako grupę LaTeX-a, pisze ją ze spacjami: \frac{ a }{2}
      odpowiedź zapisuje numer losowania ("seed") i wylosowane wartości (wpisy jako "@id", krótkie listy); karta zostaje ta sama (klucz pytania) — historia zaczyna się od nowa TYLKO, gdy zmieni się generator (params, let, require) albo wzór odpowiedzi (answers, options, correct, items …), nigdy przy losowaniu
      "rule" przy form "text": {"spaces": true} — spacje się nie liczą; {"scripts": true} — indeksy (₂, ²) jak zwykłe cyfry: Al2(SO4)3 = Al₂(SO₄)₃
      np. {"form": "number", "prompt": "Bestimmen Sie $r$ mit $0\\le r<{n}$ und ${a} = q\\cdot {n} + r$.", "params": [{"name": "a", "random": [20, 99]}, {"name": "n", "random": [3, 9]}], "let": [{"name": "r", "value": "mod(a, n)"}], "answers": ["{r}"]}
      np. {"form": "number", "prompt": "Samochód przejechał {s} m w {t} s. Jaka była jego średnia prędkość?", "params": [{"name": "s", "random": [20, 500], "step": 10}, {"name": "t", "random": [2, 60]}], "let": [{"name": "v", "value": "s / t"}], "answers": ["{v}"], "unit": "m/s", "quantity": "Velocity", "tolerance": 0.01, "relative": true}
      np. {"form": "one", "prompt": "Co było wcześniej?", "params": [{"name": "a", "entry": {"kind": "@hist/zdarzenie"}}, {"name": "b", "entry": {"kind": "@hist/zdarzenie", "where": "it.data != a.data"}}], "let": [{"name": "pierwsze", "value": "minby([a, b], it.data)"}, {"name": "drugie", "value": "maxby([a, b], it.data)"}], "options": ["{pierwsze.label}", "{drugie.label}"], "correct": [0]}
    JĘZYK WYRAŻEŃ w generatorach (let, require, where, {…}, „Oblicz”):
      Wyrażenia w zadaniach generowanych — ten sam język co w rysunkach (liczby z kropką, teksty w apostrofach, + - * / % ^, < <= > >= == !=, && || !, w ? a : b), a do tego:
        listy: [1, 2, 3], [a, b]; element: lista[0] (od 0; lista[-1] — ostatni); lista + lista — połączone
        wpis (wylosowany z bazy): wpis.pole (np. kation.ladunek), wpis.id, wpis.label; pole liczbowe z wielkością: wpis.pole_si (w SI), wpis.pole_unit; data: wpis.data (liczba rrrrmmdd, do porównań), wpis.data_text (słowami); odwołanie: wpis.okres.label (jeden krok dalej)
        wyrażenie dla każdego elementu (filter, map, sortby, count, any, all, find, sum, avg, min, max, minby, maxby): "it" — element, "i" — jego miejsce (od 0), np. filter(jony, it.ladunek < 0), map(wydarzenia, it.label)
        teksty porównują się alfabetycznie ("Ala" < "Ola"); == porównuje też listy (element po elemencie) i wpisy (po id)
        losowanie w wyrażeniu (shuffle, choose, pick) używa numeru zadania — ten sam numer daje to samo zadanie
        funkcje liczbowe:
          sin — sinus (kąt w radianach — rad(30) zamienia stopnie)
          cos — cosinus (radiany)
          tan — tangens (radiany)
          asin — arcus sinus — wynik w radianach (deg(...) zamienia na stopnie)
          acos — arcus cosinus (radiany)
          atan — arcus tangens (radiany)
          atan2 — atan2(y, x) — kąt wektora (x, y) w radianach
          sinh — sinus hiperboliczny
          cosh — cosinus hiperboliczny
          tanh — tangens hiperboliczny
          sqrt — pierwiastek kwadratowy
          cbrt — pierwiastek sześcienny
          abs — wartość bezwzględna
          sign — znak: −1, 0 albo 1
          floor — w dół do całości
          ceil — w górę do całości
          trunc — część całkowita
          round — round(x) albo round(x, cyfry) — zaokrąglenie
          clamp — clamp(x, od, do) — x przycięte do przedziału
          lerp — lerp(a, b, t) — od a do b: t = 0 daje a, t = 1 daje b
          exp — e do potęgi x
          ln — logarytm naturalny
          log10 — logarytm dziesiętny
          log2 — logarytm o podstawie 2
          pow — pow(a, b) — to samo co a^b
          hypot — hypot(x, y) — długość wektora
          deg — radiany na stopnie
          rad — stopnie na radiany
          mod — mod(a, b) — reszta, zawsze od 0 do b (także dla ujemnych)
          step — step(próg, x) — 0 przed progiem, 1 od progu
          smooth — smooth(od, do, x) — łagodnie od 0 do 1, gdy x idzie od „od" do „do"
          tri — tri(x) — fala trójkątna 0 → 1 → 0, okres 1 (odbijanie, zygzak)
          rand — rand(x) — „losowa" liczba 0–1, zawsze ta sama dla tego samego x (np. rand(i) dla każdej kopii)
          onstep — onstep(x, krok) — 1, gdy x leży na siatce kroku (onstep(2.25, 0.25) → 1): warunek zadań losowych, żeby rozwiązanie dało się ustawić
          root — root(x, n) — pierwiastek stopnia n (root(27, 3) → 3; z liczby ujemnej tylko nieparzystego stopnia)
          log — log(x) — dziesiętny, log(x, b) — o podstawie b: log(8, 2) → 3
          sig — sig(x, n) — zaokrąglenie do n cyfr znaczących: sig(0.012345, 2) → 0,012
          fact — fact(n) — silnia n! (n całkowite 0–170)
          binom — binom(n, k) — symbol Newtona: na ile sposobów wybrać k z n
          isint — isint(x) — 1, gdy x jest liczbą całkowitą (warunek: wynik ma być całkowity)
          fmt — fmt(x, cyfry) — liczba jako tekst z przecinkiem: fmt(9.81, 1) → "9,8"
          fmtpi — fmtpi(x, cyfry) — liczba jako wielokrotność π: fmtpi(2.356) → "0,75π", fmtpi(3.1416) → "π" (do 2 miejsc, bez zer na końcu)
        funkcje list, tekstów i wpisów:
          len — len(x) — ile elementów ma lista (albo znaków tekst)
          first — first(lista) — pierwszy element
          last — last(lista) — ostatni element
          at — at(lista, i) — element na miejscu i, licząc od 0 (−1: ostatni); to samo co lista[i]
          take — take(lista, k) — pierwsze k elementów
          drop — drop(lista, k) — bez pierwszych k elementów
          slice — slice(lista, od, do) — kawałek: od włącznie, do wyłącznie (od 0; ujemne liczą od końca)
          reverse — reverse(lista) — w odwrotnej kolejności
          sort — sort(lista) — rosnąco: liczby według wartości, teksty alfabetycznie, wpisy według nazwy (malejąco: reverse(sort(lista)))
          shuffle — shuffle(lista) — losowo przemieszana (los zadania: ten sam numer zadania, ta sama kolejność)
          choose — choose(lista, k) — k różnych elementów wybranych losowo (bez powtórzeń)
          pick — pick(lista) — jeden element wybrany losowo
          contains — contains(lista, x) — 1, gdy x jest na liście (w tekście: gdy tekst zawiera x)
          index — index(lista, x) — miejsce x na liście, od 0 (−1: nie ma)
          unique — unique(lista) — każdy element raz
          range — range(od, do, krok) — liczby od…do WŁĄCZNIE (range(1, 5) → [1, 2, 3, 4, 5]); krok domyślnie 1
          join — join(lista, separator) — elementy w jednym tekście (domyślnie przez przecinek)
          concat — concat(a, b, …) — listy połączone w jedną (pojedyncza wartość dochodzi jako element)
          list — list(a, b, …) — lista z tych wartości (to samo co [a, b, …])
          get — get(wpis, "klucz") — pole wpisu po kluczu (to samo co wpis.klucz)
          str — str(x) — jako tekst; liczba z przecinkiem, do 12 cyfr znaczących
          num — num(tekst) — liczba z tekstu ("3,5" → 3.5)
          sub — sub(x) — cyfry i znaki + − ( ) w indeksie dolnym: "SO" + sub(4) → "SO₄"
          sup — sup(x) — w indeksie górnym: "Al" + sup("3+") → "Al³⁺"
          plain — plain(x) — indeksy z powrotem jako zwykłe znaki: "Al₂(SO₄)₃" → "Al2(SO4)3"
          upper — upper(tekst) — wielkimi literami
          lower — lower(tekst) — małymi literami
          gcd — gcd(a, b, …) — największy wspólny dzielnik liczb całkowitych (także listy)
          lcm — lcm(a, b, …) — najmniejsza wspólna wielokrotność (także listy): lcm(3, 2) → 6
          if — if(warunek, a, b) — a, gdy warunek jest spełniony, inaczej b (to samo co warunek ? a : b)
          filter — filter(lista, warunek) — te elementy, dla których warunek jest spełniony: filter(jony, it.ladunek > 0)
          map — map(lista, wyrażenie) — wyrażenie dla każdego elementu: map(wydarzenia, it.label)
          sortby — sortby(lista, klucz) — rosnąco według wyrażenia: sortby(wydarzenia, it.data) — od najwcześniejszego
          find — find(lista, warunek) — pierwszy element, który spełnia warunek (nie ma: "")
          any — any(lista, warunek) — 1, gdy choć jeden element spełnia warunek
          all — all(lista, warunek) — 1, gdy każdy element spełnia warunek
          count — count(lista) — ile elementów; count(lista, warunek) — ile spełnia warunek
          sum — sum(lista) albo sum(lista, wyrażenie) — suma: sum(skladniki, it.masa)
          avg — avg(lista) albo avg(lista, wyrażenie) — średnia
          min — min(a, b, …) — najmniejsza liczba; min(lista); min(lista, wyrażenie)
          max — max(a, b, …) — największa liczba; max(lista); max(lista, wyrażenie)
          minby — minby(lista, klucz) — element z najmniejszym kluczem: minby(wydarzenia, it.data) — najwcześniejsze
          maxby — maxby(lista, klucz) — element z największym kluczem
        Granice: lista do 2000 elementów, w jednym wyrażeniu do 200000 kroków po listach — więcej daje NaN (zadanie się nie losuje).
    "interactive" — rysunek do poruszania: "drawing" (ten sam JSON co moduł strony „Animacja”: vars, let, sim, controls, rules z "goal": true, world, elements — jako tekst JSON),
    "goal" (wyrażenie celu, np. "abs(x - cel) < 0.5 && y <= 0"; puste — reguły rysunku z "goal"), "solution" ("kat = 45; v0 = sqrt(cel*g)" — rachunek z wartościami rysunku; w świecie także "w2.pos = 5"; puste — "task.solve" rysunku, a jego "task" losuje przy każdej próbie zadanie tak samo trudne);
    sprawdzane przez symulację ustawionych wartości do końca (świat — odtworzony według jego reguł: co zablokowane, zostaje); wartości z "random" losowane przy każdej próbie;
    "goals" (zamiast "goal"): kilka celów PO KOLEI, np. ["x > 3", "y < 1"] — dobrze dopiero, gdy najpierw spełniony jest pierwszy, a potem drugi; "check": "live" (domyślnie — rysunek pokazuje trafienie już przy próbach, ocena po „Sprawdź”) albo "submit" (przy próbach nic nie zdradza celu, dopiero „Sprawdź” ocenia);
    podgląd importu liczy "solution" do końca i ostrzega, gdy rozwiązanie NIE osiąga celu, oraz wymienia nieznane nazwy w "let", "goal", "goals", "rules" i wyrażeniach elementów; w tekstach rysunku fmt(x, cyfry) i fmtpi(x) (wielokrotność π: fmtpi(2.356) → „0,75π”); nazwy suwaków i odczytów mogą mieć wzory ($…$), napisy na samym rysunku (elementy "text") są zwykłym tekstem (π, ², indeksy przez sub()/sup())

"templates" — szablony kart: {"name", "kinds": ["@rodzaj"], "direction": "a→b", "graph": {"nodes": [{"id", "type", "x", "y", "config"}], "edges": [{"id", "from", "out", "to", "in"}]}, "tests", "asks"}
  szablon może dotyczyć rodzaju z biblioteki ("quote", "work", "person") albo ze skryptorium ("text", "delivery", "project"), z których korzysta ta baza: wtedy karty powstają z ich wpisów, np. {"name": "Miejsce cytatu", "kinds": ["quote"], "direction": "locator", "graph": …}
  "tests" — co sprawdzają karty szablonu i jak mocno: [{"of": "this" (ten wpis) | "klucz pola-odwołania" (wpisy, na które wskazuje), "weight": 0–10}]; bez "tests": ten wpis z wagą 1.
    Znajomość należy do wpisu, a karta jest jego dowodem: dokładne pytanie waży więcej niż ogólne, jedna karta może liczyć się dla kilku wpisów;
    np. karta „Co się wtedy stało?” faktu: "tests": [{"of": "this", "weight": 1}, {"of": "okres", "weight": 0.3}, {"of": "gdzie", "weight": 0.3}]
  "asks" — o jaki FAKT pytają karty szablonu: [{"of": "this" | "klucz pola-odwołania", "facet": "nazwa faktu"}] albo krótko ["data"]; karty, które pytają o ten sam fakt tego samego wpisu, dzielą każdą odpowiedź
    — np. „Kiedy było X?” i „Co było w listopadzie 1829?” z "asks": ["data"]: dobra odpowiedź na jedną liczy się dla obu; w pętli „Dla każdej wartości” fakt jest osobny dla każdej wartości; bez "asks": karta liczy się tylko dla siebie;
    pary pytania „Połącz w pary” są faktami same z siebie: każda pokazana para liczy się dla karty swojej pary
  węzły liczące: "random" ({"min", "max", "step"} albo {"list": ["3", "5"]}, albo lista z wejścia "items"; "count": 4 — tyle RÓŻNYCH naraz) — losuje przy każdej karcie; "calc" („Oblicz”): {"expr": "p0 * p1; p0 + 1", "inputs": 2, "decimals": 2} — wyrażenia językiem rysunków (mod, round, fmt, sqrt …), jedno w wierszu albo po „;”, każde daje wartość (lista — kilka); p0…p7 — pierwsza liczba z wejścia, n0…n7 — ile wartości przyszło, l0…l7 — wszystkie wartości wejścia jako lista (wpisy jako rekordy: sum(l0, it.masa)); "aggregate" („Zbierz”): {"op": "sum"|"count"|"min"|"max"|"avg", "decimals"} — wejście "values" (np. "follow" → "field" liczbowe); wyjście "value" łączy się z "pattern", "answer.number" ("expected") i "answer.one" ("expected" albo "distractors", np. "p0 + 1; p0 - 1; p0 * 2")
  węzeł "generate" („Generator”) — TEN SAM generator co w pytaniach (GENERATOR wyżej): "config": {"params": […], "let": […], "require": […], "texts": [{"name": "pytanie", "value": "Jaki wzór ma {kation.label} z {anion.label}?"}]} — "this" w wyrażeniach to wpis tej karty (this.symbol); "only": "this.ladunek > 0" — kartę dostają tylko takie wpisy rodzaju (pozostałe bez ostrzeżenia);
    każda nazwa (parametr, wartość liczona, tekst) ma swoje wyjście o tej nazwie: liczby i teksty jako wartości, wpisy jako wpisy, lista jako kilka wartości — do "prompt" (przez "pattern" albo prosto tekst z "texts"), "answer.*" ("expected", "distractors", "items", "left", "right"), "card"
    gdy zadania nie da się wylosować (60 prób), dla tego wpisu nie powstaje karta — z powodem w podglądzie szablonu; karta zapisuje wylosowane wartości i numer losowania; historia karty zaczyna się od nowa tylko po zmianie grafu szablonu
  węzeł "card" przyjmuje też "hints" (podpowiedzi — teksty, od łagodnej do konkretnej) i "solution" (rozwiązanie — tekst z wartościami zadania, po odpowiedzi)

Znajomość — liczy ją aplikacja, tak samo wszędzie (nie ustawia się jej w JSON):
  każda odpowiedź zostaje zapisana; karta pamięta tylko kilka wartości: kiedy ostatnio odpowiedziano, ile czasu naprawdę minęło przed tą odpowiedzią, odstęp do następnego razu i najlepszy odstęp przed ostatnim błędem;
  dobrze (od 90%): odstęp = czas, który naprawdę minął × 3 (odpowiedź przed terminem go nie skraca); częściowo: jedna trzecia tego czasu, co najmniej dzień, jeśli minęły dni; źle (poniżej 25%): 5 minut; dobrze zaraz po błędzie: 0,4 × najlepszy odstęp sprzed błędu
    — np. źle po 5 dniach: wraca po 5 minutach; dobrze zaraz potem: za 2 dni; znów dobrze po 2 dniach: za 6 dni;
  znajomość karty: poprawność ostatniej odpowiedzi × √(10 ÷ (1 + 9 · czas od odpowiedzi ÷ odstęp)) — zaraz po dobrej 3,16, w dniu powtórki 1, potem spada coraz wolniej (10 % dopiero po 111 odstępach, nigdy 0); po złej 0;
  trzy pasma (stałe): „znane” od 1 (100 %) — jeszcze nie pora; „do powtórki” od 0,1 do 1 — umiesz, a teraz (albo zaraz) trzeba powtórzyć: termin powtórki NIE znaczy „nie umiem”; „nieznane” poniżej 0,1 — nigdy nie pytane, ostatnio źle albo zapomniane (111 odstępów po terminie);
  znajomość wpisu: średnia znajomości jego kart Z ODPOWIEDZIĄ, ważona "weight" z "tests" (karta jeszcze nie pytana nie jest dowodem); to, co na nim buduje (pola z "prerequisite" — połowa — i zależności z Ustawień, z ich wagą), podnosi ją co najmniej do tej części najlepszego z nich — nigdy do ich sumy

"revisions" — powtórki: {"name", "graph", "next"} (źródła → kroki → … → jeden „Sposób pytania")
  LEKCJA — zwykła powtórka z "endWhenDone": true, "pick": "next", "order": "general": w trakcie pasek „x z y kart”, na końcu podsumowanie (zrobione, dobrze za pierwszym razem, czas, karty ze złą odpowiedzią i „Ćwicz te jeszcze raz”);
    "next": "@kurs/lekcja-2" — trwała nazwa (albo identyfikator) powtórki, która idzie po tej: na końcu przycisk „Następna lekcja”
  także kroki wspólne z widokami: {"type": "follow", "config": {"field": "authors", "back": false}} — karty wpisów, do których prowadzi odwołanie (albo, "back": true, które wskazują na te wpisy); {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field", "cmp", "value"}]}}} — karty wpisów spełniających regułę; {"type": "structure", "config": {"dir": "down|up", "one": true}} — karty wpisów, które leżą w strukturze pod tymi wpisami (albo nad nimi); "follow" i "structure" z "keep": true zostawiają też karty, od których wyszły
  źródło „rodzaj z biblioteki": {"type": "source.kind", "config": {"kind": "quote", "from": "<identyfikator biblioteki>"}} — "from" puste: z tej bazy i ze wszystkich źródeł
  źródło „widok”: {"type": "source.view", "config": {"view": "@widok"}} — karty wpisów, które pokazuje zapisany widok: widok decyduje, co wchodzi w grę, powtórka z tego wybiera; zmiana widoku zmienia powtórkę, a jego „Filtry znajomości” na końcu działają w trakcie powtórki
    np. {"name": "Od ogólnego do szczegółu", "graph": {"nodes": [{"id": "w", "type": "source.view", "config": {"view": "@fakty/w-ogolne"}}, {"id": "p", "type": "strategy", "config": {"mode": "temporal", "order": "general"}}], "edges": [{"id": "e1", "from": "w", "out": "cards", "to": "p", "in": "cards"}]}}
  „Filtr znajomości”: {"type": "filter.when", "config": {"when": warunek}} — zostają karty, dla których warunek jest spełniony, sprawdzany W TRAKCIE powtórki przy każdej karcie: co czekało, wchodzi, gdy warunek zacznie obowiązywać; karta już w stosie zostaje
    warunek to ta sama logika co w przebiegach: {"type": "knowness", "rel": "before", "band": "learned"} — to, co trzeba znać wcześniej, jest poznane;
    "band" — pasmo zamiast liczby: "learned" (poznane: do powtórki albo znane — termin powtórki nie zamyka tego, co dalej) | "known" (znane, od 100 %) | "due" (do powtórki) | "unknown" (nieznane); albo liczba: "op": "ge", "than": 0.5 (dawne "rel": "before" / "up" z "than": 1 czyta się jako "learned");
    "rel": "self" (ten wpis) | "cards" (jego karty; w powtórce: ta karta) | "before" (to, co trzeba znać wcześniej — najbliższe wpisy z kartami w kolejności nauki) | "up" (to, pod czym leży w strukturze) | "chain" (już pytane karty CAŁEJ drogi przed nim — przez wszystkie stopnie, także przez wpisy bez pytań i koła; nigdy niepytane się nie liczą) | "core" (pytania kluczowe tematu — pytania z "core": true, które go wymieniają w "about"; w powtórce: tematów tej karty) | klucz pola-odwołania (to, na co wskazuje, np. "okres");
    luki tematu (pytanie kluczowe już pytane i teraz nieznane): {"type": "knowness", "rel": "core", "each": "any", "band": "unknown"} — np. „Uzupełnij luki” bierze karty tematów, których pytanie kluczowe jest nieznane;
    blokada krajobrazu jako warunek do każdego widoku i powtórki: {"type": "knowness", "rel": "chain", "band": "known"} — każda już pytana karta całej drogi przed wpisem jest znana (nic w niej nie blednie, nic nie było ostatnio źle);
    "each": "all" (domyślnie — każdy) | "any" (choć jeden); gdy nic takiego nie ma, "all" jest spełnione; "of": "@wpis" zamiast "rel" — znajomość jednego wpisu; warunki łączą "and" / "or" / "not": {"type": "and", "items": [ … ]}
  „Idź po kolejności nauki”: {"type": "learning", "config": {"dir": "before" | "after", "one": true, "keep": true}} — karty tego, co trzeba znać wcześniej (albo, "after", co na tym buduje), aż do podstaw albo ("one") o krok; "keep": true dokłada je do kart wyjściowych
  „Próbka z każdego tematu”: {"type": "sample", "config": {"perTopic": 2}} — z każdego tematu (pierwszy z "about" karty, inaczej jej wpis) zostaje do "perTopic" losowych kart; co dzień inna próbka; razem z „Razem” ("union") np. wszystkie karty luk + próbka reszty — sprawdzian na wyrywki
  „Sposób pytania” ("strategy"): {"mode": "temporal" (według tego, co umiem) | "levels" | "once" | "random", "order", "pick", "perTopic", "stackSize", "count", "levels", "minCorrectness", "endWhenDone", "rule"}
    "once" („Cały stos, każda raz”): każda karta stosu dokładnie raz, w "order"; zła odpowiedź NIE wraca w tym przebiegu; karta, której warunek zacznie obowiązywać w trakcie, dołącza do kolejki; na końcu każdy temat jako „umiesz” albo „luka” (luka: któraś jego karta nie była całkiem dobra) z „Temat”, „Zobacz w opowieści” i „Uzupełnij luki” — tak działa „Sprawdź, co wiesz”
    "random": jak "once", ale tylko pierwsze "count" kart (domyślnie 20) po "order" (bez "order": losowo)
    "levels" („Poziomy”): stos "stackSize" kart; dobra odpowiedź podnosi kartę o poziom (do "levels", domyślnie 5, 1–20), zła wraca na poziom 1, a dobra po złej też idzie na 1; karta na najwyższym poziomie w tym przebiegu już nie wraca — przebieg kończy się sam
    "minCorrectness" (0–1, domyślnie 1) — od jakiej poprawności odpowiedź liczy się jako dobra (dla stosu i poziomów); "stackSize" (domyślnie 20) — ile kart naraz w stosie ("temporal", "levels"); "rule" — co powtórka zmienia w surowości sprawdzania szablonu, np. {"caseSensitive": false}
    "temporal": stos "stackSize" kart; karta wychodzi ze stosu dopiero po całkiem dobrej odpowiedzi ("minCorrectness", domyślnie 1); wolne miejsce bierze najpierw to, co do powtórki (najsłabsze najpierw), potem nieznane (nowe, ostatnio złe, zapomniane — w "order"), a gdy obu nie ma — znane, które zna się najsłabiej („na zapas”: powtórka sama się nie kończy); "endWhenDone": true — koniec, gdy nic nie czeka i nie ma nic nowego
    "order" — kolejność: "general" (najpierw ogólne — według poziomów kolejności nauki) | "text" (jak w tekście źródła — miejsce w dziele) | "date" (według najwcześniejszej daty wpisu) | "random" | "given" (jak przychodzą) | "due" (najpierw zaległe); bez "order": w stosie "general", w stałej kolejce "random"
    "pick" — wybór ze stosu: "next" (ściśle następna według kolejności) | "weighted" (losowo, częściej to, co słabiej znane i dłużej czeka; domyślnie) | "sample" (próbka: z każdego tematu tylko "perTopic" losowych kart, domyślnie 2 — np. "mode": "once", "pick": "sample", "perTopic": 2 sprawdza każdy temat na wyrywki; potem ściśle następna); inna wartość — import ostrzega, działa jak domyślna; przy każdej karcie uczący się widzi, dlaczego przyszła
  „Sprawdź, co wiesz — cała książka”: {"name": "Sprawdź, co wiesz — cała książka", "graph": {"nodes": [{"id": "q", "type": "source.kind", "config": {"kind": "question"}}, {"id": "k", "type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field": "core", "cmp": "eq", "value": "true"}]}}}, {"id": "p", "type": "strategy", "config": {"mode": "once", "order": "general", "pick": "next"}}], "edges": [{"id": "e1", "from": "q", "out": "cards", "to": "k", "in": "cards"}, {"id": "e2", "from": "k", "out": "cards", "to": "p", "in": "cards"}]}} — każde pytanie kluczowe raz (bez gotowej powtórki: przycisk „Sprawdź, co wiesz” nad krajobrazem robi to samo dla obszaru w obrazie)
  „Uzupełnij luki”: źródło → {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "core", "each": "any", "band": "unknown"}}} → „Razem” ← (to samo źródło → {"type": "sample", "config": {"perTopic": 1}}) → „Sposób pytania” {"mode": "once"}: wszystkie karty luk i po jednej na wyrywki z reszty ("band": "unknown" obejmuje też nigdy niepytane — najpierw „Sprawdź, co wiesz”)
  „Najpierw podstawy” to zwykłe kroki: {"type": "learning", "config": {"dir": "before", "keep": true}} → {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "before", "band": "learned"}}} → „Sposób pytania” z "order": "general"; dawny krok "gate" import i eksport zamieniają na nie
"flows" — przebiegi (opowieści, kursy krok po kroku): {"ref", "name", "look": "reading|slides|scenes|dialogue|flashcards|map", "start", "graph", "goals", "lines", "narrators", "slots", "template", "fill", "overrides", "presentation", "unit", "review"}
  "graph": {"nodes": [{"id", "type", "x", "y", "config"}], "edges": [{"id", "from", "out", "to", "in": "in"}]} — kroki i przejścia ("out" — wyjście kroku); "start": id pierwszego kroku (pominięte — jedyny krok, do którego nic nie prowadzi);
  ŚCIEŻKA MUSI BYĆ LOGICZNA: dokładnie jeden początek i jeden koniec (krok "end", "return" albo "handoff"), każdy krok osiągalny z początku, z każdego kroku da się dojść do końca, każde wyjście ("right" I "wrong" pytania, każda możliwość wyboru) prowadzi do kroku; podgląd importu wymienia z nazwy każdy krok, który to łamie (drugi początek, krok nieosiągalny, ślepy zaułek, pętla bez wyjścia), a przebieg bez początku albo bez końca się nie zapisze;
  kroki ("type") i ich wyjścia:
    "show" {"of": "@wpis", "title", "media", "drawing"} → "next" — pokazuje wpis (wypowiedź z „Treść w blokach” w całości, inne wpisy z polami); tytuł kroku: "title" kroku, bez niego — nazwa pokazanego slajdu (jego etykieta, np. pole „tytul”); w akapicie bloku pusta linia zaczyna nowy akapit, pojedyncze przejście do nowej linii łamie wiersz; cytat to akapit z wierszami „> …” i ostatnim „> — Autor”, przypisy [^1] w tekście i „[^1]: …” na końcu (lista „Przypisy” powstaje sama — import ostrzega przed „Cytat (…):”, ręczną listą „Przypisy”, „kliknij dalej” i cytatem bez „> —”); miejsce uczącego się w opowieści leży w jego postępie (pozycja przebiegu: krok, odwiedzone, ukończona, cele — także na innych urządzeniach); po imporcie, który zmienia identyfikatory kroków, znikają tylko nieistniejące odwiedzone kroki, odtwarzacz wraca do pierwszego nieodwiedzonego kroku od początku, „ukończona”, cele i przebyte drogi zostają (stałe "id" kroków — np. "s<klucz>" — zachowują miejsce); "drawing" — RYSUNEK OBOK TEKSTU SLAJDU (szeroko: tekst po lewej, rysunek po prawej; na telefonie pod tekstem): ten sam JSON co moduł strony „Animacja” i pytanie "interactive" (vars, let, controls — suwaki, elements …), statyczny albo z suwakami, bez celu i bez oceny; jako obiekt, tekst JSON albo klucz pola pokazanego wpisu, które trzyma rysunek (np. "drawing": "rysunek" — pole typu "json"/"text"), np. {"id": "s7", "type": "show", "config": {"of": "@laag/folie/zwei-geraden", "drawing": {"vars": [{"name": "m", "value": 1, "min": -3, "max": 3, "step": 0.5}], "controls": [{"type": "slider", "var": "m", "label": "Steigung $m$"}], "elements": [{"type": "plot", "fn": "m*x + 1", "from": -5, "to": 5}, {"type": "plot", "fn": "-x + 2", "from": -5, "to": 5}]}}};
    "question" {"of": "@pytanie"} → "right" | "wrong" — pytanie z bazy; odpowiedź leży na JEGO karcie: liczy się dla tego, o czym jest ("about"), i wspólnie z powtórkami; ODTWARZACZ PYTA TYLKO O TO, CZEGO UCZĄCY SIĘ NIE UMIE: pytanie, którego karta jest już znana (od 100 %, z całej historii — opowieści, powtórki, ćwiczenia), pomija po cichu wyjściem "right" — bez odpowiedzi i bez zmiany planu karty; slajdy pokazuje zawsze; nie dopisuj do tego warunków — dotyczy każdej bazy i każdego przebiegu (przegląd z samymi znanymi pytaniami od razu się kończy, opowieść da się wtedy przeczytać); po złej odpowiedzi to samo pytanie nie wraca od razu — najpierw jedno znane („przerywnik”, nie liczy się i nic nie zmienia, chyba że odpowiedź jest zła);
    "choice" {"title", "options": [{"label", "condition", "actions"}]} → "o0", "o1", … — wybór („Którędy dalej?”): opowieść zatrzymuje się i pokazuje WSZYSTKIE możliwości z nazwy i z tym, co czeka za każdą („3 slajdy do przeczytania · 5 pytań do odpowiedzi”); możliwość, której "condition" nie jest spełniony, stoi zamknięta i mówi, co ją otworzy (z warunkiem "not" — dlaczego jest zamknięta); aplikacja nigdy nie wybiera sama; drogi mogą wracać do wyboru (wtedy zostają otwarte na później);
    "chapters" {"title", "chapters": [{"title"}]} → "c0", "c1", … i "done" — ROZWIDLENIE, KTÓRE SIĘ SCHODZI: pokazuje wszystkie drogi z tym, co czeka za każdą; przerobione (w tej opowieści albo takie, których każdy krok uczący się już umie) stoją jako „ukończone”, „Ukończono 2 z 3 ścieżek”, a gdy wszystkie są za nim — idzie wyjściem "done"; "chapterEnd" — koniec drogi (wraca do wyboru); "restart" — ta droga od nowa;
    "condition" {"condition": warunek} → "yes" | "no" — bez ekranu, np. „pomiń, gdy umie”: {"type": "knowness", "of": "@temat", "band": "known"}; na ścieżce NIGDY nie jest wyborem uczącego się: rysuje się tylko gałąź, która go teraz dotyczy, a gdy tego jeszcze nie wiadomo — obie razem jako jedna część ze znakiem „automatycznie”; droga, która wraca do wyboru, ma na ścieżce krótką strzałkę z powrotem; ścieżka ma jeden „Koniec” na górze, a nad nim to, co w kolejności nauki przychodzi po tej opowieści (bez ręcznych odnośników); "set" {"actions": [{"type": "set"|"add", "value", "to"|"by"}]} → "next";
    "expand" {"of", "threshold"} → "next" (wyjaśnia, gdy jeszcze nie umie); "opening" {"mode": "discovery"|"recall"}; "line" {"character", "of", "mood"}; "subflow" {"flow"}; "each" {"collection"|"kind", "flow"}; "handoff" {"flow"}; "detour" {"flow": "@inna-opowiesc", "label": "Chcesz wiedzieć więcej: …", "optional": true} → "done" | "skip"; "review" {"of": "story", "threshold": 0.9} → "passed" | "notyet" (PRZEGLĄD W JEDNYM KROKU — patrz niżej); "end"; "return"
    ZAGŁĘBIENIE ("detour") — opowieści układaj jak drabinę: jedna ogólna, pod nią krótkie przeglądy etapów, pod nimi głębsze opowieści; PRZEGLĄD ZOSTAW KRÓTKI, głębszą treść daj do WŁASNEJ opowieści (własny przebieg, zwykle z własnym "unit") i połącz ją krokiem "detour" z "optional": true w miejscu, w którym pasuje; odtwarzacz pokazuje kartę: nazwę tamtej opowieści, co w niej czeka („7 slajdów · 16 pytań”), „Wejdź” i „Dalej bez tego” (gdy już ukończona: „już znasz”, „Przypomnij” i „Dalej”); „Wejdź” gra ją w środku (tytuł, ścieżka i liczniki są wtedy jej, nad nią pasek „Etap 1 › Dom w Becchi” z „Wróć do: Etap 1” — powrót na krok zagłębienia bez ukończenia), jej koniec wraca wyjściem "done", „Dalej bez tego” idzie wyjściem "skip" (zwykle oba do tego samego następnego kroku); postęp należy do opowieści: tamta jest ukończona raz, gdziekolwiek ją skończono, a jej pytania liczą się jak zawsze; pominięte zagłębienie niczego nie blokuje, na ścieżce liczy się jako przerobione (cienki obrys), a w „Co dalej” po końcu opowieści stoi jako pierwsze; przegląd opowieści obejmuje tylko jej własne pytania; "optional": false (rzadko) — tylko „Wejdź”, a koniec opowieści go wymaga (wtedy bez wyjścia "skip"); najwyżej 3 zagłębienia jedno w drugim; KOŁO (A → B → A) import odrzuca z nazwami obu; głębsza opowieść, której "unit" wymaga (pole z "prerequisite": "up") jednostki przeglądu, otwarta wprost przed ukończeniem przeglądu mówi „Najpierw: Etap 1” — z przeglądu wchodzi się zawsze; przykład: {"id": "z1", "type": "detour", "config": {"flow": "@bosko/becchi", "label": "Chcesz wiedzieć więcej: Dom w Becchi bez ojca", "optional": true}}, krawędzie {"from": "z1", "out": "done", "to": "s5"} i {"from": "z1", "out": "skip", "to": "s5"}
    krok "scene" {"page": "adres/strony", "scene": "klucz sceny", "title"} — scena prezentacji; wyjścia "next", przy pytaniu na scenie "right" / "wrong", przyciski "b0", "b1", …
  "goals": [{"id", "title", "condition"}] — cele (przebieg z celami to zadanie); osiągnięte zapisują się przy miejscu uczącego się i zostają osiągnięte; przebieg z celami opuszcza swoją jednostkę do doliny dopiero, gdy jest ukończony I każdy cel osiągnięty (bez celów: gdy ukończony);
  PRZEGLĄD W JEDNYM KROKU (od 2026-11-05 — zamiast kilku kroków na każde pytanie): {"id": "przeglad", "type": "review", "config": {"of": "story", "threshold": 0.9}} → "passed" | "notyet"; pyta jeszcze raz o pytania TEGO przebiegu (kroki "question"; "of": "@inny-przebieg" — o jego pytania), których uczący się jeszcze nie umie — każde raz w rundzie (złe nie wraca w tej rundzie; znane pomija jak zawsze), potem pokazuje wynik („Umiesz 9 z 10 (90 %)”): co najmniej "threshold" (0–1, domyślnie 0.9) → "passed", inaczej "notyet" (bez połączenia: opowieść kończy się z przeglądem jeszcze niezdanym, a na końcu stoi „Powtórz przegląd”; albo połącz z wyborem „Spróbuj jeszcze raz” / „Zakończ na razie” — nie z samym sobą); zapisuje wartość "value" (domyślnie „<nazwa opowieści bez @>.przeglad”: 1 zdany, 0 nie); przebieg BEZ "goals" dostaje sam cel „Przegląd zdany” ("goal" — inna nazwa celu, np. „Durchsicht bestanden”) z warunkiem tej wartości, a „Powtórz przegląd” wraca do tego kroku (gdy "review" nie wskazuje innego); na ścieżce to jeden węzeł „Przegląd”; przykład: {"nodes": [… {"id": "q9", "type": "question", "config": {"of": "@kurs/q/opady"}}, {"id": "przeglad", "type": "review", "config": {"of": "story", "threshold": 0.9, "goal": "Przegląd zdany"}}, {"id": "koniec", "type": "end"}], "edges": [… {"from": "q9", "out": "right", "to": "przeglad"}, {"from": "q9", "out": "wrong", "to": "przeglad"}, {"from": "przeglad", "out": "passed", "to": "koniec"}]} ("notyet" bez połączenia)
  PRZEGLĄD Z OSOBNYCH KROKÓW (dawny sposób, nadal działa) NA KOŃCU OPOWIEŚCI (w tym samym przebiegu, te same pytania co w opowieści — ta sama historia kart, nigdy kopie): licznik z nazwą opowieści na początku ("deszcz.przeglad" — wartości należą do uczącego się, nie do jednej opowieści); krok "set" zeruje go na początku przeglądu, a "review": "<id tego kroku>" mówi, dokąd prowadzi „Powtórz przegląd” (bez "review": na początek); każde pytanie "right" → krok "set" {"actions": [{"type": "add", "value": "deszcz.przeglad", "by": 1}]} → następne pytanie, "wrong" → od razu następne pytanie; na końcu "condition" {"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3} — "yes" → koniec, "no" → wraca na początek przeglądu (albo do wyboru „Spróbuj jeszcze raz” / „Zakończ na razie”: zakończona bez zdanego przeglądu opowieść zostaje na równinie jako „przegląd jeszcze niezdany”); cel z TYM SAMYM warunkiem: "goals": [{"id": "przeglad", "title": "Przegląd zdany", "condition": {"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3}}]
    {"ref": "@kurs/deszcz", "name": "Skąd się bierze deszcz", "look": "dialogue", "unit": "@kurs/lekcja/deszcz", "review": "p0", "goals": [{"id": "przeglad", "title": "Przegląd zdany", "condition": {"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3}}],
     "graph": {"nodes": [{"id": "p0", "type": "set", "config": {"actions": [{"type": "set", "value": "deszcz.przeglad", "to": 0}]}}, {"id": "p1", "type": "question", "config": {"of": "@kurs/q/parowanie"}}, {"id": "p1ok", "type": "set", "config": {"actions": [{"type": "add", "value": "deszcz.przeglad", "by": 1}]}}, …, {"id": "pz", "type": "condition", "config": {"condition": {"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3}}}, {"id": "koniec", "type": "end"}],
      "edges": [{"from": "p0", "out": "next", "to": "p1"}, {"from": "p1", "out": "right", "to": "p1ok"}, {"from": "p1", "out": "wrong", "to": "p2"}, {"from": "p1ok", "out": "next", "to": "p2"}, …, {"from": "pz", "out": "yes", "to": "koniec"}, {"from": "pz", "out": "no", "to": "p0"}]}}
  PYTANIA O TEMATACH, NIGDY O JEDNOSTCE: "about" pytań opowieści wymienia tematy; jednostka ("unit") nie ma własnych kart — inaczej opadłaby po kilku dobrych odpowiedziach bez opowieści, a jej przycisk ćwiczyłby karty zamiast grać opowieść;
  "narrators" — kto opowiada, według wartości: [{"character": "@piotr", "condition": {"type": "value", "value": "przewodnik", "op": "eq", "than": 1}}, {"character": "@maria"}] — opowiada pierwszy, którego warunek jest spełniony (bez warunku: zawsze); jego portret i imię stoją nad krokiem i zapowiadają jego tytuł
  "unit": "@wpis" — JEDNOSTKA, którą jest ta opowieść: w krajobrazie jedno pole (także gdy sama nie ma kart), „Pokaż ścieżkę” pokazuje ścieżkę opowieści, a gdy opowieść dobiegnie końca (z celami: i przegląd jest zdany), pole opada do doliny; pole-odwołanie jednostki z "prerequisite": "up" (np. „Wymaga” → tematy) zamyka opowieść, dopóki tego nie umiesz — w krajobrazie stoi jako góra z drogą do niej
  przycisk opowieści (pole w krajobrazie, węzeł w Nauce → Ścieżka i w module "path"): „Zacznij opowieść” (nowa), „Kontynuuj opowieść” (w drodze — od miejsca, w którym skończył), „Powtórz przegląd” (ukończona, cel nieosiągnięty — od "review"), „Otwórz opowieść” (zdana); nigdy nie ćwiczy kart jednostki
  ekran zamknięcia (odtwarzacz przed opowieścią, ta sama logika co krajobraz): brakuje czegoś przed jednostką — lista od podstaw z odnośnikami i „Ucz się” przy każdym, do tego „Ustaw jako cel” (cel w krajobrazie); wszystko poznane, ale w łańcuchu są słabe karty — „Najpierw powtórz (N)” z dokładnie tymi kartami, potem od razu opowieść; kto pisze w bazie, ma „Podgląd mimo to”
  przebieg z prezentacji (JEDNA opowieść = strona-prezentacja + ten przebieg, bez kopii): {"name": "Droga", "look": "scenes", "presentation": "parafia/droga", "unit": "@lekcja", "narrators": […]} — bez własnego "graph": jego mapą jest storyboard strony (sceny, przyciski, pytania, bramki, wartości — "story" w JSON strony, z "base": id tej bazy); w Nauce gra tę prezentację, a odpowiedzi, wartości i miejsce, w którym ktoś skończył, liczą się w tej bazie (to samo miejsce co na stronie); zobaczy ją tylko ten, kto może zobaczyć stronę; pytanie na scenie z "question": "@pytanie" liczy się jak tu krok "question", a "about" sceny mówi, czego scena dotyczy (dla ścieżki); przegląd na stronie: wartość w "story.values", bramki "set" (zero, +1 przy "right") i bramka "condition" z wynikiem, "review": "<klucz sceny początku przeglądu>", "goals" przebiegu jak wyżej (liczą się z wartości strony); strona otwiera się na scenie z adresu "?scena=<klucz>"
  miejsce uczącego się (prywatne, jak postępy; nigdy w eksporcie ani w MCP): krok, odwiedzone, przerobione drogi rozdziałów, „ukończony” (osiągnięty koniec — zostaje także po „od początku”), osiągnięte cele — warunek {"type": "flow", "flow": "@przebieg", "state": "done" | "started" | "goal", "goal": "id celu"} czyta je w widokach ("filter.when"), powtórkach i krokach widoku krajobrazu (np. tematy dopiero po ukończonej opowieści)
  ścieżka obok opowieści (2026-11-04): mapa CZĘŚCI przebiegu, liczona z samego grafu — początek i koniec jako własne znaki; „slajdy do przeczytania” (kolejne kroki "show"/"line"/"expand"/"opening"/scena bez pytań), „pytania do odpowiedzi” (kolejne "question"/scena z pytaniami; krok z jednym i drugim — oba liczniki), „przegląd” (pętla wracająca do pytań, aż wszystkie umiesz, i krok z "review"; pojedynczy slajd tuż przed nią należy do niej), „wybór drogi” ("choice", "chapters" i scena z kilkoma przyciskami — rysowany jako rozwidlenie z licznikiem „wybierz 1 z 3” / „wybrano 1 z 3” / „ukończono 2 z 3 ścieżek”); kroki "condition"/"set" są przezroczyste; zawsze od dołu (początek) do góry (koniec), cała w ramce (zmniejszona; „+”, „−”, „Dopasuj”, „Pełny ekran”), obecna część większa, obrysowana i z nazwą obok, inne nazwy po wskazaniu (pierwsze dotknięcie — okienko, drugie — otwiera), legenda zawsze pod mapą; „X z Y” liczy dokładnie narysowane sześciokąty; część jest ukończona, gdy ją przeszedł (pytania: i nauczył się, przegląd: i wszystko umie); dawny opis: mała mapa ścieżki idzie za krokiem; wskazana możliwość wyboru podświetla swoją drogę; klik w wolny krok przenosi opowieść do niego; na stronie stoi też osobno jako moduł "path" ({"library", "flow": "<id przebiegu>"} — także dla przebiegu z prezentacji)
  "recreatio.cogita.flow" — JEDEN przebieg razem z tym, co pokazuje (eksport z edytora przebiegów): {"format": "recreatio.cogita.flow", "version": 1, "flow": {przebieg jak wyżej}, "entities": [wpisy, które pokazuje — także postacie i jednostka "unit"]} — importuje się w tym samym miejscu co kurs; wpisy z "ref" łączą się z istniejącymi
"collections" — zbiory: {"name", "rule": {"op": "and|or", "items": [{"field", "cmp", "value"}]}, "list": ["@wpis"]}
"views" — widoki (te same kroki co powtórka, po wpisach): {"name", "mode": "table|tree|matrix|map|canvas|outline|quilt|landscape", "steps": [krok, …], "query", "group", "matrix", "columns": ["klucz pola" | "#axis:@oś"], "sort": {"key", "dir": 1|-1}, "landscape": {"nest": "pole"}}
  na początku źródła — kilka pod rząd sumuje się (np. kazania i komentarze): "source.all" | "source.kind" {"kind": "@rodzaj" albo "text" ze skryptorium, "from"} | "source.collection" {"collection": "@zbiór"} | "source.list" {"ids": ["@wpis"]};
  także "source.from" {"entry": "@kazanie"} — to, na co wskazuje wpis (kazanie: jego cytaty, wypowiedzi, słowa ze słownika, miejsca z planu; w powtórce: „Z wpisu" — powtórka z kazania);
  potem "follow" {"field", "back"}, "structure" {"dir": "down|up", "one": true} (po polach struktury — bez "one": do samego końca; "one": true — jeden poziom) i "filter.rule" {"rule"} (źródło po innym kroku zaczyna od nowa);
  także "filter.when" {"when": warunek} i "learning" {"dir", "one", "keep"} — te same co w powtórce; w widoku liczy się znajomość tego, kto patrzy (uczącego się na tym koncie; na stronie — osoby strony albo tej przeglądarki),
    np. fakty okresu dopiero, gdy okres jest znany: {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "okres", "op": "ge", "than": 1}}}; tylko wpisy, których podstawy są znane: "rel": "before";
  kolumny i "sort" ze znajomości: "#knowness" (znajomość wpisu), "#due" (kiedy powtórzyć), "#level" (poziom w kolejności nauki), np. "sort": {"key": "#knowness", "dir": 1} — najpierw najsłabsze;
  "mode": "quilt" (Mapa postępów) — kafelek na wpis w kolorze tego, jak dobrze uczący się go zna (nowe, uczę się, do powtórki, umiem), pogrupowany jak "group" (np. idee według lekcji pod rozdziałami: {"by": "axis", "kind": "@lekcja", "via": ["lekcja"], "sort": {"field": "nr"}, "group": "rozdzial"}); klik: tekst, pytania, „Ćwicz to”, „Otwórz w źródle”; widać go w Nauka → Postępy (też nauczycielowi) i w module „Widok”
  "mode": "landscape" (Krajobraz) — osobisty krajobraz wiedzy tego, kto patrzy: JEDNA MAPA wszystkich tematów — każdy temat to jedna sześciokątna kolumna na stałym miejscu (to samo miejsce zawsze; nic się nie przestawia przy przybliżaniu ani kliknięciu); OBSZARY tworzą się same z połączeń „Najpierw trzeba znać” — grupy po ok. 5–12 tematów, które dużo od siebie zależą, a mało od reszty, poziom po poziomie, aż na górze jest ok. 7–20 obszarów (bez pętli; NIE z rozdziałów — "group" widoku to tylko kolor bez obszarów); obszary tylko UKŁADAJĄ mapę: tematy obszaru leżą razem jako jedna łata, podobszary jako łaty w niej, obszary nie pokazują zależności (żadnych dróg ani linii między obszarami); te same dla każdego uczącego się, liczone od nowa tylko po zmianie bazy; nazwa obszaru: z bazy, gdy pasuje (rozdział, sekcja „§4 …”), inaczej „Wokół: <temat, od którego zależy w nim najwięcej>”; właściciel zmienia nazwę i przenosi temat do innego obszaru (menu „⋯” w okienku tematu) — zostaje po przeliczeniu; miejsca tylko ze struktury (nigdy z postępów), liczone od nowa przy każdym otwarciu strony (podczas używania nic się nie przelicza), te same dla każdego uczącego się: DOM na własnym polu w samym środku (prosty płaski domek leżący na polu; dotknięcie wybiera temat startowy, „Przywróć widok” wraca do domu); temat startowy = najogólniejszy temat bez wymagań (na którym buduje najwięcej), obok domu; FUNDAMENT = start, tematy, które potrzebują tylko jego, i tematy, na których buduje co najmniej połowa bazy (w głębokiej bazie często cały obszar, w płaskiej tylko start i jego bezpośredni następcy), jako zwarta okrągła łata wokół domu, podzielona na sektory obszarów; każdy inny najwyższy obszar zaczyna się na brzegu fundamentu po stronie, gdzie leżą jego wymagania, i rośnie na zewnątrz jako jeden klin (szerszy zamiast dłuższy), podobszary w nim — każdy obszar to jedna spójna łata; cała mapa to jeden zwarty, prawie okrągły kształt bez dziur, wysp i samotnych kolumn; to, co umiesz, rośnie wokół domu;
    WYSOKOŚĆ = STOPNIE: najdłuższy łańcuch tematów, których jeszcze brakuje, ten temat też — dolina 0 (umiem, także to, co do powtórki), jeden stopień — można zacząć teraz, każdy dalszy stopień wyżej; JEDNA wysokość stopnia dla wszystkich pól bazy, dobrana do bazy: im mniej stopni ma baza (najdłuższy łańcuch), tym wyższy każdy stopień (płaska baza ma wyraźne różnice, głęboka wygląda jak dotąd); KAMERA należy do uczącego się i jest swobodna: Ctrl + przeciągnięcie (albo prawym przyciskiem) obraca płynnie dookoła środka widoku i nachyla: w górę — bardziej z boku (ku horyzontowi), w dół — bardziej z góry (suwak z ikonami „z boku” i „z góry”), dwa palce obracają, nachylają i przybliżają, przeciągnięcie przesuwa, przycisk obraca o 45°, „Przywróć widok”; widok (przybliżenie, miejsce, nachylenie, obrót) zostaje do następnego razu; aplikacja nigdy sama nie zmienia kąta; z góry widać wszystko; kamera zostaje (ta przeglądarka, ten uczący się); TEMATY: ile tematów trzeba jeszcze poznać, ten też — tyle kroków ma lista „krok po kroku”;
    "landscape": {"nest": "<pole odwołania>", "nestSort": "nr", "regions": {"names": {"<klucz obszaru>": {"name": "Restklassen", "topics": ["@temat", …]}}, "moves": {"@temat": "<klucz obszaru>"}}} — "regions" zapisuje aplikacja: nazwy właściciela razem z tematami obszaru (po przeliczeniu nazwa znajduje swój obszar po wspólnych tematach) i tematy przeniesione do innego obszaru; "budget" i "bands" ze starszych baz są czytane i nie mają wpływu;
    "nest": KRAJOBRAZ ZAGNIEŻDŻONY — grupy pochodzą z danych, nie z obliczeń: węzeł mapy to zwykły wpis własnego rodzaju (np. „Pole mapy”: "nazwa", "nr" — kolejność, pole odwołania do rodzaju węzłów z "structure": "up" — węzeł nadrzędny; puste: węzeł najwyższy; gałęzie mogą mieć różną głębokość), a wpis treści wskazuje swój węzeł polem odwołania o kluczu z "nest" (bez węzła stoi na najwyższym poziomie); "nestSort" — liczbowe pole kolejności węzłów (domyślnie "nr"); węzły są obszarami tej jednej mapy (łaty w łatach) — z daleka nazwy najwyższych węzłów, przybliżenie pokazuje nazwy niższych (węzły niżej ALBO wpisy węzła — wpisy węzła, który ma też węzły niżej, stoją we własnym obszarze „Pozostałe w: …”, żeby żadna mapa nie mieszała obszarów z tematami), okruszki prowadzą z powrotem; węzeł jest prawdziwym polem: pierścień = znane / wszystkie karty całego poddrzewa, kolor z tej znajomości (im więcej umie, tym głębszy), wysokość = odległość do najbliższego wpisu w środku, którego można się uczyć (0, gdy coś w środku jest gotowe), zapada się w dolinę, gdy wszystko w środku jest opanowane (z oznaczeniem powtórki, gdy coś jest do powtórzenia), zamek, gdy wszystko, co w środku czeka na naukę, wymaga najpierw powtórki; okienko węzła: nazwa, pierścień, stan słowami, JEDEN główny przycisk („Wejdź”, „Powtórz” — karty do powtórki w poddrzewie, „Ustaw jako cel” — najbliższy wpis w środku; przy węźle-jednostce opowieści — przycisk opowieści) i lista tego, co w środku; miejsca są stałe: pola poziomu ciasno w pierścieniach wokół uczącego się, bliżej to, czego trzeba się nauczyć wcześniej (najwcześniejszy wpis w środku), potem węzły przed wpisami i kolejność autora — nigdy według postępów; jednostka opowieści może być węzłem albo wpisem treści;
    język mapy: barwa = obszar (każdy najwyższy obszar ma swój odcień, bezpieczny dla daltonistów, sąsiednie nigdy podobne; po przybliżeniu do obszaru jego podobszary mają sąsiednie odcienie, sąsiednie podobszary różne), jasność i nasycenie należą do wiedzy (umiesz — pełny kolor, dalekie góry blade), wysokość = stopnie; ŻADNYCH znaków na polach; nad mapą przełącznik widoku (zapamiętany z widokiem): „Ogólny”, „Co umiem” (w kolorze tylko to, co umiesz, w pomarańczowoczerwonym obrysie), „Do odkrycia” (w kolorze tylko to, czego można się uczyć teraz, w jasnożółtym obrysie, umiane blado dookoła), „Do powtórki” (w kolorze tylko tematy z powtórką; gdy nic — „Nic do powtórki”); obok nachylenia trzy wysokości kolumn: niskie, średnie, wysokie (×0,5 / ×1 / ×2 stopnia bazy, zapamiętane z widokiem); PIERŚCIEŃ na brzegu pola (od średniego przybliżenia, bez tekstu): średnia znajomość kart tematu (90, 90, 90, 100, 100, 100 % → 95 %), od góry zgodnie z ruchem wskazówek, kropka — coś do powtórki; TO, CO UMIESZ, TO TWÓJ OBSZAR — jeden pomarańczowoczerwony obrys wokół wszystkiego, co umiesz, i jasnożółty obrys wokół tematów, których możesz się uczyć teraz; kolory obszarów zostają w środku w pełni widoczne; obszar, w którym umiesz wszystko — zdobyty (mała flaga przy nazwie, „Obszar zdobyty: …”); „tu jesteś” to mała cicha kropka; PIONKI stoją tylko z twojego działania: otwarcie tematu do nauki (dwuklik na polu, „Zacznij”, „Ucz się teraz”) stawia na nim pionek, który zostaje, aż temat umiesz; ustawienie celu stawia flagę na celu i jeden pionek w kolorze celu na drodze — na następnym temacie do nauki, idzie dalej, gdy kolejny temat jest umiany; dotknięcie pionka otwiera temat (opowieść tam, gdzie przerwano), flagi — cel z drogą; z daleka pionki jednego obszaru jako jeden z liczbą (dotknięcie przybliża); pionki zapisują się z postępami (inne urządzenie widzi to samo); nad mapą jedno zdanie zaczynające się od twojego obszaru: „Twój obszar: 4 tematy · 1 z 12 obszarów zdobytych · 8 gotowych · 10 do powtórki” z dwoma przyciskami; PRZYBLIŻANIE płynne (kółko, dwa palce, „+”/„−”, dwuklik na obszarze — płynnie na cały obszar) i znaczeniowe: z daleka (i cała mapa w widoku) relief, kolory i nazwa KAŻDEGO najwyższego obszaru w jego kolorze, na jego własnej powierzchni (krótka linia tylko przy obszarze za małym na nazwę), nigdy nie znika; każdy poziom podobszarów ma własny stopień przybliżenia: bliżej nazwy podobszarów, jeszcze bliżej ich podobszarów itd. ( najechanie lub dotknięcie podświetla cały obszar, inne bledną; kliknięcie przybliża), bez nazw tematów; średnio — nazwy podobszarów w ich odcieniu i pierścienie na polach, bez nazw tematów; blisko — na każdym polu jego nazwa (1–2 wiersze, zwykłe pismo, nie większe niż tekst strony) i pierścień; najgłębiej (2–5 pól w widoku) — do tego najwyżej jedno słowo stanu („umiesz”, „3 do powtórki”); tekst leży na górnej ścianie (nachyla się i obraca z nią, za stromo — znika) i jest rysowany razem ze swoją kolumną: kolumna z przodu go zakrywa, nazwa na prawie zakrytej ścianie nie jest pokazywana; obrysy grube tam, gdzie widać, cienkie i jaśniejsze tam, gdzie zasłania je kolumna z przodu; pionki i flagi zasłonięte przez kolumnę z przodu zostawiają małą kropkę przy jej górnej krawędzi; okruszki idą za przybliżeniem („Cała mapa › Rozdział I › Wokół: Relacje”), kliknięcie okruszka oddala do niego; legenda zwinięta w „Legenda”;
    klik: obszar (z daleka, albo jego nazwa) — płynnie przybliża do niego na tej samej mapie, dwuklik na temacie (blisko) — otwiera go do nauki, z boku jego nazwa, liczby i „Dalej tutaj” (KAŻDY temat, którego można się uczyć teraz); temat (z bliska) — wybiera go: na ziemi krótkie miękkie drogi do tego, czego wymaga (ciemniej) i co otwiera (jaśniej), nic więcej; drugi klik zaczyna (gdy można); okienko tematu jest krótkie: nazwa i stan jednym zdaniem („Gotowe — możesz zacząć”, „Brakuje jeszcze 2 tematów”, „Do powtórki: 5 kart”), gdy czegoś brakuje — „Najpierw potrzebujesz:” (najwyżej 5, najpierw te gotowe, każdy z „Ucz się teraz”; nazwa przybliża mapę do tematu), główny przycisk „Prowadź mnie tutaj” (ustawia cel i od razu zaczyna pierwszy brakujący krok) albo „Zacznij”, zwinięte „Otwiera dalej: 5 tematów”, przy opowieści jedna linia „Opowieść: 16 części · ukończono 0” z „Pokaż ścieżkę” (ścieżka w osobnym dużym widoku, nigdy w okienku), na dole jedna linia obszaru („Dom w czasie burzy: 5 tematów · 0 z 5 umiesz”); narzędzia autora tylko w „⋯” i tylko dla piszących w bazie; cel zapisuje się prywatnie jak postępy;
    np. {"ref": "@swiat/w-krajobraz", "name": "Krajobraz wiedzy", "mode": "landscape", "steps": [{"type": "source.kind", "config": {"kind": "@swiat/temat"}}], "group": {"by": "axis", "kind": "@swiat/tag", "via": ["tagi"]}}; zagnieżdżony: rodzaj węzłów {"ref": "@swiat/pole", "name": "Pole mapy", "label": "{nazwa}", "fields": [{"key": "nazwa", "type": "line"}, {"key": "nr", "type": "number"}, {"key": "nad", "type": "ref", "to": ["@swiat/pole"], "structure": "up"}]}, węzły {"ref": "@swiat/m-ruch", "kinds": ["@swiat/pole"], "data": {"nazwa": "Ruch", "nr": 1, "nad": "@swiat/m-fizyka"}}, temat z polem {"key": "pole", "type": "ref", "to": ["@swiat/pole"]} → "data": {"pole": "@swiat/m-ruch"}, widok {"ref": "@swiat/w-pola", "name": "Krajobraz pól", "mode": "landscape", "steps": [{"type": "source.kind", "config": {"kind": "@swiat/temat"}}], "landscape": {"nest": "pole"}}
  "mode": "outline" (Struktura) rysuje źródła jako korzenie, a pod nimi to, do czego prowadzą kroki; "outline": {"chip": "klucz pola nad każdym krokiem (np. rola)", "order": "tree|text" (bez "order": ostatni wybór czytelnika, a na początek kolejność tekstu u Tomasza i drzewo w innych dziełach), "by": "klucz pola, według którego najpierw układają się kroki jednego poziomu (np. czas — czas opowieści; bez "by": według miejsca w dziele)", "tie": "klucz pola przy tym samym miejscu (np. nr)"};
    widok otwarty od wpisu (wejście z Biblioteki) zastępuje tym wpisem wszystko przed pierwszym „Idź po…”; np. {"name": "Wywód", "mode": "outline", "steps": [{"type": "source.kind", "config": {"kind": "@krok"}}, {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field": "nalezy", "cmp": "empty"}]}}}, {"type": "structure", "config": {"dir": "down"}}], "outline": {"chip": "rola", "order": "tree", "tie": "nr"}}
  grupowanie (drzewo "group", wiersze i kolumny "matrix": {"rows": grupowanie, "cols": grupowanie}): {"by": "kind"} | {"by": "field", "field": "klucz"} | {"by": "axis", "kind": "@rodzaj", "via", "through", "depth", "sort", "group"} — OŚ: jej wartości to wpisy rodzaju
    "via": ["pole"] — przez które pola-odwołania wpis należy do wartości (puste: przez dowolne); "through": "pole" albo "*" — także o jeden krok dalej (wpis → przez to pole → inny wpis → przez "via" → wartość); "depth": "all" albo liczba — "through" przez wszystkie (albo n) poziomy: na każdej drodze w górę wartość najbliższego wpisu, który ją ma, a wpis z własną wartością ma tylko ją (np. {"by": "axis", "kind": "@obszar", "via": ["obszar"], "through": "wymaga", "depth": "all", "sort": {"field": "nr"}}; w krajobrazie pole struktury w górę działa tak samo bez "depth")
    "sort": {"field": "numer"} — kolejność według pola liczbowego wartości, albo {"list": "@rozaniec", "field": "tajemnice"} — według kolejności w polu-odwołaniu innego wpisu; bez "sort" — według nazwy
    "group": "czesc" — nagłówki: pole-odwołanie wartości (np. część tajemnic); w macierzy nad kolumnami i między wierszami
  kolumna "#axis:@rodzaj" — wartości tej osi (wpisy rodzaju), na które wskazuje wpis
  np. {"name": "Postacie według okresu", "mode": "tree", "steps": [{"type": "source.kind", "config": {"kind": "@postac"}}], "group": {"by": "axis", "kind": "@okres", "via": ["okres"], "sort": {"field": "od"}}}
  np. macierz 20 × 12 — Tajemnica × Obszar: {"name": "Tajemnica × Obszar", "mode": "matrix", "steps": [{"type": "source.kind", "config": {"kind": "text"}}, {"type": "source.kind", "config": {"kind": "@komentarz"}}], "matrix": {"rows": {"by": "axis", "kind": "@tajemnica", "sort": {"field": "numer"}, "group": "czesc"}, "cols": {"by": "axis", "kind": "@obszar", "group": "grupa"}}}
    — 20 tajemnic różańca (w czterech częściach) × 12 maryjnych obszarów (w grupach); w polu: kazania ze skryptorium (rodzaj tekstu „Kazanie maryjne” z polami "tajemnica" i "obszar") i komentarze, których "about" wskazuje tajemnicę i obszar; puste pola też są widoczne
  na stronie: moduł "view" {"library": "<id bazy>", "view": "<id widoku>", "mode": "tabela|drzewo|macierz|mapa|postepy|krajobraz", "answers": "<id obszaru kursu>", "rewards": "<id nagród>"} — pole macierzy (klik) i wpis otwierają się pod spodem, droga w adresie osobno dla każdego modułu; w krajobrazie uczy się osoba strony: "answers" i "rewards" jak w module „Powtórka”, nauka liczy się dla modułów „Punkty i seria” i „Statystyki na żywo” tej strony
"rewards" — nagrody (punkty, seria dni, cel dnia, poziomy, odznaki); kilka w bazie, każde miejsce wybiera swoje (moduł „Punkty i seria” / „Statystyki na żywo” na stronie, Ustawienia → Motywacja → „Punkty i nagrody” w Nauce):
  {"ref": "@kurs/punkty", "name": "Punkty i seria",
   "points": {"correct": 10, "partial": 5, "wrong": 1, "first": 5, "known": 20, "fast": 0, "combo": 15, "goal": 50, "streak": 5},
   "known": {"days": 1}, "fast": {"seconds": 8}, "combo": {"every": 5}, "goal": {"amount": 20, "unit": "cards|answers|points|minutes"},
   "streak": {"counts": "goal|any", "grace": 0, "max": 10},
   "levels": [{"at": 0, "name": "Początkujący"}, {"at": 100, "name": "Uczeń"}],
   "badges": [{"id": "tydzien", "name": "Tydzień z rzędu", "icon": "star|flame|target|book|bolt|crown|medal|leaf|check|rocket", "measure": "points|streak|best|known|cards|answers|correct|days|combo|goals|level|regions|map|clean", "atLeast": 7, "points": 0, "says": "…", "kind": "start|consistency|accuracy|volume|goals|exploration", "tier": 2}]}
  "points": "correct" × poprawność za dobrą odpowiedź (od 90%), "partial" × poprawność za częściowo dobrą, "wrong" za złą (za próbę), "first" za pierwszą odpowiedź na kartę, "known" za kartę utrwaloną (następna powtórka co najmniej "known.days" dni dalej), "fast" za dobrą w "fast.seconds" s, "combo" co "combo.every" dobrych z rzędu (przerwa ponad 30 min zaczyna od nowa), "goal" za cel dnia, "streak" × dzień serii (do "streak.max")
  "goal": cel dnia — "cards" różnych kart, "answers" odpowiedzi, "points" punktów (bez premii za cel i serię), "minutes" minut nauki; "streak": dzień serii to dzień z celem ("goal") albo z jakąkolwiek nauką ("any"), "grace" — tyle dni przerwy nie przerywa serii
  "badges": "regions" (obszary mapy znane w całości), "map" (procent tematów mapy, 0–100) i "clean" (dni z rzędu bez kart po terminie) liczy krajobraz — taka odznaka przychodzi, gdy uczący się go otworzy, a jej data zostaje zapisana w jego postępach; "kind" (niekonieczne) to kategoria na stronie „Odznaki i poziomy” — bez niego wynika z miary; odznaki jednej kategorii z tą samą miarą to stopnie jednej drabiny: od najniższego progu drewno, brąz, srebro, złoto, diament (drabina do 5 stopni: po jednym; dłuższa rozkłada pięć materiałów po równo, z numerem w materiale — „Srebro II”), "tier" 1–5 (niekonieczne) ustawia materiał wprost; wbudowane zasady mają 5 kategorii po 12 stopni, mniej więcej wykładniczo (pierwsze łatwe, najwyższe po miesiącach), i 12 poziomów, każdy mniej więcej dwa razy dalej
  punkty nie są zapisywane: liczy je aplikacja z odpowiedzi uczącego się — zmiana zasad zmienia punkty wszystkich; czego brakuje, bierze się z zasad wbudowanych; rankingów nie ma (tylko w sesjach na żywo)
"anchors" —wejścia z Biblioteki: {"ref", "name", "work": "@klucz dzieła albo identyfikator", "locator": "s. 45–60" | "s. 1–3; 27–30" | "I q. 2 a. 3; a. 4" | "" (całe dzieło), "entry": "@wpis tej bazy (nie dzieło)", "view": "@widok albo jego nazwa", "note"}
  przy dziele w Bibliotece pojawia się przycisk z nazwą wejścia — tylko dla tych, którzy mogą czytać tę bazę (Biblioteka niczego nie zapisuje); kilka wejść jednego dzieła może dotyczyć całości, początku, końca, także kilku części naraz
  części oddziela „;”; część, która zaczyna się niżej niż poprzednia, należy do jej ramy („I q. 2 a. 3; a. 4” — artykuł 4 tej samej kwestii; „t. 2, rozdz. 1; rozdz. 9” — rozdział 9 tego samego tomu)
"forms" — formularze dodawania (należą do schematu): {"ref", "name", "says", "graph", "keys", "paste", "order"}
  węzeł "pick" — wybór na początek, zostaje dla wszystkich wierszy: "config": {"label", "kinds": ["@rodzaj"], "many", "optional", "value": ["@wpis"]}
  węzeł "entry" — wpis z każdego wiersza: "config": {"kind": "@rodzaj", "also": ["@inny rodzaj"] (rodzaj wybierany przy każdej wartości; na liście przedrostek „Nazwa rodzaju: …”), "label", "many" (kilka w wierszu), "optional": true (może zostać puste — wpisy, do których prowadzi, powstają i bez niego), "reuse": "same|never", "identity": ["pole"],
    "fields": {"pole": {"from": "type|ask|fixed", "value": "tekst"}}} — type: wpisywane w wierszu, ask: ustawiane na początek ("value" — domyślnie), fixed: stała wartość
  krawędź {"id", "from": węzeł, "out": "out", "to": węzeł "entry", "in": klucz pola-odwołania} — wypełnia to pole wpisem z węzła "from";
    kilka krawędzi do pola, które przyjmuje kilka: wartości po kolei według położenia węzłów (z góry na dół); wpis powstaje, gdy w wierszu są wszystkie połączone
  "order": ["id węzła entry"] — kolejność pól w wierszu (Enter, kolumny wklejanej listy); bez niej jak na płótnie
  "keys": {"enter", "ctrlEnter", "shiftEnter"}: "next", "more", "save", "newline", "none"
  "paste": {"columns": "auto", "tab", ";", "=", " - ", "|", ",", "values": ",", ";", "/", "|", "header": true|false}
## Jak aplikacja używa tych danych
  Wiedza: wpisy stoją w „Wpisy” (tabela, drzewo, struktura, macierz, płótno — według widoków), każdy ze swoją stroną (pola, odwołania, kolejność nauki); rodzaje, szablony, widoki i sposoby dodawania — w „Schematach”; wejścia ("anchors") dają przy dziele w Bibliotece i w czytniku przycisk „W Wiedzy”.
  Nauka: szablony robią z wpisów karty (z kluczem „szablon:wpis”); powtórki wybierają z kart i pytają; „Ścieżka” pokazuje kolejność nauki; widoki i powtórki z „Filtrem znajomości” pokazują to, co uczący się już może.
  Krajobraz (widok "landscape", na stronie "krajobraz"): z kolejności nauki i znajomości liczy dla każdego wpisu wysokość (dolina, pierścień, góry), z grupowania widoku — kierunek; uczący się wybiera tam, czego się uczyć, ustawia cel (zapisany prywatnie jak postępy), a blokada każe najpierw powtórzyć słabe karty z drogi przed wpisem.
  Czytanie w Nauce: przed pierwszym pytaniem o wpis z "about" stoi „Nowy temat” (tytuł i zapowiedź, „Czytaj dalej”, „Czytaj tekst” do miejsca w źródle), po odpowiedzi — wyjaśnienie; oba według "reading" jego rodzaju, a bez niego — streszczenie albo pierwszy akapit, potem pola z tekstem.
  Odpowiedzi: każda zapisuje się zaszyfrowana w przeglądarce — dla uczącego się i dla obszaru przyjęć kursu (Ustawienia), gdzie nauczyciel widzi „Postępy”; z nich liczy się znajomość kart i wpisów. Serwis nie czyta odpowiedzi; widzi tylko, kiedy następna powtórka i ile kart czeka — na osobę i bazę (do przypomnienia).
  Strony: moduły „Widok” (tabela, drzewo, macierz, mapa), „Powtórka”, „Kurs / opowieść”, „Karta wpisu” czytają bazę tak, jak widzi ją czytelnik strony; uczy się osoba strony (zalogowana — ona sama, bez konta — ta przeglądarka).
  Nagrody ("rewards"): moduły „Punkty i seria” i „Statystyki na żywo” na stronie oraz Nauka (Motywacja „Punkty i nagrody”, zakładka „Nagrody”) liczą z odpowiedzi punkty, serię, cel dnia, poziom i odznaki — na żywo, przy każdej odpowiedzi; nic z tego nie jest zapisywane.
  Inne bazy wiedzy, które korzystają z tej jako źródła, widzą jej rodzaje, wpisy, szablony, powtórki i przebiegi tylko do odczytu; link dla AI i MCP czytają ją bez zmian.
  Kto czyta: ten, kto czyta jej obszar (w obszarze jawnym — każdy); wpisy są szyfrowane kluczem obszaru.
  Import usuwa tylko to, co dokument wymienia z "remove": true (podgląd pokazuje każde), i nie dotyka odpowiedzi ani postępów: nowa karta zaczyna bez historii, a karta, której poprawna odpowiedź się zmieniła, zaczyna historię od nowa (zmiana wag "tests" historii nie zmienia).
```
<!-- app:cogita-json:end -->

## Dodatek C — Rodzaje gotowych schematów (z plików)

<!-- app:template-kinds:start -->
```text
## templates/cogita/wywod.json — Opis dzieła — kroki (wywód, przebieg) i elementy stałe
### "@wywod/krok" — Krok wywodu, etykieta {tresc}
- "rola" — Rola (choice; do wyboru: "pytanie", "odpowiedz", "argument", "zarzut", "sedcontra", "replika", "rozroznienie", "przyklad", "wniosek", "opis", "streszczenie", "czesc", "watek", "wydarzenie", "etap"): Co ten krok robi w dziele. W tekście, który dowodzi: Pytanie (teza kończy się „?”), Odpowiedź — teza autora, Argument — racja za tym, pod czym stoi, Zarzut — racja przeciw, Sed contra, Odpowiedź na zarzut, Rozróżnienie, Przykład, Wniosek. W tekście, który opowiada albo opisuje: Wątek (początek równoległej struktury: budowa utworu, chronologia, rozwój postaci), Część utworu (rozdział, scena), Wydarzenie, Etap (etap rozwoju), Opis, Streszczenie. Listę można rozszerzać — każda nowa możliwość to nowa pozycja, nie nowy schemat.
- "miejsce" — Miejsce w dziele (ref; z miejscem; → work): Dzieło z Biblioteki i miejsce kroku w jego układzie miejsc: „s. 46–47”, „I q. 2 a. 3 arg. 1”, „rozdz. 3”. Początek struktury: cały zakres (np. „s. 45–60”). Bez miejsca — całe dzieło. Przesłanka, której autor nie wypowiada wprost: bez wartości.
- "tresc" — Treść (blocks): Pierwsze zdanie to teza kroku — własnymi słowami, najwyżej 200 znaków, bez miejsca w nawiasie. Dalej krótkie streszczenie. Tekstu źródła się tu nie przepisuje; dosłowny fragment idzie do pola „Ważny fragment”. Własna ocena to osobny Komentarz.
- "fragment" — Ważny fragment (text): Najważniejsze zdanie (najwyżej trzy) z tego miejsca — dokładnie tak, jak w tekście, bez cudzysłowu. Z niego i z tezy powstają karty: które fragmenty należą do których tez.
- "nalezy" — Należy do (ref; kilka; → @wywod/krok; struktura up): Krok bezpośrednio wyżej: pytanie, na które ten krok odpowiada; teza, którą wspiera albo atakuje; zarzut, na który odpowiada; rozdział, w którym jest wydarzenie; wątek, do którego należy. Krok może należeć do kilku struktur naraz (wydarzenie w rozdziale i w chronologii). Puste tylko na początku struktury.
- "elementy" — Elementy stałe (ref; kilka; → @wywod/element): Elementy stałe dzieła, o których ten krok mówi albo których używa: pojęcie (np. wolność w tym tekście), postać, miejsce.
- "czas" — Czas opowieści (number): Tylko w opowieści: kolejność w czasie samej historii (1 — najwcześniej; to samo, gdy dzieje się naraz). Wspomnienie z końca książki, które opowiada o dzieciństwie, ma mały numer. Według tego pola układa się widok „Wywód — w czasie opowieści”.
- "nr" — Nr w tym samym miejscu (number): Tylko gdy kilka kroków pod tym samym krokiem ma to samo miejsce (np. pięć dróg w „co.”): 1, 2, 3 w kolejności tekstu.
### "@wywod/element" — Element stały, etykieta {nazwa}
- "nazwa" — Nazwa (line): Jak element nazywa się w dziele: słowo („wolność”), imię postaci, nazwa miejsca. Bez dzieła (pojęcie ponad dziełami): jego zwykła nazwa („Wolność”).
- "czym" — Czym jest (choice; do wyboru: "pojecie", "postac", "miejsce", "przedmiot", "grupa", "motyw", "pytanie"): Co to za element. Listę można rozszerzać (np. „Symbol”, „Zwierzę”) — nowa możliwość to nowa pozycja, nie nowy schemat.
- "rzeczywistosc" — Czy istnieje naprawdę (choice; do wyboru: "rzeczywisty", "wzorowany", "fikcyjny", "nieznane"): Przy dziele, które opowiada o rzeczywistości (powieść o prawdziwej osobie, film historyczny, wspomnienia, reportaż): czy element istnieje naprawdę. Fakty o nim — z ich źródłami i oceną — to wpisy rodzaju „Fakt” (templates/cogita/fakty.json), które wskazują ten element w „O kim, o czym”.
- "opis" — Opis (blocks): Pierwsze zdanie: jak TO dzieło rozumie albo przedstawia element (najwyżej 200 znaków, własnymi słowami). Dalej szczegóły: cechy, zmiany, relacje. Bez dzieła: co znaczy ogólnie.
- "miejsce" — Miejsce w dziele (ref; kilka; z miejscem; → work): Gdzie dzieło wprowadza albo opisuje element (dzieło z Biblioteki i miejsce; kilka miejsc — kilka wartości). Pusty: element ponad dziełami (np. „Wolność” w ogóle), na który wskazują elementy z dzieł.
- "fragment" — Ważny fragment (text): Zdanie (najwyżej trzy), w którym dzieło najlepiej pokazuje element — dokładnie jak w tekście.
- "ogolnie" — Ogólnie (ref; kilka; → @wywod/element): Element ponad dziełami, do którego ten się odnosi: „wolność” u Kanta i „wolność” u Milla wskazują na „Wolność”. W komentarzu można potem pokazać, czym się różnią.
- "nalezy" — Część albo aspekt (ref; → @wywod/element; struktura up): Element szerszy, którego ten jest aspektem albo częścią: „wolność wyboru” pod „Wolność”, pokój pod domem, członek pod rodziną.
### "@komentarz/rodzaj" — Komentarz, etykieta {content}
- "about" — O czym (ref; kilka; z miejscem): Czego dotyczy komentarz: krok, element stały, werset Pisma (dzieło z biblioteki i miejsce), cytat, osoba, inny wpis — dowolny rodzaj, z tej bazy, z bibliotek i baz, z których korzysta
- "content" — Treść (blocks): Pierwsze zdanie pierwszego akapitu to teza (nazwa wpisu). Własna myśl — o kroku, o elemencie, o całym dziele, o czymkolwiek w Cogicie — zawsze „interpretacja”, osobno od tego, co mówi dzieło.
Szablony kart: „Fragmenty i tezy jednego dzieła — połącz w pary”, „Do tego fragmentu — która teza?”, „Z którego dzieła jest ta teza?”, „Co znaczy w tym dziele…?”.
Sposoby dodawania: „Pytania dzieła — wiersz po wierszu”, „Kroki pod krokiem — wiersz po wierszu”, „Elementy stałe dzieła — wiersz po wierszu”.
Widoki: „Wywód”, „Wywód — kolejność tekstu”, „Wywód — w czasie opowieści”, „Pytania wiodące i inne początki”, „Elementy stałe”, „Elementy stałe — tabela”.

## templates/cogita/fakty.json — Fakty i źródła — co źródło mówi o świecie, kiedy i gdzie, i czy to się zgadza
### "@fakty/fakt" — Fakt, etykieta {tresc}
- "tresc" — Treść (blocks): Pierwsze zdanie to sam fakt — jedno twierdzenie o świecie, krótko, własnymi słowami (najwyżej 200 znaków): „Bitwa pod Grunwaldem odbyła się 15 lipca 1410 roku.”, „Karol Wojtyła przyjął święcenia kapłańskie 1 listopada 1946 roku.”, „Woda wrze w 100 °C pod ciśnieniem 1013 hPa.”. Dalej szczegóły. Dwa twierdzenia to dwa fakty.
- "haslo" — Hasło (line): Krótka nazwa bez daty i bez odpowiedzi — do kart „Kiedy?” i „Co wiadomo?”: „Bitwa pod Grunwaldem”, „Święcenia kapłańskie Karola Wojtyły”, „Chrzest Polski”.
- "rodzaj" — Rodzaj faktu (choice; do wyboru: "zdarzenie", "stan", "liczba", "wypowiedz", "przyczyna", "opinia"): Jaki to fakt — od tego zależy, jak go sprawdzić i o co pytać (zdarzenie: kiedy i gdzie; wypowiedź: kto i do kogo; liczba: ile). Opinii nie potwierdza się źródłem — opisuje się, kto tak ocenia.
- "kogo" — O kim, o czym (ref; kilka): Osoby, miejsca, rzeczy, pojęcia, których fakt dotyczy — wpisy tej bazy (np. Element stały, Pojęcie) albo osoby i dzieła z biblioteki.
- "kiedy" — Kiedy (date; niepewne): Data z dokładnością, jaką znamy — rok, miesiąc albo dzień; przybliżona albo sporna — ze stanem, źródłem i notatką. Fakt bez daty — puste.
- "gdzie" — Gdzie (ref; kilka; → @miejsce/miejsce): Miejsce — wpis rodzaju „Miejsce” (ze współrzędnymi): gdzie to się stało, gdzie ktoś był.
- "okres" — Okres (ref; kilka; → @czas/okres; struktura up; kolejność nauki up): Okres, epoka albo etap, do którego fakt należy („Okupacja”, „Średniowiecze”, „Dzieciństwo”). Okres jest ogólniejszy — jego karty przychodzą przed kartami faktów.
- "zrodlo" — Źródło (ref; kilka; z miejscem; → work): Skąd ten fakt: dzieło z biblioteki, które go podaje — książka, artykuł, nagranie, film, dokument, strona — z miejscem w nim (strona, rozdział, werset, minuta). Jak czytać to miejsce, wie Biblioteka (układ miejsc dzieła). Gdy uczysz się z jednego dzieła, to jest ono — także wtedy, gdy coś upiększa albo zmyśla.
- "jak" — Jak podaje to źródło (text): Jak źródło to przedstawia: dosłownie, w skrócie, z dopowiedzeniami, w scenie z wymyślonym dialogiem, z inną datą, bez kontekstu, z postacią złożoną z kilku osób… Opis, bez oceny.
- "ocena" — Czy się zgadza (choice; do wyboru: "potwierdzone", "prawdopodobne", "sporne", "uproszczone", "nieprawdziwe", "fikcja", "nieznane"): Ocena po sprawdzeniu w innych źródłach. Bez sprawdzenia — puste.
- "potwierdzenia" — Inne źródła (ref; kilka; z miejscem; → work): Dzieła z biblioteki, które to potwierdzają albo mu przeczą — z miejscem, jak przy „Źródle”.
- "poza" — Źródła spoza biblioteki (list): Gdy źródła nie ma w bibliotece — każde w osobnej linii: hasło encyklopedii, archiwum, adres strony. Lepiej dodać je do biblioteki i wskazać w „Inne źródła”.
- "uzasadnienie" — Uzasadnienie (text): Dlaczego taka ocena: co mówią inne źródła, czym różnią się od źródła faktu, czego nie da się sprawdzić.
- "wymaga" — Najpierw trzeba znać (ref; kilka; kolejność nauki up): Fakty albo pojęcia, które trzeba znać wcześniej, żeby ten zrozumieć (wybór na papieża wymaga faktu, że ktoś był kardynałem). Tylko bezpośrednie.
### "@czas/okres" — Okres, etykieta {nazwa}
- "nazwa" — Nazwa (line): Okres, epoka albo etap: „Okupacja”, „Średniowiecze”, „Dzieciństwo w Wadowicach”, „Pontyfikat”, „Adwent”.
- "czas" — Kiedy (range): Od–do, z dokładnością, jaką znamy: „1939–1945”, „ok. 960–992”, „1978–2005”, „1990–” (bez końca). Okres bez dat — puste.
- "nr" — Kolejność (number): Numer w kolejności (1 — najwcześniejszy) — według niego układają się okresy w widokach, także gdy dat brak albo okresy nachodzą na siebie.
- "opis" — Opis (markup): Najważniejsze o tym okresie w dwóch–trzech zdaniach — to, co trzeba wiedzieć, zanim przyjdą szczegóły.
- "gdzie" — Gdzie (ref; kilka; → @miejsce/miejsce): Gdzie toczył się ten okres albo etap („Becchi”, „Chieri”, „Turyn”) — może zostać puste.
- "nalezy" — Należy do (ref; → @czas/okres; struktura up; kolejność nauki up): Szerszy okres, w którym ten leży („Młodość” w „Życie przed kapłaństwem”, „Wczesne średniowiecze” w „Średniowiecze”).
### "@miejsce/miejsce" — Miejsce, etykieta {nazwa}
- "nazwa" — Nazwa (line): Nazwa miejsca: „Becchi”, „Chieri”, „Turyn”, „Valdocco”, „Wadowice”.
- "polozenie" — Położenie (geo): Współrzędne: {"lat": 45.0703, "lon": 7.6869} — szerokość i długość geograficzna (punkt na mapie).
- "opis" — Opis (markup): Czym jest to miejsce i dlaczego jest ważne — jedno–dwa zdania.
- "w" — Leży w (ref; → @miejsce/miejsce): Większe miejsce, w którym leży (Valdocco w Turynie, Becchi koło Castelnuovo) — może zostać puste.
Szablony kart: „Hasło → co wiadomo (fiszka)”, „Hasło → kiedy (rok)”, „Czy to się zgadza? (wybór oceny)”, „Okres → co wtedy było (fiszka)”.
Sposoby dodawania: „Fakty ze źródła — wiersz po wierszu”, „Okresy — wiersz po wierszu”.
Widoki: „Fakty według okresów”, „Oś czasu”, „Fakty według oceny”, „Fakty według rodzaju”, „Fakty od podstaw”, „Od ogólnego do szczegółu”.

## templates/cogita/zbior.json — Zbiór — pozycje do rozpoznania i rozróżnienia (modlitwy, prefacje, pieśni, psalmy, artykuły, utwory, obrazy…)
### "@zbior/pozycja" — Pozycja, etykieta {oznaczenie}
- "nr" — Numer (number): Kolejność w zbiorze albo w grupie (1, 2, 3…) — według niej układają się widoki. Oznaczenie, pod którym pozycja stoi w źródle („P 12”, „Ps 23”, „KV 618”, „art. 12”), idzie do „Oznaczenia”.
- "oznaczenie" — Oznaczenie (line): Jak pozycję nazywa zbiór — tytuł, numer, sygnatura: „Prefacja o Adwencie I”, „Pieśń 112: Czarna Madonna”, „Psalm 23”, „Art. 12 Konstytucji”, „Sonata c-moll op. 13 (Patetyczna)”.
- "poczatek" — Początek (text): Pierwsze słowa (wers, fraza, zdanie), po których się ją rozpoznaje — dokładnie jak w źródle. Gdy wszystkie pozycje zaczynają się tą samą formułą (prefacje: „Zaprawdę, godne to i sprawiedliwe…”), wpisz słowa PO niej.
- "tresc" — O czym jest (blocks): Pierwsze zdanie: o czym jest — myśl przewodnia, własnymi słowami (najwyżej 200 znaków). Dalej najważniejsze myśli, po kolei.
- "znaki" — Znaki rozpoznawcze (list): Słowa, obrazy, motywy, cechy, po których ją poznać — każdy w osobnej linii („czuwanie”, „podwójne przyjście”; „tonacja d-moll”; „czerwony płaszcz”).
- "obraz" — Obraz albo dźwięk (media): Gdy rozpoznaje się ją także po obrazie albo dźwięku — zdjęcie, ilustracja, fragment melodii. Plik dodaje się w aplikacji.
- "grupa" — Grupa (ref; → @zbior/grupa; struktura up; kolejność nauki up): Grupa, dział albo rodzaj, do którego należy („Prefacje adwentowe”, „Pieśni maryjne”, „Rozdział II. Wolności i prawa”). Grupa jest ogólniejsza: najpierw poznaje się grupę, potem jej pozycje.
- "miejsce" — Gdzie jest (ref; kilka; z miejscem; → work): Dzieło z biblioteki i miejsce w nim — strona, numer, werset, minuta nagrania; ta sama pozycja może stać w kilku dziełach (pieśń w dwóch śpiewnikach). Jak czytać to miejsce, wie Biblioteka (układ miejsc dzieła, także strony w osobno liczonych częściach książki).
- "podobne" — Łatwo pomylić z (ref; kilka; → @zbior/pozycja): Pozycje podobne do tej — te, które łatwo pomylić (z tej samej grupy, o tym samym temacie, o podobnym początku).
- "roznica" — Czym się różni (text): Czym różni się od tych, z którymi łatwo ją pomylić: inna myśl, inny obraz, inne słowo kluczowe.
- "uzycie" — Kiedy i do czego (text): Kiedy, przy jakiej okazji i do czego się jej używa („w Adwencie do 16 grudnia”, „na pogrzebach”, „gdy umowa jest nieważna”).
- "wymaga" — Najpierw trzeba znać (ref; kilka; kolejność nauki up): Co trzeba znać wcześniej — pojęcie, inną pozycję. Tylko bezpośrednie.
### "@zbior/grupa" — Grupa, etykieta {nazwa}
- "nazwa" — Nazwa (line): Nazwa grupy, działu albo rodzaju: „Prefacje”, „Prefacje adwentowe”, „Pieśni wielkanocne”, „Rozdział II Konstytucji”.
- "nr" — Kolejność (number): Numer grupy w kolejności zbioru — według niego układają się grupy w widokach.
- "opis" — Czym się wyróżnia (markup): Co łączy pozycje tej grupy i czym różni się ona od innych — dwa–trzy zdania, ogólnie.
- "nalezy" — Należy do (ref; → @zbior/grupa; struktura up; kolejność nauki up): Szerszy dział („Prefacje” → „Prefacje adwentowe”).
- "miejsce" — Gdzie jest (ref; kilka; z miejscem; → work): Dzieło z biblioteki i zakres grupy w nim („s. 400–412”, „nr 1–20”).
Szablony kart: „Oznaczenie → o czym jest (fiszka)”, „Początek → która to? (wybór z tej samej grupy)”, „Początki i oznaczenia z tej samej grupy — połącz w pary”, „Oznaczenie → jak się zaczyna (fiszka)”, „Czym się różni od podobnych? (fiszka)”, „Obraz albo dźwięk → która to? (wybór z tej samej grupy)”, „Grupa → czym się wyróżnia (fiszka)”.
Sposoby dodawania: „Pozycje zbioru — wiersz po wierszu”.
Widoki: „Według numeru”, „Według grup”, „Podobne i różnice”, „Od podstaw”.

## templates/cogita/podstawy.json — Pojęcia z kolejnością nauki — od podstaw do szczegółów
### "@podstawy/pojecie" — Pojęcie, etykieta {nazwa}
- "nazwa" — Nazwa (line): Jak się nazywa pojęcie: „Atom”, „Orbital”, „Liczba atomowa”.
- "czym" — Czym jest (markup): Jedno–dwa zdania: czym jest to pojęcie — tak, żeby zrozumiał je ktoś, kto zna już to, czego ono wymaga.
- "wymaga" — Wymaga (ref; kilka; → @podstawy/pojecie; kolejność nauki up): Pojęcia, które trzeba znać WCZEŚNIEJ, żeby zrozumieć to (orbital wymaga powłoki elektronowej; elektron wymaga atomu). Tylko bezpośrednie — dalsze wynikają same. Puste: pojęcie podstawowe. Z tego pola aplikacja liczy poziomy od podstaw: karty pojęcia przychodzą, gdy umiesz to, czego ono wymaga.
- "dziedzina" — Dziedzina (line): Np. „Chemia”, „Fizyka” — odróżnia pojęcia o tej samej nazwie.
- "przyklad" — Przykład (text): Przykład albo ilustracja (nieobowiązkowo).
Szablony kart: „Czym jest pojęcie? (fiszka)”, „Jakie to pojęcie? (wpisz nazwę)”, „Pojęcia i ich znaczenie — połącz w pary”.
Sposoby dodawania: „Pojęcia — wiersz po wierszu, z tym, czego wymagają”.
Widoki: „Od podstaw”.

## templates/cogita/pytania.json — Pytania — jeden schemat, wiele rodzajów pytań
### "@pytania/pytanie" (wbudowany "question") — Pytanie, etykieta {prompt}
- "form" — Rodzaj pytania (choice; do wyboru: "text", "number", "date", "gap", "one", "many", "truefalse", "match", "order", "build", "flash", "point", "code", "interactive"): Jak się pyta i odpowiada — od tego zależy, które pola niżej się wypełnia: text (Odpowiedź słowami), number (Liczba), date (Data), gap (Luka w tekście), one (Jedna z kilku), many (Kilka z kilku), truefalse (Prawda czy fałsz), match (Połącz w pary), order (Ułóż w kolejności), build (Zbuduj z kafelków), flash (Fiszka (sam oceniasz)), point (Miejsce na mapie), code (Kod (Python)), interactive (Rysunek do poruszania)
- "prompt" — Pytanie (markup): Treść pytania; przy „Prawda czy fałsz” — zdanie, przy fiszce — jej przód, przy luce — tekst z luką [[słowo]] (kilka luk: każda osobno). Wzory: $…$ w zdaniu, $$…$$ osobno
- "hints" — Podpowiedzi (list): Podpowiedzi przed odpowiedzią, od łagodnej do konkretnej (1–3, z wzorami $…$); każda odsłonięta obniża najwyższy wynik tej odpowiedzi o ¼
- "explanation" — Wyjaśnienie (tekst) (markup): Wyjaśnienie pokazywane zaraz po odpowiedzi, rozwinięte (2–4 zdania, wzory $…$, źródła [@dzieło, s. 12])
- "answers" — Poprawne odpowiedzi (list; tylko gdy form: text, number, date, gap): Przyjmowane odpowiedzi (text, number, date, gap) — pierwsza jest wzorcowa; wpisywanie nigdy nie wymaga LaTeX-a
- "options" — Do wyboru (list; tylko gdy form: one, many): Możliwości (one, many) — mogą mieć wzory $…$
- "correct" — Które są dobre (list; tylko gdy form: one, many): Numery dobrych możliwości, od 0 (one, many)
- "feedback" — Zdanie do każdej możliwości (list; tylko gdy form: one, many): Po jednym zdaniu do każdej możliwości, w tej samej kolejności co „Do wyboru” (puste: bez zdania) — po odpowiedzi stoi pod wybraną i pod dobrymi (one, many)
- "value" — Prawda? (bool; tylko gdy form: truefalse): Czy zdanie jest prawdziwe (truefalse)
- "left" — Lewa strona (list; tylko gdy form: match): Lewa strona par, np. lata (match)
- "right" — Prawa strona (list; tylko gdy form: match): Prawa strona par, w tej samej kolejności, np. wydarzenia (match)
- "leftLabel" — Nagłówek lewej strony (line; tylko gdy form: match): Nad lewą kolumną karty, np. „Rok” (match)
- "rightLabel" — Nagłówek prawej strony (line; tylko gdy form: match): Nad prawą kolumną karty, np. „Wydarzenie” (match)
- "show" — Ile naraz (number; tylko gdy form: many, match): Długa lista: tyle par (match) albo zdań (many) na jednej karcie (2–12) — każda para / każde zdanie ma wtedy swoją kartę, a resztę miejsc zajmują losowe inne; puste: wszystko na jednej karcie
- "share" — Wspólne części (text): Nazwa zbioru części: pytania z tą samą nazwą liczą odpowiedź na tę samą część razem — to samo zdanie (many, truefalse), tę samą parę (match), to samo słowo w luce (gap), ten sam nazwany fakt (fact). Np. kilka wersji „Które zdania są twierdzeniami?”. Puste: części tylko tego pytania
- "fact" — O jaki fakt pyta (text): Nazwa jednego faktu, o który pyta pytanie bez części (text, number, date, one, flash, order…): pytania o tym samym fakcie dzielą odpowiedzi — np. „Kiedy był Grunwald?” i „Co było w 1410?” z "fact": "Grunwald 1410". „Prawda czy fałsz”: zdanie, które ocenia (bez tego — treść pytania), to samo co zdanie w „Kilka z kilku” z tym samym "share"
- "items" — W dobrej kolejności (list; tylko gdy form: order, build): Elementy w poprawnej kolejności (order); kafelki dobrej odpowiedzi w kolejności (build)
- "extra" — Kafelki zbędne (list; tylko gdy form: order, build): Kafelki, których nie trzeba użyć (build); „Ułóż w kolejności” ich nie pokazuje
- "alternatives" — Inne dobre kolejności (json; tylko gdy form: build): Inne przyjmowane odpowiedzi z kafelków: lista list, np. [["$B$", "$=$", "$A$"]] (build)
- "preview" — Podgląd (choice; tylko gdy form: order, build; do wyboru: "math", "text"): math albo text — jak pokazać to, co ułożone (build: domyślnie wzór; order: bez — bez podglądu)
- "join" — Między kafelkami (json; tylko gdy form: order, build): Co stoi między kafelkami w podglądzie — tekst, domyślnie " " (build, order)
- "choices" — Do wyboru w lukach (json; tylko gdy form: gap): Do każdej luki [[…]] po kolei lista ZŁYCH możliwości, np. [["Satz 2.1", "Lemma 3.4"], []] — luka z listą jest do wybrania, z pustą — do wpisania (gap)
- "back" — Odwrotna strona (list; tylko gdy form: flash): Co jest na odwrocie fiszki (flash)
- "tolerance" — Tolerancja (number; tylko gdy form: number, date): Ile wolno się pomylić (liczba; data — w jednostkach dokładności)
- "relative" — Tolerancja względna (bool; tylko gdy form: number): Tolerancja jako ułamek wartości (liczba)
- "unit" — Jednostka (line; tylko gdy form: number): Jednostka liczby
- "quantity" — Wielkość (choice; tylko gdy form: number; do wyboru: "Dimensionless", "PlaneAngle", "Length", "Area", "Volume", "Mass", "Time", "Frequency", "AngularVelocity", "Velocity", "Acceleration", "Force", "Momentum", "Energy", "Torque", "Power", "Pressure", "ThermodynamicTemperature", "Density", "DynamicViscosity", "KinematicViscosity", "SpecificEnergy", "SpecificHeatCapacity", "ThermalConductivity", "ElectricCurrent", "ElectricCharge", "Voltage", "Resistance", "Capacitance", "AmountOfSubstance", "AmountOfSubstanceConcentration", "MolarMass", "LuminousIntensity"): Jaka wielkość (number): Torque, Energy, Mass, Length … — wtedy odpowiedź może mieć inną jednostkę tej wielkości (przeliczana), a jednostka innej wielkości jest błędem (12 J na pytanie o moment siły)
- "precision" — Dokładność daty (choice; tylko gdy form: date; do wyboru: "year", "month", "day"): year, month albo day
- "task" — Zadanie (text; tylko gdy form: code): Opis zadania (code)
- "starter" — Początek kodu (text; tylko gdy form: code): Kod na start, z def transform(x): (code)
- "createInput" — Dane testowe (text; tylko gdy form: code): def create_input(seed): … — dane do sprawdzenia (code)
- "reference" — Rozwiązanie wzorcowe (text; tylko gdy form: code): def reference(x): … — wynik, z którym porównuje się kod (code)
- "cases" — Ile przypadków (number; tylko gdy form: code): Na ilu danych sprawdzić (code)
- "tests" — Przykłady (json; tylko gdy form: code): Widoczne przykłady: [{"input": [3, 1, 2], "output": [1, 2, 3], "note": "…"}] — sprawdzane przed ukrytymi przypadkami (code); może być tekstem JSON
- "place" — Miejsce (geo; tylko gdy form: point): Szukany punkt: {"lat": …, "lon": …} (point)
- "radius" — Promień (m) (number; tylko gdy form: point): Jak blisko trzeba trafić, w metrach (point)
- "drawing" — Rysunek (JSON) (text; tylko gdy form: interactive): Rysunek do poruszania — ten sam JSON co w module „Animacja” strony: vars, sim, controls, rules (z "goal": true — cel), world (rzeczy do budowania, np. waga), elements (interactive)
- "goal" — Cel (wyrażenie) (line; tylko gdy form: interactive): Kiedy odpowiedź jest dobra, np. "abs(x - cel) < 0.5 && y <= 0" — liczone w symulacji do końca; puste: reguły rysunku z "goal": true (interactive)
- "solution" — Rozwiązanie (line; tylko gdy form: interactive): Wartości, które rozwiązują zadanie, np. "kat = 45; v0 = 12" albo własności rzeczy "w2.pos = 5" — pokazywane po złej odpowiedzi; puste: "task.solve" rysunku (interactive)
- "goals" — Cele po kolei (list; tylko gdy form: interactive): Kilka celów (wyrażeń), które trzeba osiągnąć PO KOLEI, np. ["x > 3", "y < 1"] — zamiast "goal" (interactive)
- "check" — Kiedy sprawdzać (choice; tylko gdy form: interactive; do wyboru: "live", "submit"): "live" (domyślnie) — rysunek pokazuje trafienie już podczas prób, ocena po „Sprawdź”; "submit" — nic nie zdradza celu, dopiero „Sprawdź” ocenia (interactive)
- "explain" — Wyjaśnienie (wpisy) (ref; kilka): Wpisy pokazywane po odpowiedzi, zwinięte (np. wypowiedź z treścią w blokach)
- "params" — Parametry (json): Wartości losowane przy każdym pytaniu: [{"name": "a", "random": [2, 30], "step": 1}], {"name": "f", "values": [...]}, 2026-11-03 także wpisy z bazy: {"name": "kation", "entry": {"kind": "@rodzaj", "where": "it.ladunek > 0"}}, {"name": "zd", "entries": {"kind": "@rodzaj", "count": 4}}; w tekstach {a}, {kation.symbol}
- "let" — Wartości liczone (json): Liczone z parametrów, po kolei: [{"name": "r", "value": "mod(a, n)"}] — język wyrażeń rysunków z listami i wpisami (filter, map, sortby, choose, gcd, lcm, sub, sup …); w tekstach {r}, {fmt(x, 2)}
- "require" — Warunki losowania (list): Warunki, które losowanie musi spełnić, np. "a > 2*n" — losuje się od nowa (do 60 razy); gdy się nie da, karta nie powstaje
- "core" — Pytanie kluczowe (bool): Kluczowe dla tematów z „O czym”: „Sprawdź, co wiesz” pyta o nie raz, a ich znajomość mówi, czy temat to „luka” (warunek z rel "core")
- "about" — O czym (ref; kilka): Wpisy, które to pytanie sprawdza: jego wynik liczy się do ich znajomości, a samo pytanie czeka, aż opanujesz to, co trzeba znać przed nimi
- "needs" — Najpierw trzeba znać (ref; kilka; kolejność nauki up): Wpisy albo pytania, które trzeba opanować, zanim padnie to pytanie (np. „Czym jest atom?” przed „Czym jest orbital?”)
Sposoby dodawania: „Prawda czy fałsz — wiele naraz”, „Pytania z odpowiedzią słowami — wiele naraz”, „Jedna z kilku — wiele naraz (pierwsza możliwość jest dobra)”, „Fiszki — wiele naraz”.
Widoki: „Pytania według rodzaju”.
```
<!-- app:template-kinds:end -->
