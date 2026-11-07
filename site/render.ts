import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { loadGameData } from "./lib/data.ts";
import { type Assets, renderSite, type Site } from "./pages.ts";

export const FONTS = {
  "/f/silkscreen-700-v5.woff2": "node_modules/@fontsource/silkscreen/files/silkscreen-latin-700-normal.woff2",
  "/f/vt323-v5.woff2": "node_modules/@fontsource/vt323/files/vt323-latin-400-normal.woff2",
};

/** Fonts to try out while designing. Only the dev server loads these. */
export const DEV_FONTS = {
  "/f/press-start.woff2": "node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2",
  "/f/pixelify-700.woff2": "node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2",
};

function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

function minifyJs(js: string): string {
  return js
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** Dev only: press F to cycle font pairs on the real pages. */
const DEV_HEAD = `<style>
@font-face{font-family:"Press Start 2P";src:url("/f/press-start.woff2")}
@font-face{font-family:"Pixelify Sans";font-weight:700;src:url("/f/pixelify-700.woff2")}
</style><script>
(() => {
  const pairs = [
    ["Silkscreen", "VT323"],
    ["Press Start 2P", "VT323"],
    ["Pixelify Sans", "VT323"],
    ["Silkscreen", "system-ui"],
  ];
  let i = Number(new URLSearchParams(location.search).get("font") ?? localStorage.getItem("devfont") ?? 0);
  const apply = () => {
    const [display, body] = pairs[i % pairs.length];
    document.documentElement.style.setProperty("--display", JSON.stringify(display));
    document.documentElement.style.setProperty("--body", JSON.stringify(body));
    localStorage.setItem("devfont", i);
    document.title = display + " + " + body;
  };
  apply();
  addEventListener("keydown", (e) => { if (e.key === "f") { i++; apply(); } });
})();
</script>`;

export function renderAll(options: { dev: boolean }): Site {
  const assets: Assets = {
    css: minifyCss(readFileSync("site/style.css", "utf8")),
    js: minifyJs(readFileSync("site/client.js", "utf8")),
    fonts: Object.keys(FONTS),
    devHead: options.dev ? DEV_HEAD : "",
  };
  const site = renderSite(loadGameData(), assets);
  // The browser runs the same engine as the build, with types stripped. No bundler needed.
  site.files["planner/engine.js"] = stripTypeScriptTypes(readFileSync("shared/engine.ts", "utf8"));
  site.files["planner/app.js"] = readFileSync("site/planner.js", "utf8");
  return site;
}
