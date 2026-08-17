# Hortus Dei — rezerwacje

Moduł rezerwacji miejsca rekolekcyjnego: całe Hortus Dei albo pojedyncze części — dom główny
z kaplicą i jadalnią, dwa mniejsze domki, ogród z altaną i miejscem na grilla. Grupy zgłaszają
rezerwację ze strony publicznej, koordynator ją potwierdza.

Strona: `/hortus`. API: `/hortus/...`. Schemat bazy: `hortus`.

## Model

Części miejsca (`HortusResources`) tworzą **drzewo**: korzeniem jest całe miejsce, jego dziećmi domy
i ogród, a ich dziećmi kaplica, jadalnia czy grill. Każda część ma dwie liczby, na których opiera się
cały mechanizm:

| Pole | Znaczenie |
| --- | --- |
| `Capacity` | ile **różnych grup** może trzymać tę część w tej samej chwili. Kaplica i jadalnia: 2. Domy, grill, całe miejsce: 1. |
| `TechnicalMinutesBefore` / `After` | czas na sprzątanie, zmywanie i przygotowanie. Doliczany do zajętości, więc kolejna grupa nie wejdzie w trakcie. |

Rezerwacja (`HortusReservations`) to jedna grupa i jej kontakt; to, co faktycznie zajmuje, opisują
pozycje (`HortusReservationItems`) — każda z nich to jedna część na jednym przedziale czasu.
Dzięki temu jedna grupa może mieć dom na trzy noce i kaplicę na dwie godziny w ramach jednego
zgłoszenia. Pozycja jest liczona w **nocach** (od godziny zakwaterowania do godziny wyjazdu)
albo w **godzinach** — o tym, co jest dozwolone, decyduje `BookingUnit` części.

## Reguły dostępności

Silnik (`Services/Hortus/HortusAvailabilityEngine.cs`) sprawdza każdą żądaną pozycję trzema regułami:

1. **Wyłączność z góry** — nic wyłącznego (blokada techniczna albo rezerwacja części nadrzędnej)
   nie może obejmować tej części ani niczego nad nią. Rezerwacja domu głównego zamyka jego kaplicę.
2. **Wolne miejsce** — liczba różnych grup trzymających tę część (wliczając grupy, które trzymają
   część nadrzędną) musi mieścić się w `Capacity`. Limit jest liczony **w każdej chwili osobno**,
   więc dwie częściowo nakładające się grupy blokują tylko wspólny środek przedziału.
3. **Wolne wnętrze** — wzięcie części oznacza wzięcie wszystkiego w środku. Nie da się wynająć
   całego Hortus Dei, gdy ktoś obcy siedzi w kaplicy.

Wszystkie porównania obejmują czas techniczny po obu stronach, więc sprzątanie po jednej grupie
i przygotowanie dla następnej nigdy nie trafią na to samo pomieszczenie w tym samym czasie.

Zmiany czasu są rozwiązywane po ludzku: godzina, która nie istnieje, przesuwa się do przodu,
a godzina, która występuje dwa razy, bierze pierwsze przejście. Slot kończący się wcześniej niż
zaczyna (np. czuwanie 22:00–01:00) przechodzi na następny dzień.

## Statusy

`pending` → `confirmed` | `rejected` | `cancelled`.

Kalendarz zajmują wyłącznie rezerwacje **potwierdzone**. Zgłoszenia oczekujące są pokazywane jako
niepewne i zwracane jako ostrzeżenie (`warnings`), ale nie blokują nikogo — decyzja należy do
koordynatora. Potwierdzenie sprawdza kolizje jeszcze raz, bo od zgłoszenia mogło się zmienić;
`force: true` pozwala potwierdzić mimo kolizji.

Wpisy rodzaju `block` to blokady techniczne koordynatora — ignorują `Capacity` i zamykają część
w całości (remont, przerwa w sezonie, dodatkowe sprzątanie).

## Endpointy

Publiczne:

| Metoda | Ścieżka | Opis |
| --- | --- | --- |
| GET | `/hortus/{slug}` | opis miejsca i lista części |
| GET | `/hortus/{slug}/availability?from&to` | zajętość w oknie (bez nazw grup) |
| POST | `/hortus/{slug}/check` | sprawdzenie terminu bez zapisu |
| POST | `/hortus/{slug}/requests` | zgłoszenie rezerwacji → kod + klucz |
| GET | `/hortus/{slug}/requests/{code}?token` | status zgłoszenia |
| POST | `/hortus/{slug}/requests/{code}/cancel?token` | odwołanie przez zgłaszającego |

Koordynator (`RequireAuthorization` + przypisanie `PortalAdminAssignments.ScopeKey = 'hortus-dei'`):

| Metoda | Ścieżka | Opis |
| --- | --- | --- |
| GET | `/hortus/admin/status` | czy koordynator jest ustawiony i czy miejsce jest utworzone |
| POST | `/hortus/admin/claim` | przejęcie roli koordynatora (pierwszy chętny) |
| POST | `/hortus/admin/bootstrap` | utworzenie miejsca i domyślnego układu części |
| GET | `/hortus/{slug}/admin/reservations?status&from&to` | lista zgłoszeń |
| GET | `/hortus/{slug}/admin/timeline?from&to` | kalendarz z nazwami grup |
| POST | `/hortus/{slug}/admin/check` | sprawdzenie terminu (z pominięciem wskazanej rezerwacji) |
| POST/PUT | `/hortus/{slug}/admin/reservations[/{id}]` | wpis ręczny lub blokada techniczna |
| POST | `/hortus/{slug}/admin/reservations/{id}/decision` | potwierdź / odrzuć / odwołaj |
| DELETE | `/hortus/{slug}/admin/reservations/{id}` | usunięcie blokady (rezerwacje grup tylko odwołujemy) |
| GET/POST/PUT/DELETE | `/hortus/{slug}/admin/resources[/{id}]` | części miejsca: limit grup, czas techniczny |
| PUT | `/hortus/{slug}/admin/settings` | doba, czas techniczny, wyprzedzenie, przyjmowanie zgłoszeń |

Numer zgłoszenia (`HD-XXXXXX`) sam w sobie nic nie ujawnia — podgląd wymaga też klucza, którego
skrót SHA-256 jest jedynym, co trzyma baza. Zły klucz i nieistniejący numer dają tę samą odpowiedź.

## Uruchomienie

1. Zastosuj `backend/Recreatio.Api/Sql/patch_hortus.sql` na bazie (idempotentny, tworzy schemat
   `hortus` i pięć tabel). `schema.sql` zawiera już te same tabele dla świeżej instalacji.
2. Wejdź na `/hortus`, zaloguj się i kliknij **Zostań koordynatorem Hortus Dei**, a potem
   **Utwórz układ miejsca** — powstanie miejsce z domyślnym drzewem części.
3. W panelu koordynatora ustaw nazwy, limity grup i czasy techniczne pod realia miejsca.

## Pliki

- `backend/Recreatio.Api/Data/Hortus/` — encje
- `backend/Recreatio.Api/Services/Hortus/HortusAvailabilityEngine.cs` — reguły dostępności
- `backend/Recreatio.Api/Endpoints/Hortus/` — endpointy publiczne, panel, wspólna logika, domyślny układ
- `backend/Recreatio.Api/Contracts/HortusContracts.cs` — kontrakty API
- `frontend/src/pages/hortus/` — strona publiczna, panel koordynatora, oś czasu
- `frontend/src/styles/hortus.css` — style modułu
