import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'BrowserRAG',
        short_name: 'BrowserRAG',
        description: 'In-browser RAG chat application for CSV and PDF documents',
        theme_color: '#4a90e2',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
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