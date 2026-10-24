# REcreatio for Android

The Android app runs the same web bundle as recreatio.pl inside a Capacitor 8 shell. The bundle ships **inside the APK** and is served on the phone from `https://recreatio.pl`. Only the service at `api.recreatio.pl` is reached over the network.

Two things follow from the origin being `https://recreatio.pl`:

- The service's session cookie is first-party, and CORS already allows this origin.
- The code that holds the keys is the code that was installed, not whatever a server hands out today.

The trade-off is that a new frontend reaches the phone only with a new APK.

It needs no Google Play services, so it runs on GrapheneOS without sandboxed Play.

## Build

Requirements:

- Node 22+
- JDK 21
- Android SDK with `platforms;android-36` and `build-tools;36.0.0`

The scripts find Android Studio and Visual Studio installs by themselves. Otherwise set `JAVA_HOME` and `ANDROID_HOME`.

```sh
cd frontend
npm run android:keystore        # once — creates the signing key outside the repo
npm run android:apk             # signed release  → android-out/recreatio-<version>.apk (+ recreatio-sms-<version>.apk)
npm run android:release         # APK + AAB (for Google Play) → android-out/
npm run android:publish         # newest AAB → Google Play, internal testing, draft
npm run android:apk -- --debug  # debug build, WebView inspectable via chrome://inspect
```

**Two deploy files.** `deploy-web.bat` deploys the site to `docs/`. `deploy-app.bat` builds the APK and AAB and uploads the AAB to Google Play if `~/.recreatio/android/play-service-account.json` exists. Without the signing key it stops. `deploy-app.bat --skip-web` builds the app from the `dist/` that `deploy-web.bat` left, so the app carries exactly the files that went online. Without it, the app builds the site itself and `docs/` stays untouched.

`android:apk` does four things:

1. Builds the site with Vite.
2. Copies it into the Android project (`cap sync`).
3. Builds with Gradle.
4. Prints the APK path, the version, and two SHA-256 values: one for the signing certificate and one for the file.

Versions:

- `versionName` is the `package.json` version plus the UTC build time, e.g. `0.1.0+20260930.1412`.
- `versionCode` is minutes since 2026-01-01 UTC, so every build installs over the previous one.

`npm run android:icons` regenerates the launcher, notification and splash images from `public/logo/android-chrome-512x512.png`. It needs `ffmpeg`.

## Install on GrapheneOS

1. Copy the APK to the phone and open it in *Files*. When asked, allow *Files* to install unknown apps. Over USB, `adb install recreatio-….apk` works too.
2. Leave the **Network** permission on in the install dialog.
3. Updates install over the old version the same way. They must be signed with the same key.

Notes:

- *Exploit protection → WebView JIT* may be turned off for the app. It still works, because Vanadium runs WebAssembly without JIT, but the login key derivation (Argon2) gets slower.
- Signing fingerprint (SHA-256): `69:0E:01:3E:6F:97:63:81:AE:0D:DF:1A:E1:52:00:05:52:5A:9B:D1:1C:31:C6:5D:97:64:81:56:BE:2C:72:1C`

## What the shell adds

| Area | What happens |
| --- | --- |
| Start | Opens `#/workspace` rather than the public start page. |
| Keys | Under *Konto → Klucz: Zachowany*, the device's opener lives in the **Android Keystore** (StrongBox on Pixels), not in `localStorage`, via `KeyVaultPlugin`. The key survives an app restart, and a copy of the app data alone opens nothing. |
| Backup | `allowBackup=false`: nothing goes into Seedvault or a cloud backup. On a new phone you sign in again. |
| Links | Links to `recreatio.pl` open in the app. |
| Back button | Closes an open dialog first, then goes back in history, then moves the app to the background. |
| Downloads | `<a download>` of a `blob:` goes through the system file picker (`FileSaverPlugin`). |
| Notifications | With content, opened on the phone: chats as conversations with a reply field, forms with names, task reminders with **Zrobione** (`Notices`, see below). Shown also while the app is open, except for the chat that is open. A WorkManager job checks every 15 min or more while the app is closed (`NotifyWorker`). With Firebase built in, the service wakes the phone at once (`PushService`). On the first start the app asks for notification permission once. |
| Theme | Follows the system's light/dark mode, including the status bar icons. |

