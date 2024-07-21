import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      strategies: "injectManifest",
      srcDir: "src",
      filename: "serviceWorker.ts",

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: "Alarmy",
        short_name: "Alarmy",
        description: "Powerful alarms",
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        swDest: "serviceWorker.js",
      },

      devOptions: {
        enabled: true,
        navigateFallback: "index.html",
        suppressWarnings: true,
        type: "module",
      },
    }),
  ],
});
