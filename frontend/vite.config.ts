import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
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
