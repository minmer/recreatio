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
npm run android:apk             # signed release  → android-out/recreatio-<version>.apk
npm run android:release         # APK + AAB (for Google Play) → android-out/
npm run android:publish         # newest AAB → Google Play, internal testing, draft
npm run android:apk -- --debug  # debug build, WebView inspectable via chrome://inspect
```

**`deploy-frontend.bat` builds the app too.** It deploys the site to `docs/`, then builds the APK and AAB from the same `dist/` (`--skip-web`), and uploads the AAB to Google Play if `~/.recreatio/android/play-service-account.json` exists. Without the signing key it skips the app; `deploy-frontend.bat --web-only` skips it on purpose.

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
| Notifications | Shown while the app runs (`@capacitor/local-notifications`), also in the foreground, except for the chat that is open. A WorkManager job checks every 15 min or more while the app is closed (`NotifyWorker`). With Firebase built in, the service wakes the phone at once (`PushService`, see below). On the first start the app asks for notification permission once. |
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

## Not there yet

- **Push on GrapheneOS without sandboxed Play.** There is no FCM there, so the app falls back to the 15-minute check. The route there would be UnifiedPush (e.g. ntfy) behind the same wake-up signal.

## Google Play

Everything for the store is in [`play/`](play/): listing texts (pl-PL, en-US), icon, feature graphic, phone screenshots, release notes, and [`play/PLAY_CONSOLE.md`](play/PLAY_CONSOLE.md). That file walks through the Play Console step by step: app signing, the answers for App content and Data safety, the review account, the first manual upload, and the service account for automatic uploads.

The account deletion Google requires is in the app and on the web: *Konto → Usunięcie konta* (`backend/Api/AccountDeletion.cs`), and `https://recreatio.pl/usun-konto/`. The privacy policy is at `https://recreatio.pl/prywatnosc/`.
