/*
    Ein zweiter Weg zu derselben Seite — und die Wurzel selbst.

    <b>Was ein Alias ist.</b> Eine ganz gewöhnliche Zeile im Register, die
    keinen eigenen Inhalt trägt, sondern auf eine andere Adresse zeigt. Wer sie
    aufruft, bekommt die Seite von dort. Übernommen wird sie wie jede andere:
    mit Code und mit einer Rolle — ein Alias ist eine Adresse, keine Einstellung.

    <b>Warum kein eigener Inhalt.</b> Läge unter dem Alias eine zweite Seite,
    gäbe es zwei Fassungen derselben Sache, und eine davon wäre immer die
    veraltete. Der Inhalt hat genau einen Ort; der Alias hat nur einen Namen.

    <b>Die Wurzel ist der leere Pfad.</b> `recreatio.pl` ohne alles — das ist im
    Register die leere Zeichenkette, und deshalb muss die Formprüfung sie
    zulassen. Sie ist der einzige Pfad ohne Wort; alles andere bleibt, wie es
    war (Kleinbuchstaben, Ziffern, Bindestriche, Teile mit Schrägstrich).

    <b>Keine Ketten.</b> Ein Alias zeigt auf eine ECHTE Adresse, nie auf einen
    anderen Alias. Das prüft der Dienst beim Anlegen: eine Kette liesse sich im
    Kreis legen, und wer sie aufruft, liefe ihn mit.
*/

IF COL_LENGTH('app.slug', 'alias_of') IS NULL
    ALTER TABLE app.slug ADD alias_of nvarchar(200) NULL;
GO

/*
    Die Formprüfung neu: wie bisher, plus die leere Zeichenkette für die Wurzel.

    `LEN('')` ist 0 — die alte Prüfung verbot die Wurzel also ausdrücklich, und
    zwar zu Recht, solange es sie nicht gab.
*/
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_path')
    ALTER TABLE app.slug DROP CONSTRAINT ck_slug_path;
GO

ALTER TABLE app.slug ADD CONSTRAINT ck_slug_path
    CHECK (path = N''
        OR (path = LOWER(path)
            AND LEN(path) > 0
            AND path NOT LIKE N'%[^a-z0-9/-]%'
            AND path NOT LIKE N'/%'
            AND path NOT LIKE N'%/'
            AND path NOT LIKE N'%//%'));
GO

/*
    Ein Alias zeigt nicht auf sich selbst. Das ist die eine Schleife, die eine
    Prüfliste hier abfangen kann — alles Weitere (Ketten, Kreise über mehrere
    Zeilen) prüft der Dienst, weil es dafür nachschlagen muss.
*/
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_alias_self')
    ALTER TABLE app.slug ADD CONSTRAINT ck_slug_alias_self
        CHECK (alias_of IS NULL OR alias_of <> path);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_slug_alias')
    CREATE INDEX ix_slug_alias ON app.slug (alias_of) WHERE alias_of IS NOT NULL;
GO
