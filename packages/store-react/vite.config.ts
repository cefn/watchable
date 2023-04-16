import { resolve } from "path";
import { defineConfig } from "vite";
import packageJson from "./package.json";

/** Ensure same logic can run, even if a root package
 * (that has no dependencies or peerDependencies) */
const { name, dependencies, peerDependencies } =
  packageJson as typeof packageJson & {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

/** Establish scope of local package. */
const [scope] = name.split("/");

/** Treat anything in same scope as being
 * explicit external dep (don't bundle) */
const external = Object.keys({
  ...dependencies,
  ...peerDependencies,
}).filter((packageName) => packageName.split("/")[0] === scope);

export default defineConfig({
  build: {
    target: "node10",
    outDir: "./dist",
    emptyOutDir: false,
    lib: {
      name,
      entry: resolve(__dirname, "src/index.ts"),
      fileName: "index",
    },
    rollupOptions: {
      external,
    },
    sourcemap: true,
  },
});
