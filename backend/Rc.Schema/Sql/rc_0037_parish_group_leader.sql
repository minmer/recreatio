/*
    Wer die Gruppe FUEHRT — als Amt, nicht als Mensch.

    =========================================================================
    WAS IN rc_0035 FEHLTE
    =========================================================================

    Eine Gruppe entstand dort mit zwei Rollen:

        member_role_id   „gehoert dazu"     write auf den Bereich
        (der Gruender)   seine PERSON       admin + certify auf den Bereich

    Die zweite Zeile ist der Fehler. Die Verwaltung der Gruppe hing an der
    PERSON, die sie angelegt hat — also am Pfarrverwalter. Weitergeben liess
    sie sich nur, indem man ihm sein Konto gibt, also gar nicht.

    Genau diesen Fehler vermeidet die Pfarrei selbst seit ihrem ersten Tag
    (`RcParish.CreateAsync` legt ein Amt an, bevor sie den Bereich anlegt).
    Bei den Gruppen ist er mir durchgerutscht.

    Die Folge im Alltag: die Schola wird von jemandem gefuehrt, der nicht die
    Pfarrkanzlei ist. Er soll den Aushang seiner Gruppe selbst pflegen koennen
    — wann sie probt, wen sie sucht — ohne dafuer Verwalter der ganzen Pfarrei
    zu werden. Ohne diese Spalte gab es dafuer keinen Weg ausser dem falschen.

    =========================================================================
    WAS EIN AMT IST UND WARUM ES EINE EIGENE ZEILE BRAUCHT
    =========================================================================

    Ein Amt (`rc_role.kind = 'office'`) ist eine Rolle, die eine STELLE meint
    und keinen Menschen. Sie traegt `admin` auf dem Bereich der Gruppe; wer
    sie haelt, fuehrt die Gruppe. Gehalten wird sie zunaechst von dem, der die
    Gruppe angelegt hat — und weitergereicht wie jede andere Rolle: ueber eine
    Einladung (3.12), die den Rollenschluessel unter dem Linkgeheimnis
    versiegelt.

    Der Nachfolger braucht dafuer kein Wort mit dem Vorgaenger zu wechseln und
    bekommt kein fremdes Konto. Er bekommt die Stelle.

    Aufgeschrieben werden MUSS sie, weil sonst niemand weiss, WELCHE Rolle
    weiterzugeben ist. Ein geratenes Amt verteilt Schluessel an der Gruppe
    vorbei.

    =========================================================================
    WER DANACH WAS LESEN KANN — ohne Beschoenigung
    =========================================================================

        Amt der Gruppe        admin   Aushang aendern, Gespraech, Kalender
        Mitgliedsrolle        write   Gespraech, Kalender, Aufgaben
        Gruender (Person)     admin   dasselbe wie das Amt

    Die dritte Zeile bleibt bestehen, und das ist eine ENTSCHEIDUNG, keine
    Nachlaessigkeit: `RcAreas.InsertAreaAsync` gibt dem Anlegenden `admin` auf
    seinen eigenen Bereich, und daran haengt, dass eine Pfarrei eine Gruppe
    wieder einsammeln kann, deren Leiter nicht mehr auftaucht. Der Preis ist,
    dass der Pfarrverwalter mitlesen KANN.

    Der Kommentar in rc_0035 hat das zu schoen dargestellt („sonst laese jeder,
    der den Messplan pflegt, im Gruppenchat mit"). Richtig ist: wer den
    Messplan pflegt, liest NICHT mit — wer die Gruppe ANGELEGT hat, schon.
    Angewendete Migrationen werden nicht umgeschrieben, also steht die
    Richtigstellung hier.

    =========================================================================
    NOT NULL, UND WARUM DAS HIER GEHT
    =========================================================================

    Eine Gruppe ohne Amt ist genau der Zustand, den diese Migration abschafft
    — als NULL erlaubt waere er jederzeit wieder herstellbar, und der Code
    muesste ihn ueberall mitfuehren.

    Zum Zeitpunkt dieser Migration steht die Tabelle auf 0 Zeilen (nachgezaehlt,
    nicht angenommen). Laeuft sie je gegen eine Datenbank, in der schon Gruppen
    stehen, scheitert sie laut — und das ist die richtige Antwort: dort muesste
    erst entschieden werden, wer diese Gruppen fuehrt.
*/

IF COL_LENGTH('dbo.rc_parish_group', 'leader_role_id') IS NULL
BEGIN
    ALTER TABLE dbo.rc_parish_group ADD leader_role_id uniqueidentifier NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_rc_parish_group_leader_role')
BEGIN
    ALTER TABLE dbo.rc_parish_group
        ADD CONSTRAINT fk_rc_parish_group_leader_role
        FOREIGN KEY (leader_role_id) REFERENCES dbo.rc_role (id);
END
GO

/*
    „Welche Gruppe fuehrt dieses Amt" — die Frage beim Uebergeben und beim
    Anzeigen dessen, was einem Menschen anvertraut ist. Ohne Index geht sie
    durch alle Gruppen der Plattform.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_parish_group_leader')
BEGIN
    CREATE INDEX ix_rc_parish_group_leader
        ON dbo.rc_parish_group (leader_role_id);
END
GO