In code, everything platform-specific lives in `src/app/platform.ts` (vault, notices, saveBlob) and `src/shell.ts` (start, links, back button, downloads). The native side is `android/app/src/main/java/pl/recreatio/app/`.

### App links

Links need `https://recreatio.pl/.well-known/assetlinks.json`, which lives in `public/`, so it goes out with the next frontend deploy. `public/.nojekyll` is required so that GitHub Pages serves the dot-folder. Until then, enable links by hand: *App info → Open by default → Add link*.

## The signing key

It lives in `~/.recreatio/android/`: `recreatio-release.p12` plus `signing.properties` with the password.

**Back up both, somewhere other than this computer.** Without them there is no update for installed apps. If the key is ever replaced:

- the fingerprint in `public/.well-known/assetlinks.json` must change with it;
- users must uninstall and reinstall the app.

For Google Play, the same key becomes the upload key.

### Push (0075)

Firebase Cloud Messaging is only a **wake-up signal**. It carries `{"kind":"check"}` and nothing else, and the phone then fetches the counts with its device token (`/notify/digest`). It is built **without** the google-services Gradle plugin:

1. Firebase console, project `recreatio` → add an Android app `pl.recreatio.app` → download `google-services.json`.
2. Put it at `android/app/google-services.json` (gitignored), or point `$RECREATIO_FIREBASE` at it. The build reads four values into `BuildConfig`, and `PushSetup` starts Firebase with them. Without the file the app builds without push and only checks on its schedule.
3. The service needs the project's service account key: `Push:Fcm:ServiceAccountFile` in `backend/Api/appsettings.json`. It points at `secrets/firebase-service-account.json` (gitignored, published with the API). A relative path counts from the app folder. The log says `Push on — Firebase project …` or why push is off.

*Powiadomienia → Ustawienia* shows whether push works on this phone. All three parts must be there: the app built with Firebase, the service with the key, and the phone's token received.

### Content and direct replies (0076)

Notifications show **who wrote what**: chats in conversation style, with **Odpowiedz** (a reply field) and **Przeczytane**. Forms show the registrant's name, link joins show the link and area, and task reminders show the title with **Zrobione**. Firebase still carries only `{"kind":"check"}`. The content travels sealed over the app's own connection and is opened on the phone:

| Step | Where |
| --- | --- |
| Wake-up (push, or the 15-minute check) | `PushService` → `RichWork` → `Inbox.check` |
| Nothing new (counts and newest message unchanged)? Stop, no WebView. | `Inbox.check` |
| Open the content: an invisible WebView loads the app's own `runner.html` from the APK, with the same session and key vault | `RunnerHost` → `src/runner.ts` → `notifyRich.ts` |
| Show it; only new lines alert; swiped-away chats come back only with something new | `Notices` |
| Reply, Przeczytane, Zrobione: the runner seals, signs and sends; a retry never sends twice | `ActionReceiver` → `RichWork` |
| Task reminders with titles, in the phone's own alarm, re-planned after a reboot | `Reminders`, `ReminderReceiver` |

The crypto is not re-implemented in Java. The runner is the app's own TypeScript, the same code that seals in the chat. When the app is open, the page opens the content itself and hands it to `Notices` (`NotifyPlugin.present`).

**It needs the key on the phone.** That means *Konto → Klucz: Zachowany*, or the app still running with the key in memory. Otherwise the notification shows only the counts, as before. The settings panel says which case applies. On a lock screen that hides sensitive content, Android shows only „Nowa wiadomość". Content can be switched off: *Powiadomienia → Ustawienia → Treść w powiadomieniach*.

**Testing without Google services.** A debug build has a test receiver (`src/debug`, absent from release builds) that does what a push would do:

