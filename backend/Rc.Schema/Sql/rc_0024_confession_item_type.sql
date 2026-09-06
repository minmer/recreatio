/*
    Spowiedź jako wpis kalendarza.

    DLACZEGO TO NIE JEST NOWY MODUŁ.

    Godziny spowiedzi są tym samym co godziny mszy: powtarzającym się, jawnym
    czasem w kościele, który ten kościół zajmuje. Kalendarz umie już czas,
    powtórzenie i wyjątki — osobna tabela „spowiedź" musiałaby to wszystko
    powtórzyć, a potem rozjechać się przy pierwszej poprawce.

    RÓŻNICA JEST JEDNA I ISTOTNA.

    Spowiedź nie ma intencji. Nie „zwykle nie ma" — nie ma ich w ogóle, bo nie
    ma czego czytać na głos. Dlatego typ musi być rozróżnialny: ekran, który
    proponuje dopisanie intencji do spowiedzi, pyta o coś, co nie istnieje, a
    arkusz do gabloty wypisałby ją między mszami.

    Rozpoznawanie po tytule („Spowiedź") nie wchodzi w grę — to tekst, który
    ktoś jutro napisze inaczej.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_item_type')
BEGIN
    ALTER TABLE dbo.rc_calendar_item DROP CONSTRAINT ck_rc_item_type;
END
GO

ALTER TABLE dbo.rc_calendar_item ADD CONSTRAINT ck_rc_item_type
    CHECK (item_type IN (
        N'appointment', N'task', N'mass', N'sick_round', N'confession'));
GO

/*
    Publiczny plan pyta o wpisy jawne danego typu w danym okresie. Bez tego
    indeksu każde odpytanie gabloty przechodzi przez wszystkie wpisy kalendarza
    parafii — a gablotę odpytuje każdy, kto wejdzie na stronę.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_calendar_item_public')
BEGIN
    CREATE INDEX ix_rc_calendar_item_public
        ON dbo.rc_calendar_item (calendar_id, item_type, starts_at)
        WHERE visibility = N'public';
END
GO
