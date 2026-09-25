/*
    Der Aufbau eines Formulars und seine Logik.

    =========================================================================
    WAS HIER LIEGT
    =========================================================================

    Ein Formular war bisher eine Liste von Fragen. Jetzt hat es einen AUFBAU:

        Gruppen      eine Überschrift über mehreren Fragen
        Seiten       nacheinander — die nächste erst, wenn die vorige erfüllt ist
        Reiter       nebeneinander — alle zugleich erreichbar
        Texte        zwischen den Fragen

    — ineinander verschachtelt, so tief man will. Und eine LOGIK: Knoten, die
    Antworten lesen, vergleichen, verknüpfen (und, oder, nicht) und daraus
    entscheiden, ob eine Frage erscheint, was unter ihr steht, wie sie heisst,
    ob sie Pflicht ist.

    =========================================================================
    VERSIEGELT, WIE DIE FRAGEN
    =========================================================================

    Beides zusammen ist EIN Dokument, versiegelt unter dem Schluessel des
    Formularbereichs (0042) — dem, unter dem auch die Fragen liegen. Die
    Logik verraet oft mehr als die Frage: „wenn Alter < 16, frage nach dem
    Einverstaendnis der Eltern" sagt etwas ueber die Menschen, die hier
    erwartet werden.

    Der Dienst liest es nicht und kann es nicht auswerten. Das muss er auch
    nicht: er kann die Antworten ohnehin nicht lesen. Ausgewertet wird im
    Browser — dort, wo die Antworten entstehen.

    Wechselt das Formular seinen Bereich, versiegelt der Browser das Dokument
    neu, zusammen mit den Fragen (Module.UpdateAsync).
*/

IF OBJECT_ID('app.form_design', 'U') IS NULL
BEGIN
    CREATE TABLE app.form_design
    (
        module_id   uniqueidentifier NOT NULL,

        /* Unter wessen Schluessel — immer der Bereich des Formulars. */
        area_id     uniqueidentifier NOT NULL,
        epoch       int              NOT NULL,

        sealed      varbinary(max)   NOT NULL,
        updated_at  datetimeoffset   NOT NULL,

        CONSTRAINT pk_form_design PRIMARY KEY (module_id),
        CONSTRAINT fk_form_design_module FOREIGN KEY (module_id) REFERENCES app.module (id),
        CONSTRAINT fk_form_design_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_form_design_epoch CHECK (epoch >= 1)
    );
END
GO
