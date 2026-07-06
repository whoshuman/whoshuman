import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwind()],
  // shared-validation se compila a CommonJS (lo consume el back NestJS). El navegador no
  // puede hacer named imports de un CJS servido en crudo, así que forzamos a Vite a
  // pre-empaquetarlo a ESM. (shared-types no hace falta: son solo tipos, se borran.)
  optimizeDeps: {
    include: ["@whoshuman/shared-validation"]
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
