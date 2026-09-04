/*
    Der Schluessel einer Selbstanmeldung, zugeteilt an eine Person.

    WARUM.

    Wer sich zur Firmung anmeldet, verschliesst seine Angaben mit einem
    Sitzungsschluessel. Der lag bisher an genau zwei Plaetzen: hinter der Raute
    im Link, und — unter dem Annahmeschluessel der Gruppe verpackt — bei der
    Amtsrolle der Pfarrei. Das Konto des Angemeldeten bekam nichts.

    Damit war "verbinde die Anmeldung mit deinem Konto" eine leere Geste: die
    Zeile merkte sich das Konto, aber niemand konnte ueber das Konto etwas
    oeffnen. Wer den Link verlor, verlor seine Anmeldung — auch angemeldet.
    Und der Knopf "Link abschalten" daneben haette den letzten Weg zugemacht.

    Ab hier bekommt die Personenrolle des Kontos denselben Schluessel, verpackt
    unter ihrem oeffentlichen Wrap-Schluessel. Verpackt wird im BROWSER, beim
    Verbinden — dort liegt der Sitzungsschluessel ohnehin, weil er aus dem Link
    kommt. Der Dienst speichert nur die Huelle und kann sie nicht oeffnen.

    WAS SICH AENDERT.

    Nur die erlaubten Werte von rc_role_key_grant.key_kind. Die Tabelle selbst
    passt bereits: (role_id, key_kind, key_ref) trifft genau den Fall — die
    Rolle, die lesen darf, die Art des Schluessels, und worauf er zeigt.

    key_ref traegt die Kennung des Kandidaten, key_epoch bleibt NULL: eine
    Selbstanmeldung gehoert zu keiner Bereichsepoche. Genau das sagt auch
    rc_candidate.epoch = 0.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'ck_rc_role_key_grant_kind'
             AND parent_object_id = OBJECT_ID('dbo.rc_role_key_grant'))
BEGIN
    ALTER TABLE dbo.rc_role_key_grant DROP CONSTRAINT ck_rc_role_key_grant_kind;
END
GO

/*
    Dieselben fuenf wie zuvor, wortgleich uebernommen, plus candidate_key.

    Die alte Liste steht hier ausgeschrieben und wird nicht aus der Datenbank
    gelesen: eine Migration, die den Zustand vorfindet und fortschreibt, tut
    auf zwei Rechnern zweierlei. Was sie herstellt, muss dastehen.
*/
ALTER TABLE dbo.rc_role_key_grant ADD CONSTRAINT ck_rc_role_key_grant_kind CHECK (
    key_kind IN (N'recovery', N'role_key', N'data_key', N'shared_view', N'epoch',
                 N'candidate_key'));
GO

/*
    Eine Rolle bekommt denselben Kandidatenschluessel nicht zweimal.

    Ohne diese Regel legte ein zweites Verbinden — ein Doppelklick, ein
    erneut geoeffneter Link — eine weitere Huelle desselben Schluessels an.
    Die Leseseite naehme dann eine davon, und welche, entschiede die
    Sortierung. Zwei Wahrheiten fuer dieselbe Sache sind eine zu viel.

    Vernichtete Zuteilungen zaehlen nicht mit: nach einer Loeschung durch
    Schluesselvernichtung (12.3.2) darf dieselbe Stelle neu vergeben werden.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_rc_role_key_grant_candidate')
BEGIN
    CREATE UNIQUE INDEX uq_rc_role_key_grant_candidate
        ON dbo.rc_role_key_grant (role_id, key_ref)
        WHERE key_kind = N'candidate_key' AND destroyed_at IS NULL;
END
GO

/*
    Nachschlagen geht ueber den Kandidaten, nicht ueber die Rolle.

    Die Frage der Leseseite lautet: "welche Huellen gibt es zu DIESER
    Anmeldung" — und bei der Kontouebersicht "zu diesen Rollen". Der
    vorhandene Index auf role_id bedient das zweite; dieser das erste.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_role_key_grant_ref')
BEGIN
    CREATE INDEX ix_rc_role_key_grant_ref
        ON dbo.rc_role_key_grant (key_ref, key_kind)
        WHERE destroyed_at IS NULL;
END
GO
