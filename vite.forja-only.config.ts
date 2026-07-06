import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from "path";

// Config de UNA sola página (forja-brep) para screenshots del Part Studio en
// iangpu. Evita construir las 40+ páginas (una página de cine WIP rota tumbaría
// el build completo) y produce dist-forja/, que sirve `vite preview` SIN
// file-watcher → no toca inotify → cero ENOSPC. Reusa los plugins/alias/OCCT
// wasm de la config base.
export default defineConfig({
  // root absoluto = dir de esta config (el repo). Así `vite` funciona aunque se
  // invoque desde $HOME (ssh pelón) usando --config con ruta absoluta; el cwd
  // deja de importar.
  root: resolve(import.meta.dirname),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  optimizeDeps: { exclude: ["opencascade.js"] },
  assetsInclude: ["**/*.wasm"],
  // DEV server (no preview): el kernel OCCT carga el .wasm grande vía import
  // dinámico @vite-ignore, que SOLO funciona en dev (sirve node_modules); en un
  // build de producción ese .wasm no se emite → 404 "kernel falló". root absoluto
  // (arriba) + watch.ignored de los dirs pesados evita el ENOSPC de inotify
  // (antes vigilaba todo $HOME por el cwd equivocado del ssh).
  server: {
    host: "0.0.0.0",
    port: 5002,
    strictPort: true,
    watch: {
      ignored: [
        "**/dist/**", "**/dist-forja/**", "**/dist-video/**",
        "**/docs/**", "**/forja-shots/**", "**/.git/**", "**/node_modules/**",
      ],
    },
  },
  build: {
    target: "esnext",
    sourcemap: false,
    minify: false, // Rolldown-Vite usa Oxc, no esbuild; para screenshots no importa
    outDir: "dist-forja",
    rollupOptions: {
      input: { "forja-brep": resolve(import.meta.dirname, "forja-brep.html") },
      // Rolldown-Vite (v8) exige manualChunks como función; en una sola página no
      // hace falta chunking manual — se omite.
    },
  },
});
