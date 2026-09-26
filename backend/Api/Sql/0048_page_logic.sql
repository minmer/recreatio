/*
    DIE LOGIK EINER SEITE — eine Karte (React Flow), auf der die Bausteine der
    Seite Eingänge haben und die Angaben des Menschen, der die Seite gerade
    ansieht, die Eingänge speisen.

    Links, was über den Menschen bekannt ist (ist jemand gewählt, kam er über
    einen Link, hat er Formular X geschickt, seine Angaben bestätigt, eine
    Antwort gegeben, hat die Kanzlei einen Haken gesetzt, ab einem Datum …);
    in der Mitte UND, ODER, NICHT; rechts die Bausteine der Seite („zeigen,
    wenn") und die Schritte, aus denen der Baustein „Kroki osoby" seine Liste
    zeichnet („erledigt, wenn", „gilt, wenn").

    Ausgewertet wird im BROWSER — dort liegen die Angaben offen, beim Dienst
    nicht. Das Dokument selbst ist Seiteninhalt wie Titel und Text und liegt
    offen; wo es mit einer Antwort vergleicht, steht darin nur der Abdruck des
    Vergleichswerts, nicht der Wert.
*/

IF COL_LENGTH('app.slug', 'page_logic') IS NULL
    ALTER TABLE app.slug ADD page_logic nvarchar(max) NULL;
GO
