/*
    Die persönliche Rolle — das Konto in der Welt der Schlüssel.

    `app.role` steht seit 0001, aber zwei Dinge fehlten, und ohne sie ist eine
    Rolle nicht benutzbar:

        die privaten Hälften   es gab nur die öffentlichen Schlüssel, also
                               Rollen, die niemand öffnen kann

        der Weg vom Konto      ein frisch angelegter Mensch zeigte auf keine
                               Rolle; es gab nichts, worauf sich eine
                               Verantwortung setzen liesse

    Beide Hälften liegen versiegelt unter dem abgeleiteten Rollenschlüssel
    (Kernel: `RoleKeys.PersonalRoleKey`, abgeleitet aus dem Hauptschlüssel des
    Kontos). Der Dienst kann sie beim Anlegen versiegeln, weil er den
    Hauptschlüssel in genau diesem Augenblick in der Hand hält — danach liegt
    er unter dem PasswordKey und ist für ihn fort.

    NULL erlaubt, und das ist kein Versehen: `office` und `member` bekommen
    einen zufälligen Rollenschlüssel, der je Halter verpackt wird
    (`key_grant`), nicht eine Hülle in der Zeile.
*/

IF COL_LENGTH('app.role', 'sign_private_sealed') IS NULL
    ALTER TABLE app.role ADD sign_private_sealed varbinary(max) NULL;
GO

IF COL_LENGTH('app.role', 'wrap_private_sealed') IS NULL
    ALTER TABLE app.role ADD wrap_private_sealed varbinary(max) NULL;
GO

/*
    Welche Rolle DIESES Konto ist.

    Die Wurzel von allem: über sie hängen Ämter und Mitgliedschaften am Konto
    (`role_edge`), und nur sie darf abgeleitet werden — eine Rolle mit mehreren
    Haltern kann das nicht (Kernel: RoleKeys).
*/
IF COL_LENGTH('app.account', 'person_role_id') IS NULL
    ALTER TABLE app.account ADD person_role_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_account_person_role')
    ALTER TABLE app.account ADD CONSTRAINT fk_account_person_role
        FOREIGN KEY (person_role_id) REFERENCES app.role (id);
GO

/*
    Eine persönliche Rolle gehört genau einem Konto. Zwei Konten auf derselben
    Rolle hiessen: zwei Menschen, ein Schlüsselbund, und die Übergabe eines
    Amtes wäre nicht mehr nachvollziehbar.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_account_person_role')
    CREATE UNIQUE INDEX ux_account_person_role ON app.account (person_role_id)
        WHERE person_role_id IS NOT NULL;
GO
