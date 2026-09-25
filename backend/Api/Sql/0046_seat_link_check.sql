/*
    Der Link eines Menschen: für die Kanzlei wieder lesbar, beim ersten Öffnen
    geprüft, und die ganze Einsendung auf einmal bestätigt.

    =========================================================================
    1. DER LINK, FÜR DIE KANZLEI WIEDER LESBAR (access.link_sealed)
    =========================================================================

    Gespeichert war vom Link nur sein Abdruck. Wollte die Kanzlei einem
    Menschen seinen Link per SMS schicken, musste sie einen NEUEN ausstellen —
    von Hand, je Mensch, und der alte starb dabei. Jetzt liegt der Link
    zusätzlich versiegelt unter dem PLATZSCHLÜSSEL: wer den Platz öffnen kann
    (die Kanzlei, der Mensch selbst), liest auch seinen Link. Der Dienst nicht.

    =========================================================================
    2. BEIM ERSTEN ÖFFNEN: IST DAS DER RICHTIGE MENSCH? (verify_*)
    =========================================================================

    Ein Link in einer SMS kann bei der falschen Nummer landen. Das Formular
    sagt, welche Angaben der Öffnende einmal bestätigen muss (slug_field.
    link_check, etwa Imię und Nazwisko). Aus ihnen rechnet der BROWSER einen
    langsamen Abdruck (PBKDF2, Salz: die Kennung des Platzes) — bei der
    Anmeldung oder beim Ausstellen durch die Kanzlei, die die Antworten ja
    kennt. Der Dienst hält nur den Abdruck.

    Solange nicht bestätigt ist, gibt der Dienst den Platzschlüssel NICHT
    heraus — und ohne ihn ist nichts zu lesen. Wer richtig antwortet, wird
    nicht wieder gefragt (verified_at). Nach zehn Fehlversuchen ist Schluss;
    die Kanzlei stellt einen neuen Link aus.

    =========================================================================
    3. DIE GANZE EINSENDUNG AUF EINMAL BESTÄTIGT (registration.confirmed_at)
    =========================================================================

    Bisher wurde jede Nummer einzeln bestätigt. Jetzt sieht der Mensch nach dem
    ersten Öffnen ALLES, was er angegeben hat — vor allem die Kontakte — und
    bestätigt es einmal. Ändert er etwas, bekommt er einen neuen Link, und der
    alte hört auf zu gelten (Seat.RotateAsync).
*/

IF COL_LENGTH('app.access', 'link_sealed') IS NULL
    ALTER TABLE app.access ADD link_sealed varbinary(max) NULL;
GO

IF COL_LENGTH('app.access', 'verify_hash') IS NULL
    ALTER TABLE app.access ADD verify_hash varbinary(32) NULL;
GO

/* Welche Fragen beim ersten Öffnen gestellt werden — die Kennungen, durch Kommas getrennt. */
IF COL_LENGTH('app.access', 'verify_fields') IS NULL
    ALTER TABLE app.access ADD verify_fields nvarchar(2000) NULL;
GO

IF COL_LENGTH('app.access', 'verified_at') IS NULL
    ALTER TABLE app.access ADD verified_at datetimeoffset(7) NULL;
GO

IF COL_LENGTH('app.access', 'verify_failures') IS NULL
    ALTER TABLE app.access ADD verify_failures int NOT NULL
        CONSTRAINT df_access_verify_failures DEFAULT (0);
GO

IF COL_LENGTH('app.slug_field', 'link_check') IS NULL
    ALTER TABLE app.slug_field ADD link_check bit NOT NULL
        CONSTRAINT df_slug_field_link_check DEFAULT (0);
GO

IF COL_LENGTH('app.registration', 'confirmed_at') IS NULL
    ALTER TABLE app.registration ADD confirmed_at datetimeoffset(7) NULL;
GO
