import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleBarcodeApiRequest } from './src/server/barcode-handler'

function barcodeApiPlugin(): Plugin {
  return {
    name: 'nittoo-barcode-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url === '/api/discovery/barcode' || req.url.startsWith('/api/discovery/barcode?'))) {
          try {
            await handleBarcodeApiRequest(req, res);
          } catch (err: unknown) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: (err as Error)?.message || 'Server error' }));
          }
        } else {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url === '/api/discovery/barcode' || req.url.startsWith('/api/discovery/barcode?'))) {
          try {
            await handleBarcodeApiRequest(req, res);
          } catch (err: unknown) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: (err as Error)?.message || 'Server error' }));
          }
        } else {
          next();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    barcodeApiPlugin(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            if (
              id.includes('react/') ||
              id.includes('react-dom/') ||
              id.includes('react-router-dom/') ||
              id.includes('scheduler/')
            ) {
              return 'react-vendor';
            }
          }
        },
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/*.md', '**/.git/**'],
    },
  },
})
