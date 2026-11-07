import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { build, outDir } from "./build.ts";

const PORT = 4321;
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".css": "text/css",
};

await build({ dev: true });
const ROOT = outDir(true);

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let path = join(ROOT, normalize(decodeURIComponent(url.pathname)));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  const found = existsSync(path);
  if (!found) path = join(ROOT, "404.html");
  response.writeHead(found ? 200 : 404, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(response);
}).listen(PORT, () => console.log(`Eight Badges: http://localhost:${PORT}. Press F in the browser to try fonts.`));
