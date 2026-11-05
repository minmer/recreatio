# Przewodnik dla AI: wspólnota (diecezja, rejon, krąg, szkoła, chór, turnus) jako JSON

Ten przewodnik mówi, jak asystent AI przygotowuje CAŁĄ wspólnotę w Recreatio jako jeden dokument
`recreatio/community`, który człowiek importuje w aplikacji i zatwierdza po obejrzeniu planu. Asystent niczego nie
zapisuje sam i nie widzi instancji użytkownika. Opisane jest to, co aplikacja **robi dziś** (sprawdzone w kodzie i
testami, stan 2026-11-05); czego nie robi — stoi w „Ograniczeniach”. Nie obiecuj niczego spoza tego tekstu.

Format pól: `get_import_format("community")`. Przykłady: `example-community-dk-krakow` (wzorzec: archidiecezja →
rejony → kręgi, bez osób), `example-community-dk-rejon-13`, `example-community-dk-rejon-1`, `example-community-szkola`,
`example-community-oaza`, `example-community-turnus`, `example-community-chor`, `example-community-grupa-nauki`.
Dodatkowe części obszaru (`extra`) mają format `get_import_format("area")`.

## 1. Model — co jest czym

| pojęcie | czym jest w aplikacji | uwaga |
|---|---|---|
| **jednostka** (`unit`) | jeden **obszar** (area) z rodzicem; drzewo dowolnie głębokie | treści (kalendarz, rozmowy, strony, formularze) należą do obszaru |
| **pozycja** (`positions`) | **rola obszaru** jednostki („Para animatorska · Krąg Kalinowe 1”) z poziomem read/write/admin | definiowana raz, używana w wielu jednostkach |
| **osoba** (`persons`, `people`) | wpis w zapieczętowanym dokumencie wspólnoty (imię widzi tylko przeglądarka) + **jeden osobisty link** ze wszystkimi jej rolami | osoba NIE jest kontem |
| **konto** | rejestracja w Recreatio (login + hasło, klucze) | osoba może działać bez konta; edycja stron wymaga konta (pkt 5) |
| **osobisty link** | rola-link trzymająca role osoby; otwiera `#/moje`; 365 dni | tworzy go import; zmiana miejsc osoby → NOWY link, stary przestaje działać |
| **link roli** (`intake.mode: "link"`) | jeden link dołączania do pozycji uczestnika/członka | dla wielu osób naraz, nie osobisty |
| **para** (`"pair": "<klucz osoby>"`) | tylko informacja o małżonku (wyświetlanie) | nic nie nadaje |
| **pozycja parowa** (`"pair": true`) | pozycja na dwie osoby | obie osoby trzymają TĘ SAMĄ rolę → identyczne prawa, dwa osobne linki; w rozmowach każdy pisze jako „Imię Nazwisko (Rola)” |
| **kilka miejsc** (`places`) | jedna osoba, wiele ról w jednym linku | prawa = najwyższy poziom w każdym obszarze |
| **grono** (`council`) | osobny obszar pod jednostką, z własną rozmową | skład liczy się sam z obsady |

## 2. Uprawnienia — jak powstają

Prawa pozycji (`rights`) → poziom roli w JEJ jednostce i dostęp w innych obszarach (`desiredAccess`, `communityCompile.ts`):

| `rights` | w swojej jednostce | w jednostkach poniżej | wyżej |
|---|---|---|---|
| `lead` (prowadzenie) | admin + trzyma pozostałe pozycje jednostki (może dawać ich linki) | **admin we wszystkich, bez wyjątku** | tylko przez `subunitsSee` (read) |
| `accompany` (towarzyszenie, np. moderator) | read | read we wszystkich | j.w. |
| `cooperate` (współpraca) | write | nic | j.w. |
| `member` (członkostwo) | **write** | nic | j.w. |
| `participant` (uczestnictwo) | read | nic | j.w. |

Dodatkowo:
- `visibility.subunitsSee: true` w jednostce X → **każda pozycja każdej jednostki pod X dostaje read w X** (widzą kalendarz,
  stronę dla członków, rozmowę X). Nie dziedziczy się na jednostki pod X — ustaw osobno (np. w planie budowy).
- `council` w jednostce X → obszar grona: pozycje `lead` jednostki X = admin, pozycje z `own` = write, pozycje z `below`
  w jednostkach BEZPOŚREDNIO pod X = write. Członkowie nie.
