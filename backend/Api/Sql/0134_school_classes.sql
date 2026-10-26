/*
    0134 — SCHULEN UND KLASSEN: zwei weitere Arten eines Bereichs (area_profile.kind).

      school   die Klassen darin, die Programme (Projekte im Skryptorium der Schule)
               und ihre Verwirklichung in jeder Klasse, die Lehrer
      class    die Schüler (Formular mit Anwesenheit und Notizen), der Stundenplan
               (wöchentliche Termine), das Programm mit Verwirklichung und Notizen

    Was eine Klasse verwirklicht, steht als Wygłoszenie im Skryptorium der Schule
    (versiegelt wie alles dort, mit dem Bereich der Klasse) — der Dienst braucht dafür
    keine neue Tabelle.

    Noch einmal ausgeführt, ändert es nichts.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = N'ck_area_profile_kind' AND parent_object_id = OBJECT_ID('app.area_profile')
             AND definition NOT LIKE N'%school%')
BEGIN
    ALTER TABLE app.area_profile DROP CONSTRAINT ck_area_profile_kind;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'ck_area_profile_kind' AND parent_object_id = OBJECT_ID('app.area_profile'))
BEGIN
    ALTER TABLE app.area_profile ADD CONSTRAINT ck_area_profile_kind
        CHECK (kind IN (N'event', N'group', N'organisation', N'course', N'school', N'class'));
END
GO
