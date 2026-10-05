/*
    Claimable root address events (recreatio.pl/events). Only the SHA-256 digest is stored here;
    the claim code was issued separately on 2026-10-05.
    frontend/src/app/routes.ts also registers this public page.
*/

IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'events')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
    VALUES (
        '01a10c9e-7aeb-7a98-b3ca-d3d301704574',
        N'events',
        0x9FD3896FA2C3418921B9C509FDD6A9485805960E8C53FE7B3F661078E95ECA38,
        N'events. Claim code issued on 2026-10-05, kept outside Git.',
        SYSDATETIMEOFFSET());
END
GO
