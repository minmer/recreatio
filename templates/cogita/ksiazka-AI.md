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

Dzieło zwykle łączy kilka warstw: powieść o prawdziwej osobie — przebieg, elementy i fakty; podręcznik historii — fakty, okresy i pojęcia; mszał albo śpiewnik — zbiór i pojęcia; kodeks — zbiór pozycji (artykuły) i pojęcia. Wszystko, czego tu nie ma, jest w dodatkach — wygenerowanych z aplikacji, więc zawsze zgodnych z tym, co aplikacja przyjmuje.

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
    "psalms": "hebrew" | "greek"    — tylko Pismo Święte: numeracja psalmów (BT: hebrew; Wulgata: greek)
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
  "uncertain": true                                           przy dowolnym bloku: odczyt niepewny

## Znaki w tekście
  {{page 46}}  albo  {{page 46 pdf 52}}    granica strony w środku akapitu (dokładnie tam, gdzie wypada)
  {{note 3}}                               odwołanie do przypisu "3"
  {{? słowo}}                              niepewny odczyt tego słowa;  {{?}} — nieczytelne
  {{gap}}                                  pominięty / brakujący fragment
Wszystko inne jest zwykłym tekstem. Zachowaj dokładne brzmienie, kolejność, akapity i interpunkcję oryginału. Nie poprawiaj, nie streszczaj, nie tłumacz.

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
  Istniejące wpisy rozpoznaje się po identyfikatorze (z eksportu) albo po trwałej nazwie; import UZUPEŁNIA je w miejscu: pola, których dokument nie wymienia, zostają, a "pole": null usuwa pole; wpisów nie usuwa. Przed zapisem każdą zmianę w tym, co już jest, trzeba przyjąć (i można ją poprawić).
  Rodzaj można wskazać jego trwałą nazwą ("kinds": ["@wywod/krok"]) — znajdzie się także po zmianie nazwy.
  Nazwa z „/" jest TRWAŁA: zostaje przy wpisie (także przy widoku, wejściu, szablonie, formularzu, rodzaju), a ten sam dokument zaimportowany drugi raz zmienia te same rzeczy zamiast tworzyć nowe; wielkość liter nie ma znaczenia.
    Kroki rekonstrukcji: "@<klucz dzieła>/<rekonstrukcja>/<krok>", np. "@kowalski2020/calosc/pytanie", "@kowalski2020/wstep/arg1" — każda rekonstrukcja jednego dzieła ma własny środkowy człon.
    Trwałe nazwy są wspólne dla całej bazy: dokument, który trafia w nazwy wpisów z innego dokumentu, zmieni je (podgląd to mówi) — inna rekonstrukcja potrzebuje innego członu (np. "calosc-2").
    Nazwy bez „/" działają tylko w swoim dokumencie. Rodzaje i wpisy mają wspólne nazwy, każdy rodzaj dokumentów (widoki, wejścia, szablony…) własne: wejście "@q" nie zmieni wpisu "@q".
    W polu-odwołaniu i w odwołaniu komórki ("ref") nazwa, która nigdzie nie prowadzi, wypada (z ostrzeżeniem); w polu tekstowym "@autor/rok" jest tekstem i zostaje.
  Dzieło, osobę, cytat z biblioteki wskazuje się jej kluczem albo identyfikatorem ("@kowalski2020") — tylko z bibliotek, z których korzysta ta baza (Więcej → Ustawienia → Źródła); nie tworzy się ich tutaj.
  Eksport zapisuje trwałe nazwy, a identyfikatory własnych wpisów, rodzajów i dokumentów w widokach, szablonach, powtórkach, przebiegach, zbiorach i formularzach jako "@nazwa" — da się go zaimportować do innej bazy.

