import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: "terser",
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      treeshake: true,
    },
  },
});
