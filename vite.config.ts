import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5001,
    proxy: {
      // /rpc → daemon lab1k en ian-gpu vía tailscale (64K edges activos)
      // Esto elimina CORS porque el navegador habla con localhost:5001/rpc
      "/rpc": {
        target: "http://127.0.0.1:9877",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        brain: resolve(import.meta.dirname, "brain.html"),
        lab: resolve(import.meta.dirname, "lab.html"),
        physics: resolve(import.meta.dirname, "physics.html"),
        math: resolve(import.meta.dirname, "math.html"),
        escuela: resolve(import.meta.dirname, "escuela.html"),
      },
      output: {
        manualChunks: {
          three: ["three"],
          r3f: ["@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
});
