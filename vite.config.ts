import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * CSS QUE NO BLOQUEA EL PRIMER PIXEL.
 *
 * Vite inyecta `<link rel="stylesheet" href="/assets/main-*.css">` en el <head>, y una hoja
 * bloqueante DETIENE todo pintado hasta que baja. La de la escuela pesa 201 KB: sobre datos
 * móviles (1.6 Mbps, 150 ms de latencia) es más de un segundo de pantalla NEGRA.
 *
 * Medido el 2026-08-05 con telemetría real: FCP 1708 ms y mediana de sesión 0.9 s → el 87%
 * de la gente se fue ANTES de que la página pintara. No rebotaban por lo que veían: por lo
 * que NO veían. Y el 97.5% llega desde el navegador de Instagram/TikTok, donde la competencia
 * es el feed que está a un swipe.
 *
 * El truco `media="print"` + `onload` hace que el navegador la baje SIN bloquear y la active
 * al terminar. Así el atrio embebido en index.html (CSS inline, cero peticiones) pinta con el
 * HTML, y la hoja grande entra después — antes de que React monte, porque el bundle de JS
 * (three.js + r3f) pesa mucho más que el CSS y siempre llega después.
 *
 * IMPORTANTE: no toca las hojas de las otras entradas ni el <noscript> de respaldo.
 */
function cssSinBloquear() {
  return {
    name: "css-sin-bloquear",
    enforce: "post" as const,
    transformIndexHtml(html: string) {
      return html.replace(
        /<link rel="stylesheet"([^>]*?)href="([^"]+\.css)"([^>]*)>/g,
        (etiqueta, antes, href, despues) => {
          if (/media=/.test(etiqueta)) return etiqueta;            // ya la tratamos a mano
          return `<link rel="stylesheet"${antes}href="${href}"${despues} media="print" onload="this.media='all';this.onload=null">` +
                 `<noscript><link rel="stylesheet"${antes}href="${href}"${despues}></noscript>`;
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cssSinBloquear()],
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
    // iangpu corre el RIAN lab (daemon fuera del repo) que agota los inotify
    // watchers del SISTEMA → vite dev muere con ENOSPC al intentar vigilar. No
    // necesitamos HMR para render: watch:null apaga el watcher (recarga manual).
    // Si algún día se quiere HMR aquí, subir fs.inotify.max_user_watches (root).
    watch: process.env.VITE_NO_WATCH ? null : undefined,
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
        perfil: resolve(import.meta.dirname, "perfil.html"),
        terminos: resolve(import.meta.dirname, "terminos.html"),
        privacidad: resolve(import.meta.dirname, "privacidad.html"),
        masterclass: resolve(import.meta.dirname, "masterclass.html"),
        solver: resolve(import.meta.dirname, "solver.html"),
        reporte: resolve(import.meta.dirname, "reporte.html"),
        tutoriales: resolve(import.meta.dirname, "tutoriales.html"),
        economia: resolve(import.meta.dirname, "economia.html"),
        premio: resolve(import.meta.dirname, "premio.html"),
        clase: resolve(import.meta.dirname, "clase.html"),
        comando: resolve(import.meta.dirname, "comando.html"),
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
        "cinematic-limones": resolve(import.meta.dirname, "cinematic-limones.html"),
        "cinematic-ideas": resolve(import.meta.dirname, "cinematic-ideas.html"),
        "cinematic-romer": resolve(import.meta.dirname, "cinematic-romer.html"),
        "forja-brep": resolve(import.meta.dirname, "forja-brep.html"),
        // EL ESTUDIO VIVO y las vistas 3D animadas: pantallas propias además del
        // botón que ya vive dentro de forja-brep, para poder abrirlas directo.
        "estudio-vivo": resolve(import.meta.dirname, "estudio-vivo.html"),
        "ciclo": resolve(import.meta.dirname, "ciclo.html"),
        "molde": resolve(import.meta.dirname, "molde.html"),
        "vista3d-anim": resolve(import.meta.dirname, "vista3d-anim.html"),
        "forja-mecanismos": resolve(import.meta.dirname, "forja-mecanismos.html"),
        nova: resolve(import.meta.dirname, "nova.html"),
      },
      output: {
        // ⚠ EL ORDEN Y LA PRESENCIA DE `react` AQUÍ NO SON COSMÉTICOS (2026-08-05).
          //
          // Sin esta primera línea, Rollup metía React y ReactDOM DENTRO del chunk de r3f
          // —porque @react-three/fiber depende de React— y entonces el entry del atrio salía
          // así: `import{c,j,r}from"./r3f-*.js"`. O sea: para obtener createRoot había que
          // bajar los 707 KB de fiber+drei, que arrastran los 725 KB de three.
          //
          // Una landing de PURO TEXTO descargaba 1.43 MB de librerías 3D para pintar un div.
          // Medido en 4G móvil (1.6 Mbps, 150 ms), que es como llega el 97.5% del tráfico
          // real: React montaba a los 31.4 SEGUNDOS. La mediana de sesión es 0.9 s. Nadie
          // había visto nunca el sitio funcionando — y el embudo de 1.65% no era un problema
          // de copy ni de diseño.
          //
          // Con React en su propio chunk, three y r3f solo los baja quien de verdad abre algo
          // 3D (el lab, el CAD, las escenas cinemáticas).
          //
          // La forma de OBJETO no sirve aquí: se probó `react: ["react","react-dom"]` y Rollup
          // emitió un chunk `react-*.js` de UN BYTE — el de r3f ya se había quedado con los
          // módulos. La forma de FUNCIÓN decide por ruta y en el orden que yo mando, así que
          // React se reclama ANTES de que fiber pueda absorberlo.
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
            if (id.includes("@react-three")) return "r3f";
            if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) return "three";
          },
      },
    },
  },
});
