/*
    Zugang zu einer Adresse — für andere Rollen als die, die sie führt.

    <b>Zwei getrennte Fragen, und der Kernel trennt sie schon.</b> Nach 3.5 ist
    `certify` KEINE höhere Stufe, sondern steht neben der Leiter: es deckt
    nichts ab, und nichts deckt es ab. Genau das ist hier gebraucht:

        write            darf die Seite ändern
        write + certify  darf sie ändern UND Unterseiten öffnen sowie
                         weitergeben
        certify allein   darf aufnehmen, ohne selbst hineinzusehen — der
                         Pfarrer, der jemanden in eine Gruppe holt, deren
                         Inhalte ihn nichts angehen

    Mehrere Rollen an derselben Seite sind damit nicht Sonderfall, sondern der
    Normalfall: je Rolle ein Zertifikat, je Zertifikat eine Stufe.

    <b>Warum Zertifikate und keine Rechtespalte.</b> Eine Spalte schreibt, wer
    die Datenbank hält. Ein Zertifikat trägt die Unterschrift der ausstellenden
    Rolle, und die kann er nicht herstellen — der private Schlüssel liegt
    versiegelt und geht nur im Browser seines Halters auf. Dieselbe Überlegung
    wie bei der Rollenkante (0008), und dieselbe Tabelle wie in 0001.
*/

/*
    `slug` als Geltungsbereich.

    Die Prüfliste stand auf `area` und `body` — beides Dinge, die es im Neubau
    noch nicht gibt. Die Adresse gibt es, und sie ist das erste, woran jemand
    Zugang braucht.
*/
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_certificate_scope')
    ALTER TABLE app.certificate DROP CONSTRAINT ck_certificate_scope;
GO

ALTER TABLE app.certificate ADD CONSTRAINT ck_certificate_scope
    CHECK (scope_kind IN (N'area', N'body', N'slug'));
GO

/*
    Eine Adresse, die von OBEN geöffnet wurde, hat keinen Code.

    Wer `parish` führt, öffnet `parish/aktualnosci` selbst — es gibt niemanden,
    dem man dafür ein Geheimnis schicken müsste, und ein erfundener Code wäre
    eine Behauptung über eine Tür, die es nicht gibt.

    NULL heisst deshalb: nicht durch Eintippen zu haben. Und damit daraus keine
    unerreichbare Zeile wird, hält die Prüfung das Paar zusammen — ohne Code
    UND ohne Halter gäbe es eine Adresse, die niemand je bekommen kann.
*/
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_claim')
    ALTER TABLE app.slug DROP CONSTRAINT ck_slug_claim;
GO

ALTER TABLE app.slug ALTER COLUMN claim_code_sha256 varbinary(32) NULL;
GO

ALTER TABLE app.slug ADD CONSTRAINT ck_slug_claim
    CHECK ((claimed_by_role_id IS NULL     AND claimed_at IS NULL AND claimed_by_account_id IS NULL)
        OR (claimed_by_role_id IS NOT NULL AND claimed_at IS NOT NULL));
GO

ALTER TABLE app.slug ADD CONSTRAINT ck_slug_reachable
    CHECK (claim_code_sha256 IS NOT NULL OR claimed_by_role_id IS NOT NULL);
GO
