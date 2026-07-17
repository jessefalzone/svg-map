import { build } from "vite";

await build({
  build: {
    emptyOutDir: true,
    lib: {
      entry: "src/index.js",
      formats: ["es"],
      fileName: () => "svg-map.es.js",
    },
  },
});

await build({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/auto.js",
      name: "SVGMap",
      formats: ["iife"],
      fileName: () => "svg-map.js",
    },
  },
});
