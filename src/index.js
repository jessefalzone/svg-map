const SVG_NS = "http://www.w3.org/2000/svg";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

const convertedImages = new WeakMap();
const pendingConversions = new WeakMap();

const LINK_ATTRIBUTES = new Set([
  "href",
  "target",
  "download",
  "ping",
  "rel",
  "hreflang",
  "type",
  "referrerpolicy",
]);

const GLOBAL_ATTRIBUTES = new Set(["dir", "lang", "role", "tabindex", "xml:lang"]);

function createSVGElement(document, name) {
  return document.createElementNS(SVG_NS, name);
}

function describeArea(area, index, map) {
  const mapName = map.getAttribute("name") || map.id || "(unnamed)";
  const areaId = area.id ? `#${area.id}` : `at index ${index}`;
  return `area ${areaId} in map \"${mapName}\"`;
}

function warn(area, index, map, message) {
  console.warn(`[svg-map] Skipping ${describeArea(area, index, map)}: ${message}.`, area);
}

function parseCoordinates(area, index, map, { limit, dropUnpaired = false } = {}) {
  const value = area.getAttribute("coords");
  if (value == null || value.trim() === "") {
    warn(area, index, map, "coordinates are missing or empty");
    return null;
  }

  let parts = value.split(",");
  if (limit) parts = parts.slice(0, limit);
  if (dropUnpaired && parts.length % 2 === 1) parts.pop();
  const coordinates = [];
  for (const part of parts) {
    const token = part.trim();
    const floatingPointNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    if (!floatingPointNumber.test(token) || !Number.isFinite(Number(token))) {
      warn(area, index, map, `coordinates contain an invalid number (${JSON.stringify(token)})`);
      return null;
    }
    coordinates.push(Number(token));
  }
  return coordinates;
}

function normalizedShape(area) {
  const shape = (area.getAttribute("shape") || "rect").trim().toLowerCase();
  return ["rect", "circle", "poly", "default"].includes(shape) ? shape : "rect";
}

function buildGeometry(area, index, map, width, height) {
  const document = area.ownerDocument;
  const shape = normalizedShape(area);
  let geometry;

  if (shape === "default") {
    geometry = createSVGElement(document, "rect");
    geometry.setAttribute("x", "0");
    geometry.setAttribute("y", "0");
    geometry.setAttribute("width", String(width));
    geometry.setAttribute("height", String(height));
  } else {
    const coordinates = parseCoordinates(area, index, map, {
      limit: shape === "rect" ? 4 : shape === "circle" ? 3 : undefined,
      dropUnpaired: shape === "poly",
    });
    if (!coordinates) return null;

    if (shape === "rect") {
      if (coordinates.length < 4) {
        warn(area, index, map, "a rectangle needs four coordinates");
        return null;
      }
      const [x1, y1, x2, y2] = coordinates;
      const rectWidth = Math.abs(x2 - x1);
      const rectHeight = Math.abs(y2 - y1);
      if (rectWidth === 0 || rectHeight === 0) {
        warn(area, index, map, "a rectangle must have positive width and height");
        return null;
      }
      geometry = createSVGElement(document, "rect");
      geometry.setAttribute("x", String(Math.min(x1, x2)));
      geometry.setAttribute("y", String(Math.min(y1, y2)));
      geometry.setAttribute("width", String(rectWidth));
      geometry.setAttribute("height", String(rectHeight));
    } else if (shape === "circle") {
      if (coordinates.length < 3) {
        warn(area, index, map, "a circle needs three coordinates");
        return null;
      }
      const [cx, cy, radius] = coordinates;
      if (radius <= 0) {
        warn(area, index, map, "a circle must have a positive radius");
        return null;
      }
      geometry = createSVGElement(document, "circle");
      geometry.setAttribute("cx", String(cx));
      geometry.setAttribute("cy", String(cy));
      geometry.setAttribute("r", String(radius));
    } else {
      if (coordinates.length < 6) {
        warn(area, index, map, "a polygon needs at least six coordinates");
        return null;
      }
      geometry = createSVGElement(document, "polygon");
      const points = [];
      for (let point = 0; point < coordinates.length; point += 2) {
        points.push(`${coordinates[point]},${coordinates[point + 1]}`);
      }
      geometry.setAttribute("points", points.join(" "));
    }
  }

  geometry.classList.add("svg-map__area");
  geometry.setAttribute("fill", "transparent");
  geometry.setAttribute("pointer-events", "all");
  return geometry;
}

function isTransferableGlobalAttribute(name) {
  return (
    name === "class" ||
    name === "style" ||
    GLOBAL_ATTRIBUTES.has(name) ||
    name.startsWith("data-") ||
    name.startsWith("aria-") ||
    name.startsWith("on")
  );
}

function transferAttributes(area, target, includeLinkAttributes) {
  if (area.hasAttribute("alt")) target.setAttribute("aria-label", area.getAttribute("alt"));
  if (area.id) target.setAttribute("data-svg-map-source-id", area.id);

  for (const attribute of area.attributes) {
    const name = attribute.name.toLowerCase();
    if (name === "id" || name === "alt" || name === "title") continue;
    if (name === "class") {
      for (const className of attribute.value.split(/\s+/).filter(Boolean)) target.classList.add(className);
    } else if ((includeLinkAttributes && LINK_ATTRIBUTES.has(name)) || isTransferableGlobalAttribute(name)) {
      if (name === "xml:lang") target.setAttributeNS(XML_NS, name, attribute.value);
      else target.setAttribute(name, attribute.value);
    }
  }
}

