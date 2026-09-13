/*
    Die Bausteine einer Seite.

    <b>Eine Zeile je Baustein, und nicht ein Dokument.</b> Der Altbestand legte
    Aufbau, Menü und Inhalt einer Pfarrseite als EINE Zeichenkette ab. Das liest
    sich bequem und rächt sich an dem Tag, an dem zwei Menschen gleichzeitig
    speichern: der letzte gewinnt, und zwar alles. Eine Zeile je Baustein hat
    eine Kennung, eine Reihenfolge und eine Herkunft.

    <b>`layout` und `config` sind trotzdem JSON</b>, und das ist kein
    Widerspruch:

        layout   je Bildschirmgrösse ein Rechteck — Zeile, Spalte, Breite,
                 Höhe. Ein WERT, kein Ding. Zwölf Spalten dafür wären zwölf
                 Spalten, die zusammen nur einmal Sinn ergeben.

        config   was dieser eine Baustein an Inhalt trägt. 0003 sagt es schon:
                 „Bei einem Modul ist das alles, was es gibt." Der Dienst liest
                 es nicht — er legt es ab.

    <b>`kind` hat bewusst keine Prüfliste</b> (wie in 0003): die Arten wachsen,
    und eine Liste, die man bei jeder neuen wandern muss, wird vergessen — dann
    lehnt die Datenbank ab, was die Oberfläche schon anbietet.

    <b>Klartext</b>, wie Titel und Vorspann: die Seite wird ohne Konto
    ausgeliefert. Was versiegelt gehört, gehört nicht auf eine öffentliche
    Seite.
*/

IF OBJECT_ID('app.slug_part', 'U') IS NULL
BEGIN
    CREATE TABLE app.slug_part
    (
        id         uniqueidentifier NOT NULL,
        slug_id    uniqueidentifier NOT NULL,

        kind       nvarchar(40)     NOT NULL,

        -- Die Reihenfolge im Dokument. Das Raster bestimmt, WO ein Baustein
        -- steht; diese Zahl bestimmt, in welcher Reihenfolge er gelesen und
        -- gespeichert wird — auf einem Vorleser zählt genau sie.
        position   int              NOT NULL,

        layout     nvarchar(max)    NOT NULL,
        config     nvarchar(max)    NULL,

        created_at datetimeoffset   NOT NULL,

        CONSTRAINT pk_slug_part PRIMARY KEY (id),
        CONSTRAINT fk_slug_part_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id),
        CONSTRAINT ck_slug_part_kind CHECK (LEN(kind) > 0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_slug_part_slug')
    CREATE INDEX ix_slug_part_slug ON app.slug_part (slug_id, position);
GO
