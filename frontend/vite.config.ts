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
      }
    }
  },
  worker: {
    format: 'es'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // hash-wasm gehört zur neuen Plattform und sonst nirgends hin.
            // Im gemeinsamen vendor-Bündel lädt JEDE Altbestandsseite das
            // Argon2-WebAssembly mit — für eine Funktion, die dort niemand
            // aufruft.
            if (id.includes('/hash-wasm/')) return 'vendor-rc-crypto';
            if (
              id.includes('/reactflow/') ||
              id.includes('/@dnd-kit/') ||
              id.includes('/katex/') ||
              id.includes('/react-katex/')
            ) {
              return 'vendor-cogita-ui';
            }
            return 'vendor';
          }
          if (id.includes('/src/pages/parish/')) return 'parish';
          if (id.includes('/src/pages/cogita/') || id.includes('/src/cogita/')) return 'cogita';
          if (id.includes('/src/pages/HomePage') || id.includes('/src/components/') || id.includes('/src/lib/')) {
            return 'recreatio-core';
          }
          return undefined;
        }
      }
    }
  }
});
