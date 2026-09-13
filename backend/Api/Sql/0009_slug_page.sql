/*
    Was unter einer Adresse STEHT — die kleinste ehrliche Seite.

    Eine Überschrift und ein Absatz, im Klartext. Klartext, weil die Seite ohne
    Konto ausgeliefert wird: sie zu versiegeln hiesse, sie genau dem
    vorzuenthalten, für den sie da ist.

    <b>Warum sie an der ADRESSE hängt und nicht an `app.page`.</b> `app.page`
    verlangt einen Körper (`body_id`), und einen Körper gibt es erst, wenn
    Organisation, Bereich und Ämter stehen. Eine Seite, die auf den Ausbau des
    halben Modells wartet, ist eine Adresse, die nichts zeigt.

    Diese Tabelle ist deshalb ausdrücklich das Zwischenstück: eine Adresse mit
    Überschrift und Vorspann. Wenn die Seitenmaschine (statische Teile plus
    Module) steht, zeigt die Adresse auf eine `page`-Zeile, und was hier liegt,
    wandert einmalig hinüber. Bis dahin ist es das, was es ist — und nicht die
    Andeutung von etwas Grösserem.

    <b>Wer schreiben darf, steht nicht hier</b>, sondern im Register: es ist die
    Rolle, die die Adresse führt, oder die Rolle über der nächsthöheren Adresse.
    Eine zweite Rechteliste an der Seite wäre eine zweite Wahrheit.
*/

IF OBJECT_ID('app.slug_page', 'U') IS NULL
BEGIN
    CREATE TABLE app.slug_page
    (
        slug_id            uniqueidentifier NOT NULL,

        title              nvarchar(200)    NOT NULL,
        lead               nvarchar(4000)   NULL,

        updated_at         datetimeoffset   NOT NULL,

        -- WELCHE ROLLE zuletzt geschrieben hat, nicht welcher Mensch. Der
        -- Mensch wechselt, das Amt bleibt — und in einem Jahr ist die Frage
        -- „wer war dafür zuständig" die interessantere.
        updated_by_role_id uniqueidentifier NULL,

        CONSTRAINT pk_slug_page PRIMARY KEY (slug_id),
        CONSTRAINT fk_slug_page_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id),
        CONSTRAINT fk_slug_page_role FOREIGN KEY (updated_by_role_id) REFERENCES app.role (id),

        CONSTRAINT ck_slug_page_title CHECK (LEN(title) > 0)
    );
END
GO
