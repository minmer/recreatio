/*
    GRUPY FORMULARZY (0096) — ein Ordner: Formulare (und Unterformulare)
    unter einem Namen, in einer Reihenfolge, in der Liste beieinander und auf
    der Karte als ein Kasten. Für den Menschen, der ausfüllt, ändert sich
    nichts.

    `app.form_group`: der Name, und wer sie angelegt hat. Sichtbar ist eine
    Gruppe dem, der sie angelegt hat, und jedem, der eines ihrer Formulare
    sieht.

    `module.form_group_id`, `module.group_position`: in welcher Gruppe ein
    Formular steht, und an welcher Stelle. Ein Formular steht in höchstens
    einer Gruppe; wird die Gruppe gelöscht, stehen ihre Formulare wieder lose.
*/

IF OBJECT_ID('app.form_group') IS NULL
    CREATE TABLE app.form_group
    (
        id                  uniqueidentifier  NOT NULL,
        name                nvarchar(200)     NOT NULL,
        created_by_role_id  uniqueidentifier  NULL,
        created_at          datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_form_group PRIMARY KEY (id),
        CONSTRAINT fk_form_group_role FOREIGN KEY (created_by_role_id) REFERENCES app.role (id)
    );
GO

IF COL_LENGTH('app.module', 'form_group_id') IS NULL
    ALTER TABLE app.module ADD form_group_id uniqueidentifier NULL
        CONSTRAINT fk_module_form_group FOREIGN KEY REFERENCES app.form_group (id);
GO

IF COL_LENGTH('app.module', 'group_position') IS NULL
    ALTER TABLE app.module ADD group_position int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_module_form_group' AND object_id = OBJECT_ID('app.module'))
    CREATE INDEX ix_module_form_group ON app.module (form_group_id) WHERE form_group_id IS NOT NULL;
GO
