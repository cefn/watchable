# Counter (Preact with Typescript)

This is identical to the [React version of this app](https://github.com/cefn/lauf/tree/main/apps/counter-react-ts) as a demonstration that [@lauf/store-react](https://www.npmjs.com/package/@lauf/store-react) also works with [Preact](https://preactjs.com/).

The gzipped bundle size with Preact is tiny, with the same app bundled in React being 6 times bigger!

This command line reports on built assets, targeting the default [browserslist](https://browsersl.ist/)

```
watchable git:(main) ✗ ls -1 apps/counter*react-ts/dist/assets/*.js | xargs -I{} zsh -c "echo {}; cat {} | wc -c"
apps/counter-preact-ts/dist/assets/index-b24b95cf.js
24605
apps/counter-preact-ts/dist/assets/index-legacy-391f2bee.js
23910
apps/counter-preact-ts/dist/assets/polyfills-legacy-823a12e6.js
18698
apps/counter-react-ts/dist/assets/index-cf510a1e.js
143388
apps/counter-react-ts/dist/assets/index-legacy-4b55f219.js
142948
apps/counter-react-ts/dist/assets/polyfills-legacy-fc8e3fef.js
22348
```

This project builds and runs using [Vite](https://vitejs.dev/).