- Nie da się ograniczyć `lead` na niższym poziomie, ani nadać „tylko kalendarz” — poziom dotyczy całego obszaru.
- Strukturę wspólnoty (dokument) zapisuje tylko konto z prawem admin w obszarze NAJWYŻSZEJ jednostki.

Co daje poziom w obszarze (sprawdza usługa — `Area.MayAsync` — a treść jest zaszyfrowana kluczem obszaru, który dostaje
tylko rola z dostępem; ukrycie w interfejsie to tylko wygoda):

| operacja | read | write | admin |
|---|---|---|---|
| czytać kalendarz, stronę „tylko z dostępem”, rozmowę obszaru | ✔ | ✔ | ✔ |
| pisać w **rozmowie obszaru** (`chats: "area"`) | ✔ | ✔ | ✔ |
| pisać w **kanale ogłoszeń** (`chats: "channel"`) | — (czyta) | ✔ | ✔ |
| dodawać / zmieniać / usuwać terminy kalendarza, formularze, wpisy | — | ✔ | ✔ |
| role, członkowie, linki, ustawienia, administrator danych, rozmowy obszaru zakładać | — | — | ✔ |

**Strony to osobny mechanizm** (pkt 5): edytuje je rola, która **prowadzi adres**, nie poziom w obszarze.

## 3. Kalendarze

- Każdy obszar ma swój kalendarz. Czytają go wszyscy z read w obszarze, piszą wszyscy z write/admin.
  `member` = write → zwykły członek MOŻE dodawać terminy. Gdy ma tylko czytać, daj `participant`.
- Para rejonowa (`lead`) ma admin w każdym kręgu poniżej → widzi i zmienia wszystkie terminy kręgów, z pełnymi danymi.
- Widok zbiorczy: **Kalendarz** w warsztacie (`#/workspace/calendar`) pokazuje wszystko, co osoba może czytać — te same
  wpisy, nie kopie.
- Termin regionu wpisany raz jest widoczny dla członków kręgów, gdy region ma `visibility.subunitsSee: true` (czytają
  kalendarz regionu). Sąsiednie kręgi nie widzą swoich kalendarzy (brak dostępu = usługa nie wydaje wpisów).
- Widoczność POJEDYNCZEGO terminu: `extra.appointments[].publish` (`"area"` — ten obszar, `"auto"`, albo identyfikator
  innego obszaru) — ten sam wpis pokazuje się tam, nie powstaje duplikat.
- Strona publiczna z modułem kalendarza pokazuje anonimowym gościom TYLKO terminy, których obszar widoczności jest
  jawny (Obszar → „Dla wszystkich”: „Każdy czyta”). Terminy wewnętrzne nie wyciekają przez moduł (filtruje usługa,
  `Calendar.Read.cs`). Obszar jednostki domyślnie NIE jest jawny → moduł „Terminy” na stronie publicznej jest pusty dla
  gości, dopóki terminy nie trafią do jawnego obszaru (pkt 7).

## 4. Rozmowy

| ustawienie | co powstaje | kto pisze |
|---|---|---|
| `tools.chat: true` | rozmowa obszaru jednostki (jedna na obszar; powtórny import jej nie dubluje) | każdy z read w obszarze — z `subunitsSee` także członkowie kręgów poniżej |
| `tools.announcements: true` | kanał ogłoszeń obszaru | write/admin obszaru; reszta czyta |
| `tools.askLeaders: true` | moduł „Napisz do prowadzących” na stronie dla członków | odpowiadają pozycje `lead`/`accompany` |
| `council` | osobny obszar + jego rozmowa | skład z obsady (pkt 2) |
| `extra.chats` | **zastępuje** listę z `tools.*` (np. `["area"]`, `["channel"]`, `[{ "kind": "area", "forms": [...] }]`) | j.w. |
| `tools.chat: false` | nic — rozmowy nie ma; prowadzący jednostki (admin) może ją później założyć ręcznie w obszarze | — |

Warunek: **administrator danych** (pkt 9, krok 3). Bez niego rozmowy, formularze i treść stron publicznych nie
powstają (import pisze ostrzeżenie); po jego wskazaniu ten sam import tworzy je. Rozmowa założona ręcznie zostaje przy
kolejnych importach (import niczego nie usuwa).

## 5. Strony, adresy, publikacja

- **Adres** (`address`, ścieżka `recreatio.pl/<ścieżka>`): najwyższa jednostka ma `address` (np. `"dk/krakow"`), jednostki
  poniżej dostają `<adres rodzica>/<klucz>` (np. `dk/krakow/rejon-5/kalinowe-1`), chyba że mają własny `address`.
  Adres najwyższego poziomu (jeden człon, np. `dk`) zajmuje się **kodem od operatora** (Strony → „Zajmij adres”); adresy
  pod nim otwiera bez kodu ten, kto prowadzi adres nadrzędny. Alias i domena to tylko drugie drogi do istniejącego adresu.
