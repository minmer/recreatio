/*
    Claimable root address hortusdei (recreatio.pl/hortusdei). Only the SHA-256 digest is stored here;
    the claim code was issued separately on 2026-10-18.
    Since 2026-10-16 every first path segment that is not a route word is a page — no frontend change needed.
*/

IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'hortusdei')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
    VALUES (
        'f3f7090c-0026-45e2-8e03-e65fcf864b8d',
        N'hortusdei',
        0x6732B326E7168CE88CE816F219106973B9FCF69F108388418E40FA5017A734A5,
        N'hortusdei. Claim code issued on 2026-10-18, kept outside Git.',
        SYSDATETIMEOFFSET());
END
GO
