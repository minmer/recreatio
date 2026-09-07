/*
    Der Annahmeschluessel gehoert dem AMT, nicht dem Bereich.

    -------------------------------------------------------------------------
    WAS FALSCH WAR
    -------------------------------------------------------------------------

    Ein Anmeldeformular arbeitet mit einem Schluesselpaar:

      * der OEFFENTLICHE Teil wird breit geteilt — jeder, der sich anmeldet,
        verschliesst damit seine Antworten. Er steht im Klartext in der Antwort
        des Dienstes, und das ist richtig so;

      * der PRIVATE Teil oeffnet sie wieder. Er gehoert dem, der die
        Veranstaltung fuehrt — und sonst niemandem.

    Beim Anlegen einer Veranstaltung lag der private Teil bisher unter dem
    EPOCHENSCHLUESSEL DES BEREICHS. Wer zum Bereich gehoert, hat diesen
    Schluessel; also konnte jeder Helfer, der zum Vorbereiten hinzugebeten
    wurde, saemtliche Anmeldungen lesen — Namen, Ernaehrung,
    Unvertraeglichkeiten. Niemand musste ihm dafuer etwas geben, es folgte aus
    der Mitgliedschaft.

    Beim Firmmodul ist es von Anfang an richtig gewesen
    (`RcConfirmationIntake`): dort liegt der private Teil unter dem
    AMTSSCHLUESSEL, und `intake_epoch = 0` sagt, dass er an keiner Epoche
    haengt. Diese Migration zieht die Veranstaltungen nach.

    -------------------------------------------------------------------------
    WAS SICH DAMIT AENDERT
    -------------------------------------------------------------------------

    <b>Das Amt wird aufgeschrieben.</b> Es entstand bisher beim Anlegen und
    wurde weggeworfen — die Veranstaltung wusste hinterher nicht, wer sie
    fuehrt. Ohne diese Spalte laesst sich der private Teil nicht mehr finden,
    egal unter welchem Schluessel er liegt.

    <b>Ein Amt ist uebergebbar.</b> Genau darum geht es: die Pfarrsekretaerin
    kann die Veranstaltung weiterreichen, ohne jemandem ihr Konto zu geben —
    und der Nachfolger sieht die Anmeldungen, ohne dass ihn jemand in den
    Bereich aufnehmen muesste.

    -------------------------------------------------------------------------
    DIE ALTEN BLEIBEN, WIE SIE SIND
    -------------------------------------------------------------------------

    Ein Skript kann nicht umschluesseln: dafuer muesste es den Epochenschluessel
    haben, und den hat es nicht — das ist der Sinn der Sache. Vorhandene
    Veranstaltungen behalten also ihren Wert in `intake_epoch` und werden
    weiterhin darueber geoeffnet.

    `intake_epoch` UNTERSCHEIDET die beiden Faelle, und das ist kein
    Behelf, sondern die Auskunft selbst:

        > 0   unter dem Epochenschluessel dieser Epoche  (alt)
        = 0   unter dem Amtsschluessel                   (neu)

    Der Lesepfad prueft das und sagt es auch. Die Alternative — alle alten
    unlesbar machen — waere ein Datenverlust zugunsten einer schoeneren
    Codezeile.
*/

IF COL_LENGTH('dbo.rc_event', 'office_role_id') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event ADD office_role_id uniqueidentifier NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_rc_event_office')
BEGIN
    ALTER TABLE dbo.rc_event
        ADD CONSTRAINT fk_rc_event_office
        FOREIGN KEY (office_role_id) REFERENCES dbo.rc_role (id);
END
GO

/*
    „Welche Veranstaltungen fuehrt dieses Amt" — die Frage beim Uebergeben.
    Ohne Index geht sie durch alle Veranstaltungen der Plattform.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_event_office')
BEGIN
    CREATE INDEX ix_rc_event_office ON dbo.rc_event (office_role_id)
        WHERE office_role_id IS NOT NULL;
END
GO
