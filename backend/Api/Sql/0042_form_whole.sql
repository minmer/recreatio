/*
    Das Formular als GANZES — sein eigener Bereich, seine Klausel, sein Ende.

    =========================================================================
    ZWEI BEREICHE, NICHT EINER
    =========================================================================

    Bisher lag die BESCHRIFTUNG einer Frage unter dem Schluessel desselben
    Bereichs wie ihre ANTWORTEN (`slug_field.area_id`). Das hiess: wer die
    Frage lesen sollte, musste den Bereich lesen koennen, in den die Antworten
    gehen. Fuer ein oeffentliches Formular bedeutete das, den Bereich der
    Kandidaten zu veroeffentlichen — oder das Formular blieb draussen
    „zapieczętowane", Frage fuer Frage.

    Jetzt hat das Formular SEINEN Bereich (`module.area_id`, meist ein
    oeffentlicher: die Seite, auf der es steht), und die Fragen liegen darunter.
    Die Antworten gehen weiter dorthin, wohin die Frage sie schickt:

        die Frage          label_area_id / label_epoch   (der Bereich des Formulars)
        die Antwort        area_id / Annahme             (der Bereich der Daten)

    NULL in `label_area_id` heisst: wie vorher, unter `area_id` / `epoch`. Es
    wird nichts umgeschrieben — der Dienst kann es nicht, er hat keinen
    Schluessel. Der Browser versiegelt eine alte Frage neu, sobald jemand sie
    bearbeitet oder den Bereich des Formulars wechselt.

    =========================================================================
    EINE KLAUSEL JE FORMULAR
    =========================================================================

    „Kto odpowiada za dane" stand je Bereich der Antworten (`area_controller`).
    Ein Formular mit Fragen in zwei Bereichen fragte deshalb zweimal nach
    derselben Pfarrei. Die Klausel gehoert unter das FORMULAR — dort steht sie
    auch fuer den, der es ausfuellt. Uebernommen wird, was schon da ist: die
    Klausel des Formularbereichs, sonst die des ersten Antwortbereichs.

    =========================================================================
    GESCHLOSSEN
    =========================================================================

    `closed_at`: ab dann nimmt das Formular nichts mehr an. Es bleibt stehen,
    mit allem, was eingegangen ist — geschlossen ist nicht geloescht.
*/

IF COL_LENGTH('app.slug_field', 'label_area_id') IS NULL
    ALTER TABLE app.slug_field ADD label_area_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.slug_field', 'label_epoch') IS NULL
    ALTER TABLE app.slug_field ADD label_epoch int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_slug_field_label_area')
    ALTER TABLE app.slug_field ADD CONSTRAINT fk_slug_field_label_area
        FOREIGN KEY (label_area_id) REFERENCES app.area (id);
GO

/* Beides oder keines: ein Bereich ohne Epoche liesse sich nicht oeffnen. */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_field_label')
    ALTER TABLE app.slug_field ADD CONSTRAINT ck_slug_field_label CHECK (
        (label_area_id IS NULL AND label_epoch IS NULL)
        OR (label_area_id IS NOT NULL AND label_epoch >= 1));
GO

IF COL_LENGTH('app.module', 'closed_at') IS NULL
    ALTER TABLE app.module ADD closed_at datetimeoffset NULL;
GO

IF COL_LENGTH('app.module', 'controller_name') IS NULL
    ALTER TABLE app.module ADD controller_name nvarchar(200) NULL;
GO

IF COL_LENGTH('app.module', 'controller_address') IS NULL
    ALTER TABLE app.module ADD controller_address nvarchar(400) NULL;
GO

IF COL_LENGTH('app.module', 'controller_email') IS NULL
    ALTER TABLE app.module ADD controller_email nvarchar(200) NULL;
GO

/*
    Was schon da ist, wird uebernommen — damit ein Formular, das heute
    sammelt, es morgen auch noch tut.
*/
UPDATE m
   SET controller_name = c.name,
       controller_address = c.address,
       controller_email = c.email
  FROM app.module m
  CROSS APPLY (
      SELECT TOP 1 ac.name, ac.address, ac.email
        FROM app.area_controller ac
       WHERE ac.area_id = m.area_id
          OR ac.area_id IN (SELECT f.area_id FROM app.slug_field f WHERE f.part_id = m.id)
       ORDER BY CASE WHEN ac.area_id = m.area_id THEN 0 ELSE 1 END
  ) c
 WHERE m.kind = N'form' AND m.controller_name IS NULL;
GO
