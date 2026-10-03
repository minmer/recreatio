/*
    Nabożeństwa — eine eigene Art neben Messe und Beichte.

    -------------------------------------------------------------------------
    WARUM EINE ART UND NICHT EIN TITEL
    -------------------------------------------------------------------------

    Rosenkranz, Kreuzweg, Gorzkie Żale, Maiandacht, Anbetung: wiederkehrend,
    öffentlich, in der Kirche — wie die Messe und die Beichte. Als
    `appointment` stünden sie nicht im Messplan (der zeigt nur den
    Gottesdienst), und als `mass` bekämen sie Intentionen und zählten bei
    „wie viele Priester braucht es". Die Art ist das, wonach der Plan fragt;
    der Titel („Różaniec") ist Text, den jemand morgen anders schreibt.

    `devotion` hat keine Intentionen — wie die Beichte. Der Dienst weist sie
    ab (`Mass.AddIntentionAsync`), nicht die Oberfläche.

    Erweitert werden nur die beiden Prüfungen; keine Zeile ändert sich. Ein
    Dienst ohne diese Fassung schreibt `devotion` nie — er kennt sie nicht.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'ck_item_kind' AND definition NOT LIKE '%devotion%')
    ALTER TABLE app.calendar_item DROP CONSTRAINT ck_item_kind;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_item_kind')
    ALTER TABLE app.calendar_item ADD CONSTRAINT ck_item_kind
        CHECK (kind IN (N'appointment', N'task', N'mass', N'confession', N'visit', N'devotion'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'ck_calendar_item_kind' AND definition NOT LIKE '%devotion%')
    ALTER TABLE app.calendar DROP CONSTRAINT ck_calendar_item_kind;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_calendar_item_kind')
    ALTER TABLE app.calendar ADD CONSTRAINT ck_calendar_item_kind
        CHECK (item_kind IN (N'appointment', N'mass', N'confession', N'visit', N'devotion'));
GO
