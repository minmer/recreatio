/* 0139 — Liturgia is a parallel Library collection, not a book or a knowledge base.
   Canonical works, editions, passages, templates and assignments use the existing
   individually encrypted, versioned entry store. References are validated in the
   trusted client; the service cannot inspect private plaintext. Existing area access,
   atomic batch writes and revision history apply unchanged. No contents are published. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_library_kind' AND parent_object_id = OBJECT_ID('app.library'))
    ALTER TABLE app.library DROP CONSTRAINT ck_library_kind;
GO
ALTER TABLE app.library ADD CONSTRAINT ck_library_kind CHECK (kind IN (N'books', N'knowledge', N'writing', N'liturgy'));
GO