Kto czyta: bazę czyta ten, kto czyta jej obszar. W obszarze jawnym (gdy baza jest otwarta: Ustawienia → Kto czyta) każdy, bez konta — cała baza, także odpowiedzi pytań i szkice.
  Pojedynczych wpisów się nie publikuje: to, co ma być publiczne, trafia do osobnej bazy w obszarze jawnym (wpis → Kto widzi → Przenieś; identyfikator zostaje). Moduły stron (powtórka, przebieg, karta wpisu) czytają bazę tak, jak widzi ją czytelnik strony.

"kinds" — rodzaje:
  "name" — nazwa, "label" — wzór etykiety, np. "{givenNames} {surname}", "tells" — pole, które odróżnia imienników,
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
  "blocks" (treść w blokach) — lista bloków: {"type": "paragraph", "text": "zapis"} | {"type": "ordered"|"unordered", "items": [komórka, …]} | {"type": "table", "columns": ["nagłówek", …], "rows": [[komórka, …], …]};
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
  pytanie — JEDEN rodzaj "question"; "form" (rodzaj pytania) mówi, jak się pyta, i od niego zależy, które pola się wypełnia:
    "text" — Odpowiedź słowami: Uczący się wpisuje odpowiedź; liczy się podobieństwo — literówka daje część punktów. Dobrych odpowiedzi może być kilka. Pola: "prompt" (pytanie), "answers" (poprawne odpowiedzi, np. ["siedem", "7"])
    "number" — Liczba: Uczący się wpisuje liczbę, może z jednostką; tolerancja mówi, ile wolno się pomylić. Pola: "prompt" (pytanie), "answers" (poprawne odpowiedzi, np. ["12"]), "unit" (jednostka, np. "N·m"), "quantity" (wielkość, np. "Torque"), "tolerance" (tolerancja, np. 0.5), "relative" (tolerancja względna, np. false)
    "date" — Data: Uczący się wpisuje datę — z dokładnością do roku, miesiąca albo dnia. Pola: "prompt" (pytanie), "answers" (poprawne odpowiedzi, np. ["1410-07-15"]), "precision" (dokładność daty, np. "year"), "tolerance" (tolerancja, np. 0)
    "gap" — Luka w tekście: Tekst z zakrytym słowem — w treści [[słowo]] (albo „…” i dobre odpowiedzi niżej); uczący się wpisuje, czego brakuje. Pola: "prompt" (tekst z luką), "answers" (poprawne odpowiedzi, np. ["Ojczyzno"])
    "one" — Jedna z kilku: Kilka możliwości, dobra jest jedna; kolejność miesza się przy każdym pytaniu. Pola: "prompt" (pytanie), "options" (do wyboru, np. ["Pięć", "Siedem", "Dwanaście"]), "correct" (które są dobre, np. [1])
    "many" — Kilka z kilku: Kilka możliwości, dobrych może być kilka — trzeba zaznaczyć wszystkie. Pola: "prompt" (pytanie), "options" (do wyboru, np. ["Pięć", "Siedem", "Dwanaście"]), "correct" (które są dobre, np. [1])
    "truefalse" — Prawda czy fałsz: Jedno zdanie; uczący się mówi, czy jest prawdziwe. Pola: "prompt" (zdanie), "value" (prawda?, np. true)
    "match" — Połącz w pary: Dwie kolumny (np. rok — wydarzenie); uczący się łączy je w pary. Długa lista pokazuje się po kilka par naraz. Pola: "prompt" (polecenie), "left" (lewa strona, np. ["1410", "1569", "1791"]), "right" (prawa strona, np. ["Bitwa pod Grunwaldem", "Unia lubelska", "Konstytucja 3 maja"]), "leftLabel" (nagłówek lewej strony, np. "Rok"), "rightLabel" (nagłówek prawej strony, np. "Wydarzenie"), "show" (ile par naraz, np. 4)
    "order" — Ułóż w kolejności: Elementy pomieszane; uczący się układa je po kolei. Pola: "prompt" (polecenie), "items" (w dobrej kolejności, np. ["1s", "2s", "2p", "3s"])
    "flash" — Fiszka (sam oceniasz): Przód i odwrotna strona; uczący się odwraca kartę i sam mówi, czy umiał. Pola: "prompt" (przód fiszki), "back" (odwrotna strona, np. ["Najmniejsza część pierwiastka"])
    "point" — Miejsce na mapie: Uczący się wskazuje punkt na mapie; liczy się, czy trafił w promień. Pola: "prompt" (pytanie), "place" (miejsce, np. {"lat": 53.49, "lon": 20.1}), "radius" (promień (m), np. 20000)
    "code" — Kod (Python): Uczący się pisze funkcję w Pythonie; sprawdza ją porównanie z rozwiązaniem wzorcowym na danych testowych. Pola: "prompt" (pytanie), "task" (zadanie, np. "…"), "starter" (początek kodu, np. "def transform(x): …"), "createInput" (dane testowe, np. "def create_input(seed): …"), "reference" (rozwiązanie wzorcowe, np. "def reference(x): …"), "cases" (ile przypadków, np. 5)
    "interactive" — Rysunek do poruszania: Uczący się ustawia rysunek (suwaki, przeciąganie) i sprawdza; dobrze, gdy symulacja osiąga cel. Pola: "prompt" (pytanie), "drawing" (rysunek (JSON), np. "{… JSON rysunku …}"), "goal" (cel (wyrażenie), np. "abs(x - cel) < 0.5"), "solution" (rozwiązanie, np. "v0 = 12")
    wspólne dla każdego: "form" (rodzaj pytania), "prompt" (pytanie), "explain" (wyjaśnienie), "about" (o czym), "needs" (najpierw trzeba znać);
      "about": ["@wpis"] — co pytanie sprawdza: jego wynik liczy się do znajomości tych wpisów, a pytanie czeka, aż opanujesz to, co trzeba znać przed nimi;
      "needs": ["@wpis albo @pytanie"] — co trzeba opanować przed tym pytaniem (pytanie ogólne przed szczegółowym)
    pary: lewa i prawa strona w tej samej kolejności; długa lista z "show" (2–12) — na karcie tyle par, każda para ma swoją kartę, wracają te, których uczący się jeszcze nie umie
    np. {"ref": "@q-lata", "kinds": ["question"], "data": {"form": "match", "prompt": "Połącz rok z wydarzeniem", "left": ["1410", "1569", "1791", "1918"], "right": ["Bitwa pod Grunwaldem", "Unia lubelska", "Konstytucja 3 maja", "Odzyskanie niepodległości"], "leftLabel": "Rok", "rightLabel": "Wydarzenie", "show": 3}}
    np. {"ref": "@q-atom", "kinds": ["question"], "data": {"form": "one", "prompt": "Co jest w jądrze atomu?", "options": ["Elektrony", "Protony i neutrony", "Tylko neutrony"], "correct": [1], "about": ["@atom"]}}
    np. {"ref": "@q-orbital", "kinds": ["question"], "data": {"form": "truefalse", "prompt": "Na jednym orbitalu mogą być najwyżej dwa elektrony.", "value": true, "about": ["@orbital"], "needs": ["@q-atom"]}}
    "gap" — w treści [[słowo]] to luka (uczący się widzi „…”), a bez "answers" dobrą odpowiedzią jest to słowo
    "interactive" — rysunek do poruszania: "drawing" (ten sam JSON co moduł strony „Animacja”: vars, let, sim, controls, rules z "goal": true, world, elements — jako tekst JSON),
    "goal" (wyrażenie celu, np. "abs(x - cel) < 0.5 && y <= 0"; puste — reguły rysunku z "goal"), "solution" ("kat = 45; v0 = sqrt(cel*g)" — rachunek z wartościami rysunku; w świecie także "w2.pos = 5"; puste — "task.solve" rysunku, a jego "task" losuje przy każdej próbie zadanie tak samo trudne);
    sprawdzane przez symulację ustawionych wartości do końca (świat — odtworzony według jego reguł: co zablokowane, zostaje); wartości z "random" losowane przy każdej próbie

