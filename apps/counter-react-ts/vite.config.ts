import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

// import { visualizer } from "rollup-plugin-visualizer";
// import alias from "@rollup/plugin-alias";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: "terser",
    rollupOptions: {
      treeshake: true,
      // plugins: [
      //   alias({
      //     entries: [
      //       { find: "react", replacement: "preact/compat" },
      //       { find: "react-dom/test-utils", replacement: "preact/test-utils" },
      //       { find: "react-dom", replacement: "preact/compat" },
      //       { find: "react/jsx-runtime", replacement: "preact/jsx-runtime" },
      //     ],
      //   }),
      // ],
    },
  },
  plugins: [
    react(),
    legacy({
      targets: ["defaults"],
    }),
    // visualizer({
    //   template: "treemap", // or sunburst
    //   open: true,
    //   gzipSize: true,
    //   brotliSize: true,
    //   filename: "analice.html",
    // }),
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
