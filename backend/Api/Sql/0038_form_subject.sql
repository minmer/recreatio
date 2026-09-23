/*
    Wovon ein Bogen HANDELT — und woher sein Name kommt.

    =========================================================================
    1. EIN BOGEN HANDELT VON JEMANDEM
    =========================================================================

    Ein Anmeldebogen fuer die Firmung handelt von einem MENSCHEN. Eine
    Anmeldung einer Schola handelt von einer GRUPPE. Ein Bogen, mit dem sich
    jemand um ein Amt bewirbt, handelt von einer ROLLE.

    Bisher stand das nirgends, und deshalb liess sich die eine Frage nicht
    beantworten, an der alles weitere haengt: WORAN haengt der Platz, den die
    Einsendung erzeugt? Ein Link muss zu etwas gehoeren — zu einem Menschen, zu
    einer Gruppe, zu einem Amt. „Zu irgendetwas" ist keine Antwort.

        none    der Bogen handelt von nichts Benanntem (Kontaktformular)
        person  von einem Menschen
        group   von einer Gruppe
        role    von einem Amt

    <b>`none` ist die Vorgabe</b>, und zwar fuer das Bestehende. Etwas anderes
    zu setzen hiesse, den vorhandenen Boegen eine Aussage unterzuschieben, die
    niemand getroffen hat.

    =========================================================================
    2. WELCHES FELD WELCHE ANGABE IST
    =========================================================================

    `slug_field.identity_role` sagte bisher `none | name | contact`. Das
    genuegte, um zu wissen, WO ungefaehr der Name steht — und nicht, um einen
    Bogen aus den Angaben eines Menschen auszufuellen. „name" ist nicht
    dasselbe wie „Vorname", und „contact" ist Telefon oder E-Mail oder beides.

    Ab hier nennt das Feld die Angabe beim Namen, und zwar mit denselben
    Woertern wie `person_value` (0005). Dieselbe Sache zweimal zu benennen ist
    die zuverlaessigste Art, sie auseinanderlaufen zu lassen.

    <b>`name` und `contact` bleiben gueltig.</b> Sie stehen in vorhandenen
    Zeilen, und eine Migration, die sie verbietet, muesste raten, was gemeint
    war.

    =========================================================================
    3. DER RUFNAME FEHLTE
    =========================================================================

    `person_value` kannte sechs Angaben. Ein Rufname ist keine davon — und er
    ist genau die, nach der eine Gruppe zuerst fragt: auf einem Namensschild
    steht nicht „Katarzyna Wojciechowska".
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.module') AND name = 'for_kind')
BEGIN
    ALTER TABLE app.module ADD for_kind nvarchar(16) NOT NULL
        CONSTRAINT df_module_for_kind DEFAULT (N'none');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_module_for_kind')
    ALTER TABLE app.module ADD CONSTRAINT ck_module_for_kind
        CHECK (for_kind IN (N'none', N'person', N'group', N'role'));
GO

/* -- Welches Feld welche Angabe ist --------------------------------------- */

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_field_identity')
    ALTER TABLE app.slug_field DROP CONSTRAINT ck_slug_field_identity;
GO

ALTER TABLE app.slug_field ADD CONSTRAINT ck_slug_field_identity
    CHECK (identity_role IN (
        /* was schon dasteht */
        N'none', N'name', N'contact',

        /* und was `person_value` kennt — Wort fuer Wort dasselbe */
        N'given_name', N'surname', N'phone', N'born', N'address', N'email', N'nickname'));
GO

/* -- Der Rufname ----------------------------------------------------------- */

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_person_value_field')
    ALTER TABLE app.person_value DROP CONSTRAINT ck_person_value_field;
GO

ALTER TABLE app.person_value ADD CONSTRAINT ck_person_value_field
    CHECK (field IN (N'given_name', N'surname', N'phone', N'born',
                     N'address', N'email', N'nickname'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_person_release_field')
    ALTER TABLE app.person_release DROP CONSTRAINT ck_person_release_field;
GO

ALTER TABLE app.person_release ADD CONSTRAINT ck_person_release_field
    CHECK (field IN (N'given_name', N'surname', N'phone', N'born',
                     N'address', N'email', N'nickname'));
GO

/*
    „Welche Abschriften sind veraltet" — die Frage, die entsteht, sobald
    jemand seine Angabe aendert.

    <b>Der Dienst kann sie nicht erneuern.</b> Eine Abschrift liegt unter dem
    Epochenschluessel eines Bereichs, und den hat er nicht. Er kann nur SAGEN,
    welche betroffen sind; neu versiegeln muss der Browser dessen, dem die
    Angabe gehoert. Der Index ist dafuer da, dass diese Frage billig bleibt.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_person_release_role')
    CREATE INDEX ix_person_release_role ON app.person_release (role_id, field);
GO
