/*
    Der Anhang merkt sich seine Epoche selbst.

    -------------------------------------------------------------------------
    WARUM DAS VORHER NICHT NOETIG WAR
    -------------------------------------------------------------------------

    Ein Anhang hing an einer Nachricht, und die Nachricht wusste, unter welcher
    Epoche sie versiegelt ist (`rc_message.epoch`). Zum Oeffnen genuegte also
    ein Verbund: `EpochOfMessageAsync` holte die Zahl von dort.

    Seit rc_0028 haengt ein Anhang auch an einem Veranstaltungsteil oder an
    einer Veranstaltung. Die haben keine Epoche — der TEIL hat eine, die
    Veranstaltung nicht, und ein Bild in einer Galerie gehoert weder eindeutig
    zum einen noch zum anderen.

    Der Verbund haette also je Traegerart anders ausgesehen, und beim Hinzufuegen
    der naechsten Art haette jemand vergessen, ihn zu erweitern. Das faellt nicht
    beim Uebersetzen auf: es faellt auf, wenn ein Bild sich nicht mehr oeffnen
    laesst.

    -------------------------------------------------------------------------
    WARUM DIE EPOCHE UEBERHAUPT MITGESCHRIEBEN GEHOERT
    -------------------------------------------------------------------------

    Sie ist keine Eigenschaft des Traegers, sondern der VERSIEGELUNG: unter
    welchem Schluessel diese Bytes zugemacht wurden. Der Bereich schneidet
    spaeter neue Epochen; der Anhang bleibt unter seiner. Wer sie aus der
    aktuellen ableitet, kann eine alte Datei nicht mehr oeffnen — und merkt es
    erst an der Datei.
*/

IF COL_LENGTH('dbo.rc_attachment', 'epoch') IS NULL
BEGIN
    ALTER TABLE dbo.rc_attachment ADD epoch int NULL;
END
GO

/*
    Nachtrag fuer die vorhandenen: ihre Epoche ist die ihrer Nachricht. Ohne
    diesen Schritt stuenden sie auf NULL und waeren nur noch ueber den alten
    Verbund zu oeffnen — der bleibt zwar, aber zwei Wahrheiten ueber dieselbe
    Zahl laufen irgendwann auseinander.
*/
UPDATE a
   SET a.epoch = m.epoch
  FROM dbo.rc_attachment a
  JOIN dbo.rc_message m ON m.id = a.message_id
 WHERE a.epoch IS NULL;
GO
