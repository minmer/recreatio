# Pytania z części: przewodnik dla KI

Ten przewodnik mówi, jak pisać pytania do bazy wiedzy (Cogita), żeby **każda część pytania liczyła się osobno** i żeby **odpowiedź na jedną kartę liczyła się dla każdej innej karty, która pyta o to samo**. Składnię dokumentu podaje format importu `knowledge-base` (MCP Recreatio: `get_import_format`), wspólne zasady schematów — przewodnik `guide-schemes` (`templates/cogita/schematy-AI.md`).

## 0. Zasady dla KI

1. Piszesz **pytania** (rodzaj `"question"`) jako wpisy w `"entities"` dokumentu `{"format": "recreatio.cogita.course", "version": 1, "name", "entities": [...]}`; każdy wpis ma własny `"ref"` (`"@temat/q-nazwa"`), odniesienia piszesz jako `"@ref"`.
2. **Nie wymyślasz kluczy.** Do części służą tylko: `"show"`, `"share"`, `"fact"` (i `"about"`, który już znasz). Wszystko inne liczy aplikacja.
3. Nazwy w `"share"` i `"fact"` są **stałe i opisowe** (`"aussagen-skript-1"`, `"Grunwald 1410"`): ta sama nazwa = ta sama rzecz. Dwie różne rzeczy nigdy nie dostają tej samej nazwy.
4. Odpowiadasz jednym dokumentem JSON i krótkim raportem: jakie zbiory `"share"` i jakie fakty `"fact"` założyłeś i które pytania je dzielą.

## 1. Co aplikacja liczy sama — tego nie deklarujesz

- **Pytanie pyta o części; każda część jest faktem.** Odpowiedź mówi o każdej części osobno, wynik karty to średnia części.
- **Części z treści pytania** (nic nie dopisujesz):
  - `"match"` (Połącz w pary) — każda para; wynik: część dobrze połączonych par.
  - `"many"` (Kilka z kilku) — każde zdanie: dobrze, gdy zaznaczone i powinno być, albo pominięte i nie powinno; wynik: średnia zdań. Przykład: 3 zdania, jedno dobrze pominięte, dwa źle → 33 %.
  - `"gap"` z kilkoma lukami (`[[słowo]]` kilka razy w tekście) — każde słowo w luce.
- **Jedna odpowiedź liczy się dla każdej karty o tej samej części.** Karta, której wszystkie części zostały właśnie ocenione, dostaje tę ocenę (średnią) — nie wraca od razu, choć sama nie była pytana.
- Pamięć karty, trzy pasma (nieznane / do powtórki / znane) i stos powtórki — jak w `guide-schemes`; części niczego tu nie zmieniają, tylko dostarczają więcej odpowiedzi.

## 2. Co deklarujesz

| Klucz | Gdzie | Co znaczy |
|---|---|---|
| `"show": n` | `match`, `many` | Długa lista: na karcie `n` par / zdań (2–12), **każda para / każde zdanie ma swoją kartę** (ona + `n − 1` losowych innych; przy zdaniach co najmniej jedno dobre). Powtórka wraca tylko do części, których uczący się jeszcze nie umie. Bez `"show"`: wszystko na jednej karcie. |
| `"share": "nazwa"` | każde pytanie | Zbiór części: pytania z tą samą nazwą **dzielą te same części** — to samo zdanie (many, truefalse), tę samą parę (match), to samo słowo w luce (gap), ten sam nazwany fakt. Bez `"share"` części należą tylko do tego pytania. |
| `"fact": "nazwa"` | pytanie bez części: `text`, `number`, `date`, `one`, `truefalse`, `flash`, `order`, `build`… | Jedyna część pytania. Pytania o tym samym fakcie dzielą odpowiedzi (`"Kiedy był Grunwald?"` i `"Co było w 1410?"` z `"fact": "Grunwald 1410"`). Bez `"share"` nazwa obowiązuje w całej bazie. |
| `"fact": "#strona"` | jak wyżej, z `"about"` | Strona wpisu z `"about"` (pierwszego): `"#data"` przy `"about": ["@grunwald"]` to **ten sam fakt, co karta szablonu** z `"asks": [{"of": "this", "facet": "data"}]` o tym wpisie. Tak pytania pisane ręcznie i karty z szablonów liczą się wzajemnie. |
| `"truefalse"` + `"share"` | | Ocena jednego zdania — **to samo zdanie, co w `"many"` z tym samym `"share"`**. Treść zdania: `"fact"` (dokładnie tak, jak w `"options"`), bez niego treść pytania. |

Wynik pytania **zawsze** jest średnią części — nie deklarujesz wag ani punktów.

## 3. Jak decydujesz

