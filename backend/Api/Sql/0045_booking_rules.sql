/*
    Wie viele Termine ein Mensch halten darf — und wer eine Rolle ist, nicht
    nur ein Platz.

    =========================================================================
    1. JE MENSCH HOECHSTENS SO VIELE
    =========================================================================

    Bisher zaehlte nur der Termin selbst (`capacity`: wie viele auf EINEM
    Termin sitzen). Wie viele Termine EINER sich nimmt, zaehlte niemand: ein
    Firmling konnte fuenf Treffen belegen, und vier andere fanden keines.

    `per_person` — 0 heisst: keine Grenze (so war es bisher). Gezaehlt werden
    die Ansprueche, die noch stehen oder warten und noch nicht vorbei sind
    (Bookings.TakeAsync, unter derselben Sperre wie die Plaetze).

    =========================================================================
    2. DER CODE DES GASTGEBERS — WIEDER LESBAR, ABER NUR FUER IHN
    =========================================================================

    Bisher stand der Code EINMAL in der Antwort und sonst nirgends; wer
    „Ukryj" drueckte, hatte ihn verloren. Jetzt wuerfelt ihn der Browser,
    schickt seinen Abdruck (wie bisher gespeichert) und dazu den Code,
    versiegelt unter dem Schluessel dessen, der den Termin haelt — seines
    Platzes oder seiner Person. Der Dienst kann ihn nicht lesen; der Halter
    liest ihn, sooft er will.

    =========================================================================
    3. EINE ROLLE NIMMT SICH EINEN TERMIN
    =========================================================================

    `role_id` stand schon in 0039 („ein Platz ODER eine Rolle"), genommen
    wurde aber nur mit einem Platz. Wer angemeldet ist, waehlt jetzt eine
    seiner Personen — und nimmt fuer sie. Ihr Name ist versiegelt; damit die
    Kanzlei weiss, wer da sitzt, geht ein Name OFFEN mit (`holder_name`),
    genau wie `recipient_name` am Platz.
*/

IF COL_LENGTH('app.resource', 'per_person') IS NULL
BEGIN
    ALTER TABLE app.resource
        ADD per_person int NOT NULL CONSTRAINT df_resource_per_person DEFAULT (0);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_resource_per_person')
    ALTER TABLE app.resource ADD CONSTRAINT ck_resource_per_person CHECK (per_person >= 0);
GO

IF COL_LENGTH('app.claim', 'invite_sealed') IS NULL
    ALTER TABLE app.claim ADD invite_sealed varbinary(max) NULL;
GO

IF COL_LENGTH('app.claim', 'holder_name') IS NULL
    ALTER TABLE app.claim ADD holder_name nvarchar(200) NULL;
GO

/* Zweimal dieselbe ROLLE auf demselben Termin geht so wenig wie zweimal derselbe Platz. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_claim_offer_role')
    CREATE UNIQUE INDEX uq_claim_offer_role
        ON app.claim (item_id, occurrence_at, role_id)
        WHERE item_id IS NOT NULL AND role_id IS NOT NULL
          AND status IN (N'pending', N'confirmed');
GO

/* „Was haelt DIESE Person" — die Frage einer Seite mit Anmeldung. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_claim_role')
    CREATE INDEX ix_claim_role ON app.claim (role_id) WHERE role_id IS NOT NULL;
GO
