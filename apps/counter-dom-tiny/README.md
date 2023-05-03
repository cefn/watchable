This Counter app is identical to the other ones, but tuned for the tiniest possible bundle. The result is a bundle of just 424 bytes combining the fully reactive `@watchable/store` state library and the app logic.

[Open this app in a Stackblitz editable sandbox](https://stackblitz.com/github/cefn/watchable/tree/main/apps/counter-dom-tiny?file=src/main.js)

- Like all counter-dom-\* apps this uses the dom directly, avoiding the (~45k gzip) overhead of React
- It doesn't use the promise support of a `@watchable/store-follow` queue. It uses watcher callbacks instead.
- It includes no polyfills for legacy browsers or module preload
- It uses `terser` instead of `esbuild` for minification

```
npm run build
[...]
🏃 [build] Running command "vite build"
vite v4.2.1 building for production...
transforming...
✓ 4 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                0.42 kB
dist/assets/index-a5bf9cee.js  0.82 kB │ gzip: 0.41 kB
```