"templates" — szablony kart: {"name", "kinds": ["@rodzaj"], "direction": "a→b", "graph": {"nodes": [{"id", "type", "x", "y", "config"}], "edges": [{"id", "from", "out", "to", "in"}]}, "tests"}
  szablon może dotyczyć rodzaju z biblioteki ("quote", "work", "person") albo ze skryptorium ("text", "delivery", "project"), z których korzysta ta baza: wtedy karty powstają z ich wpisów, np. {"name": "Miejsce cytatu", "kinds": ["quote"], "direction": "locator", "graph": …}
  "tests" — co sprawdzają karty szablonu i jak mocno: [{"of": "this" (ten wpis) | "klucz pola-odwołania" (wpisy, na które wskazuje), "weight": 0–10}]; bez "tests": ten wpis z wagą 1.
    Znajomość należy do wpisu, a karta jest jego dowodem: dokładne pytanie waży więcej niż ogólne, jedna karta może liczyć się dla kilku wpisów;
    np. karta „Co się wtedy stało?” faktu: "tests": [{"of": "this", "weight": 1}, {"of": "okres", "weight": 0.3}, {"of": "gdzie", "weight": 0.3}]

Znajomość — liczy ją aplikacja, tak samo wszędzie (nie ustawia się jej w JSON):
  każda odpowiedź zostaje zapisana; karta pamięta tylko kilka wartości: kiedy ostatnio odpowiedziano, ile czasu naprawdę minęło przed tą odpowiedzią, odstęp do następnego razu i najlepszy odstęp przed ostatnim błędem;
  dobrze (od 90%): odstęp = czas, który naprawdę minął × 3 (odpowiedź przed terminem go nie skraca); częściowo: jedna trzecia tego czasu, co najmniej dzień, jeśli minęły dni; źle (poniżej 25%): 5 minut; dobrze zaraz po błędzie: 0,4 × najlepszy odstęp sprzed błędu
    — np. źle po 5 dniach: wraca po 5 minutach; dobrze zaraz potem: za 2 dni; znów dobrze po 2 dniach: za 6 dni;
  znajomość karty: poprawność ostatniej odpowiedzi × 10^(0,5·(1 − czas od odpowiedzi ÷ odstęp)) — zaraz po dobrej 3,16, w dniu powtórki 1 („umiem” od 1), potem spada; po złej 0;
  znajomość wpisu: średnia znajomości jego kart Z ODPOWIEDZIĄ, ważona "weight" z "tests" (karta jeszcze nie pytana nie jest dowodem), plus to, co na nim buduje (pola z "prerequisite" — połowa znajomości tego, co od wpisu zależy — i zależności z Ustawień, z ich wagą)

