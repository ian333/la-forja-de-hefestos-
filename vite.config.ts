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
  // opencascade.js es un módulo WASM grande (~66 MB) con glue Emscripten.
  // No debe pre-bundlearse (esbuild no lo maneja bien) y su .wasm debe servirse
  // tal cual. El kernel B-Rep (src/forja/brep/occt.ts) lo carga vía import
  // dinámico del glue ESM; Vite resuelve la URL del .wasm como asset.
  optimizeDeps: {
    exclude: ["opencascade.js"],
  },
  assetsInclude: ["**/*.wasm"],
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
        precios: resolve(import.meta.dirname, "precios.html"),
        cuenta: resolve(import.meta.dirname, "cuenta.html"),
        terminos: resolve(import.meta.dirname, "terminos.html"),
        privacidad: resolve(import.meta.dirname, "privacidad.html"),
        masterclass: resolve(import.meta.dirname, "masterclass.html"),
        solver: resolve(import.meta.dirname, "solver.html"),
        reporte: resolve(import.meta.dirname, "reporte.html"),
        tutoriales: resolve(import.meta.dirname, "tutoriales.html"),
        economia: resolve(import.meta.dirname, "economia.html"),
        premio: resolve(import.meta.dirname, "premio.html"),
        clase: resolve(import.meta.dirname, "clase.html"),
        "econ-lab": resolve(import.meta.dirname, "econ-lab.html"),
        "physics-nobel": resolve(import.meta.dirname, "physics-nobel.html"),
        "math-prizes": resolve(import.meta.dirname, "math-prizes.html"),
        "preview-escena": resolve(import.meta.dirname, "preview-escena.html"),
        library: resolve(import.meta.dirname, "library.html"),
        quasar: resolve(import.meta.dirname, "quasar.html"),
        magnetar: resolve(import.meta.dirname, "magnetar.html"),
        "cinematic-atom": resolve(import.meta.dirname, "cinematic-atom.html"),
        "cinematic-molecule": resolve(import.meta.dirname, "cinematic-molecule.html"),
        "cinematic-bh": resolve(import.meta.dirname, "cinematic-bh.html"),
        "cinematic-bh-reel": resolve(import.meta.dirname, "cinematic-bh-reel.html"),
        "cinematic-pulsar": resolve(import.meta.dirname, "cinematic-pulsar.html"),
        "cinematic-protein": resolve(import.meta.dirname, "cinematic-protein.html"),
        "cinematic-dna": resolve(import.meta.dirname, "cinematic-dna.html"),
        "cinematic-tde": resolve(import.meta.dirname, "cinematic-tde.html"),
        "cinematic-bhdisk": resolve(import.meta.dirname, "cinematic-bhdisk.html"),
        "forja-brep": resolve(import.meta.dirname, "forja-brep.html"),
        "forja-mecanismos": resolve(import.meta.dirname, "forja-mecanismos.html"),
        nova: resolve(import.meta.dirname, "nova.html"),
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