- Jednostka dostaje stronę dla członków (`access: members`) zawsze; publiczną — gdy `public.page: true` albo zapisy
  (`intake.mode: "signup"`). Bez strony publicznej strona dla członków stoi POD adresem jednostki; z publiczną — pod
  `<adres>/dla-nas`.
- **Kto prowadzi adres** (edytuje stronę, otwiera podstrony, robi je publicznymi) — `pagesBy` jednostki albo planu
  budowy: `{ "inside": "<pozycja>", "public": "<pozycja>" }`; pozycja tej jednostki albo z `^` — jednostki wyżej
  (`"^para-rejonowa"`). Bez `pagesBy` adresy prowadzi osoba, która importuje. Wygrywa NAJBLIŻSZY prowadzony adres
  (`Access.OfAsync`): kto prowadzi `…/kalinowe-1`, ten decyduje o wszystkim pod nim; prowadzący rejon nie edytuje strony
  kręgu, którą przekazano kręgowi.
- Edycja stron wymaga **konta**, które trzyma tę rolę (osoba otwiera swój link zalogowana i dołącza go do konta). Sam link
  bez konta czyta i pisze w rozmowie/kalendarzu, ale nie edytuje stron.
- Strona „tylko z dostępem” sprawdza dostęp sama (usługa: 403 dla innych). Dostęp **nie dziedziczy się** po ścieżce:
  podstrona strony dla członków może być publiczna.
- **Zatwierdzanie publikacji przez rejon NIE jest wymuszane technicznie.** Kto prowadzi adres, może pod nim opublikować
  stronę publiczną. Do wyboru: (a) krąg prowadzi swój adres (`pagesBy.inside: "para-animatorska"`) — sam edytuje stronę
  wewnętrzną, ale technicznie MOŻE też publikować; zgoda rejonu jest regułą organizacyjną; (b) adres kręgu prowadzi
  rejon (`pagesBy.inside: "^para-rejonowa"`) — publikacja tylko przez rejon, ale krąg nie edytuje swojej strony (pisze
  w kalendarzu i rozmowie). Nie twierdź, że (a) wymusza zgodę rejonu.
- Moduły stron (`extra.pages[].page.modules`, format `page`) — moduł kalendarza: `"calendars": "@kalendarz"` (kalendarz
  obszaru) albo identyfikatory kalendarzy (znane dopiero po imporcie).
- Widżet (`#/widget/<partId>/<strona>`, `public/widget.js`) pokazuje dokładnie to, co gość widzi na stronie — nie
  zmienia modelu dostępu.

## 6. Wspólna strona kilku kręgów (np. parafii)

Nie zmieniaj struktury organizacyjnej. Dodaj **jednostkę redakcyjną** obok kręgów (pod rejonem), np.
`{ "key": "parafia-x-strona", "name": "DK parafii X — strona", "positions": ["redakcja"], "pagesBy": { "public": "redakcja" },
"settings": { "public": { "page": true } } }` z pozycją `{ "key": "redakcja", "rights": "cooperate" }` i daj osobom z
kilku kręgów dodatkowe miejsce w `places`. Terminy na tej stronie: moduł kalendarza z identyfikatorami kalendarzy
kręgów — drugi etap (pkt 9), gdy identyfikatory są znane; goście zobaczą tylko terminy z jawnego obszaru.

## 7. Terminy publiczne regionu — bezpiecznie

Nie rób obszaru rejonu jawnym (jawny = każdy czyta WSZYSTKO w obszarze, także rozmowę). Zamiast tego: jednostka
„Rejon V — publiczne” (bez osób), w aplikacji ustawiona „Dla wszystkich: Każdy czyta”, a terminy publiczne regionu
w `extra.appointments` regionu z `"publish": "<id tej jednostki>"` (drugi etap). Jawność obszaru ustawia się ręcznie
(Obszary → obszar → „Dla wszystkich”) — import jej nie zmienia (decyzja bezpieczeństwa).

## 8. Import — co robi z dokumentem

