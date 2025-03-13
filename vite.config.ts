import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    port: 3000,
    allowedHosts: [
      '69c4-130-41-215-103.ngrok-free.app',
      '.ngrok-free.app', // To allow any future ngrok URLs without needing to update config
    ]
  }
}); 