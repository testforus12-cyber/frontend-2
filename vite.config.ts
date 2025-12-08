import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true, // This makes Vite listen on all available network interfaces
    // Alternatively, you can specify a specific IP address:
    // host: '192.168.1.100',
    port: 3000, // Or your desired port
    proxy: {
      // Forward API calls to backend during development to avoid CORS
      '/api': {
        target: 'https://backend-2-4tjr.onrender.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
