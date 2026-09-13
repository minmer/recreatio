/*
    Die Startseite — und die Wurzel, die auf sie zeigt.

    Zwei Zeilen, und beide werden ÜBERNOMMEN wie jede andere Adresse: mit Code
    und mit einer Rolle. Hier stehen nur die Hashes; die Codes wurden einmal
    ausgegeben und existieren nur dort, wo sie jemand aufbewahrt hat.

        start   die Seite. Hier wird alles erklärt: Titel, Vorspann, Module.
        (leer)  `recreatio.pl` selbst — ein Alias auf `start`.

    <b>Warum nicht einfach die Seite an die Wurzel legen.</b> Dann hiesse die
    Adresse „nichts", und jede Aufzählung im Arbeitsplatz müsste einen Namen
    dafür erfinden. So hat die Seite einen Namen, unter dem man sie verwaltet,
    und die Wurzel ist das, was sie ist: ein zweiter Weg dorthin.

    <b>Die Reihenfolge ist Absicht.</b> Erst das Ziel, dann der Alias — ein
    Alias auf eine Adresse, die es nicht gibt, wäre ein Verweis ins Leere, und
    der Dienst lehnt ihn beim Anlegen genau deshalb ab.
*/

IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'start')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
    VALUES (
        '01a09a0a-c4dd-75c7-8029-a4a079faeaac',
        N'start',
        0x92306F73E35A969F08A87C01E99C7BAB80C00B3742A024EF65DDDF11D02A6843,
        N'Die Startseite. Code am 2026-09-13 ausgegeben, nur ausserhalb des Git.',
        SYSDATETIMEOFFSET());
END
GO

IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, alias_of, created_at)
    VALUES (
        '01a09a0a-c4de-79a4-80cd-a329f97f729b',
        N'',
        0x523520F9571F8B96E4D1EA68E7E8C239020409A501B3DCA60536D2F1502F97E7,
        N'recreatio.pl selbst — Alias auf start. Code am 2026-09-13 ausgegeben.',
        N'start',
        SYSDATETIMEOFFSET());
END
GO
