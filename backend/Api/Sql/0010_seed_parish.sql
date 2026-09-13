/*
    Die erste Adresse im Register: recreatio.pl/parish.

    <b>Hier steht der HASH, nicht der Code.</b> SHA-256 über ein Geheimnis aus
    18 Zufallsbytes — aus dieser Zeile lässt sich der Code nicht zurückrechnen,
    und deshalb darf sie im Git stehen. Der Code selbst wurde EINMAL ausgegeben
    und existiert nur dort, wo ihn jemand aufbewahrt hat.

    <b>Warum überhaupt hier und nicht mit `slug add`.</b> Beides geht. Ein
    Eintrag in einer Migration ist reproduzierbar: eine frische Datenbank hat
    dieselbe Adresse mit demselben Code, ohne dass jemand einen Befehl von Hand
    nachholen muss. `slug add` ist der Weg für alles, was später dazukommt.

    <b>Wenn der Code verloren geht:</b> diese Zeile löschen und mit `slug add
    parish` eine neue anlegen. Solange die Adresse noch niemand übernommen hat,
    kostet das nichts — danach ist sie vergeben, und der Code taugt ohnehin
    nicht mehr (er wirkt genau einmal).

    Die Kennung ist eine UUIDv7, von Hand erzeugt statt NEWID(): der Rest der
    Plattform sortiert nach der Zeit in der Kennung, und eine Zufalls-GUID
    stünde darin quer.
*/

IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'parish')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
    VALUES (
        '01a09945-8b9c-7fa7-9096-2b5fbb42f3d9',
        N'parish',
        0x566DA4B432AE85F12C5411D4D31487DAF835C4A7F5A205268A40E04F696C0079,
        N'Die Pfarrseite. Code am 2026-09-13 ausgegeben, nur ausserhalb des Git.',
        SYSDATETIMEOFFSET());
END
GO
