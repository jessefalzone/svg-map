import { afterEach, describe, expect, it, vi } from "vitest";
import { convertAll, convertImageMap, init } from "../src/index.js";

function setBody(markup) {
  document.body.innerHTML = markup;
}

function setNaturalSize(image, width = 400, height = 200) {
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
    complete: { configurable: true, value: true },
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("convertImageMap", () => {
  it("converts all shapes, defaults missing/invalid shapes to rect, and reverses overlap order", async () => {
    setBody(`
      <img usemap="#places" width="800" height="400">
      <map name="places">
        <area id="first" shape="rect" coords="90.5,80,10,20,not-a-number" href="#one">
        <area id="circle" shape="circle" coords="25.5,30,10,not-a-number">
        <area id="poly" shape="poly" coords="0,0, 50,0, 25,40,not-a-number">
        <area id="missing" coords="1,2,11,22">
        <area id="invalid" shape="banana" coords="3,4,13,24">
        <area id="default" shape="default">
      </map>`);

    const image = document.querySelector("img");
    const svg = await convertImageMap(image);

    expect(svg.getAttribute("viewBox")).toBe("0 0 800 400");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
    expect(svg.querySelectorAll(".svg-map__area")).toHaveLength(6);
    expect([...svg.children].map((node) => node.dataset.svgMapSourceId)).toEqual([
      "default", "invalid", "missing", "poly", "circle", "first",
    ]);
    expect(svg.lastElementChild.dataset.svgMapSourceId).toBe("first");
    expect(svg.lastElementChild.getAttribute("tabindex")).toBe("0");
    expect(svg.querySelector('[data-svg-map-source-id="first"] rect').outerHTML).toContain('x="10"');
    expect(svg.querySelector('[data-svg-map-source-id="first"] rect').outerHTML).toContain('width="80.5"');
    expect(svg.querySelector('[data-svg-map-source-id="poly"]').getAttribute("points")).toBe("0,0 50,0 25,40");
    expect(svg.firstElementChild.getAttribute("width")).toBe("800");
    expect(image.hasAttribute("usemap")).toBe(false);
    expect(document.querySelector("map")).not.toBeNull();
  });

  it("transfers link and compatible global attributes without duplicating IDs", async () => {
    setBody(`
      <img usemap="#m" width="100" height="50" style="max-width: 100%" class="photo">
      <map name="m"><area id="source" shape="rect" coords="0,0,20,20"
        href="/go" target="_blank" download="file" ping="/ping" rel="next"
        hreflang="fr" type="text/html" referrerpolicy="no-referrer"
        alt="Go there" title="A useful region" class="hot custom" style="cursor: help"
        data-key="7" aria-describedby="help" lang="fr" xml:lang="fr" dir="ltr" role="button" tabindex="2"
        onclick="window.clicked = true" itemprop="url">
      </map>`);

    const image = document.querySelector("img");
    const svg = await convertImageMap(image);
    const link = svg.querySelector(".svg-map__link");
    const shape = link.querySelector(".svg-map__area");

    expect(link.classList.contains("hot")).toBe(true);
    expect(link.getAttribute("href")).toBe("/go");
    expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(link.getAttribute("tabindex")).toBe("2");
    expect(link.getAttribute("aria-label")).toBe("Go there");
    expect(link.getAttribute("xml:lang")).toBe("fr");
    expect(link.getAttribute("dir")).toBe("ltr");
    expect(link.dataset.svgMapSourceId).toBe("source");
    expect(link.id).toBe("");
    expect(link.getAttribute("itemprop")).toBeNull();
    expect(link.getAttribute("coords")).toBeNull();
    expect(shape.querySelector("title").textContent).toBe("A useful region");
    expect(shape.classList.contains("svg-map__area")).toBe(true);
    expect(image.className).toBe("photo");
    expect(image.getAttribute("style")).toContain("max-width");
    expect(image.parentElement.className).toBe("svg-map");
  });

  it("keeps unlinked regions interactive without creating an SVG link", async () => {
    setBody('<img usemap="#m" width="10" height="10"><map name="m"><area coords="0,0,5,5" alt="Plain" class="plain"></map>');
    const svg = await convertImageMap(document.querySelector("img"));
    const shape = svg.querySelector(".svg-map__area");
    expect(svg.querySelector("a")).toBeNull();
    expect(shape.classList.contains("plain")).toBe(true);
    expect(shape.getAttribute("aria-label")).toBe("Plain");
    expect(shape.getAttribute("fill")).toBe("transparent");
    expect(shape.getAttribute("pointer-events")).toBe("all");
  });

  it("uses intrinsic dimensions and waits for delayed image loads", async () => {
    setBody('<img usemap="#m"><map name="m"><area shape="default"></map>');
    const image = document.querySelector("img");
    Object.defineProperty(image, "complete", { configurable: true, value: false });
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, get: () => image.dataset.loaded ? 320 : 0 },
      naturalHeight: { configurable: true, get: () => image.dataset.loaded ? 180 : 0 },
    });

    const conversion = convertImageMap(image);
    image.dataset.loaded = "yes";
    image.dispatchEvent(new Event("load"));
    expect((await conversion).getAttribute("viewBox")).toBe("0 0 320 180");
  });

  it("leaves the native map active on image failure, missing maps, and maps with no valid areas", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    setBody(`
      <img id="missing" usemap="#absent" width="10" height="10">
      <img id="bad-map" usemap="#bad" width="10" height="10">
      <img id="failed" usemap="#failed"><map name="bad"><area shape="circle" coords="1,nope,2"></map>
      <map name="failed"><area shape="default"></map>`);

    expect(await convertImageMap(document.querySelector("#missing"))).toBeNull();
    expect(await convertImageMap(document.querySelector("#bad-map"))).toBeNull();
    const failed = document.querySelector("#failed");
    setNaturalSize(failed, 0, 0);
    expect(await convertImageMap(failed)).toBeNull();
    expect(document.querySelectorAll("img[usemap]")).toHaveLength(3);
    expect(warning).toHaveBeenCalled();
  });

  it("is idempotent when called repeatedly for the same image", async () => {
    setBody('<img usemap="#m" width="10" height="10"><map name="m"><area shape="default"></map>');
    const image = document.querySelector("img");
    const first = await convertImageMap(image);
    const second = await convertImageMap(image);
    expect(second).toBe(first);
    expect(document.querySelectorAll(".svg-map__overlay")).toHaveLength(1);
  });
});

describe("collection APIs", () => {
  it("converts multiple and shared maps while respecting caller-scoped roots", async () => {
    setBody(`
      <section id="inside"><img usemap="#shared" width="10" height="10"></section>
      <img id="outside" usemap="#shared" width="10" height="10">
      <map name="shared"><area shape="default" href="#x"></map>`);
    const results = await convertAll(document.querySelector("#inside"));
    expect(results).toHaveLength(1);
    expect(document.querySelector("#outside").hasAttribute("usemap")).toBe(true);
    expect(await convertAll(document)).toHaveLength(1);
    expect(await convertAll(document)).toEqual([]);
  });

  it("init returns converted overlays", async () => {
    setBody('<img usemap="#m" width="10" height="10"><map name="m"><area shape="default"></map>');
    expect(await init(document)).toHaveLength(1);
  });
});
