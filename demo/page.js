const demo = document.querySelector("#demo");
const frame = document.querySelector("#demo-frame");
const output = document.querySelector("#active-region");

function describe(link) {
  output.textContent = `Active region: ${link.getAttribute("aria-label")} (${link.dataset.shape})`;
}

globalThis.SVGMap.init().then(() => {
  const links = demo.querySelectorAll(".svg-map__link");
  links.forEach((link) => {
    link.addEventListener("pointerenter", () => describe(link));
    link.addEventListener("focus", () => describe(link));
    link.addEventListener("click", () => describe(link));
  });
});

document.querySelectorAll("[data-size]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-size]").forEach((item) => item.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
    frame.style.setProperty("--demo-width", `${button.dataset.size}%`);
  });
});

document.querySelector("#show-regions").addEventListener("change", (event) => {
  demo.classList.toggle("show-regions", event.target.checked);
});
