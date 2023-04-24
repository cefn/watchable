import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";

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
});
