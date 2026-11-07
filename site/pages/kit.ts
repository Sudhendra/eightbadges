import type { GameData, Starter } from "../lib/data.ts";
import { html, type Markup, raw } from "../lib/html.ts";
import { buildProgress, type Progress } from "../lib/progress.ts";
import { spritePath, SPRITE_SIZE } from "../lib/sprites.ts";

export const REPO_URL = "https://github.com/Sudhendra/eightbadges";
export const SITE_URL = "https://eightbadges.com";
const ICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'%3E%3Cpath fill='%230e9f6e' d='M3 0h2v1h1v1h1v1h1v2H7v1H6v1H5v1H3V7H2V6H1V5H0V3h1V2h1V1h1z'/%3E%3C/svg%3E`;

export type Assets = {
  css: string;
  js: string;
  /** Font files to preload. */
  fonts: string[];
  /** Extra markup for the dev server. Empty in production. */
  devHead: string;
};

export type PageOptions = {
  path: string;
  title: string;
  description: string;
  bodyClass: string;
  starter?: Starter;
  /** Extra CSS for this page only. */
  css?: string;
};

/** Everything a page module needs: the data, shared helpers, and a record of sprites used. */
export type Kit = ReturnType<typeof createKit>;

const SMALL_WORDS = new Set(["of", "the", "and"]);

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function createKit(data: GameData, assets: Assets) {
  const sprites = new Set<number>();
  const progress: Progress = buildProgress(data);
  const sections = new Map(data.world.sections.map((section) => [section.id, section]));
  const mapSection = new Map(data.world.maps.map((map) => [map.id, map.section]));

  const sectionName = (id: string): string => {
    const underwater = /^underwater_(\d+)$/.exec(id);
    if (underwater) return `Underwater, Route ${underwater[1]}`;
    const section = sections.get(id);
    return section ? titleCase(section.name) : titleCase(id.replace(/_/g, " "));
  };

  const sprite = (species: string, options: { size?: number; eager?: boolean; hero?: string } = {}): Markup => {
    const mon = data.species.get(species);
    if (!mon) throw new Error(`Unknown species ${species}`);
    sprites.add(mon.dex);
    const size = options.size ?? SPRITE_SIZE;
    return html`<img class="sprite" src="${spritePath(mon.dex)}" alt="${mon.name}" width="${size}" height="${size}"
      ${options.eager ? raw("") : raw(' loading="lazy" decoding="async"')}
      ${options.hero ? raw(` style="view-transition-name:${options.hero}"`) : raw("")}>`;
  };

  const gems = (mode: "shine" | "scroll"): Markup =>
    html`<span class="gems ${mode}" aria-hidden="true">${Array.from({ length: 8 }, (_, i) =>
      html`<i class="gem" style="--i:${i}"></i>`,
    )}</span>`;

  const nav = (): Markup =>
    html`<nav class="sitenav" aria-label="Site"><a href="/planner/">PLANNER</a><a href="/map/">MAP</a><a href="/pokemon/">POKÉMON</a><a href="/tms/">TMS &amp; HMS</a><a href="/abilities/">ABILITIES</a></nav>`;

  /** A sticky top bar with a way home, for every page except home. */
  const bar = (label: string, extra: Markup | string = ""): Markup =>
    html`<header class="bar"><a href="/" data-home>HOME</a>${extra}<span class="bar-name">${label}</span></header>`;

  const page = (options: PageOptions, body: Markup): string =>
    `<!doctype html>${html`<html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>${options.title}</title>
        <meta name="description" content="${options.description}">
        <link rel="canonical" href="${SITE_URL}${options.path}">
        <meta property="og:title" content="${options.title}">
        <meta property="og:description" content="${options.description}">
        <meta name="color-scheme" content="light dark">
        <link rel="icon" href="${ICON}">
        ${assets.fonts.map((font) => html`<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin>`)}
        <style>${raw(assets.css)}${raw(options.css ?? "")}</style>
        ${raw(assets.devHead)}
        <script type="speculationrules">${raw('{"prerender":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}')}</script>
      </head>
      <body class="${options.bodyClass}" ${options.starter ? raw(`data-starter="${options.starter}"`) : raw("")}>
        ${body}
        <footer class="foot">
          ${nav()}
          <p><button class="sound" type="button" data-sound aria-pressed="false">SOUND: OFF</button>
          <a href="${REPO_URL}">HELP BUILD THIS</a></p>
          <p>A non-commercial fan project. Not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and its sprites belong to them.</p>
        </footer>
        <script>${raw(assets.js)}</script>
      </body>
    </html>`.value}`;

  /** "before ROXANNE", or "before YOUR RIVAL, Route 104" when the title alone is ambiguous. */
  const beforeStop = (index: number | null | undefined): string => {
    if (index === null || index === undefined) return "after the Champion";
    const stop = data.journey[index]!;
    return stop.kind === "rival" || stop.kind === "villain" ? `before ${stop.title}, ${stop.place}` : `before ${stop.title}`;
  };

  const speciesLink = (species: string, label?: string): Markup =>
    html`<a href="/pokemon/${species}/">${label ?? data.species.get(species)!.name}</a>`;

  /** Links to a place's page, or names it plainly when it isn't on the region map (like Marine Cave). */
  const placeLink = (section: string): Markup =>
    sections.has(section) ? html`<a href="/places/${section}/">${sectionName(section)}</a>` : html`<span>${sectionName(section)}</span>`;

  /** Maps without a fixed region (the ferry, the contest halls) get named from their own id. */
  const DYNAMIC_NAMES: [RegExp, string][] = [[/^ss_tidal/, "S.S. Tidal"], [/^contest_hall/, "Contest Hall"], [/^battle_pyramid/, "Battle Pyramid"]];
  const mapPlace = (map: string): { key: string; markup: Markup } => {
    const section = mapSection.get(map) ?? "dynamic";
    if (section !== "dynamic") return { key: section, markup: placeLink(section) };
    const name = DYNAMIC_NAMES.find(([pattern]) => pattern.test(map))?.[1] ?? titleCase(map.replace(/_/g, " "));
    return { key: name, markup: html`<span>${name}</span>` };
  };

  const itemName = (id: string): string => data.items.find((item) => item.id === id)?.name ?? id;

  const moveName = (id: string): string => data.moves.get(id)?.name ?? id;

  return {
    data,
    progress,
    sprites,
    sections,
    mapSection,
    sectionName,
    sprite,
    gems,
    nav,
    bar,
    page,
    beforeStop,
    speciesLink,
    placeLink,
    mapPlace,
    itemName,
    moveName,
    titleCase,
  };
}
