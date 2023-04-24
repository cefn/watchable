import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: "terser",
    rollupOptions: {
      treeshake: true,
    },
  },
  plugins: [
    legacy({
      targets: ["defaults"],
    }),
  ],
  clearScreen: false,
});
