import { defineConfig } from "vite";
import vitePluginCommonjs from "vite-plugin-commonjs";
import rollupPluginCommonjs from "@rollup/plugin-commonjs";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vitePluginCommonjs()],
  build: {
    rollupOptions: {
      plugins: [rollupPluginCommonjs()],
    },
  },
});
