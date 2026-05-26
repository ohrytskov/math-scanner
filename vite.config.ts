import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Deployed standalone (Cloudflare Pages or similar) at the site root, so no base path.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