"revisions" — powtórki: {"name", "graph"} (źródła → kroki → … → jeden „Sposób pytania")
  także kroki wspólne z widokami: {"type": "follow", "config": {"field": "authors", "back": false}} — karty wpisów, do których prowadzi odwołanie (albo, "back": true, które wskazują na te wpisy); {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field", "cmp", "value"}]}}} — karty wpisów spełniających regułę; {"type": "structure", "config": {"dir": "down|up", "one": true}} — karty wpisów, które leżą w strukturze pod tymi wpisami (albo nad nimi); "follow" i "structure" z "keep": true zostawiają też karty, od których wyszły
  źródło „rodzaj z biblioteki": {"type": "source.kind", "config": {"kind": "quote", "from": "<identyfikator biblioteki>"}} — "from" puste: z tej bazy i ze wszystkich źródeł
  źródło „widok”: {"type": "source.view", "config": {"view": "@widok"}} — karty wpisów, które pokazuje zapisany widok: widok decyduje, co wchodzi w grę, powtórka z tego wybiera; zmiana widoku zmienia powtórkę, a jego „Filtry znajomości” na końcu działają w trakcie powtórki
    np. {"name": "Od ogólnego do szczegółu", "graph": {"nodes": [{"id": "w", "type": "source.view", "config": {"view": "@fakty/w-ogolne"}}, {"id": "p", "type": "strategy", "config": {"mode": "temporal", "order": "general"}}], "edges": [{"id": "e1", "from": "w", "out": "cards", "to": "p", "in": "cards"}]}}
  „Filtr znajomości”: {"type": "filter.when", "config": {"when": warunek}} — zostają karty, dla których warunek jest spełniony, sprawdzany W TRAKCIE powtórki przy każdej karcie: co czekało, wchodzi, gdy warunek zacznie obowiązywać; karta już w stosie zostaje
    warunek to ta sama logika co w przebiegach: {"type": "knowness", "rel": "before", "op": "ge", "than": 1} — znajomość tego, co trzeba znać wcześniej, co najmniej 1;
    "rel": "self" (ten wpis) | "cards" (jego karty; w powtórce: ta karta) | "before" (to, co trzeba znać wcześniej — najbliższe wpisy z kartami w kolejności nauki) | "up" (to, pod czym leży w strukturze) | klucz pola-odwołania (to, na co wskazuje, np. "okres");
    "each": "all" (domyślnie — każdy) | "any" (choć jeden); gdy nic takiego nie ma, "all" jest spełnione; "of": "@wpis" zamiast "rel" — znajomość jednego wpisu; warunki łączą "and" / "or" / "not": {"type": "and", "items": [ … ]}
  „Idź po kolejności nauki”: {"type": "learning", "config": {"dir": "before" | "after", "one": true, "keep": true}} — karty tego, co trzeba znać wcześniej (albo, "after", co na tym buduje), aż do podstaw albo ("one") o krok; "keep": true dokłada je do kart wyjściowych
  „Sposób pytania” ("strategy"): {"mode": "temporal" (według tego, co umiem) | "levels" | "once" | "random", "order", "pick", "stackSize", "count", "levels", "minCorrectness", "rule"}
    "order" — kolejność: "general" (najpierw ogólne — według poziomów kolejności nauki) | "text" (jak w tekście źródła — miejsce w dziele) | "date" (według najwcześniejszej daty wpisu) | "random" | "given" (jak przychodzą) | "due" (najpierw zaległe); bez "order": w stosie "general", w stałej kolejce "random"
    "pick" — wybór ze stosu: "next" (ściśle następna według kolejności) | "weighted" (losowo, częściej to, co słabiej znane i dłużej czeka; domyślnie); przy każdej karcie uczący się widzi, dlaczego przyszła
  „Najpierw podstawy” to zwykłe kroki: {"type": "learning", "config": {"dir": "before", "keep": true}} → {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "before", "op": "ge", "than": 1}}} → „Sposób pytania” z "order": "general"; dawny krok "gate" import i eksport zamieniają na nie
