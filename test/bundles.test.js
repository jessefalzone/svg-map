// @vitest-environment node

import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import * as moduleAPI from "../dist/svg-map.es.js";

import { describe, expect, it } from "vitest";

describe("distribution bundles", () => {
  it("exports a side-effect-free ESM API", () => {
    expect(Object.keys(moduleAPI).sort()).toEqual(["convertAll", "convertImageMap", "init"]);
  });

  it("exposes window.SVGMap and auto-initializes as a classic script", async () => {
    const bundle = await readFile(new URL("../dist/svg-map.js", import.meta.url), "utf8");
    const dom = new JSDOM(
      '<!doctype html><img usemap="#m" width="20" height="10"><map name="m"><area shape="default"></map>',
      { runScripts: "dangerously" },
    );
    const script = dom.window.document.createElement("script");
    script.textContent = bundle;
    dom.window.document.head.append(script);
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(Object.keys(dom.window.SVGMap).sort()).toEqual(["convertAll", "convertImageMap", "init"]);
    expect(dom.window.document.querySelectorAll(".svg-map__overlay")).toHaveLength(1);
    expect(dom.window.document.querySelector("img").hasAttribute("usemap")).toBe(false);
  });
});
