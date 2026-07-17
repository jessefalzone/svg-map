# SVG Map

Turn HTML image maps into responsive, CSS-styleable SVG overlays in the browser.
The converter has no runtime dependencies, preserves the original `<map>` in the
DOM, and works with current Chrome, Firefox, Safari, and Edge.

[Try the live responsive demo](https://jessefalzone.github.io/svg-map/) or open
[`index.html`](./index.html) locally.

## Browser script

Load the classic bundle after your markup or from `<head>`. It exposes
`window.SVGMap` and automatically converts every `img[usemap]` once the DOM is
ready.

```html
<script src="./dist/svg-map.js"></script>

<img
  src="floor-plan.png"
  srcset="floor-plan-small.png 600w, floor-plan.png 1200w"
  sizes="100vw"
  width="1200"
  height="700"
  usemap="#rooms"
  style="max-width: 100%; height: auto"
>
<map name="rooms">
  <area shape="rect" coords="50,40,300,220" href="/kitchen" alt="Kitchen">
  <area shape="poly" coords="340,40,600,40,580,220,350,200" href="/office" alt="Office">
</map>
```

Explicit positive `width` and `height` attributes define the coordinate space.
When either is absent, conversion waits for the image to load and uses its
intrinsic dimensions. CSS can stretch width and height independently: the SVG
uses `preserveAspectRatio="none"` and remains aligned with the rendered image.

## Module API

The package's ES module has no automatic side effects:

```js
import { convertImageMap, convertAll, init } from "svg-map";

await convertImageMap(document.querySelector("#diagram"));
await convertAll(document.querySelector("main"));
await init(); // waits for DOM readiness, then converts the document
```

All functions are asynchronous:

- `convertImageMap(image)` resolves to the created `SVGSVGElement`, or `null`.
- `convertAll(root = document)` resolves to all overlays created within `root`.
- `init(root = document)` waits for that root's document to be ready, then calls
  `convertAll`.

The converter does not watch DOM mutations. Call `convertImageMap`, `convertAll`,
or `init` again after adding content. Repeated calls are safe and never create a
second overlay for an already converted image.

## Styling

SVG Map supplies only layout, transparent hit detection, and stable hooks. Add
your own visual treatment:

```css
.svg-map { /* positioned wrapper around the original image */ }
.svg-map__overlay { /* responsive SVG overlay */ }
.svg-map__link { /* linked SVG region */ }
.svg-map__area {
  fill: transparent;
  stroke: transparent;
  transition: fill 150ms, stroke 150ms;
}
.svg-map__link:hover .svg-map__area,
.svg-map__link:focus .svg-map__area {
  fill: rgb(255 210 0 / 35%);
  stroke: #c44;
}
```

The original image element is moved intact into `.svg-map`; its classes, inline
styles, `srcset`, and other attributes are retained.

## Shapes and attributes

`rect`, `circle`, `poly`, and `default` areas are supported. A missing or unknown
`shape` is treated as `rect`. Coordinates may be floating-point numbers;
reversed rectangles are normalized. Extra rectangle/circle coordinates and a
polygon's final unpaired coordinate are ignored as HTML image maps require.

Linked regions transfer `href`, `target`, `download`, `ping`, `rel`, `hreflang`,
`type`, and `referrerpolicy`. Compatible `class`, `style`, `data-*`, `aria-*`,
`lang`, `role`, `tabindex`, and event attributes are retained. `alt` becomes
`aria-label`, and `title` becomes an SVG `<title>`. Because the original map stays
in the document, an area `id` is exposed as `data-svg-map-source-id` instead of
being duplicated. Geometry and microdata-only HTML attributes are omitted.

Areas are drawn in reverse source order so the first HTML area keeps native
overlap priority. Areas without `href` remain pointer-enabled SVG geometry but
are not wrapped in a link.

Malformed or empty areas are skipped with a contextual `console.warn`. Missing
maps, failed images, and maps without any valid region remain untouched and keep
their native `usemap`. Once at least one region succeeds, `usemap` is removed and
the retained `<map>` becomes inert.

## Development

Node 20 or newer is required for development:

```sh
npm install
npm test
npm run build
```

Open [`index.html`](./index.html) to manually check responsive sizing, hover
styling, and keyboard navigation. The same page is deployed to GitHub Pages.

## Legacy Python CLI

The original Python converter remains available in [`legacy/`](./legacy/) as a
legacy, build-time workflow. It is not required by the browser library.

```sh
cd legacy
poetry install
poetry run python map-to-svg.py path/to/map.html
```

Run `poetry run python map-to-svg.py --help` for the stroke-related output
options. Existing CLI behavior is unchanged.
