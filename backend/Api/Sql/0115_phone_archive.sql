/* 0115 — DAS ARCHIV DER SMS, nach Gesprächen (zu 0114).

   Ein Stapel enthält jetzt die Nachrichten EINES Gesprächs, und neben ihm
   liegt eine kleine versiegelte Übersicht (`summary`): wer, wie viele, von
   wann bis wann, die letzte Nachricht. So steht im Browser die Liste der
   Gespräche, ohne dass jede Nachricht geladen werden muss, und ein Gespräch
   lädt nur seine eigenen Stapel. Der Dienst öffnet auch diese Hülle nicht.

   Archiviert wird in den Bereich der Rolle, der das Archiv gehört (wählbar);
   mehrere Telefone (ein altes, ein neues) archivieren in denselben Bereich,
   und dieselbe Nachricht erkennen sie an ihrem Abdruck.
*/
IF COL_LENGTH('app.phone_sms_batch', 'summary') IS NULL
    ALTER TABLE app.phone_sms_batch ADD summary varbinary(8000) NULL;
GO
