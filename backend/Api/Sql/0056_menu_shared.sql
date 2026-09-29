/*
    EIN MENUE FUER MEHRERE SEITEN (0056).

    Seit 0054 haengt ein Menue an einer Seite und gilt fuer sie und alles
    darunter. Das reicht fuer einen Baum und fuer nichts sonst: die Pfarrei,
    die Schule und der Chor liegen im Register NEBENEINANDER, und wer ueber
    allen dasselbe Menue will, musste es dreimal pflegen — und dreimal
    nachziehen, wenn ein Eintrag dazukam.

    Deshalb darf eine Zeile ab hier zweierlei sein:

        menu          ihr EIGENES Menue, wie bisher
        uses_slug_id  ein VERWEIS: „hier gilt das Menue jener Seite"

    Genau eines von beiden, nie beides und nie keines — das sagt
    `ck_slug_menu_one`.

    KEINE KETTEN. Ein Verweis zeigt immer auf eine Seite mit einem EIGENEN
    Menue, nie auf einen zweiten Verweis. Damit ist das Aufloesen ein Schritt
    und nicht ein Weg, es kann keinen Kreis geben, und die Frage „woher kommt
    dieses Menue" hat eine Antwort statt einer Spur.

    WOFUER RELATIVE ZIELE GELTEN, aendert sich nicht: fuer die Seite, die das
    Menue TRAEGT. Nimmt eine Seite das Menue der Pfarrei, dann bedeutet „oaza"
    darin weiterhin die Oaza der Pfarrei — sonst zeigte derselbe Eintrag auf
    jeder Seite woandershin, und das waere kein geteiltes Menue mehr.
*/

IF COL_LENGTH('app.slug_menu', 'uses_slug_id') IS NULL
    ALTER TABLE app.slug_menu ADD uses_slug_id uniqueidentifier NULL;
GO

/* Ein Verweis hat kein eigenes Menue — also darf die Spalte leer bleiben. */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.slug_menu') AND name = 'menu' AND is_nullable = 0)
    ALTER TABLE app.slug_menu ALTER COLUMN menu nvarchar(max) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_slug_menu_uses')
    ALTER TABLE app.slug_menu ADD CONSTRAINT fk_slug_menu_uses
        FOREIGN KEY (uses_slug_id) REFERENCES app.slug (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_menu_one')
    ALTER TABLE app.slug_menu ADD CONSTRAINT ck_slug_menu_one CHECK (
        (menu IS NOT NULL AND uses_slug_id IS NULL)
     OR (menu IS NULL AND uses_slug_id IS NOT NULL AND uses_slug_id <> slug_id));
GO

/* Wer ein Menue hergibt, wird gesucht: „welche Seiten haengen an meinem?" */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_slug_menu_uses')
    CREATE INDEX ix_slug_menu_uses ON app.slug_menu (uses_slug_id) WHERE uses_slug_id IS NOT NULL;
GO
