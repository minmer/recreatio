/*
    Claimable root address deletion. Only the SHA-256 digest is stored here;
    the claim code was issued separately on 2026-10-02.
    frontend/src/app/routes.ts also registers this public page.
*/

IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'deletion')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
    VALUES (
        '4769bd29-78e7-4f4b-adb8-2cd1aab05893',
        N'deletion',
        0x36E6D5ECFA798CAB134869840DFD41461F6BABC317CCA1351B87D25698BAAE60,
        N'deletion. Claim code issued on 2026-10-02, kept outside Git.',
        SYSDATETIMEOFFSET());
END
GO
