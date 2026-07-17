const w = "http://www.w3.org/2000/svg", S = "http://www.w3.org/XML/1998/namespace", b = /* @__PURE__ */ new WeakMap(), h = /* @__PURE__ */ new WeakMap(), N = /* @__PURE__ */ new Set([
  "href",
  "target",
  "download",
  "ping",
  "rel",
  "hreflang",
  "type",
  "referrerpolicy"
]), L = /* @__PURE__ */ new Set(["dir", "lang", "role", "tabindex", "xml:lang"]);
function f(t, e) {
  return t.createElementNS(w, e);
}
function E(t, e, n) {
  const r = n.getAttribute("name") || n.id || "(unnamed)";
  return `area ${t.id ? `#${t.id}` : `at index ${e}`} in map "${r}"`;
}
function d(t, e, n, r) {
  console.warn(`[svg-map] Skipping ${E(t, e, n)}: ${r}.`, t);
}
function D(t, e, n, { limit: r, dropUnpaired: l = !1 } = {}) {
  const s = t.getAttribute("coords");
  if (s == null || s.trim() === "")
    return d(t, e, n, "coordinates are missing or empty"), null;
  let o = s.split(",");
  r && (o = o.slice(0, r)), l && o.length % 2 === 1 && o.pop();
  const i = [];
  for (const c of o) {
    const u = c.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(u) || !Number.isFinite(Number(u)))
      return d(t, e, n, `coordinates contain an invalid number (${JSON.stringify(u)})`), null;
    i.push(Number(u));
  }
  return i;
}
function $(t) {
  const e = (t.getAttribute("shape") || "rect").trim().toLowerCase();
  return ["rect", "circle", "poly", "default"].includes(e) ? e : "rect";
}
function M(t, e, n, r, l) {
  const s = t.ownerDocument, o = $(t);
  let i;
  if (o === "default")
    i = f(s, "rect"), i.setAttribute("x", "0"), i.setAttribute("y", "0"), i.setAttribute("width", String(r)), i.setAttribute("height", String(l));
  else {
    const c = D(t, e, n, {
      limit: o === "rect" ? 4 : o === "circle" ? 3 : void 0,
      dropUnpaired: o === "poly"
    });
    if (!c) return null;
    if (o === "rect") {
      if (c.length < 4)
        return d(t, e, n, "a rectangle needs four coordinates"), null;
      const [u, a, p, A] = c, v = Math.abs(p - u), y = Math.abs(A - a);
      if (v === 0 || y === 0)
        return d(t, e, n, "a rectangle must have positive width and height"), null;
      i = f(s, "rect"), i.setAttribute("x", String(Math.min(u, p))), i.setAttribute("y", String(Math.min(a, A))), i.setAttribute("width", String(v)), i.setAttribute("height", String(y));
    } else if (o === "circle") {
      if (c.length < 3)
        return d(t, e, n, "a circle needs three coordinates"), null;
      const [u, a, p] = c;
      if (p <= 0)
        return d(t, e, n, "a circle must have a positive radius"), null;
      i = f(s, "circle"), i.setAttribute("cx", String(u)), i.setAttribute("cy", String(a)), i.setAttribute("r", String(p));
    } else {
      if (c.length < 6)
        return d(t, e, n, "a polygon needs at least six coordinates"), null;
      i = f(s, "polygon");
      const u = [];
      for (let a = 0; a < c.length; a += 2)
        u.push(`${c[a]},${c[a + 1]}`);
      i.setAttribute("points", u.join(" "));
    }
  }
  return i.classList.add("svg-map__area"), i.setAttribute("fill", "transparent"), i.setAttribute("pointer-events", "all"), i;
}
function T(t) {
  return t === "class" || t === "style" || L.has(t) || t.startsWith("data-") || t.startsWith("aria-") || t.startsWith("on");
}
function g(t, e, n) {
  t.hasAttribute("alt") && e.setAttribute("aria-label", t.getAttribute("alt")), t.id && e.setAttribute("data-svg-map-source-id", t.id);
  for (const r of t.attributes) {
    const l = r.name.toLowerCase();
    if (!(l === "id" || l === "alt" || l === "title"))
      if (l === "class")
        for (const s of r.value.split(/\s+/).filter(Boolean)) e.classList.add(s);
      else (n && N.has(l) || T(l)) && (l === "xml:lang" ? e.setAttributeNS(S, l, r.value) : e.setAttribute(l, r.value));
  }
}
function x(t, e, n, r, l) {
  const s = M(t, e, n, r, l);
  if (!s) return null;
  if (t.hasAttribute("title")) {
    const i = f(t.ownerDocument, "title");
    i.textContent = t.getAttribute("title"), s.prepend(i);
  }
  if (!t.hasAttribute("href"))
    return g(t, s, !1), s;
  const o = f(t.ownerDocument, "a");
  return o.classList.add("svg-map__link"), g(t, o, !0), o.append(s), o;
}
function I(t) {
  const e = Number(t.getAttribute("width")), n = Number(t.getAttribute("height"));
  return e > 0 && n > 0 && Number.isFinite(e) && Number.isFinite(n) ? { width: e, height: n } : null;
}
function m(t) {
  return t.naturalWidth > 0 && t.naturalHeight > 0 ? { width: t.naturalWidth, height: t.naturalHeight } : null;
}
function _(t) {
  const e = I(t) || m(t);
  return e ? Promise.resolve(e) : t.complete ? Promise.resolve(null) : new Promise((n) => {
    const r = () => {
      t.removeEventListener("load", l), t.removeEventListener("error", s);
    }, l = () => {
      r(), n(m(t));
    }, s = () => {
      r(), n(null);
    };
    t.addEventListener("load", l, { once: !0 }), t.addEventListener("error", s, { once: !0 });
    const o = m(t);
    o && (r(), n(o));
  });
}
function B(t) {
  var r;
  const e = (r = t.getAttribute("usemap")) == null ? void 0 : r.trim();
  if (!e || !e.startsWith("#") || e.length === 1) return null;
  const n = e.slice(1);
  try {
    return decodeURIComponent(n);
  } catch {
    return n;
  }
}
function P(t) {
  const e = B(t);
  return e && Array.from(t.ownerDocument.getElementsByTagName("map")).find(
    (n) => n.getAttribute("name") === e
  ) || null;
}
function W(t, e) {
  const r = t.ownerDocument.createElement("span");
  r.className = "svg-map", r.style.position = "relative", r.style.display = "inline-block", r.style.lineHeight = "0", e.classList.add("svg-map__overlay"), e.setAttribute("preserveAspectRatio", "none"), e.setAttribute("width", "100%"), e.setAttribute("height", "100%"), e.style.position = "absolute", e.style.inset = "0", e.style.pointerEvents = "none", t.parentNode && t.parentNode.insertBefore(r, t), r.append(t, e);
}
async function C(t) {
  if (!t || t.nodeType !== 1 || t.localName !== "img")
    return console.warn("[svg-map] convertImageMap expected an <img> element.", t), null;
  if (!t.hasAttribute("usemap")) return null;
  const e = P(t);
  if (!e)
    return console.warn(`[svg-map] No matching <map> found for usemap=${JSON.stringify(t.getAttribute("usemap"))}.`, t), null;
  const n = await _(t);
  if (!n)
    return console.warn("[svg-map] Image dimensions could not be determined; leaving its native image map active.", t), null;
  const r = f(t.ownerDocument, "svg");
  r.setAttribute("viewBox", `0 0 ${n.width} ${n.height}`);
  const s = Array.from(e.querySelectorAll("area")).map((o, i) => x(o, i, e, n.width, n.height)).filter(Boolean).reverse();
  return s.length === 0 ? (console.warn("[svg-map] The matching map has no valid regions; leaving its native image map active.", e), null) : (r.append(...s), W(t, r), t.removeAttribute("usemap"), b.set(t, r), r);
}
function k(t) {
  if (b.has(t)) return Promise.resolve(b.get(t));
  if (h.has(t)) return h.get(t);
  const e = C(t).finally(() => h.delete(t));
  return t && (typeof t == "object" || typeof t == "function") && h.set(t, e), e;
}
async function F(t = document) {
  const e = [];
  return t && t.nodeType === 1 && t.matches("img[usemap]") && e.push(t), t && typeof t.querySelectorAll == "function" && e.push(...t.querySelectorAll("img[usemap]")), (await Promise.all(e.map(k))).filter(Boolean);
}
function G(t) {
  return t.readyState !== "loading" ? Promise.resolve() : new Promise((e) => t.addEventListener("DOMContentLoaded", e, { once: !0 }));
}
async function O(t = document) {
  const e = t.nodeType === 9 ? t : t.ownerDocument;
  return e && await G(e), F(t);
}
export {
  F as convertAll,
  k as convertImageMap,
  O as init
};