```sh
adb shell am broadcast -n pl.recreatio.app/.DebugWake -a pl.recreatio.app.DEBUG_WAKE
```

## The SMS edition

The same app with SMS, MMS and the phone's address book. It is meant for one phone and never goes to Google Play. `npm run android:apk` and `npm run android:release` build it in the same run as `android-out/recreatio-sms-<version>.apk` (Gradle flavour `sms`, native code in `app/src/sms/`). It has the same application id and signature as the normal app, so a phone has one or the other, and each installs over the other with the data kept.

| What | Where |
| --- | --- |
| Being the phone's SMS app: receiving SMS and MMS, sending both, notifications with a reply field, quick replies to calls, `sms:` links. The phone's own message store stays the store. | `SmsReceiver`, `MmsReceiver` (own PDU codec `MmsPdu`), `SmsSender`, `SmsNotices`, `RespondService`, `ComposeActivity` |
| The SMS view `#/workspace/sms` looks and works like Rozmowy but stays separate from it. The list has the same rows (picture, name, time, last message, unread count, a crossed bell when muted). A conversation is a room: a head with back, picture, name, call, 🔍 (search in the conversation) and ⋮; bubbles left and right under day labels; ↓ with the count of new messages; the round field with 📎 (camera, photos and videos, a file as a link) and ▾ next to the send arrow (*Wyślij później…*). The first time, a conversation opens at the end; after that, where you left it. The phone remembers this per conversation, also after the app is closed; the browser remembers it while the tab is open, because the key there contains phone numbers. If new (unread) messages came in, for example when you open the conversation from a notification, it goes to them instead, with *Nieprzeczytane* above the first one: they stand at the top when they don't all fit, otherwise the conversation shows the end. ↓ with a count goes to the first of the messages that came while you read further up. Tapping into the field to write takes the conversation to the end, so the newest messages stand right above the keyboard and leaving after writing reopens at the end. When the keyboard opens, the field grows or a picture loads, the messages at the bottom stay in place and older ones move out of view at the top. | `src/app/phone/SmsApp.tsx`, `smsChat.tsx` (built from `chat/ChatKit`), `Composer.tsx` |
| Two SIMs: a chip next to the name in a conversation's head shows the own number that sends. Tapping it switches the number for that conversation. A contact group can have its own number (*SMS → ⋮ → Numery i grupy*, or the group's chip in *Kontakty*), and then everyone in the group gets SMS from that number. The order is: the conversation's own choice, then the group's number, then the SIM the last message came in on, then the phone's SMS SIM. The rules are stored by number and sealed with the account (`/workspace/state`), so every phone uses the same ones. A reply from a notification and *Napisz SMS* from Formularze follow them too. On the phone the chip appears only with two SIMs. In the browser, the number chip of a conversation starts from the same rules, and a number picked there becomes the conversation's choice on the phone too. | `lines.ts`, `LineChip` in `smsChat.tsx`, `LinesView.tsx`, `SmsSheet.tsx`, `Phone.threadSubs` → `Spam.threadSub`, `ruledNumber` (browser, `SmsArchiveView.tsx`) |
| The head also shows whether the conversation goes into the archive (*w archiwum* / *poza archiwum*). When the archive takes only chosen conversations, ⋮ adds this one or takes it out. | `ArchiveMark` in `smsChat.tsx` |
| Spam: ⋮ in a conversation has *Wycisz…* (8 hours, a week, or for good), *Zablokuj (spam)…* and *Usuń rozmowę z telefonu…*. A muted conversation gets no notification and a crossed bell in the list. Blocking adds the number to Android's own block list, so the system drops its SMS and calls for every app. It also deletes the conversation from the phone and, if you tick it, from the archive. *SMS → ⋮ → Zablokowane numery* lists blocked numbers, each with *Odblokuj*. | `Spam.java`, `PhonePlugin` `mute`/`block`/`unblock`/`deleteThread`, `SmsReceiver`/`MmsReceiver` (drop blocked senders), `SmsNotices` |
| "Napisz SMS" in Formularze → Osoby opens a sheet that sends at once, and the list stays where it was. | `SmsSheet.tsx` |
| The archive (*SMS → ⋯ → Archiwum*) belongs to a role you choose: your own person (its private area) or another role you hold, which gets its own area "Archiwum SMS". Whoever holds that role reads it, also in the browser. You can archive all conversations or only the ones you tick. Each archived conversation goes in whole, and after that new messages follow on their own, shortly after they arrive or are sent and twice a day. Nothing is archived on its own until you choose a role or press *Archiwizuj teraz* once. | `archiveSettings.ts`, `smsArchive.ts`, `SmsArchiveView.tsx`, `PhoneWork` → runner, `backend/Api/Phone/` |
| An old phone adds its history: install the same APK there and sign in. The old phone doesn't have to become the SMS app; *Pozwól czytać SMS* is enough. Then press *Archiwizuj teraz*. It archives into the same archive, and a message both phones hold is stored once (same print). | `requestSmsRead`, `core/polyfills.ts` (older WebViews) |
| The browser (`#/workspace/sms`) reads every archive you have access to. It shows conversations from small per-batch outlines, loads one conversation's batches when you open it, and searches by person, number or text. It looks for new messages every 30 seconds while the tab is in front. | `SmsArchiveView.tsx`, `POST /workspace/phone/archives` |
| Replying from the browser: a conversation with one person has a reply box (send now, or at a chosen time). The reply is sealed into the archive's area and waits there. Only a phone that has the own number this conversation used takes it, plans it and sends it; the archive records that number with every message (since 2026-10-18). The browser shows *Czeka na telefon*, *Telefon wysyła*, *Wysłano z telefonu (device)* or *Nie wysłano*, and *Odwołaj* works until the SMS is out. The phone hears of it through the FCM wake-up (`phoneOutbox` in `/notify/digest`); without FCM it hears within 15 minutes, and every minute while the app is open. | `outbox.ts`, `ReplyBox` in `SmsArchiveView.tsx`, `backend/Api/Phone/Phone.Outbox.cs` (0116), `Push.Phone`, `PhoneWork` job `outbox` |
| *Wyślij później*: the clock next to *Wyślij* in a conversation picks a time, and the phone sends the SMS itself at that time, also without a network (an exact alarm). Text only, not MMS. Planned messages stand in the conversation with *Odwołaj*. Replies from the browser for later are planned the same way. | `Composer.tsx`, `ScheduledSms.java`, `ScheduledReceiver.java` |
| A photo, a video or any file up to 25 MB can go as a link instead of an MMS. The app encrypts it, uploads it to recreatio.pl, and the SMS carries `https://recreatio.pl/#/plik/<secret>`. The key is only in the link, after the `#`, so the service never sees it. Photos keep their full quality but lose their EXIF data (location, device), except how they are turned. A link is valid for 7 days, 30 days or 1 year. *SMS → ⋯ → Pliki przez link* lists them: copy a link again, open it, or delete it (the link stops working at once). Whoever has the link opens the file in a browser, without an account. The browser's reply box takes a file the same way. | `share.ts`, `SharedFile.tsx` (`#/plik/…`), `Shares.tsx`, `Composer.tsx`, `backend/Api/Phone/Phone.Share.cs` (0117) |
| As an MMS, a photo is made as large and as good as the operator allows. The composer shows the operator's limit (often 300 KB to 1 MB). The photo is also turned upright and loses its location data. | `SmsSender.fit`, `SmsSender.mmsMax` |
| *Twoje numery* (in *Numery i grupy* and *Archiwum*): the phone's own number per SIM. A SIM that doesn't report its number gets it typed in, on this phone only. | `Lines.java`, `OwnLines` in `LinesView.tsx` |
| Long press selects a message, and each tap then adds or removes one. *Wyświetl* shows the chosen messages large, with A− / A+ (the size is remembered). *Kopiuj* copies them, and on the phone *Przekaż* starts a new SMS with their text. This works on the phone and in the archive, also in the browser. Single messages can't be deleted from the phone here, only a whole conversation (⋮). | `reading.tsx`, `SmsLog` in `smsChat.tsx` |
| Contacts `#/workspace/contacts`, sealed in the own area: read from the phone, vCard in and out, and edited here. A copy goes into the phone's contacts under the account "REcreatio" after every change and twice a day, so calls and SMS show names without asking the service. | `ContactsApp.tsx`, `contactStore.ts`, `PhoneContacts.java` |
| "Przenieś z telefonu…" reads the phone's contacts in, writes the copy, then removes the originals that live only in the phone's own storage (no account). Contacts of DAVx5, Signal or the SIM stay. | `PhoneContacts.dropLocal` |

