const path = require("path");
const { build } = require("esbuild");

module.exports = {
  doBuild(modulePath) {
    const { dependencies, peerDependencies } = require(path.resolve(
      modulePath,
      "./package.json"
    ));

    let external = [];
    if (dependencies) {
      external = external.concat(Object.keys(dependencies));
    }
    if (peerDependencies) {
      external = external.concat(Object.keys(peerDependencies));
    }

    build({
      entryPoints: [path.resolve(modulePath, "src/index.ts")],
      outdir: path.resolve(modulePath, "dist"),
      format: "cjs",
      minify: true,
      sourcemap: true,
      bundle: true,
      target: ["es6"],
      external,
    });
  },
};
