This Counter app is identical to the other ones, but here we have tuned it for the tiniest possible bundle.

- We no longer use the promise support of a `@lauf/store-follow` queue. We use watcher callbacks instead.
- We include no polyfills for legacy browsers or module preload
- We use `terser` instead of `esbuild` for minification

The result is a bundle of just 406 bytes combining the fully reactive `@lauf/store` state library and the app logic.

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