Install on GrapheneOS:

1. Install `recreatio-sms-<version>.apk` over the normal app.
2. If Google Messages is installed, turn off its RCS chats first.
3. *App info → ⋮ → Allow restricted settings*. Android asks for this before an app from outside a store may become the SMS app.
4. In the app, open *SMS → Ustaw jako aplikację SMS*, then allow contacts.
5. *Konto → Klucz: Zachowany*, so the archive and the contact copy also run while the app is closed (the runner needs the key, as for notifications).

The service needs migrations 0114 (`phone_*` tables), 0115 (an outline per archive batch), 0116 (`phone_outbox`, replies from the browser) and 0117 (`phone_share`, files as links), and an API with `Phone/`, before the archive, the contacts, replies from the browser and file links work.

MMS has not been tried against a real carrier, because the emulator has no MMSC. The PDU codec has unit tests (`app/src/testSms`).

### Lamps (Bluetooth LE, 2026-10-18)

The SMS edition also replaces BLE lamp remotes: *Lampy* (`#/workspace/lamps`) shows your devices at the top, each with buttons for its signals, then the timers and the console; *+ Urządzenie* and *Odczyt z pilota* are at the bottom. A button sends the signal as a real BLE advertisement from the phone. You can keep pressing while one is being sent: each press waits its turn (*Czeka*) and goes out after the previous one; a bar at the top shows what is going out, how many wait, and *Stop*, which also drops the waiting ones. The Play edition has none of this and asks for no Bluetooth permission.

