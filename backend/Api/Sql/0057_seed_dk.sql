/*
    Claimable root address dk. Only the SHA-256 digest is stored here;
    the claim code was issued separately on 2026-09-30.
    frontend/src/app/routes.ts also registers this public page.
*/

IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'dk')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
    VALUES (
        '09abf799-8e10-4cc5-956c-4670d0539896',
        N'dk',
        0xF48843D27944FBD83BD86C6C4352117E3000D8BBBDC8B5A6F62F169AB9E64480,
        N'dk. Claim code issued on 2026-09-30, kept outside Git.',
        SYSDATETIMEOFFSET());
END
GO