function buildRegion(area, index, map, width, height) {
  const geometry = buildGeometry(area, index, map, width, height);
  if (!geometry) return null;

  if (area.hasAttribute("title")) {
    const title = createSVGElement(area.ownerDocument, "title");
    title.textContent = area.getAttribute("title");
    geometry.prepend(title);
  }

  if (!area.hasAttribute("href")) {
    transferAttributes(area, geometry, false);
    return geometry;
  }

  const link = createSVGElement(area.ownerDocument, "a");
  link.classList.add("svg-map__link");
  transferAttributes(area, link, true);
  link.append(geometry);
  return link;
}

function explicitDimensions(image) {
  const width = Number(image.getAttribute("width"));
  const height = Number(image.getAttribute("height"));
  return width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)
    ? { width, height }
    : null;
}

function intrinsicDimensions(image) {
  return image.naturalWidth > 0 && image.naturalHeight > 0
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : null;
}

function waitForDimensions(image) {
  const dimensions = explicitDimensions(image) || intrinsicDimensions(image);
  if (dimensions) return Promise.resolve(dimensions);
  if (image.complete) return Promise.resolve(null);

  return new Promise((resolve) => {
    const finish = () => {
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };
    const onLoad = () => {
      finish();
      resolve(intrinsicDimensions(image));
    };
    const onError = () => {
      finish();
      resolve(null);
    };
    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
    const racedDimensions = intrinsicDimensions(image);
    if (racedDimensions) {
      finish();
      resolve(racedDimensions);
    }
  });
}

function mapNameFromUsemap(image) {
  const usemap = image.getAttribute("usemap")?.trim();
  if (!usemap || !usemap.startsWith("#") || usemap.length === 1) return null;
  const name = usemap.slice(1);
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function findMap(image) {
  const name = mapNameFromUsemap(image);
  if (!name) return null;
  return Array.from(image.ownerDocument.getElementsByTagName("map")).find(
    (map) => map.getAttribute("name") === name,
  ) || null;
}

function installOverlay(image, svg) {
  const document = image.ownerDocument;
  const wrapper = document.createElement("span");
  wrapper.className = "svg-map";
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";
  wrapper.style.lineHeight = "0";

  svg.classList.add("svg-map__overlay");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.pointerEvents = "none";

  if (image.parentNode) image.parentNode.insertBefore(wrapper, image);
  wrapper.append(image, svg);
}

async function performConversion(image) {
  if (!image || image.nodeType !== 1 || image.localName !== "img") {
    console.warn("[svg-map] convertImageMap expected an <img> element.", image);
    return null;
  }
  if (!image.hasAttribute("usemap")) return null;

  const map = findMap(image);
  if (!map) {
    console.warn(`[svg-map] No matching <map> found for usemap=${JSON.stringify(image.getAttribute("usemap"))}.`, image);
    return null;
  }

  const dimensions = await waitForDimensions(image);
  if (!dimensions) {
    console.warn("[svg-map] Image dimensions could not be determined; leaving its native image map active.", image);
    return null;
  }

  const svg = createSVGElement(image.ownerDocument, "svg");
  svg.setAttribute("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`);

  const areas = Array.from(map.querySelectorAll("area"));
  const regions = areas
    .map((area, index) => buildRegion(area, index, map, dimensions.width, dimensions.height))
    .filter(Boolean)
    .reverse();

  if (regions.length === 0) {
    console.warn("[svg-map] The matching map has no valid regions; leaving its native image map active.", map);
    return null;
  }

  svg.append(...regions);
  installOverlay(image, svg);
  image.removeAttribute("usemap");
  convertedImages.set(image, svg);
  return svg;
}

/** Convert one image map, resolving after image dimensions are available. */
export function convertImageMap(image) {
  if (convertedImages.has(image)) return Promise.resolve(convertedImages.get(image));
  if (pendingConversions.has(image)) return pendingConversions.get(image);
  const conversion = performConversion(image).finally(() => pendingConversions.delete(image));
  if (image && (typeof image === "object" || typeof image === "function")) {
    pendingConversions.set(image, conversion);
  }
  return conversion;
}

/** Convert every img[usemap] in root. */
export async function convertAll(root = document) {
  const images = [];
  if (root && root.nodeType === 1 && root.matches("img[usemap]")) images.push(root);
  if (root && typeof root.querySelectorAll === "function") {
    images.push(...root.querySelectorAll("img[usemap]"));
  }
  const results = await Promise.all(images.map(convertImageMap));
  return results.filter(Boolean);
}

function ready(document) {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
}

/** Wait for DOM readiness, then convert images within root. */
export async function init(root = document) {
  const ownerDocument = root.nodeType === 9 ? root : root.ownerDocument;
  if (ownerDocument) await ready(ownerDocument);
  return convertAll(root);
}
