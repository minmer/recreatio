/*
    Bereiche bekommen eine Gestalt: Verschachtelung, Oeffentlichkeit, und was
    ein Formularmensch ausser seinem Eigenen sieht.

    =========================================================================
    1. VERSCHACHTELUNG — UND WAS SIE HEISST
    =========================================================================

    `Pfarrei > Messe > Spenden`. Bisher lagen Bereiche nebeneinander; die
    Zugehoerigkeit stand nirgends, und wer sie brauchte, baute sie sich aus
    Namen zusammen.

    <b>Die Regel ist eine VORAUSSETZUNG, keine Vererbung.</b> Wer in einen
    inneren Bereich soll, muss im aeusseren stehen — aber wer im aeusseren
    steht, hat damit im inneren noch gar nichts. Das ist der Unterschied
    zwischen „gehoert dazu" und „darf hinein", und er ist der ganze Zweck der
    Verschachtelung: die Spenden liegen INNERHALB der Messe und trotzdem nicht
    offen fuer jeden, der die Messe fuehrt.

    <b>Kein Kreis.</b> Eine Pruefbedingung kann nur das Offensichtliche
    verbieten (ein Bereich ist nicht sein eigener Vater); A > B > A faengt der
    Dienst ab, so wie beim Rollengraphen (3.14).

    =========================================================================
    2. OEFFENTLICH — EINE ANGABE, NICHT ZWEI
    =========================================================================

    Bisher hiess „oeffentlich" genau eines: der Epochenschluessel steht
    veroeffentlicht in `area_epoch.key_public`. Das genuegt fuers LESEN und
    sagt nichts darueber, ob ein Fremder auch etwas HINEINLEGEN darf.

        none    niemand von aussen
        read    jeder darf lesen        (Messzeiten)
        write   jeder darf lesen und einsenden

    <b>Warum beides zusammen an einer Stelle.</b> Zwei Schalter fuer dieselbe
    Frage laufen auseinander: irgendwann steht der Schluessel offen und die
    Absicht sagt `none`, und niemand weiss mehr, welches von beiden gilt. Der
    Dienst haelt sie deshalb zusammen — wer hochsetzt, veroeffentlicht den
    Schluessel im selben Zug; wer auf `none` zurueckgeht, nimmt ihn zurueck.

    Zurueckgenommen heisst nicht ungeschehen: wer den Schluessel gelesen hat,
    hat ihn. Was aufhoert, ist der Zugriff auf das, was danach kommt — und
    solange es keine Epochenrotation gibt, ist das ehrlich zu sagen.

    =========================================================================
    3. WAS EIN FORMULARMENSCH SIEHT
    =========================================================================

    Wer ueber ein Formular hereinkommt, bekommt einen Platz (0027) und damit
    IMMER vollen Zugriff auf das Eigene — seine Einsendung gehoert ihm.

    Die andere Frage ist, was er vom BEREICH sieht: gar nichts, oder das
    Gemeinsame mitlesen, oder auch etwas beitragen. Das entscheidet nicht das
    Formular, sondern der Verwalter des Bereichs — das Formular sagt nur, in
    welchen Bereich es fuehrt.

        own     nur das Eigene (Vorgabe)
        read    dazu das Gemeinsame lesen
        write   dazu beitragen

    Technisch ist `read`/`write` eine Zuteilung des Epochenschluessels an den
    Platz (`app.access_grant`, 0024) — dieselbe Maschinerie, die das Amt schon
    fuer ausgestellte Plaetze benutzt. Die Stufe steht am BEREICH und nicht an
    der Zuteilung: sonst muesste der Verwalter sie zweihundertmal pflegen.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.area') AND name = 'parent_area_id')
BEGIN
    ALTER TABLE app.area ADD parent_area_id uniqueidentifier NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_area_parent')
    ALTER TABLE app.area ADD CONSTRAINT fk_area_parent
        FOREIGN KEY (parent_area_id) REFERENCES app.area (id);
GO

/* Das Offensichtliche verbietet die Zeile selbst; den Kreis der Dienst. */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_area_not_self')
    ALTER TABLE app.area ADD CONSTRAINT ck_area_not_self
        CHECK (parent_area_id IS NULL OR parent_area_id <> id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.area') AND name = 'public_level')
BEGIN
    ALTER TABLE app.area ADD public_level nvarchar(8) NOT NULL
        CONSTRAINT df_area_public_level DEFAULT (N'none');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_area_public_level')
    ALTER TABLE app.area ADD CONSTRAINT ck_area_public_level
        CHECK (public_level IN (N'none', N'read', N'write'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.area') AND name = 'seat_level')
BEGIN
    ALTER TABLE app.area ADD seat_level nvarchar(8) NOT NULL
        CONSTRAINT df_area_seat_level DEFAULT (N'own');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_area_seat_level')
    ALTER TABLE app.area ADD CONSTRAINT ck_area_seat_level
        CHECK (seat_level IN (N'own', N'read', N'write'));
GO

/*
    BESTEHENDE BEREICHE, deren Schluessel schon veroeffentlicht ist, sind
    oeffentlich lesbar — das war bisher die einzige Bedeutung. Die Spalte sagt
    das jetzt aus, statt es aus dem Schluessel zu erraten.
*/
UPDATE a
   SET a.public_level = N'read'
  FROM app.area a
 WHERE a.public_level = N'none'
   AND EXISTS (SELECT 1 FROM app.area_epoch e
                WHERE e.area_id = a.id AND e.key_public IS NOT NULL);
GO

/* „Welche Bereiche liegen in diesem" — die Frage jedes Baums. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_area_parent')
    CREATE INDEX ix_area_parent ON app.area (parent_area_id) WHERE parent_area_id IS NOT NULL;
GO