| What | Where |
| --- | --- |
| Devices (name, device number, room, notes) with their signals, sealed in your own area (`app.phone_lamp`, migration 0118). Add, edit, duplicate, delete. A signal is one or more frames: the raw advertising payload in hex (paste it as nRF Connect shows it, `0x`, spaces and line breaks are fine), how long to send it (default 1000 ms) and a pause before the next frame. Under every payload: byte count, the AD structures, manufacturer id and data, the exact `addManufacturerData` call and the bytes that end up in the air. | `lamps/LampsApp.tsx`, `LampEdit.tsx`, `FrameView.tsx`, `adv.ts`, `lampStore.ts`, `backend/Api/Phone/Phone.Lamps.cs` |
| Sending: legacy, non-connectable advertising (so Android adds no flags and all 31 bytes are the payload), `ADVERTISE_MODE_LOW_LATENCY`, high TX power, no name or TX power in the packet. Per frame: start, wait for `AdvertiseCallback` (3 s at most), hold, stop, pause. One radio thread: a second press waits for the first. *Stop*, leaving the app or closing it stops at once. Every outcome comes back with a code (`data-too-large`, `too-many-advertisers`, `no-permission`, `bluetooth-off`, `no-callback`, …) and the console shows it, with the start latency and how long Android really advertised. | `LampPlugin.java`, `LampFrame.java`, `lamps/transmit.ts`, `LampConsole.tsx` |
| Short or held (2026-10-21): a short press of a button sends the whole signal as saved. A press longer than 300 ms sends for as long as the finger stays on the button, at most 30 s. A one-frame signal goes out without a break, and a signal of several frames repeats them in order. Letting go stops it at once, even before the saved duration is over. The key shows the seconds while held. If another send is still running when the press starts, the held press waits its turn; if it was already released by then, it goes out for as long as it was pressed. Scrolling the page across the buttons sends nothing. The test sends (*Wyślij próbnie*) work the same way. | `lamps/SendKey.tsx`, `transmit.ts` (`Hold`, `heldFrames`), `LampPlugin.release`, `LampRadio.Press` |
| *Tempo przycisków* (the slider under the buttons): a pause between two transmissions — between the single packets the phone repeats while a frame goes out (a packet every 100 ms + the pause, set exactly through `AdvertisingSetParameters.setInterval` on Android 8+), between the frames of a signal and between queued presses, so a lamp that reads fast identical packets as one press counts each. It starts at the fastest (no pause, as saved); the saved signals never change. It applies only to the buttons (and test sends) and is remembered on the account (`lamps.pace`). The buttons no longer have a length slider: holding the button decides how long (a length remembered from before is ignored there). Every timer has its own two sliders (*Tempo tego timera*: pause between its actions and frames, limit per frame), stored with the timer and used by the phone's alarm and by *Wykonaj teraz*. | `lamps/pace.ts`, `PaceControl.tsx`, `transmit.ts`, `TimerEdit.tsx`, `timers.ts`, `LampTimers.java` |
| Timers: at a time of day, on chosen weekdays (none chosen: every day), one or more actions in order, each a signal of a device. Stored sealed beside the devices (same table, `kind: 'timer'`). The phone keeps a plan (time, days and the frames of each action) and one exact alarm for the next due minute; when it rings, every timer of that minute runs, even with the app closed, then the next alarm is set. After a reboot, an update or a time zone change the alarm is set again. Only the phone where *Ten telefon wykonuje timery* is ticked runs them (the first timer saved on a phone ticks it there), so two phones never switch a lamp twice. The plan is refreshed whenever devices or timers change on the phone and when the app starts. Failures (Bluetooth off, no permission) show a notification; the last 20 runs are listed. | `lamps/TimerList.tsx`, `TimerEdit.tsx`, `timers.ts`, `timerStart.ts`, `LampTimers.java`, `LampTimerReceiver.java` |
| *Odczyt z pilota* (learn from the remote): the phone scans (`SCAN_MODE_LOW_LATENCY`, every packet), you press the remote's button next to the phone. The strongest sender (best three packets averaged) is taken as the remote; its latest packet is shown decoded live, identical consecutive packets are grouped into runs, and the repeating pattern is preselected: one packet repeated, a cycle of several, or else the most frequent. The ticked runs are saved as a signal of an existing or a new device. A TXT log from nRF Connect (`2026-10-18 03:27:06.277, -29 dBm, 0x1EFF…`) goes through the same analysis, also in the browser. | `lamps/LampLearn.tsx`, `learn.ts` |

