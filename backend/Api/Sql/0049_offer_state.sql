/*
    Ein Termin, den die Kanzlei in der Hand hat — und eine Mindestzahl.

    =========================================================================
    1. ZU, AUCH WENN NOCH PLATZ IST (app.offer_state)
    =========================================================================

    Die Kanzlei schliesst einen Termin, obwohl Plaetze frei sind (der Priester
    will nur diese drei), und oeffnet ihn wieder. Der GASTGEBER kann seinen
    Termin ebenfalls schliessen — sobald genug Menschen darauf sitzen (siehe
    2.) — und wieder oeffnen, solange nicht die Kanzlei ihn geschlossen hat.

    Je Vorkommen eine Zeile, und nur wenn es geschlossen ist. Wer ihn
    geschlossen hat, steht dabei: was die Kanzlei schliesst, oeffnet kein
    Gastgeber.

    =========================================================================
    2. DIE MINDESTZAHL (resource.min_persons)
    =========================================================================

    Nach dem Fenster des Gastgebers faellt ein Termin an alle zurueck — ausser
    es sitzen schon so viele darauf, wie die Kanzlei als Mindestzahl gesetzt
    hat: dann gehoert er der Gruppe und oeffnet sich nicht wieder. Dieselbe
    Zahl erlaubt dem Gastgeber, ihn selbst zu schliessen. Voreinstellung 2 —
    genau das, was bisher galt (einer allein fiel zurueck, zwei nicht).

    =========================================================================
    3. VON DER KANZLEI EINGETRAGEN (claim.by_office)
    =========================================================================

    Die Kanzlei traegt Menschen selbst ein — auch ueber die Plaetze hinaus.
    Einen mit Link (dann sieht er den Termin bei sich), oder einfach einen
    Namen, fuer jemanden ohne Link. Dafuer darf ein Anspruch auch nur einen
    Namen tragen.
*/

IF COL_LENGTH('app.resource', 'min_persons') IS NULL
    ALTER TABLE app.resource ADD min_persons int NOT NULL
        CONSTRAINT df_resource_min_persons DEFAULT (2);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_resource_min_persons')
    ALTER TABLE app.resource ADD CONSTRAINT ck_resource_min_persons CHECK (min_persons >= 1);
GO

IF OBJECT_ID('app.offer_state') IS NULL
    CREATE TABLE app.offer_state
    (
        item_id       uniqueidentifier  NOT NULL,
        occurrence_at datetimeoffset(7) NOT NULL,
        resource_id   uniqueidentifier  NOT NULL,

        /* Wer geschlossen hat: die Kanzlei, oder der Gastgeber des Termins. */
        closed_by     nvarchar(8)       NOT NULL,
        closed_at     datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_offer_state PRIMARY KEY (item_id, occurrence_at),
        CONSTRAINT fk_offer_state_item FOREIGN KEY (item_id) REFERENCES app.calendar_item (id),
        CONSTRAINT fk_offer_state_resource FOREIGN KEY (resource_id) REFERENCES app.resource (id),
        CONSTRAINT ck_offer_state_by CHECK (closed_by IN (N'office', N'host'))
    );
GO

IF COL_LENGTH('app.claim', 'by_office') IS NULL
    ALTER TABLE app.claim ADD by_office bit NOT NULL CONSTRAINT df_claim_by_office DEFAULT (0);
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_claim_who'
            AND OBJECT_NAME(parent_object_id) = 'claim' AND definition NOT LIKE '%holder_name%')
    ALTER TABLE app.claim DROP CONSTRAINT ck_claim_who;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_claim_who'
                AND OBJECT_NAME(parent_object_id) = 'claim')
    ALTER TABLE app.claim ADD CONSTRAINT ck_claim_who
        CHECK (access_id IS NOT NULL OR role_id IS NOT NULL OR (by_office = 1 AND holder_name IS NOT NULL));
GO
