import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `@/api/client` instead of `../../../api/client`
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Reachable from a container or another device on the network.
    host: true,
    proxy: {
      // Everything the backend owns goes through the API gateway on :8000.
      //
      // Proxying in dev rather than pointing axios at localhost:8000 keeps the
      // browser on one origin, so CORS and cookie behaviour in development match
      // what a real deployment behind one host would do.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split vendor code so an app change does not invalidate the whole
        // bundle in the browser cache.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          forms: ["react-hook-form", "zod", "@hookform/resolvers"],
        },
      },
    },
  },
});
