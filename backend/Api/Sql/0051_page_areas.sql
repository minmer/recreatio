/*
    Eine Seite NUR MIT ZUGANG — gebunden an BEREICHE, nicht an eine Rolle.

    Wunsch der Kanzlei (2026-09-28): nicht „wer die Rolle X haelt", sondern
    „wer Zugang zu diesem Bereich hat" — oder zu einem von mehreren. Das ist
    die Einheit, in der die Kanzlei ohnehin denkt: die Anmeldungen der
    Firmlinge liegen im Bereich der Firmung, ihre Links auch.

    Zugang zu einer Seite mit Bereichen hat:

        ein LINK        dessen Platz in einem dieser Bereiche liegt
                        (access.area_id) — oder der an genau diese Seite
                        gehaengt ist (access_slug, wie bisher)
        eine PERSON     die einen dieser Bereiche lesen darf (ein Zertifikat
                        read/write/admin fuer eine ihrer Rollen)
        wer die Seite fuehrt

    Keine Zeile heisst: die Seite ist oeffentlich — es sei denn, sie traegt
    noch die alte Rollenbindung (internal_for_role_id, 0026); die gilt weiter,
    bis jemand Bereiche waehlt.
*/

IF OBJECT_ID('app.slug_area') IS NULL
    CREATE TABLE app.slug_area
    (
        slug_id uniqueidentifier NOT NULL,
        area_id uniqueidentifier NOT NULL,

        CONSTRAINT pk_slug_area PRIMARY KEY (slug_id, area_id),
        CONSTRAINT fk_slug_area_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id),
        CONSTRAINT fk_slug_area_area FOREIGN KEY (area_id) REFERENCES app.area (id)
    );
GO
