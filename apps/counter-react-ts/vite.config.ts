import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";
import preact from "@preact/preset-vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: "terser",
    rollupOptions: {
      treeshake: true,
    },
  },
  plugins: [
    preact(),
    legacy({
      targets: ["defaults"],
    }),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