Permissions: Android 12+ asks for *Nearby devices* (`BLUETOOTH_ADVERTISE` to send, `BLUETOOTH_SCAN` with `neverForLocation` to listen). Up to Android 11, `BLUETOOTH`/`BLUETOOTH_ADMIN` are granted at install and listening needs location permission and location turned on.

What the phone cannot do, and the app says so in *Co znaczy „nadano"*:

- "Sent" means Android started and stopped the advertisement. Whether a lamp reacted is not known; mark it by hand (*Lampa zareagowała? Tak/Nie*).
- A device in the app is a label. An advertisement reaches every lamp in range; which one reacts depends on bytes in the payload.
- The phone sends from its own random address. The remote's address cannot be copied with public APIs.
- A remote with a rolling code or counter may not accept a replayed packet.
- Timing is approximate: Android picks the interval (about 100 ms at low latency), and starting a frame takes tens of milliseconds. Sequences with gaps of a few milliseconds cannot be reproduced; the console reports the real times.
- Only manufacturer-specific data (`0xFF`) is sent byte for byte. Payloads with other structures (flags, names, UUIDs) are refused with a reason, never changed silently.

Timers use exact alarms (`USE_EXACT_ALARM`, Android 13+). On Android 12 the app may not set exact alarms, so a timer can be a few minutes late; the timer list says so. The plan, including the signal bytes, sits in the app's own preferences on the phone (no backup), because the alarm must send without the network or the key.

