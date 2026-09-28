/*
    ROZMOWY FUER ALLE IM BEREICH — auch fuer den Menschen mit dem Link.

    Wunsch der Kanzlei (2026-09-28): „Hat ein Bereich eine Rozmowa, schreibt
    darin jeder aus dem Bereich — auch die Person vom Link." Zwei Dinge folgen:

        1. In der Rozmowa eines BEREICHS (kind = area) schreibt jede Rolle,
           die ihn lesen darf — nicht erst, wer dort `write` traegt. Das
           steht im Dienst, nicht hier.

        2. Ein PLATZ (0022) dieses Bereichs liest und schreibt mit.

    =========================================================================
    WARUM DER PLATZ NICHT DEN BEREICHSSCHLUESSEL BEKOMMT
    =========================================================================

    Unter dem Epochenschluessel des Bereichs liegt mehr als der Chat: die
    interne Notiz der Kanzlei zu jedem Platz, die Platzschluessel der von
    Hand ausgestellten Plaetze, die Namen der Mitglieder. Wer ihn haelt,
    oeffnet das alles — 0024 hat deshalb die Klasse von der Kanzlei getrennt.

    Also bekommt der Platz einen Schluessel, der NUR den Chat oeffnet: im
    Browser abgeleitet aus dem Epochenschluessel (HKDF, je Chat und Epoche).
    Wer den Bereich haelt, rechnet ihn sich aus; wer nur ihn haelt, kommt
    nicht zurueck zum Bereich.

    =========================================================================
    WIE ER DORTHIN KOMMT
    =========================================================================

    Ein Platz hat keine Rolle und damit keinen oeffentlichen Schluessel — und
    eine Rolle je Platz waeren zwei RSA-4096-Paare (0024). Deshalb bekommt er
    beim ersten Oeffnen der Rozmowa eine kleine EIGENE Identitaet: zwei Paare
    P-256 (ECDH zum Empfangen, ECDSA zum Unterschreiben), in seinem Browser
    erzeugt, die privaten Haelften versiegelt unter dem PLATZSCHLUESSEL. Der
    Dienst haelt nur die oeffentlichen — und die Huelle, die er nicht oeffnet.

    Den Chatschluessel verpackt ihm dann der Browser eines Mitglieds, das den
    Bereich haelt: wer die Rozmowa oeffnet, gibt ihn allen Plaetzen weiter,
    die darauf warten.

    Jede Nachricht eines Platzes ist von ihm unterschrieben wie die einer
    Rolle — ueber denselben MessageVersionRecord, nur mit ECDSA statt RSA-PSS.
*/

IF OBJECT_ID('app.seat_identity') IS NULL
    CREATE TABLE app.seat_identity
    (
        access_id       uniqueidentifier  NOT NULL,

        /* SPKI, P-256 — zum Verpacken (ECDH) und zum Pruefen der Unterschrift (ECDSA). */
        wrap_public_key varbinary(256)    NOT NULL,
        sign_public_key varbinary(256)    NOT NULL,

        /* Beide privaten Haelften, versiegelt unter dem Platzschluessel. */
        private_sealed  varbinary(2048)   NOT NULL,

        created_at      datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_seat_identity PRIMARY KEY (access_id),
        CONSTRAINT fk_seat_identity_access FOREIGN KEY (access_id) REFERENCES app.access (id)
    );
GO

/* Der Chatschluessel einer Epoche, verpackt fuer einen Platz — vom Browser eines Mitglieds. */
IF OBJECT_ID('app.chat_seat_key') IS NULL
    CREATE TABLE app.chat_seat_key
    (
        chat_id            uniqueidentifier  NOT NULL,
        access_id          uniqueidentifier  NOT NULL,
        epoch              int               NOT NULL,
        key_wrapped        varbinary(512)    NOT NULL,
        granted_by_role_id uniqueidentifier  NOT NULL,
        granted_at         datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_chat_seat_key PRIMARY KEY (chat_id, access_id, epoch),
        CONSTRAINT fk_chat_seat_key_chat FOREIGN KEY (chat_id) REFERENCES app.chat (id),
        CONSTRAINT fk_chat_seat_key_access FOREIGN KEY (access_id) REFERENCES app.access (id),
        CONSTRAINT fk_chat_seat_key_role FOREIGN KEY (granted_by_role_id) REFERENCES app.role (id)
    );
GO

/* -- Der Verfasser einer Nachricht: eine Rolle ODER ein Platz --------------- */

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.chat_message') AND name = 'author_access_id')
    ALTER TABLE app.chat_message ADD author_access_id uniqueidentifier NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.chat_message') AND name = 'author_role_id' AND is_nullable = 0)
    ALTER TABLE app.chat_message ALTER COLUMN author_role_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_chat_message_seat')
    ALTER TABLE app.chat_message ADD CONSTRAINT fk_chat_message_seat
        FOREIGN KEY (author_access_id) REFERENCES app.access (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chat_message_author')
    ALTER TABLE app.chat_message ADD CONSTRAINT ck_chat_message_author
        CHECK ((author_role_id IS NOT NULL AND author_access_id IS NULL)
            OR (author_role_id IS NULL AND author_access_id IS NOT NULL));
GO
