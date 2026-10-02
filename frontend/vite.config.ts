import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    proxy: {
      // Die neue Plattform in der Entwicklung unter demselben Ursprung.
      //
      // Ohne diesen Umweg läge der Entwicklungsserver auf :5173 und die API auf
      // :5292 — das ist seitenübergreifend, und ein SameSite=Lax-Cookie käme
      // nie zurück. Man würde eine Stunde nach einem Fehler in der Anmeldung
      // suchen, den es nicht gibt (RcCookiePolicy).
      '/rc': {
        target: process.env.VITE_RC_API_ORIGIN ?? 'http://localhost:5292',
        changeOrigin: false
      },

      // Der Neubau (backend/Api), aus demselben Grund: ein Ursprung, kein CORS,
      // und das Sitzungskeks kommt zurück. Seine Routen liegen an der Wurzel,
      // deshalb wird /api abgeschnitten.
      '/api': {
        target: process.env.VITE_APP_API_ORIGIN ?? 'http://localhost:50994',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  worker: {
    format: 'es'
  },
  build: {
    rollupOptions: {
      /*
       * 0076 — zwei Einstiege: die Seite, und der Läufer der App
       * (`runner.html`), den die App im Hintergrund in eine unsichtbare
       * WebView lädt, um Meldungen mit Inhalt zu füllen. Er teilt die Bündel
       * des Neubaus und lädt nichts vom Altbestand.
       */
      input: {
        main: 'index.html',
        runner: 'runner.html'
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // hash-wasm gehört zur neuen Plattform und sonst nirgends hin.
            // Im gemeinsamen vendor-Bündel lädt JEDE Altbestandsseite das
            // Argon2-WebAssembly mit — für eine Funktion, die dort niemand
            // aufruft.
            if (id.includes('/hash-wasm/')) return 'vendor-rc-crypto';

            // reactflow gehört jetzt BEIDEN Seiten: dem Rollengraphen des
            // Neubaus und den Cogita-Ansichten des Altbestands. Im gemeinsamen
            // Bündel mit katex lüde der Arbeitsplatz einen Formelsatz mit, den
            // dort niemand aufruft — 300 kB für eine Ansicht, die Kästchen und
            // Pfeile zeichnet.
            if (id.includes('/reactflow/') || id.includes('/@reactflow/')) return 'vendor-flow';

            // ZXing liest Strichcodes nur, wo der Browser es nicht selbst kann
            // (`barcode.ts`) — und erst, wenn jemand scannt. Im gemeinsamen
            // Bündel lüde jede Seite 300 kB für einen Knopf in der Bibliothek.
            if (id.includes('/@zxing/')) return 'vendor-barcode';

            if (
              id.includes('/@dnd-kit/') ||
              id.includes('/katex/') ||
              id.includes('/react-katex/')
            ) {
              return 'vendor-cogita-ui';
            }
            return 'vendor';
          }
          if (id.includes('/src/legacy/pages/parish/')) return 'parish';
          if (id.includes('/src/legacy/pages/cogita/') || id.includes('/src/legacy/cogita/')) return 'cogita';
          if (id.includes('/src/legacy/pages/HomePage') || id.includes('/src/legacy/components/') || id.includes('/src/legacy/lib/')) {
            return 'recreatio-core';
          }
          return undefined;
        }
      }
    }
  }
});
