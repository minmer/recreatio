import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    proxy: {
      // Die Plattform (backend/Api) in der Entwicklung unter demselben Ursprung.
      //
      // Ohne diesen Umweg läge der Entwicklungsserver auf :5173 und die API auf
      // einem eigenen Port — das ist seitenübergreifend, und ein SameSite=Lax-
      // Cookie käme nie zurück: ein Ursprung, kein CORS, und das Sitzungskeks
      // kommt zurück. Seine Routen liegen an der Wurzel, deshalb wird /api
      // abgeschnitten. (Der Umweg `/rc` des Altbestands ist mit ihm gegangen.)
      //
      // 0109 — auch der WebSocket der Sitzungen (SignalR, `/api/cogita/hub`).
      '/api': {
        target: process.env.VITE_APP_API_ORIGIN ?? 'http://localhost:50994',
        changeOrigin: false,
        ws: true,
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
            // hash-wasm (Argon2 der Anmeldung) in einem eigenen Bündel: eine
            // öffentliche Seite lädt das WebAssembly nicht mit.
            if (id.includes('/hash-wasm/')) return 'vendor-rc-crypto';

            // reactflow nur für die Ansichten, die Kästchen und Pfeile zeichnen
            // (Karten, Logik, Pfade) — nicht für jede Seite.
            if (id.includes('/reactflow/') || id.includes('/@reactflow/')) return 'vendor-flow';

            // ZXing liest Strichcodes nur, wo der Browser es nicht selbst kann
            // (`barcode.ts`) — und erst, wenn jemand scannt. Im gemeinsamen
            // Bündel lüde jede Seite 300 kB für einen Knopf in der Bibliothek.
            if (id.includes('/@zxing/')) return 'vendor-barcode';

            // Ziehen und Ablegen braucht nur der Seitenbaukasten.
            if (id.includes('/@dnd-kit/')) return 'vendor-dnd';
            return 'vendor';
          }
          return undefined;
        }
      }
    }
  }
});
