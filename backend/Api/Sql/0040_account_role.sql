/*
    Das Konto ist keine Person.

    Seit 0006 zeigt jedes Konto auf eine Rolle (`app.account.person_role_id`),
    deren Schluessel aus dem Hauptschluessel abgeleitet wird. Sie hiess
    `person`, und die Oberflaeche nannte sie „Osoba" — aber sie ist keine:
    sie hat keinen Namen, keinen Geburtstag und keine Unterschrift unter
    einem Formular. Sie ist der Schluesselbund, an dem die Menschen dieses
    Kontos haengen.

    Seit der Anmeldung selbst die erste Person anlegt, sieht der Graph so aus:

        Konto  ──prowadzi──▶  Anna (Osoba)  ──prowadzi──▶  Sekretariat (Rola)

    Die Regel dazu, im Dienst durchgesetzt (Roles.cs, Workspace.cs):

        Das Konto haelt NUR Personen, und nur `holds`.
        Dem Konto wird NICHTS gegeben: kein Bereich, keine Adresse, kein
        Zertifikat, kein Kalendereintrag, kein Postfach.

    Wer handelt, ist immer eine Person oder eine Rolle darunter. Sonst
    stuende unter einer Seite „Konto" statt eines Menschen, und wer eine Seite
    einem Nachfolger uebergibt, muesste sein ganzes Konto mitgeben.

    Die Spalte behaelt ihren Namen. Sie umzubenennen braeche den Dienst, der
    gerade gegen dieselbe Datenbank laeuft, im Augenblick der Migration.

    Was einem Konto BISHER gegeben wurde, bleibt hier liegen: Bereiche und
    das Postfach liegen unter seinem Schluessel, und umverpacken kann nur der
    Browser. Das tut „Przekaż osobie" in den Rollen, in einem Zug.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_role_kind')
    ALTER TABLE app.role DROP CONSTRAINT ck_role_kind;
GO

ALTER TABLE app.role ADD CONSTRAINT ck_role_kind
    CHECK (kind IN (N'account', N'person', N'role', N'group'));
GO

UPDATE app.role
   SET kind = N'account'
 WHERE id IN (SELECT person_role_id FROM app.account WHERE person_role_id IS NOT NULL);
GO
