import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { spritePath, spriteSourceUrl } from "./lib/sprites.ts";
import { DEV_FONTS, FONTS, renderAll } from "./render.ts";

const SPRITE_CACHE = ".cache/sprites";
const PNG_SIGNATURE = "89504e470d0a1a0a";

const HEADERS = `/f/*
  Cache-Control: public, max-age=31536000, immutable
/s/*
  Cache-Control: public, max-age=31536000, immutable
`;

async function cachedSprite(dex: number): Promise<string> {
  const path = join(SPRITE_CACHE, `${dex}.png`);
  if (existsSync(path)) return path;
  const response = await fetch(spriteSourceUrl(dex));
  if (!response.ok) throw new Error(`Sprite ${dex}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) throw new Error(`Sprite ${dex} is not a PNG`);
  writeFileSync(path, bytes);
  return path;
}

function write(out: string, path: string, contents: string): void {
  const full = join(out, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

function copy(out: string, from: string, to: string): void {
  const full = join(out, to);
  mkdirSync(dirname(full), { recursive: true });
  copyFileSync(from, full);
}

/** Production builds go to dist/. The dev server builds to its own folder so the two never collide. */
export const outDir = (dev: boolean): string => (dev ? ".cache/dev-site" : "dist");

export async function build(options: { dev: boolean }): Promise<void> {
  const OUT = outDir(options.dev);
  const site = renderAll(options);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(SPRITE_CACHE, { recursive: true });

  for (const [path, html] of Object.entries(site.pages)) write(OUT, path, html);
  write(OUT, "_headers", HEADERS);

  for (const [to, from] of Object.entries(options.dev ? { ...FONTS, ...DEV_FONTS } : FONTS)) copy(OUT, from, to);

  const dexes = [...site.sprites].sort((a, b) => a - b);
  for (let i = 0; i < dexes.length; i += 12) {
    await Promise.all(
      dexes.slice(i, i + 12).map(async (dex) => {
        const from = await cachedSprite(dex);
        copy(OUT, from, spritePath(dex));
      }),
    );
  }

  const sizes = Object.keys(site.pages).map((path) => ({ path, gzip: gzipSync(readFileSync(join(OUT, path)), { level: 9 }).length }));
  const largest = sizes.sort((a, b) => b.gzip - a.gzip).slice(0, 3).map((page) => `${page.path} ${page.gzip} B`).join(", ");
  console.log(`${sizes.length} pages, ${dexes.length} sprites. Largest gzipped: ${largest}`);
}

if (import.meta.main) await build({ dev: false });
