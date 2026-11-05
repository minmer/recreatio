/*
    0137 — DIE GEFÜHRTE EINRICHTUNG EINER WSPÓLNOTA (`frontend/src/app/communities/`).

    Eine Wspólnota ist ein Baum von Bereichen (Einheiten) mit Positionen (Rollen), Personen
    (persönliche Links) und den fünf Schritten der Einrichtung je Einheit. Ihr Dokument
    („recreatio/community") liegt versiegelt unter dem Epochenschlüssel des Bereichs:

      app.area_setup          je Bereich ein Dokument — in der Wurzel die ganze Wspólnota, in jeder
                              Einheit darunter, was ihre Menschen lesen sollen (Name, Positionen,
                              Startseite, „verwaltet durch")
      app.area_setup_history  die vorigen Fassungen der Wurzel (höchstens 20 je Bereich), zum
                              Rückgängigmachen

    Der Dienst liest nichts davon; er prüft nur, wer schreiben darf (admin) und wer lesen (read,
    auch über Links). Noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID('app.area_setup') IS NULL
BEGIN
    CREATE TABLE app.area_setup
    (
        area_id     uniqueidentifier  NOT NULL,
        epoch       int               NOT NULL,
        sealed_blob varbinary(max)    NOT NULL,
        version     int               NOT NULL,
        role_id     uniqueidentifier  NULL,
        updated_at  datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_area_setup PRIMARY KEY (area_id),
        CONSTRAINT fk_area_setup_area FOREIGN KEY (area_id) REFERENCES app.area (id) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID('app.area_setup_history') IS NULL
BEGIN
    CREATE TABLE app.area_setup_history
    (
        id          uniqueidentifier  NOT NULL,
        area_id     uniqueidentifier  NOT NULL,
        epoch       int               NOT NULL,
        sealed_blob varbinary(max)    NOT NULL,
        version     int               NOT NULL,
        created_at  datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_area_setup_history PRIMARY KEY (id),
        CONSTRAINT fk_area_setup_history_area FOREIGN KEY (area_id) REFERENCES app.area (id) ON DELETE CASCADE
    );
    CREATE INDEX ix_area_setup_history_area ON app.area_setup_history (area_id, created_at DESC);
END
GO
