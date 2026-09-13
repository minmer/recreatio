/*
    Bereiche bekommen einen Namen — und Epochen einen Schluessel, der
    veroeffentlicht werden kann.

    -------------------------------------------------------------------------
    DREI DINGE, DIE EINANDER NICHT BESITZEN
    -------------------------------------------------------------------------

    Diese Plattform haelt drei Ordnungen auseinander:

        SCHLUESSEL   `app.area` — benannte Bereiche mit ihren Epochen. Wer
                     lesen kann, hat eine Zuteilung (`app.key_grant`).

        ROLLEN       `app.role` — Person, Funktion, Gruppe. Sie HALTEN
                     Schluessel; sie sind keine.

        SEITEN       `app.slug` — Adressen mit ihrer eigenen Hierarchie,
                     Aliassen und Domains.

    Keine besitzt eine andere. Sie treffen sich in Zertifikaten und
    Schluesselzuteilungen — nicht in Fremdschluesselspalten.

    <b>Warum der Bereich jetzt einen Namen traegt.</b> 0001 sagt: „Er hat
    keinen lesbaren Namen; was er ist, steht in `app.body`, das ihn besitzt."
    Das galt, solange ein Koerper ueber jedem Bereich stand. `app.body` fasst
    aber genau die drei Ordnungen oben in EINER Zeile zusammen — Bereich,
    Amtsrolle, Mitgliedsrolle, Adresse und Elternteil nebeneinander. Damit ist
    er der falsche Ort fuer den Namen eines Schluessels.

    Der Bereich steht deshalb fuer sich und sagt selbst, was er ist.

    <b>Klartext, nicht versiegelt.</b> Der Name ist das Etikett eines
    Schluessels — „Kancelaria", „Ogloszenia publiczne" —, und er wird
    gebraucht, BEVOR man den Schluessel hat: beim Aussuchen, unter welchem
    Bereich ein Feld versiegelt werden soll. Ein Name, den erst lesen kann,
    wer den Schluessel schon besitzt, hilft genau in dem Augenblick nicht, in
    dem er gebraucht wird.

    Das ist eine Abwaegung und keine Selbstverstaendlichkeit: wer die Tabelle
    liest, sieht damit die Gliederung des Hauses, wenn auch keinen Inhalt.
    Umkehrbar — dann wandert der Name unter den Epochenschluessel, wie im
    Altbestand.

    -------------------------------------------------------------------------
    EIN VEROEFFENTLICHTER EPOCHENSCHLUESSEL
    -------------------------------------------------------------------------

    <b>Oeffentlich heisst hier: der Schluessel liegt offen da.</b> Nicht ein
    Schalter, den der Dienst beachten muss, sondern eine Tatsache ueber einen
    Schluessel. Wer `key_public` fuellt, sagt: alles, was unter dieser Epoche
    versiegelt ist, darf jeder oeffnen.

    Der Gewinn ist nicht Geheimhaltung — es gibt keine mehr, sobald der
    Schluessel dasteht. Der Gewinn ist, dass ES NUR EINEN WEG GIBT: jedes Feld
    liegt versiegelt, und ob es zu lesen ist, haengt allein daran, ob ein
    Schluessel dafuer erreichbar ist. Der Dienst kann eine private Zeile nicht
    mehr durch eine falsche WHERE-Bedingung ausplaudern — er hat keinen
    Schluessel fuer sie.

    <b>Je Epoche, nicht je Bereich.</b> Ein Bereich kann seine erste Epoche
    offenlegen und spaeter schneiden; was danach kommt, ist wieder zu. Umgekehrt
    kann ein Bereich, der immer offen war, ab einer Epoche schliessen. Beides
    waere mit einem Schalter am Bereich nicht auszudruecken.

    <b>Ein veroeffentlichter Schluessel wird nicht zurueckgenommen.</b> Wer ihn
    einmal gesehen hat, hat ihn. `key_public` wieder auf NULL zu setzen
    verschliesst nichts — es verschweigt nur. Wer kuenftiges schuetzen will,
    schneidet eine neue Epoche; das ist der Weg, den es dafuer schon gibt.
*/

/* -------------------------------------------------------------------------
   1. Der Bereich sagt, was er ist
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.area', 'name') IS NULL
BEGIN
    ALTER TABLE app.area ADD name nvarchar(200) NOT NULL
        CONSTRAINT df_area_name DEFAULT (N'');
END
GO

/*
    Ein Bereich ohne Namen ist eine Kennung, die niemand wiedererkennt — und
    gewaehlt wird er nach dem Namen.

    Die Vorgabe oben steht nur da, damit vorhandene Zeilen die Spalte bekommen;
    heute gibt es keine. Die Pruefung hier sorgt dafuer, dass die Vorgabe nicht
    zum Dauerzustand wird.
*/
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_area_name')
BEGIN
    ALTER TABLE app.area WITH CHECK
        ADD CONSTRAINT ck_area_name CHECK (LEN(LTRIM(RTRIM(name))) > 0);
END
GO

/* -------------------------------------------------------------------------
   2. Eine Epoche, die offenliegen darf
   ------------------------------------------------------------------------- */

/*
    NULL heisst: nicht veroeffentlicht. Nur wer eine Zuteilung hat
    (`app.key_grant`, Art `epoch`), oeffnet, was unter dieser Epoche liegt.

    Steht hier etwas, ist es der Epochenschluessel selbst, roh und offen —
    dieselben 32 Byte, die sonst je Rolle verpackt werden. Absichtlich KEIN
    Geheimtext: eine Huelle, deren Schluessel danebenliegt, waere eine
    Umstaendlichkeit, die wie Schutz aussieht.
*/
IF COL_LENGTH('app.area_epoch', 'key_public') IS NULL
BEGIN
    ALTER TABLE app.area_epoch ADD key_public varbinary(64) NULL;
END
GO

/*
    32 Byte oder gar nichts. Ein Schluessel anderer Laenge ist keiner, und eine
    Zeile, die sechs Byte fuehrt, faellt sonst erst beim Entschluesseln auf —
    dort, wo niemand nach der Ursache sucht.
*/
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_area_epoch_key_public')
BEGIN
    ALTER TABLE app.area_epoch WITH CHECK
        ADD CONSTRAINT ck_area_epoch_key_public
        CHECK (key_public IS NULL OR DATALENGTH(key_public) = 32);
END
GO

/*
    „Welche Bereiche kann jeder lesen?" ist die Frage der oeffentlichen Seite,
    und sie wird bei jedem Aufruf gestellt.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_area_epoch_public')
BEGIN
    CREATE INDEX ix_area_epoch_public ON app.area_epoch (area_id, epoch)
        WHERE key_public IS NOT NULL;
END
GO
