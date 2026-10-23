# recreatio.pl — Pliki przez link (Thunderbird add-on)

A FileLink provider for Thunderbird: a large attachment leaves as the same encrypted link an SMS uses
(`https://recreatio.pl/#/plik/<secret>`, migration 0117), and the link shows up in **Pliki przez link** on
recreatio.pl next to the ones sent from the phone.

## How it works

- **The bytes are the app's.** `background.ts` bundles `src/app/phone/shareSeal.ts`: the secret, the id and key
  derived from it, the sealed envelope (name, type, file), JPEG photos without their EXIF place. A recipient opens
  the link in any browser, without an account; the key is only in the link.
- **No account in Thunderbird.** The add-on holds a *connection* (0125, `backend/Api/Phone/Phone.ShareDevice.cs`),
  made in the browser of the account: **Pliki przez link → Thunderbird → Połącz Thunderbirda**. The browser makes
  the key for the labels and seals it, with the connection's name, under the key of the own (private) area; the
  service makes the bearer secret, shows it once and keeps only its hash. Both together, with the service address,
  are the **connection code** (`RCFL1.…`) pasted into Thunderbird.
- **What a connection may do:** put files behind links in that area and withdraw its own. It opens no area key and
  reads nothing. Every call runs with the rights of the account that connected it; "Odłącz" (on recreatio.pl or in
  Thunderbird) stops it at once, links already sent keep working until they expire.
- The label of each link (name, type, size, secret, `via: "thunderbird"`) is sealed under the connection's key, so
  recreatio.pl lists the file by name and can copy the link again.

| Thunderbird event | What happens |
|---|---|
| `onFileUpload` | check the connection, seal, `PUT /share-device/share/{id}?days=…`; the link and its expiry go into the message |
| `onFileUploadAbort` | the upload stops; if it got through already, the link is withdrawn |
| `onFileDeleted` | the attachment left the message — `DELETE /share-device/share/{id}` |
| `onFileRename` | the name is inside the envelope: uploaded again under the new name, the old link withdrawn |
| `onAccountDeleted` | the connection revokes itself (`DELETE /share-device`) |

Thunderbird forgets after each start which FileLink accounts are configured; the background page marks every
account that has a stored connection again. Manifest V2 with a persistent background page, so a 25 MB upload over
a slow line is not suspended halfway.

## Build and install

```
cd frontend
npm run thunderbird:xpi
```

writes `thunderbird-out/recreatio-filelink-<version>.xpi` and a copy to `public/thunderbird/recreatio-filelink.xpi`,
which the website offers in the "Połącz Thunderbirda" dialog (`deploy-web.bat` builds it before the site). Both
paths are ignored by git. Thunderbird does not require signed add-ons: **Dodatki i motywy → ⚙ → Zainstaluj dodatek
z pliku**. Then **Ustawienia → Redagowanie → Załączniki → Dodaj → recreatio.pl**, paste the code, "Połącz".

The service needs migration **0125** and the API deployed with it; before that the website says the service does
not support it yet.

## Testing against a local service

```
npm run thunderbird:xpi -- --api http://localhost:50938 --out <folder>
```

builds a variant that may also talk to that address (host permission and the allowed list); it never goes to
`public/`. A code made by a web app on `localhost` names `http://localhost:<port>/api`.

## Files

| File | What |
|---|---|
| `manifest.json` | name, id `filelink@recreatio.pl`, `cloud_file`, permissions (`storage`, `https://api.recreatio.pl/*`) |
| `background.ts` | Thunderbird events, the settings page's questions, marking accounts at start |
| `filelink.ts` | reading the code, calls with the bearer secret, sealing and uploading, the template info |
| `settings.html`, `settings.ts`, `settings.css` | the page in Thunderbird's settings (paste the code, validity of new links, disconnect) |
| `protocol.ts` | what the settings page asks the background page |
| `messenger.ts` | types of the parts of Thunderbird's API that are used |
| `icons/` | the logo on a white tile (visible on a dark Thunderbird too) |
