/*
    Claimable root address cogita (recreatio.pl/cogita). Only the SHA-256 digest is stored here;
    the claim code was issued separately on 2026-10-16.
    frontend/src/app/routes.ts also registers this public page.
*/

IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'cogita')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
    VALUES (
        '01a14332-a36e-7417-90f6-da817da58caa',
        N'cogita',
        0x63393236504BC7A16430BA278B12B5EC458631639C84DF83AB10D71454072871,
        N'cogita. Claim code issued on 2026-10-16, kept outside Git.',
        SYSDATETIMEOFFSET());
END
GO
