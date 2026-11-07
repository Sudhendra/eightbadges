import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { spritePath, spriteSourceUrl } from "./lib/sprites.ts";
import { DEV_FONTS, FONTS, renderAll } from "./render.ts";

const OUT = "dist";
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

function write(path: string, contents: string): void {
  const full = join(OUT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

function copy(from: string, to: string): void {
  const full = join(OUT, to);
  mkdirSync(dirname(full), { recursive: true });
  copyFileSync(from, full);
}

export async function build(options: { dev: boolean }): Promise<void> {
  const site = renderAll(options);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(SPRITE_CACHE, { recursive: true });

  for (const [path, html] of Object.entries(site.pages)) write(path, html);
  write("_headers", HEADERS);

  for (const [to, from] of Object.entries(options.dev ? { ...FONTS, ...DEV_FONTS } : FONTS)) copy(from, to);

  const dexes = [...site.sprites].sort((a, b) => a - b);
  for (let i = 0; i < dexes.length; i += 12) {
    await Promise.all(
      dexes.slice(i, i + 12).map(async (dex) => {
        const from = await cachedSprite(dex);
        copy(from, spritePath(dex));
      }),
    );
  }

  for (const path of Object.keys(site.pages)) {
    const text = readFileSync(join(OUT, path));
    console.log(`${path.padEnd(22)} ${String(text.length).padStart(7)} B  ${String(gzipSync(text, { level: 9 }).length).padStart(6)} B gzip`);
  }
  console.log(`${dexes.length} sprites`);
}

if (import.meta.main) await build({ dev: false });
