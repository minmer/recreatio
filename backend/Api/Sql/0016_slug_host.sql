/*
    Eine Adresse, die auch unter einem EIGENEN NAMEN erreichbar ist.

    <b>Warum am Eintrag und nicht als eigene Zeile.</b> Ein Name wie
    `cogita.pl` kann kein Pfad sein: Pfade tragen Kleinbuchstaben, Ziffern,
    Bindestriche und Schrägstriche — einen Punkt haben sie nie. Ein Alias mit
    einem Namen statt eines Pfades bräuchte also eine Zeile ohne Pfad, und
    „eine Zeile ohne das, wodurch sie sich nennt" ist keine Zeile, sondern eine
    Ausnahme, die jede Abfrage danach mitschleppt.

    Deshalb steht der Name NEBEN dem Pfad: `cogita` ist die Adresse, unter der
    die Seite verwaltet wird, und `cogita.pl` ist ein zweiter Eingang zu
    derselben Zeile. Wer über den Namen kommt, bekommt, was dort steht — und
    folgt ein `alias_of` weiter, auch das.

    <b>Der Name ist Betrieb, nicht Inhalt.</b> Wer ihn setzt, muss ohnehin das
    DNS umlegen und die Seite unter diesem Namen ausliefern; beides tut der
    Betreiber am Server. Die ADRESSE selbst bleibt, was sie war: mit Code
    übernommen und von einer Rolle geführt. Der Name gibt niemandem ein Recht,
    er zeigt nur einen weiteren Weg.

    <b>Ein Name gehört genau einer Adresse.</b> Zwei Zeilen mit demselben Namen
    hiessen zwei Antworten auf dieselbe Frage, und welche käme, entschiede die
    Reihenfolge der Zeilen.
*/

IF COL_LENGTH('app.slug', 'host') IS NULL
    ALTER TABLE app.slug ADD host nvarchar(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_slug_host')
    CREATE UNIQUE INDEX ux_slug_host ON app.slug (host) WHERE host IS NOT NULL;
GO

/*
    Ein Hostname und sonst nichts: klein geschrieben, mit Punkt, ohne Schema,
    ohne Pfad, ohne Doppelpunkt. Was hier hineinkommt, wird später mit dem
    verglichen, was der Browser als seinen Ort nennt — eine Schreibweise mehr,
    und der Vergleich geht still daneben.
*/
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_host')
    ALTER TABLE app.slug ADD CONSTRAINT ck_slug_host
        CHECK (host IS NULL
            OR (host = LOWER(host)
                AND LEN(host) > 3
                AND host LIKE N'%.%'
                AND host NOT LIKE N'%[^a-z0-9.-]%'
                AND host NOT LIKE N'.%'
                AND host NOT LIKE N'%.'
                AND host NOT LIKE N'%..%'));
GO
