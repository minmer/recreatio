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
npm run android:apk -- --debug  # debug build, WebView inspectable via chrome://inspect
```

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
| Notifications | Chat notifications use local notifications while the app runs (`@capacitor/local-notifications`). |
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

## Not there yet

- **Push while the app is closed.** GrapheneOS has no FCM without sandboxed Play. The route there would be UnifiedPush (e.g. ntfy) or Web Push behind the same `notices` abstraction. Today notifications work only while the app is running, as in the browser.
- **Google Play.** Still needed:
  - an `.aab` (`gradlew bundleRelease`);
  - the Data Safety form;
  - the store listing, including an honest statement of the encryption limit;
  - the age rating.