"flows" — przebiegi: {"name", "look": "reading|slides|scenes|dialogue|flashcards|map", "start", "graph", "slots", "goals", "lines", "narrators"}
  "narrators" — kto opowiada, według wartości: [{"character": "@piotr", "condition": {"type": "value", "value": "przewodnik", "op": "eq", "than": 1}}, {"character": "@maria"}] — opowiada pierwszy, którego warunek jest spełniony (bez warunku: zawsze); jego portret i imię stoją nad krokiem i zapowiadają jego tytuł
  krok "scene" {"page": "adres/strony", "scene": "klucz sceny", "title"} — scena prezentacji; wyjścia "next", przy pytaniu na scenie "right" / "wrong", przyciski "b0", "b1", …
  przebieg z prezentacji (jedna opowieść, nie kopia): {"name": "Droga", "look": "scenes", "presentation": "parafia/droga", "narrators": […]} — bez własnego "graph": jego mapą jest storyboard strony (sceny, przejścia, pytania, warunki, wartości — "story" w JSON strony); w Nauce gra tę prezentację, a odpowiedzi, wartości i miejsce, w którym ktoś skończył, liczą się w tej bazie (to samo miejsce co na stronie); zobaczy ją tylko ten, kto może zobaczyć stronę
"collections" — zbiory: {"name", "rule": {"op": "and|or", "items": [{"field", "cmp", "value"}]}, "list": ["@wpis"]}
"views" — widoki (te same kroki co powtórka, po wpisach): {"name", "mode": "table|tree|matrix|map|canvas", "steps": [krok, …], "query", "group", "matrix", "columns": ["klucz pola" | "#axis:@oś"], "sort": {"key", "dir": 1|-1}}
  na początku źródła — kilka pod rząd sumuje się (np. kazania i komentarze): "source.all" | "source.kind" {"kind": "@rodzaj" albo "text" ze skryptorium, "from"} | "source.collection" {"collection": "@zbiór"} | "source.list" {"ids": ["@wpis"]};
  także "source.from" {"entry": "@kazanie"} — to, na co wskazuje wpis (kazanie: jego cytaty, wypowiedzi, słowa ze słownika, miejsca z planu; w powtórce: „Z wpisu" — powtórka z kazania);
  potem "follow" {"field", "back"}, "structure" {"dir": "down|up", "one": true} (po polach struktury — bez "one": do samego końca; "one": true — jeden poziom) i "filter.rule" {"rule"} (źródło po innym kroku zaczyna od nowa);
  także "filter.when" {"when": warunek} i "learning" {"dir", "one", "keep"} — te same co w powtórce; w widoku liczy się znajomość tego, kto patrzy (uczącego się na tym koncie; na stronie — osoby strony albo tej przeglądarki),
    np. fakty okresu dopiero, gdy okres jest znany: {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "okres", "op": "ge", "than": 1}}}; tylko wpisy, których podstawy są znane: "rel": "before";
  kolumny i "sort" ze znajomości: "#knowness" (znajomość wpisu), "#due" (kiedy powtórzyć), "#level" (poziom w kolejności nauki), np. "sort": {"key": "#knowness", "dir": 1} — najpierw najsłabsze;
  "mode": "outline" (Struktura) rysuje źródła jako korzenie, a pod nimi to, do czego prowadzą kroki; "outline": {"chip": "klucz pola nad każdym krokiem (np. rola)", "order": "tree|text" (bez "order": ostatni wybór czytelnika, a na początek kolejność tekstu u Tomasza i drzewo w innych dziełach), "by": "klucz pola, według którego najpierw układają się kroki jednego poziomu (np. czas — czas opowieści; bez "by": według miejsca w dziele)", "tie": "klucz pola przy tym samym miejscu (np. nr)"};
    widok otwarty od wpisu (wejście z Biblioteki) zastępuje tym wpisem wszystko przed pierwszym „Idź po…”; np. {"name": "Wywód", "mode": "outline", "steps": [{"type": "source.kind", "config": {"kind": "@krok"}}, {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field": "nalezy", "cmp": "empty"}]}}}, {"type": "structure", "config": {"dir": "down"}}], "outline": {"chip": "rola", "order": "tree", "tie": "nr"}}
  grupowanie (drzewo "group", wiersze i kolumny "matrix": {"rows": grupowanie, "cols": grupowanie}): {"by": "kind"} | {"by": "field", "field": "klucz"} | {"by": "axis", "kind": "@rodzaj", "via", "through", "sort", "group"} — OŚ: jej wartości to wpisy rodzaju
    "via": ["pole"] — przez które pola-odwołania wpis należy do wartości (puste: przez dowolne); "through": "pole" albo "*" — także o jeden krok dalej (wpis → przez to pole → inny wpis → przez "via" → wartość)
    "sort": {"field": "numer"} — kolejność według pola liczbowego wartości, albo {"list": "@rozaniec", "field": "tajemnice"} — według kolejności w polu-odwołaniu innego wpisu; bez "sort" — według nazwy
    "group": "czesc" — nagłówki: pole-odwołanie wartości (np. część tajemnic); w macierzy nad kolumnami i między wierszami
  kolumna "#axis:@rodzaj" — wartości tej osi (wpisy rodzaju), na które wskazuje wpis
  np. {"name": "Postacie według okresu", "mode": "tree", "steps": [{"type": "source.kind", "config": {"kind": "@postac"}}], "group": {"by": "axis", "kind": "@okres", "via": ["okres"], "sort": {"field": "od"}}}
  np. macierz 20 × 12 — Tajemnica × Obszar: {"name": "Tajemnica × Obszar", "mode": "matrix", "steps": [{"type": "source.kind", "config": {"kind": "text"}}, {"type": "source.kind", "config": {"kind": "@komentarz"}}], "matrix": {"rows": {"by": "axis", "kind": "@tajemnica", "sort": {"field": "numer"}, "group": "czesc"}, "cols": {"by": "axis", "kind": "@obszar", "group": "grupa"}}}
    — 20 tajemnic różańca (w czterech częściach) × 12 maryjnych obszarów (w grupach); w polu: kazania ze skryptorium (rodzaj tekstu „Kazanie maryjne” z polami "tajemnica" i "obszar") i komentarze, których "about" wskazuje tajemnicę i obszar; puste pola też są widoczne
  na stronie: moduł "view" {"library": "<id bazy>", "view": "<id widoku>", "mode": "tabela|drzewo|macierz|mapa"} — pole macierzy (klik) i wpis otwierają się pod spodem, droga w adresie osobno dla każdego modułu
"anchors" — wejścia z Biblioteki: {"ref", "name", "work": "@klucz dzieła albo identyfikator", "locator": "s. 45–60" | "s. 1–3; 27–30" | "I q. 2 a. 3; a. 4" | "" (całe dzieło), "entry": "@wpis tej bazy (nie dzieło)", "view": "@widok albo jego nazwa", "note"}
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
  Odpowiedzi: każda zapisuje się zaszyfrowana w przeglądarce — dla uczącego się i dla obszaru przyjęć kursu (Ustawienia), gdzie nauczyciel widzi „Postępy”; z nich liczy się znajomość kart i wpisów. Serwis nie czyta odpowiedzi; widzi tylko, kiedy następna powtórka i ile kart czeka — na osobę i bazę (do przypomnienia).
  Strony: moduły „Widok” (tabela, drzewo, macierz, mapa), „Powtórka”, „Kurs / opowieść”, „Karta wpisu” czytają bazę tak, jak widzi ją czytelnik strony; uczy się osoba strony (zalogowana — ona sama, bez konta — ta przeglądarka).
  Inne bazy wiedzy, które korzystają z tej jako źródła, widzą jej rodzaje, wpisy, szablony, powtórki i przebiegi tylko do odczytu; link dla AI i MCP czytają ją bez zmian.
  Kto czyta: ten, kto czyta jej obszar (w obszarze jawnym — każdy); wpisy są szyfrowane kluczem obszaru.
  Import niczego nie usuwa i nie dotyka odpowiedzi ani postępów: nowa karta zaczyna bez historii, a karta, której poprawna odpowiedź się zmieniła, zaczyna historię od nowa (zmiana wag "tests" historii nie zmienia).
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
- "form" — Rodzaj pytania (choice; do wyboru: "text", "number", "date", "gap", "one", "many", "truefalse", "match", "order", "flash", "point", "code", "interactive"): Jak się pyta i odpowiada — od tego zależy, które pola niżej się wypełnia: text (Odpowiedź słowami), number (Liczba), date (Data), gap (Luka w tekście), one (Jedna z kilku), many (Kilka z kilku), truefalse (Prawda czy fałsz), match (Połącz w pary), order (Ułóż w kolejności), flash (Fiszka (sam oceniasz)), point (Miejsce na mapie), code (Kod (Python)), interactive (Rysunek do poruszania)
- "prompt" — Pytanie (markup): Treść pytania; przy „Prawda czy fałsz” — zdanie, przy fiszce — jej przód, przy luce — tekst z luką [[słowo]]
- "answers" — Poprawne odpowiedzi (list; tylko gdy form: text, number, date, gap): Przyjmowane odpowiedzi (text, number, date, gap) — pierwsza jest wzorcowa
- "options" — Do wyboru (list; tylko gdy form: one, many): Możliwości (one, many)
- "correct" — Które są dobre (list; tylko gdy form: one, many): Numery dobrych możliwości, od 0 (one, many)
- "value" — Prawda? (bool; tylko gdy form: truefalse): Czy zdanie jest prawdziwe (truefalse)
- "left" — Lewa strona (list; tylko gdy form: match): Lewa strona par, np. lata (match)
- "right" — Prawa strona (list; tylko gdy form: match): Prawa strona par, w tej samej kolejności, np. wydarzenia (match)
- "leftLabel" — Nagłówek lewej strony (line; tylko gdy form: match): Nad lewą kolumną karty, np. „Rok” (match)
- "rightLabel" — Nagłówek prawej strony (line; tylko gdy form: match): Nad prawą kolumną karty, np. „Wydarzenie” (match)
- "show" — Ile par naraz (number; tylko gdy form: match): Długa lista: tyle par na jednej karcie (2–12) — każda para ma wtedy swoją kartę, a resztę miejsc zajmują losowe inne pary; puste: wszystkie pary na jednej karcie (match)
- "items" — W dobrej kolejności (list; tylko gdy form: order): Elementy w poprawnej kolejności (order)
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
- "place" — Miejsce (geo; tylko gdy form: point): Szukany punkt: {"lat": …, "lon": …} (point)
- "radius" — Promień (m) (number; tylko gdy form: point): Jak blisko trzeba trafić, w metrach (point)
- "drawing" — Rysunek (JSON) (text; tylko gdy form: interactive): Rysunek do poruszania — ten sam JSON co w module „Animacja” strony: vars, sim, controls, rules (z "goal": true — cel), world (rzeczy do budowania, np. waga), elements (interactive)
- "goal" — Cel (wyrażenie) (line; tylko gdy form: interactive): Kiedy odpowiedź jest dobra, np. "abs(x - cel) < 0.5 && y <= 0" — liczone w symulacji do końca; puste: reguły rysunku z "goal": true (interactive)
- "solution" — Rozwiązanie (line; tylko gdy form: interactive): Wartości, które rozwiązują zadanie, np. "kat = 45; v0 = 12" albo własności rzeczy "w2.pos = 5" — pokazywane po złej odpowiedzi; puste: "task.solve" rysunku (interactive)
- "explain" — Wyjaśnienie (ref; kilka): Wpisy pokazywane po odpowiedzi (np. wypowiedź z treścią w blokach)
- "about" — O czym (ref; kilka): Wpisy, które to pytanie sprawdza: jego wynik liczy się do ich znajomości, a samo pytanie czeka, aż opanujesz to, co trzeba znać przed nimi
- "needs" — Najpierw trzeba znać (ref; kilka; kolejność nauki up): Wpisy albo pytania, które trzeba opanować, zanim padnie to pytanie (np. „Czym jest atom?” przed „Czym jest orbital?”)
Sposoby dodawania: „Prawda czy fałsz — wiele naraz”, „Pytania z odpowiedzią słowami — wiele naraz”, „Jedna z kilku — wiele naraz (pierwsza możliwość jest dobra)”, „Fiszki — wiele naraz”.
Widoki: „Pytania według rodzaju”.
```
<!-- app:template-kinds:end -->
