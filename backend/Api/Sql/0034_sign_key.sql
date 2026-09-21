/*
    Lesen und UNTERSCHREIBEN trennen.

    =========================================================================
    DER BEFUND
    =========================================================================

    Eine Rolle hat zwei RSA-Paare (0001):

        wrap_private   packt Zuteilungen aus — damit LIEST man
        sign_private   unterschreibt Kanten und Zertifikate — damit BEFUGT man

    Beide lagen unter DEMSELBEN symmetrischen Rollenschluessel. Wer ihn bekam,
    bekam beide. Damit gab es genau eine Stufe: wer hineinsehen durfte, durfte
    auch im Namen der Rolle aufnehmen, weitergeben und umbenennen.

    0032 hat drei Stufen eingefuehrt (`holds`, `write`, `read`) und der Dienst
    ACHTET sie schon: eine Lesekante zaehlt nirgends als Befugnis. Was fehlte,
    war die andere Haelfte — dass ein Leser es auch dann nicht kann, wenn er
    den Dienst umgeht und selbst unterschreibt.

    =========================================================================
    DIE EINSICHT, DIE DAS LOEST
    =========================================================================

    Verhindern laesst sich das Schreiben nicht: wer entschluesseln kann, kann
    auch Bytes hinlegen. Was sich verhindern laesst, ist das UNTERSCHREIBEN —
    und damit faellt die Unterscheidung zwischen einer befugten Aenderung und
    einer untergeschobenen.

    Fuer Kanten und Zertifikate ist es sogar mehr als eine Unterscheidung: der
    Dienst PRUEFT die Unterschrift (`VerifyEdge`, `Access`/`Area`), also wird
    eine unsignierte Zusage gar nicht erst angenommen. Ein Leser kann keine
    gueltige Zuteilung herstellen — nicht heimlich, nicht offen.

    <b>Fuer INHALTE gilt das (noch) nicht.</b> Kein Inhaltssatz traegt heute
    eine Unterschrift; dort bleibt ein Leser mit dem Epochenschluessel
    ununterscheidbar. Das ist ein eigener Schritt und steht hier nur, damit
    niemand diese Migration fuer mehr haelt, als sie ist.

    =========================================================================
    WIE
    =========================================================================

        roleKey   oeffnet weiterhin Name und `wrap_private`   -> jede Stufe
        signKey   oeffnet `sign_private`                      -> nur `holds`

    Der `signKey` reist als eigene Zuteilung (`key_kind = 'role_sign'`), unter
    dem oeffentlichen Verpackungsschluessel des Halters — derselbe Weg wie beim
    Rollenschluessel, nur ein zweites Mal.

    =========================================================================
    BESTEHENDE ROLLEN WANDERN NICHT VON SELBST
    =========================================================================

    Ihr `sign_private_sealed` liegt unter dem Rollenschluessel, und der Dienst
    hat ihn nicht — er KANN sie nicht umschluesseln. Das muss der Browser
    dessen tun, der die Rolle haelt.

    Deshalb sagt die Zeile, in welcher Form sie vorliegt:

        key_layout = 0   `sign_private` unter dem Rollenschluessel (wie bisher)
        key_layout = 1   `sign_private` unter einem eigenen `signKey`

    Eine Rolle mit 0 kennt die Trennung nicht: dort ist jede Zuteilung noch
    eine volle. Die Oberflaeche hat das zu sagen, statt eine Schranke zu
    behaupten, die fuer diese Rolle nicht gilt.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.role') AND name = 'key_layout')
BEGIN
    ALTER TABLE app.role
        ADD key_layout tinyint NOT NULL
            CONSTRAINT df_role_key_layout DEFAULT (0);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_role_key_layout')
    ALTER TABLE app.role ADD CONSTRAINT ck_role_key_layout
        CHECK (key_layout IN (0, 1));
GO

/*
    Die zweite Zuteilungsart. `ck_key_grant_kind` zaehlt sie auf, und die
    Bedingung darunter (0001) verlangt weiterhin: nur `epoch` traegt eine
    Epoche, alles andere nicht.
*/
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_key_grant_kind')
    ALTER TABLE app.key_grant DROP CONSTRAINT ck_key_grant_kind;
GO

ALTER TABLE app.key_grant ADD CONSTRAINT ck_key_grant_kind
    CHECK (key_kind IN (N'role', N'role_sign', N'epoch', N'shared_view', N'data'));
GO
