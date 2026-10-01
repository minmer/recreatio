/*
    DEN LINK NOCHMAL ZEIGEN (0072).

    Das Geheimnis eines Links (0065) steht nur im Link. Wer ihn angelegt hat,
    will ihn später noch einmal schicken oder als QR zeigen — deshalb liegt es
    zusätzlich VERSIEGELT unter dem Schlüssel der Linkrolle. Öffnen kann es
    nur, wer die Linkrolle hält: der, der ihn angelegt hat, und wer über ihn
    hereinkam (der den Link ohnehin schon hat).
*/

IF COL_LENGTH('app.invitation', 'token_sealed') IS NULL
    ALTER TABLE app.invitation ADD token_sealed varbinary(512) NULL;
GO
