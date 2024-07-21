import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,

      strategies: "injectManifest",
      srcDir: "src",
      filename: "serviceWorker.ts",

      outDir: "public",

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: "Alarmy",
        short_name: "Alarmy",
        description: "Powerful alarms",
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
