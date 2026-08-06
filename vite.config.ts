// Force dev server config reload
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const vitePort = Number(process.env.VITE_PORT || 5173);
const previewPort = Number(process.env.VITE_PREVIEW_PORT || 4173);
const apiPort = Number(process.env.API_PORT || process.env.PORT || 5000);
const apiProxyTarget = (process.env.VITE_API_PROXY_TARGET && !process.env.VITE_API_PROXY_TARGET.includes("localhost"))
  ? process.env.VITE_API_PROXY_TARGET
  : `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'configure-mime-types',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ? req.url.split('?')[0] : '';
          if (url.endsWith('.tsx') || url.endsWith('.ts')) {
            const originalSetHeader = res.setHeader;
            res.setHeader = function (name, value) {
              if (name.toLowerCase() === 'content-type') {
                return originalSetHeader.call(this, name, 'application/javascript');
              }
              return originalSetHeader.call(this, name, value);
            };
            res.setHeader('Content-Type', 'application/javascript');
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: vitePort,
    strictPort: true,
    watch: {
      ignored: [
        "**/data/**",
        "**/brain/**",
        "**/scratch/**",
        "**/dist/**",
        "**/db_seed_counts.json",
      ],
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: previewPort,
  },
  build: {
    modulePreload: false,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "wouter"],
          motion: ["framer-motion"],
          forms: ["react-hook-form", "zod", "@hookform/resolvers"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast"
          ],
          charts: ["recharts"]
        }
      }
    }
  }
});
