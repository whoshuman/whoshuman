import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwind()],
  // Estos paquetes se compilan a CommonJS (los consume el back NestJS). El navegador no
  // puede hacer named imports de un CJS servido en crudo, así que forzamos a Vite a
  // pre-empaquetarlos a ESM. (shared-types no hace falta: son solo tipos, se borran.)
  optimizeDeps: {
    include: ["@whoshuman/shared-events", "@whoshuman/shared-validation"]
  },
  build: {
    rollupOptions: {
      output: {
        // Solo se agrupan a mano los vendors que SIEMPRE hacen falta al arrancar (React,
        // router, i18n, red). Asi quedan en un chunk estable que el navegador reutiliza
        // entre despliegues aunque cambie el codigo de la app.
        //
        // El ecosistema 3D (three / @react-three / postprocessing) se deja al reparto
        // automatico a proposito: agruparlo a mano creaba aristas estaticas entre chunks
        // y acababa colandose en la carga inicial de TODAS las rutas, justo lo contrario
        // de lo que se busca. Rolldown ya lo aisla solo por la frontera de los import().
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          // [\\/] cubre las dos barras: rolldown normaliza los ids a "/", pero en Windows
          // pueden llegar con "\" segun de donde salga la ruta.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor";
          if (/[\\/]node_modules[\\/](@tanstack|i18next|react-i18next)[\\/]/.test(id)) {
            return "vendor";
          }
          if (/[\\/]node_modules[\\/](axios|socket\.io-client|engine\.io-client)[\\/]/.test(id)) {
            return "vendor";
          }
          return undefined;
        }
      }
    }
  },
  // En dev, el front (Vite) y el back están en orígenes distintos → proxy de /api al
  // back servido por nginx (mismo origen para el navegador, sin CORS). secure:false por
  // el certificado autofirmado local. En producción el front lo sirve el mismo nginx.
  server: {
    port: 5180,
    proxy: {
      "/api": { target: "https://localhost", changeOrigin: true, secure: false },
      // ws:true para que el upgrade WebSocket de socket.io también pase por nginx.
      "/socket.io": { target: "https://localhost", ws: true, changeOrigin: true, secure: false }
    }
  }
});
