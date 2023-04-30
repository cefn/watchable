import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import {} from "vitest";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: "terser",
    rollupOptions: {
      treeshake: true,
    },
  },
  plugins: [
    react(),
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
  test: {
    exclude: ["test/playwright/**/*"],
  },
});