| Sytuacja | Co piszesz |
|---|---|
| Kilka zdań do oceny jednym kryterium („Które są twierdzeniami?”, „Które są prawdziwe według tekstu?”) | Jedno `"many"`; przy więcej niż 5 zdaniach `"show": 3`–`4`. |
| Kilka wersji tego samego pytania z częściowo tymi samymi zdaniami | Każda wersja `"many"` z **tym samym** `"share"`; zdania pisane **identycznie** (ten sam tekst = to samo zdanie). |
| To samo zdanie także jako „Prawda czy fałsz” | `"truefalse"` z tym samym `"share"`, `"fact"` = tekst zdania z `"options"`, `"value"` = czy spełnia kryterium. |
| Rok — wydarzenie, pojęcie — definicja (długa lista) | `"match"` z `"show": 4`–`6`; druga lista z częścią tych samych par: to samo `"share"`, pary pisane identycznie. |
| Tekst z kilkoma ważnymi słowami | `"gap"` z kilkoma `[[lukami]]`; inny tekst z tymi samymi słowami w tym samym kontekście: to samo `"share"`. |
| Jedna informacja pytana z dwóch stron (data ↔ wydarzenie, pojęcie ↔ nazwa) | Oba pytania z tym samym `"fact"`. |
| Pytanie o stronę wpisu, o którą pytają też karty szablonów | `"about": ["@wpis"]`, `"fact": "#strona"` (nazwa `facet` z `"asks"` szablonu). |
| Pytanie, które sprawdza coś innego niż jego części (zastosowanie, wniosek) | **Bez** `"share"` i `"fact"` — liczy się tylko samo. |

## 4. Przykład

```json
{
  "format": "recreatio.cogita.course", "version": 1, "name": "Aussagen — Skript, Kapitel 1",
  "entities": [
    { "ref": "@logik/q-aussagen-a", "kinds": ["question"], "data": {
      "form": "many", "prompt": "Welche der folgenden Sätze sind Aussagen im Sinne des Skripts?",
      "options": ["„$-5 \\in \\mathbb{N}$”", "„Bitte schließen Sie die Tür.”", "„Wie spät ist es?”", "„$2 + 2 = 5$”", "„Rechnen Sie $3 \\cdot 4$ aus.”", "„Es gibt Außerirdische.”"],
      "correct": [0, 3, 5], "show": 3, "share": "aussagen-kap1" } },
    { "ref": "@logik/q-aussagen-b", "kinds": ["question"], "data": {
      "form": "many", "prompt": "Markieren Sie alle Aussagen.",
      "options": ["„$2 + 2 = 5$”", "„Wie spät ist es?”", "„Jede gerade Zahl größer als 2 ist Summe zweier Primzahlen.”"],
      "correct": [0, 2], "share": "aussagen-kap1" } },
    { "ref": "@logik/q-tf-225", "kinds": ["question"], "data": {
      "form": "truefalse", "prompt": "„$2 + 2 = 5$” ist eine Aussage.", "fact": "„$2 + 2 = 5$”", "value": true,
      "share": "aussagen-kap1" } },
    { "ref": "@hist/q-grunwald-kiedy", "kinds": ["question"], "data": { "form": "date", "prompt": "Kiedy była bitwa pod Grunwaldem?", "answers": ["1410-07-15"], "precision": "year", "fact": "Grunwald 1410" } },
    { "ref": "@hist/q-grunwald-co", "kinds": ["question"], "data": { "form": "text", "prompt": "Jaka bitwa była w 1410 roku?", "answers": ["Grunwald", "bitwa pod Grunwaldem"], "fact": "Grunwald 1410" } }
  ]
}
```

Co z tego wynika: zdanie „$2 + 2 = 5$” stoi w obu wersjach i w pytaniu „Prawda czy fałsz” — gdy uczący się oceni je dobrze w jednym miejscu, pozostałe dwie karty tego zdania nie wracają od razu. Wersja A ma 6 zdań, więc `"show": 3` daje każdemu zdaniu własną kartę; wersja B (3 zdania) zostaje jedną kartą, liczoną zdanie po zdaniu. Dwa pytania o Grunwald dzielą jeden fakt.

## 5. Czego nie robić

- Nie pisz tego samego zdania / pary **różnie** (inne cudzysłowy, spacja, wzór inaczej) w pytaniach z tym samym `"share"` — to wtedy dwie różne części.
- Nie dawaj tego samego `"share"` pytaniom z **innym kryterium** („Które są Aussagen?” i „Które są prawdziwe?”): zdanie „$2 + 2 = 5$” jest Aussage, ale nie jest prawdziwe — to dwa różne fakty, więc dwa różne `"share"`.
- Nie używaj `"fact"` w `"many"`, `"match"` ani w `"gap"` z kilkoma lukami — ich części biorą się z treści.
- Nie dawaj `"show"` krótkim listom (do 4 zdań / par) — jedna karta wystarcza.
- Nie deklaruj wag części, punktów ani własnego sposobu liczenia wyniku — wynik to zawsze średnia części.
- Nie łącz przez `"fact"` pytań, które tylko dotyczą tego samego tematu (do tego służy `"about"`); `"fact"` znaczy: **ta sama informacja**.

## 6. Zanim odpowiesz — sprawdź

- Każde `"share"` ma jedno kryterium, a jego zdania / pary są w każdym pytaniu napisane znak w znak tak samo.
- Każde `"truefalse"` z `"share"` ma `"fact"` równe jednemu ze zdań `"options"` tego zbioru, a `"value"` zgadza się z `"correct"` tego zdania.
- Każde `"fact"` zaczynające się od `#` ma `"about"`, a nazwa po `#` to `facet` z `"asks"` szablonu tego rodzaju wpisu.
- Długie listy (od 6) mają `"show"`, krótkie nie.
- W raporcie: lista zbiorów `"share"` (nazwa, kryterium, pytania), lista faktów `"fact"` (nazwa, pytania).
