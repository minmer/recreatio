/**
 * DIE APP FÜR ANDROID — dieselbe Seite, in einer eigenen Hülle (Kapitel 13).
 *
 * <b>Dasselbe Bündel, kein zweiter Bau.</b> `dist/` wird in die APK gepackt
 * und dort unter `https://recreatio.pl` ausgeliefert — vom Telefon selbst,
 * nicht aus dem Netz. Nur der Dienst (`api.recreatio.pl`) wird gefragt.
 *
 * <b>Warum ausgerechnet dieser Name.</b> `session.ts` leitet den Dienst aus
 * dem eigenen Namen ab: recreatio.pl fragt api.recreatio.pl. Und nur unter
 * diesem Namen ist das Sitzungskeks des Dienstes ein EIGENES (dieselbe Site)
 * und die Herkunft eine, die der Dienst per CORS zulässt. Unter dem üblichen
 * `https://localhost` wäre beides fremd — die Anmeldung scheiterte still.
 *
 * <b>Was das heisst.</b> Adressen auf recreatio.pl öffnet die App aus sich
 * selbst; eine neue Fassung der Seite kommt erst mit einer neuen APK aufs
 * Telefon. Das ist Absicht: der Code, der die Schlüssel hält, ist der, der
 * installiert wurde — nicht der, den ein Server gerade ausliefert.
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pl.recreatio.app',
  appName: 'REcreatio',
  webDir: 'dist',
  server: {
    hostname: 'recreatio.pl',
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    /* Die Ränder (Statusleiste, Gestenleiste) kommen als CSS-Variablen an — `native.ts` legt sie um die Seite. */
    SystemBars: {
      insetsHandling: 'css',
      style: 'DEFAULT'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_recreatio',
      iconColor: '#8a5a1c'
    }
  }
};

export default config;