- Kolejność: obszary (nowe, zmiana nazwy, przeniesienie) → dla każdej jednostki od góry jej dokument obszaru (role,
  terminy, strony z właścicielami adresów, podformularze, rozmowy) → dostępy z drzewa (dodaje brakujące, zabiera tylko
  te, które sama kiedyś dała) → linki osób → zapis stanu. Nie ma jednej transakcji: błąd jednej jednostki to
  ostrzeżenie, reszta idzie dalej; **ten sam JSON zaimportowany ponownie naprawia braki** i niczego nie dubluje.
- Tożsamość = klucze (`key` jednostki, pozycji, osoby, grona; strony i terminy — klucze w `extra`). Zmiana klucza = nowa rzecz.
- Brak w dokumencie ≠ usunięcie (jednostki i osoby z poprzedniej wersji zostają). `"remove": true` — jednostka:
  dostępy zabrane, obszar i treści zostają; osoba: jej link przestaje działać.
- Przeniesienie jednostki: zmień miejsce w drzewie — obszar się przepina, dostępy przeliczają (para rejonowa traci krąg).
- Zmiana planu budowy zmienia wszystkie jednostki z tego planu (poza tym, co jednostka ustawiła sama).
- Wymiana pary: wpisz nowe osoby na pozycję, starym usuń miejsce albo `remove` → nowe linki, stare wygasają; treści
  zostają przy pozycji.
- Koszt: każda nowa rola i link to liczenie kluczy w przeglądarce (kilka sekund). Archidiecezja z kilkunastoma
  kręgami: kilka minut; bardzo duże — importuj rejon po rejonie.

## 9. Praca asystenta BEZ dostępu do instancji

**Zapytaj człowieka** (nie zgaduj): czy ma już adres najwyższy (np. `dk`) i pod jakim adresem ma stać wspólnota;
czy to nowa wspólnota czy zmiana istniejącej (wtedy poproś o eksport: zakładka JSON → „Pokaż JSON” i zmieniaj TEN
dokument); kto ma prowadzić strony kręgów (wariant a/b z pkt 5); czy członkowie mają pisać w kalendarzu (`member`) czy
tylko czytać (`participant`); osoby — imiona wpisze człowiek (nie wymyślaj).

**Bezpieczne domyślne**: brak `persons` (dopisze człowiek), `intake.mode: "leaders"`, `participant` dla członków,
`tools.chat: false` w kręgach, brak `public.page` w kręgach. **Niebezpieczne założenia**: identyfikatory obszarów
(`area`), kalendarzy, ról — nigdy ich nie wymyślaj; `visibility.default: "public"`; jawność obszaru.

**Generowanie**: same klucze i odwołania względne (`from`, pozycje po kluczu, `^pozycja`, `@kalendarz` w modułach).
Klucze: małe litery, cyfry, `-`, `_` (do 40 znaków; pozycje do 32), bez imion i nazwisk.

**Sprawdzenie przed importem** (statycznie): każdy `from` istnieje w `blueprints`; każda pozycja jednostki/planu istnieje
w `positions`; `places[].unit` i `position` istnieją i pozycja należy do tej jednostki; klucze unikalne; `council.own`
to pozycje tej jednostki, `council.below` — pozycje jednostek bezpośrednio pod nią; `pagesBy` wskazuje istniejącą
pozycję (z `^` — na danym poziomie wyżej); `intake.mode: "signup"` ma pozycję `participant`/`member`.

**Import w aplikacji** (etykiety interfejsu):
1. Adres najwyższy: Strony → „Zajmij adres” (kod od operatora) — pomiń, gdy człowiek już go prowadzi (np. `dk`).
2. Warsztat → **Wspólnoty** → „Nowa wspólnota z JSON” (zmiana: wspólnota → zakładka **JSON**) → wklej → **plan**.
   Zatrzymaj się, gdy plan ostrzega o: brakującej pozycji/jednostce, osobie bez miejsca, „nie ma … w nowym dokumencie”
   (oznacza zmianę, której nie chciano), adresie nadrzędnym należącym do kogoś innego.
3. „Zapisz zmiany” → **skopiuj nowe linki** (później: zakładka „Osoby” → „Kopiuj link”).
4. Obszary → najwyższa jednostka → Ustawienia → „Administrator danych” (jednostki poniżej go dziedziczą).
5. Ten sam JSON jeszcze raz (albo „Zapisz zmiany”) — teraz powstają rozmowy, kanały i treść stron publicznych.
6. Osoby prowadzące strony: otwierają link zalogowane i dołączają go do konta.

