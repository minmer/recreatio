/*
    LINKS MIT ZUGANG (0065) — ein Link, der einem Konto Zugang zu einem oder
    mehreren Bereichen gibt (lesen, schreiben, verwalten), einmalig oder öfter.

    Der Link ist eine Rolle (`invitation.role_id`), die die Zugänge trägt; ihre
    Schlüssel liegen versiegelt unter einem Schlüssel aus dem Geheimnis im Link
    (`sealed_role_key`). Wer einlöst, hängt seine Person an diese Rolle
    (Roles.Invites.cs). Die Tabelle stammt aus 0005 und war bisher ungenutzt;
    hier bekommt sie, was der Link-Fall braucht.
*/

IF COL_LENGTH('app.invitation', 'edge_kind') IS NULL
    ALTER TABLE app.invitation ADD edge_kind nvarchar(8) NULL;
GO

IF COL_LENGTH('app.invitation', 'capability') IS NULL
    ALTER TABLE app.invitation ADD capability nvarchar(8) NULL;
GO

IF COL_LENGTH('app.invitation', 'purpose') IS NULL
    ALTER TABLE app.invitation ADD purpose nvarchar(16) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_invitation_edge_kind')
    ALTER TABLE app.invitation ADD CONSTRAINT ck_invitation_edge_kind
        CHECK (edge_kind IS NULL OR edge_kind IN (N'holds', N'write', N'read'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_invitation_capability')
    ALTER TABLE app.invitation ADD CONSTRAINT ck_invitation_capability
        CHECK (capability IS NULL OR capability IN (N'read', N'write', N'admin'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_invitation_role')
    CREATE INDEX ix_invitation_role ON app.invitation (role_id);
GO