The service needs migration 0118 and an API with `Phone/Phone.Lamps.cs` before devices and timers can be saved.

**Testing on a phone, with a second phone running nRF Connect:**

1. Install `android-out/recreatio-sms-<version>.apk`, sign in, open *Lampy*.
2. *+ Urządzenie*: name "Test A", number 1, a signal "Włącz" with `0x1EFF00000048464B4AE15A2285B8F21CB0424734F03133C519101112131415`. The preview must say 31 bytes, producer 0x0000, *da się nadać*. Add a second device "Test B" with a different payload (e.g. the second capture `…FFC185675ED4FE…`). Save both, close the app, reopen it: both are there.
3. On the second phone, nRF Connect → *Scanner*, filter *Raw data* by `48464B4A` (HFKJ) or sort by RSSI.
4. Tap *Włącz* on Test A. The console should show *Reklama nadana*, start after some tens of ms and about 1000 ms sent. In nRF Connect a new device appears (a random address, not connectable) for about a second; open it → *Raw*: the advertising data must be exactly the 31 bytes you pasted. Tap Test B's button and check its bytes too.
5. Errors: turn Bluetooth off and tap a button (*Bluetooth jest wyłączony*); deny *Nearby devices* (*no-permission*); set the duration to 30 000 ms and press *Stop* (*Przerwano*, held less than requested); press a button and switch apps (*paused*).
6. Learning: *Odczyt z pilota → Słuchaj*, hold the real remote next to the phone and press a button. The strongest sender should be the remote, with its packet decoded and a pattern preselected. Save it as a signal, then test it against the lamp and mark *Tak/Nie*.
7. Queue: tap three buttons quickly. The bar shows the first going out and *w kolejce 2*; nRF Connect sees the three packets one after another, never two at once. Tap again and press *Stop*: the running one stops, the waiting ones are marked *Przerwano* and never go out.
8. Held: hold *Włącz* for about 3 s. The key shows the seconds; nRF Connect sees the packet for about 2.7 s (it starts after 300 ms) and it ends when you let go; the console says *Nadano przez … — tak długo, jak trzymano przycisk*. Hold it for half a second: it stops at the release, shorter than the saved 1000 ms. Tap it: the whole 1000 ms.
9. Timers: *+ Timer* for two minutes from now with two actions (Test A, Test B). *Ten telefon wykonuje timery* is ticked and *Najbliżej* shows the time. Close the app (swipe it away) and lock the phone. At that minute nRF Connect on the second phone sees Test A's packet, then Test B's. Reopen *Lampy*: *Ostatnie uruchomienia* lists the run. Turn Bluetooth off and repeat: a notification says the timer could not send.

Not tested in this repository: anything over the air (no BLE hardware on the build machine and no emulator advertising). The parsing, the storage, the queue, stop, the error mapping and the frame bytes are covered by `scripts/app-lamp-check.mjs` and `app/src/testSms/.../LampFrameTest.java` (+ `LampPressTest.java` for the held press).

## Not there yet

- **Push on GrapheneOS without sandboxed Play.** There is no FCM there, so the app falls back to the 15-minute check. That also delays replies written in the browser (up to 15 minutes, or a minute while the app is open). The route there would be UnifiedPush (e.g. ntfy) behind the same wake-up signal.

## Google Play

Everything for the store is in [`play/`](play/): listing texts (pl-PL, en-US), icon, feature graphic, phone screenshots, release notes, and [`play/PLAY_CONSOLE.md`](play/PLAY_CONSOLE.md). That file walks through the Play Console step by step: app signing, the answers for App content and Data safety, the review account, the first manual upload, and the service account for automatic uploads.

The account deletion Google requires is in the app and on the web: *Konto → Usunięcie konta* (`backend/Api/AccountDeletion.cs`), and `https://recreatio.pl/usun-konto/`. The privacy policy is at `https://recreatio.pl/prywatnosc/`.
