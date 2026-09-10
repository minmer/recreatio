/*
    Die neuen Arten von Abschnitten duerfen auch in die Datenbank.

    -------------------------------------------------------------------------
    WORUM ES GEHT
    -------------------------------------------------------------------------

    Der Browser bietet seit dem Uebernehmen der alten Teile achtzehn Arten an;
    der Dienst liess zwoelf zu. Wer im Herausgeber „Galeria" waehlte, bekam eine
    Absage — und die sah aus, als haette er etwas falsch gemacht.

    Die C#-Liste (`RcEvents.PartKinds`) ist inzwischen weit genug. Bleibt die
    Frage, ob die TABELLE eine eigene Meinung hat.

    -------------------------------------------------------------------------
    WARUM GESUCHT UND NICHT GERATEN
    -------------------------------------------------------------------------

    Das Skript, das `rc_event_part` angelegt hat, ist nicht mehr da — es ging
    mit einundzwanzig anderen in 4bd7e4ab verloren. Ob dort eine
    Pruefbedingung auf `kind` steht, laesst sich also nicht nachlesen, nur
    nachsehen.

    Genau dieser Fall ist hier schon einmal teuer geworden: die Art `mass` wurde
    im Browser erweitert, der Dienst und ZWEI Pruefbedingungen wiesen sie
    weiterhin ab, und der Fehler zeigte sich erst beim Anlegen einer Messe.

    Also: jede Pruefbedingung auf `rc_event_part.kind` wird gesucht und fallen
    gelassen. Sie fehlt danach — und das ist die ehrliche Lage. Welche Arten es
    gibt, entscheidet `RcEvents.PartKinds`, an EINER Stelle; eine zweite Liste
    in der Datenbank waere eine, die beim naechsten Teil vergessen wird. Genau
    das ist gerade passiert.
*/

DECLARE @check sysname;

SELECT TOP 1 @check = c.name
FROM sys.check_constraints c
JOIN sys.columns col
  ON col.object_id = c.parent_object_id
 AND col.column_id = c.parent_column_id
WHERE c.parent_object_id = OBJECT_ID('dbo.rc_event_part')
  AND col.name = 'kind';

IF @check IS NOT NULL
BEGIN
    DECLARE @drop nvarchar(400) =
        N'ALTER TABLE dbo.rc_event_part DROP CONSTRAINT ' + QUOTENAME(@check);
    EXEC sp_executesql @drop;
END
GO

/*
    Dasselbe fuer die Felder eines Formulars: `RcEvents.FieldKinds` fuehrt sie,
    und wer dort eine Art hinzufuegt, soll nicht an einer zweiten Liste
    scheitern, von der er nichts weiss.
*/
DECLARE @fieldCheck sysname;

SELECT TOP 1 @fieldCheck = c.name
FROM sys.check_constraints c
JOIN sys.columns col
  ON col.object_id = c.parent_object_id
 AND col.column_id = c.parent_column_id
WHERE c.parent_object_id = OBJECT_ID('dbo.rc_event_part_field')
  AND col.name = 'kind';

IF @fieldCheck IS NOT NULL
BEGIN
    DECLARE @dropField nvarchar(400) =
        N'ALTER TABLE dbo.rc_event_part_field DROP CONSTRAINT ' + QUOTENAME(@fieldCheck);
    EXEC sp_executesql @dropField;
END
GO
