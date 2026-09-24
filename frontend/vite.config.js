import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Bibliotecas grandes em arquivos próprios: o navegador guarda em cache
    // entre versões do sistema e só baixa de novo o código que mudou.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          'mui-grid': ['@mui/x-data-grid'],
          charts: ['@mui/x-charts'],
          query: ['@tanstack/react-query', 'axios', 'notistack'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
