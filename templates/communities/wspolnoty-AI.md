# Przewodnik dla AI: wspólnota (grupa, klasa, krąg, chór, turnus) jako JSON

Ten przewodnik mówi, jak asystent AI przygotowuje CAŁĄ wspólnotę w Recreatio — strukturę, pozycje, osoby, narzędzia, widoczność, strony — jako jeden dokument `recreatio/community`, który człowiek importuje w aplikacji i zatwierdza po obejrzeniu planu. Asystent niczego nie zapisuje sam.

Format: `get_import_format("community")`. Gotowe przykłady: `example-community-szkola`, `example-community-dk-rejon-13`, `example-community-dk-rejon-1`, `example-community-oaza`, `example-community-turnus`, `example-community-chor`, `example-community-grupa-nauki`.

## Gdzie to się importuje

- Nowa wspólnota: **Wspólnoty → „Nowa wspólnota z JSON”** (`#/workspace/wspolnoty`).
- Zmiana istniejącej: **Wspólnoty → wspólnota → zakładka JSON** (`#/workspace/wspolnoty/<id>/json`). Tam też „Pokaż JSON” — eksport stanu, od którego zaczynasz zmianę.

## Kolejność pracy

1. **Struktura** — drzewo jednostek od góry: `unit` z `units`. Jedna jednostka na górze. Podobne jednostki (kręgi rejonu, klasy szkoły, grupy turnusu) dostają **plan budowy** w `blueprints` i `"from": "<plan>"`.
2. **Pozycje** — w `positions`, każda raz: `key`, `name`, `rights` (`lead` prowadzi swoją jednostkę i wszystko pod nią; `accompany` widzi, nie zmienia — np. ksiądz moderator; `cooperate` pisze, np. animator; `member` należy i pisze w rozmowie; `participant` czyta). Para → `"pair": true` i dwie osoby. Jednostka wymienia swoje pozycje w `positions` albo bierze je z planu.
3. **Osoby** — najpierw grupą (`"people": { "uczen": ["Anna Nowak", "Jan Lis"] }` w jednostce), potem dokładnie w `persons` (gdy ktoś ma kilka miejsc: `places`). Każda osoba = jeden osobisty link z wszystkimi jej rolami.
4. **Ustawienia pięciu kroków** — `settings` jednostki (`life`, `structure`, `intake`, `tools`, `talk`, `visibility`, `public`). Pisz tylko to, co różni się od propozycji albo od jednostki wyżej — reszta się dziedziczy.
5. **Treści** — osobnymi formatami, po imporcie wspólnoty: lekcje i teksty (`scriptorium`, `source-text`, `work-with-text`), karty i pytania (`knowledge-base`), strony (`page`), dodatkowe terminy / strony / podformularze jednostki — w `extra` jednostki (klucze jak w formacie `area`).

## Zmiany później

- Ten sam `key` = ta sama jednostka, pozycja, osoba. Zmień nazwę, przenieś jednostkę w inne miejsce drzewa, dopisz osobę albo miejsce — import zmienia to samo, nie dubluje.
- Brak w dokumencie ≠ usunięcie. Rozwiązanie jednostki: `"remove": true` (obszar i treści zostają). Odejście osoby: `"remove": true` (link przestaje działać).
- Inne miejsca osoby (nowa pozycja, oddana pozycja) → aplikacja daje jej NOWY link, stary przestaje działać. Treści zostają przy pozycji (przejmuje je następca).
- Zmiana planu budowy zmienia wszystkie jednostki z tego planu, poza tym, co jednostka ustawiła sama.
- Dwie wspólnoty pod nową jednostką (np. dwa rejony pod diecezję) — robi to człowiek w aplikacji: Wspólnoty → zaznacz obie → „Połącz pod nową jednostką”. W JSON nie wpisuj identyfikatorów obszarów (`area`), chyba że człowiek je podał.

## Typowe błędy

- Klucze z polskimi znakami albo spacjami — klucze to małe litery, cyfry, `-` i `_` (pozycje do 32 znaków).
- Imię i nazwisko w nazwie jednostki, kluczu albo adresie — usługa widzi klucze i adresy; imiona są tylko w `persons` / `people` (zapieczętowane).
- Fikcyjne typy („typ: chór”) — nie ma typów; są tylko ustawienia i przykłady.
- `"intake.mode": "signup"` bez pozycji `participant` albo `member` — zapisy nie miałyby komu dać roli.
- Dane zdrowia, diety, telefon rodzica jako zwykłe pola — oznacz `"leadersOnly": true` (trafią do podformularza tylko dla prowadzących); dla niepełnoletnich `"intake.minors": true`.
- Liczba miejsc i lista rezerwowa (`intake.limit`, `intake.waitlist`) są dziś informacją na stronie zapisów — aplikacja ich nie liczy; powiedz to człowiekowi.
- Zbyt wiele naraz: każda nowa rola i każdy link to kilkanaście sekund liczenia kluczy w przeglądarce. Duża diecezja — importuj rejon po rejonie.

## Odpis dla człowieka

Po przygotowaniu dokumentu napisz krótko: ile jednostek, pozycji, osób; co zaimportować najpierw; że linki osób pokażą się po imporcie (i w zakładce „Osoby” → „Kopiuj link”); czego import nie zrobi sam (lekcje, karty Cogity, ankiety, obecność — osobnymi narzędziami).
