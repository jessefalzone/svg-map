// @vitest-environment node

import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

describe("live demo page", () => {
  it("converts the primitive-shape map and wires its controls", async () => {
    const [html, bundle, page] = await Promise.all([
      readFile(new URL("../index.html", import.meta.url), "utf8"),
      readFile(new URL("../dist/svg-map.js", import.meta.url), "utf8"),
      readFile(new URL("../demo/page.js", import.meta.url), "utf8"),
    ]);
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.test/svg-map/" });

    for (const source of [bundle, page]) {
      const script = dom.window.document.createElement("script");
      script.textContent = source;
      dom.window.document.head.append(script);
    }
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    const document = dom.window.document;
    expect(document.querySelectorAll(".svg-map__overlay")).toHaveLength(1);
    expect(document.querySelectorAll(".svg-map__link")).toHaveLength(4);
    expect(document.querySelectorAll('.svg-map__link[tabindex="0"]')).toHaveLength(4);
    expect(document.querySelector("#shapes-image").hasAttribute("usemap")).toBe(false);
    expect(document.querySelector("map[name=shapes-map]")).not.toBeNull();
    expect(document.querySelector("#active-region").textContent.trim()).toBe("Active region: Circle (circle)");

    document.querySelector('[data-size="50"]').click();
    expect(document.querySelector("#demo-frame").style.getPropertyValue("--demo-width")).toBe("50%");

    const triangle = [...document.querySelectorAll(".svg-map__link")].find((link) => link.getAttribute("aria-label") === "Triangle");
    triangle.dispatchEvent(new dom.window.Event("pointerenter"));
    expect(document.querySelector("#active-region").textContent).toBe("Active region: Triangle (polygon)");

    const toggle = document.querySelector("#show-regions");
    toggle.checked = true;
    toggle.dispatchEvent(new dom.window.Event("change"));
    expect(document.querySelector("#demo").classList.contains("show-regions")).toBe(true);
  });
});
