/*
    DER LINK MIT ZIEL, DER TERMIN MIT LINK (0073).

    1. Ein Link mit Zugang (0065) öffnet jetzt eine ADRESSE — die Seite der
       Gruppe, ihren Kalender, eine Seite nur mit Zugang —, und der Zugang
       gilt dort sofort, auch ohne Konto: der Browser behält den Link wie die
       persönlichen Links der Formulare. `aim` ist der Weg hinter `#/`
       (`parish/grzegorzki/oaza`), offen: er sagt nichts, was die Seite nicht
       selbst sagt. NULL: wie bisher `#/dolacz/…`.

    2. Ein Termin kann auf weitere Informationen zeigen — die Anmeldung, die
       Seite des Ausflugs. Der Link und sein Wort auf dem Knopf liegen
       versiegelt wie Ort und Notiz, unter dem Bereich des Termins.
*/

IF COL_LENGTH('app.invitation', 'aim') IS NULL
    ALTER TABLE app.invitation ADD aim nvarchar(400) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'ck_calendar_field_name'
           AND parent_object_id = OBJECT_ID(N'app.calendar_field')
           AND definition NOT LIKE N'%link_label%')
    ALTER TABLE app.calendar_field DROP CONSTRAINT ck_calendar_field_name;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'ck_calendar_field_name'
               AND parent_object_id = OBJECT_ID(N'app.calendar_field'))
    ALTER TABLE app.calendar_field ADD CONSTRAINT ck_calendar_field_name
        CHECK (field IN (N'title', N'location', N'notes', N'link', N'link_label'));
GO
