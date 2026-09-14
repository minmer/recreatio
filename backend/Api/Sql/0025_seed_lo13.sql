/*
    XIII Liceum Ogólnokształcące — die Adresse.

    Eine Zeile, und sie wird ÜBERNOMMEN wie jede andere: mit Code und mit einer
    Rolle. Hier steht nur der Abdruck; der Code wurde einmal ausgegeben und
    existiert nur dort, wo ihn jemand aufbewahrt hat. Wer diese Datei liest,
    kann die Adresse nicht an sich nehmen — das ist der ganze Zweck der Trennung.

    =========================================================================
    WARUM NUR EINE ZEILE
    =========================================================================

    `lo13/portal/...` steht hier ABSICHTLICH nicht, und es könnte auch nicht:

        `portal` ist im Register gesperrt (`Slug.IsReserved`). Dahinter beginnt
        der Platz eines Menschen — `lo13/portal/<token>/<key>` —, und eine
        Unterseite dieses Namens verdeckte jeden Schülerlink, lautlos, weil
        beide Adressen gleich aussähen.

    Und die Schüler brauchen ohnehin keine Zeile im Register: ein Platz ist
    kein Aushang. Er hängt an einem BEREICH, trägt seinen eigenen Schlüssel und
    wird im Arbeitsplatz ausgestellt, einer je Mensch.

    Alles unter `lo13` — `lo13/klasy`, `lo13/kontakt` — entsteht dagegen ohne
    Code: wer die Wurzel führt, führt, was darunter liegt (0012).

    =========================================================================
    WAS NOCH DAZUGEHÖRT
    =========================================================================

    Diese Zeile allein genügt nicht. `frontend/src/app/routes.ts` führt die
    Liste der Adressen, die der Neubau ausliefert (`PAGES`); fehlt `lo13` dort,
    antwortet die Anwendung mit „Ta ścieżka nic tu nie znaczy", obwohl die
    Adresse im Register steht. Beides gehört zusammen und wurde zusammen
    geändert.
*/

IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'lo13')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
    VALUES (
        '01a0a084-f900-75d5-ad3f-ce8808d78587',
        N'lo13',
        0x069F0A8FBC22384D4B5CA2D14385DBE0BC5C27EEE22C8D9EB31A951C571F6AA5,
        N'XIII LO. Code am 2026-09-14 ausgegeben, nur ausserhalb des Git.',
        SYSDATETIMEOFFSET());
END
GO
