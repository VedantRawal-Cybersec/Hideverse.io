import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: fileURLToPath(new URL('../../assets/runtime', import.meta.url)),
});