**Sprawdzenie po imporcie**: w Wspólnoty → Struktura drzewo jak w dokumencie; w obszarze jednostki „Zarządzane przez
wspólnotę”; link członka kręgu otwiera `#/moje` z jego kręgiem i rejonem, a adres sąsiedniego kręgu daje „tylko dla osób,
które mają dostęp”; strona dla członków bez logowania — odmowa; Rozmowy — rejon ma rozmowę i kanał, kręgi bez rozmowy
(jeśli tak ustawiono), grono rejonowe ma swoją rozmowę.

**Drugi etap** (gdy znane są identyfikatory): moduły kalendarzy z kilku obszarów, `publish` terminów do jawnego obszaru,
`area` przy przejmowaniu istniejących obszarów — człowiek podaje identyfikatory z aplikacji albo eksportu.

## 10. Wzorzec Domowy Kościół (`example-community-dk-krakow`) — stan wymagań

| wymaganie | stan |
|---|---|
| drzewo `dk/krakow` → rejony → kręgi, plany „rejon” i „krąg”, rozbudowa później | importowalne, sprawdzone |
| administrator archidiecezji zarządza wszystkim | importowalne (`lead` w korzeniu = admin wszędzie poniżej); dokument wspólnoty zapisuje tylko admin korzenia |
| para rejonowa zarządza rejonem i widzi kalendarze kręgów | importowalne (`lead` = admin w kręgach rejonu, nic w innym rejonie) |
| para animatorska prowadzi swój krąg, bez dostępu do innych | importowalne |
| członek: swój krąg + rejon + archidiecezja, bez sąsiednich kręgów | importowalne (`subunitsSee` w rejonie i korzeniu) |
| każdy z małżonków osobny link, identyczne prawa | importowalne (`pair: true`, dwie osoby na pozycji) |
| rozmowa rejonu dla wszystkich kręgów, kanał ogłoszeń, krąg rejonowy | importowalne (po wskazaniu administratora danych) |
| rozmowa kręgu nie zakładana z góry | importowalne (`tools.chat: false`); założenie później ręcznie przez prowadzących |
| para animatorska edytuje stronę wewnętrzną kręgu | **wcześniej ręcznie, teraz importowalne** (`pagesBy`, 2026-11-05); wymaga konta |
| publiczna strona kręgu tylko za zgodą rejonu | **nie wymuszane** — reguła organizacyjna (pkt 5) |
| zapraszanie tylko w swojej jurysdykcji | częściowo: osoby i linki dodaje admin korzenia; prowadzący kręgu może dawać linki pozycji swojego kręgu (trzyma je); para rejonowa nie wystawia linków członków kręgów |
| edycja kalendarza dla wybranych członków bez innych praw | brak: poziom write obejmuje cały obszar (kalendarz, formularze, kanał) |
| terminy regionu publicznie bez odsłaniania wewnętrznych | możliwe, drugi etap + ręczna jawność osobnego obszaru (pkt 7) |

## 11. Czego nie obiecywać

- że rejon „zatwierdza” strony publiczne kręgów — tego nie ma technicznie;
- osobnych praw „tylko kalendarz”, „tylko zaproszenia”, „tylko publikacja” — są tylko read/write/admin obszaru i
  prowadzenie adresu;
- że link bez konta edytuje strony;
- że rozmowy powstaną bez administratora danych;
- limitów miejsc i list rezerwowych (`intake.limit`, `intake.waitlist`) — to tylko tekst na stronie zapisów;
- że usunięcie z dokumentu usuwa obszar, treści albo rozmowy — nic nie jest kasowane;
- ankiet, obecności, tabel, lekcji, Cogity „z automatu” — to osobne narzędzia i formaty.

## Typowe błędy

- Klucze z polskimi znakami albo spacjami; imię w nazwie jednostki, kluczu albo adresie (usługa widzi klucze i adresy).
- Fikcyjne typy („typ: chór”) — nie ma typów; są tylko ustawienia i przykłady.
- `"intake.mode": "signup"` bez pozycji `participant` albo `member`.
- Dane zdrowia, diety, telefon rodzica jako zwykłe pola — oznacz `"leadersOnly": true`; dla niepełnoletnich `"intake.minors": true`.
- `member` dla członków, którzy mają tylko czytać — wtedy `participant`.
- `public.page: true` w planie kręgu, gdy publikacja ma iść przez rejon.

## Odpis dla człowieka

Po przygotowaniu dokumentu napisz krótko: ile jednostek, pozycji, osób; kolejność kroków z pkt 9; które linki trzeba
rozesłać; czego import nie zrobi (pkt 11) i co jest regułą organizacyjną, a nie zabezpieczeniem.
