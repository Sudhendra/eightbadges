import { type GameData, type Starter, STARTERS, trainerFor } from "./lib/data.ts";
import { html, type Markup, raw } from "./lib/html.ts";
import { evaluateRoad, type Hit, type StopMatchup, type Verdict } from "./lib/matchups.ts";
import { spritePath, SPRITE_SIZE } from "./lib/sprites.ts";

const REPO_URL = "https://github.com/Sudhendra/eightbadges";
const SITE_URL = "https://eightbadges.com";
const ICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'%3E%3Cpath fill='%230e9f6e' d='M3 0h2v1h1v1h1v1h1v2H7v1H6v1H5v1H3V7H2V6H1V5H0V3h1V2h1V1h1z'/%3E%3C/svg%3E`;

const VERDICT_LABEL: Record<Verdict, string> = { easy: "EASY", fair: "FAIR", tough: "TOUGH" };
const KIND_LABEL: Record<StopMatchup["stop"]["kind"], string> = {
  rival: "RIVAL",
  gym: "GYM",
  villain: "BOSS",
  elite: "ELITE FOUR",
  champion: "CHAMPION",
};

export type Assets = {
  css: string;
  js: string;
  /** Font files to preload. */
  fonts: string[];
  /** Extra markup for the dev server. Empty in production. */
  devHead: string;
};

export type Site = {
  pages: Record<string, string>;
  /** Dex numbers of every sprite the pages use. */
  sprites: Set<number>;
};

function multiplierText(multiplier: number): string {
  if (multiplier === 0.25) return "×¼";
  if (multiplier === 0.5) return "×½";
  return `×${multiplier}`;
}

function moveName(data: GameData, id: string): string {
  return data.moves.get(id)?.name ?? id;
}

export function renderSite(data: GameData, assets: Assets): Site {
  const sprites = new Set<number>();

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

  const page = (options: { path: string; title: string; description: string; bodyClass: string; starter?: Starter }, body: Markup): string =>
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
        <style>${raw(assets.css)}</style>
        ${raw(assets.devHead)}
        <script type="speculationrules">${raw('{"prerender":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}')}</script>
      </head>
      <body class="${options.bodyClass}" ${options.starter ? raw(`data-starter="${options.starter}"`) : raw("")}>
        ${body}
        <footer class="foot">
          <p><button class="sound" type="button" data-sound aria-pressed="false">SOUND: OFF</button>
          <a href="${REPO_URL}">HELP BUILD THIS</a></p>
          <p>A non-commercial fan project. Not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and its sprites belong to them.</p>
        </footer>
        <script>${raw(assets.js)}</script>
      </body>
    </html>`.value}`;

  const strip = (road: StopMatchup[], linked: boolean): Markup =>
    html`<span class="strip" aria-hidden="${linked ? "false" : "true"}">${road.map((stop) =>
      linked
        ? html`<a class="cell ${stop.verdict} ${stop.stop.kind}" href="#${stop.stop.id}" title="${stop.stop.title}, ${stop.stop.place}: ${VERDICT_LABEL[stop.verdict]}"><span class="vh">${stop.stop.title}: ${VERDICT_LABEL[stop.verdict]}</span></a>`
        : html`<i class="cell ${stop.verdict} ${stop.stop.kind}"></i>`,
    )}</span>`;

  const count = (road: StopMatchup[], verdict: Verdict): number => road.filter((stop) => stop.verdict === verdict).length;

  const home = (): string =>
    page(
      {
        path: "/",
        title: "Eight Badges: the best route through Pokémon Emerald",
        description: "Pick your starter and see your whole road to Champion: every gym, rival and boss, and how you match up.",
        bodyClass: "home",
      },
      html`<main>
        <header class="title">
          <h1>EIGHT<br>BADGES</h1>
          ${gems("shine")}
          <p>Pick a starter. See your whole road to Champion.</p>
        </header>
        <nav class="starters" aria-label="Choose your starter">
          ${STARTERS.map((starter) => {
            const road = evaluateRoad(data, starter);
            const mon = data.species.get(starter)!;
            return html`<a class="starter" data-nav data-pick="${starter}" data-starter="${starter}" href="/${starter}/">
              <span class="pick">${sprite(starter, { size: 128, eager: true, hero: `hero-${starter}` })}</span>
              <span class="name">${mon.name}</span>
              ${strip(road, false)}
              <span class="tally">${count(road, "easy")} EASY · ${count(road, "fair")} FAIR · ${count(road, "tough")} TOUGH</span>
            </a>`;
          })}
        </nav>
        <p class="hint">ARROWS to choose. ENTER to go.</p>
      </main>`,
    );

  const hitText = (who: string, hit: Hit | null): Markup =>
    hit
      ? html`<span class="hit ${hit.multiplier > 1 ? "up" : hit.multiplier < 1 ? "down" : ""}">${who}: ${moveName(data, hit.move)} <b>${multiplierText(hit.multiplier)}</b></span>`
      : html`<span class="hit">${who}: no attacks</span>`;

  const stopCard = (entry: StopMatchup, starter: Starter): Markup => {
    const { stop } = entry;
    const stage = data.species.get(entry.stage)!;
    const gymIndex = stop.kind === "gym" ? data.journey.filter((s) => s.kind === "gym").indexOf(stop) : -1;
    return html`<li class="stop ${stop.kind} ${entry.verdict}" id="${stop.id}" ${gymIndex >= 0 ? raw(`style="view-timeline-name:--g${gymIndex}"`) : raw("")}>
      <details>
        <summary data-nav>
          <span class="meta"><span>${KIND_LABEL[stop.kind]} · ${stop.place}</span><span class="verdict">${VERDICT_LABEL[entry.verdict]}</span></span>
          <span class="who">${stop.title}</span>
          ${stop.badge ? html`<span class="reward">${stop.badge}${stop.unlocks ? html` · ${moveName(data, stop.unlocks)} works outside battle` : ""}</span>` : ""}
          <span class="note">${stop.note}</span>
          <span class="team">${trainerFor(data, stop, starter).party.map((mon) =>
            html`<span class="mon">${sprite(mon.species)}<small>Lv${mon.level}</small></span>`,
          )}</span>
          <span class="toggle"></span>
        </summary>
        <div class="more">
          <p class="assume">Your ${stage.name} at Lv ${entry.level}, using only level-up moves:</p>
          <ul class="rows">${entry.mons.map((mon) =>
            html`<li><b class="vs">${data.species.get(mon.species)!.name}</b>${hitText("YOU", mon.you)}${hitText("IT", mon.it)}</li>`,
          )}</ul>
        </div>
      </details>
    </li>`;
  };

  const road = (starter: Starter): string => {
    const entries = evaluateRoad(data, starter);
    const mon = data.species.get(starter)!;
    const line: { id: string; level: number | null }[] = [{ id: starter, level: null }];
    for (let current = mon; current.evolutions[0]; current = data.species.get(current.evolutions[0].to)!) {
      line.push({ id: current.evolutions[0].to, level: Number(current.evolutions[0].param) });
    }
    const others = STARTERS.filter((other) => other !== starter);
    return page(
      {
        path: `/${starter}/`,
        title: `${mon.name}'s road through Pokémon Emerald | Eight Badges`,
        description: `Every gym, rival and boss on ${mon.name}'s road to Champion in Pokémon Emerald, and how it matches up.`,
        bodyClass: "road",
        starter,
      },
      html`<header class="bar"><a href="/" data-home>BACK</a>${gems("scroll")}<span class="bar-name">${mon.name}</span></header>
      <main>
        <header class="hero">
          <div class="line">${line.map((stage, i) =>
            html`${stage.level ? html`<span class="evo">Lv ${stage.level}</span>` : ""}${sprite(stage.id, { size: i === 0 ? 128 : 64, eager: true, ...(i === 0 ? { hero: `hero-${starter}` } : {}) })}`,
          )}</div>
          <h1>${mon.name}'S ROAD</h1>
          <p class="tally">${count(entries, "easy")} EASY · ${count(entries, "fair")} FAIR · ${count(entries, "tough")} TOUGH</p>
          ${strip(entries, true)}
          <p class="method">Rated on type matchups for your starter alone, at the opponent's level. It's a guide, not a battle sim, and your team changes everything. Rival teams shown are May's. Brendan's are the same or nearly so.</p>
        </header>
        <ol class="stops">${entries.map((entry) => stopCard(entry, starter))}</ol>
        <section class="end">
          <h2>CHAMPION</h2>
          ${gems("shine")}
          <p>That's the road. Want a different one?</p>
          <nav class="others">${others.map((other) =>
            html`<a data-nav data-starter="${other}" href="/${other}/">${sprite(other)}<span>${data.species.get(other)!.name}</span></a>`,
          )}</nav>
        </section>
      </main>`,
    );
  };

  const missing = (): string =>
    page(
      { path: "/404", title: "You whited out | Eight Badges", description: "This page doesn't exist.", bodyClass: "lost" },
      html`<main><h1>YOU WHITED OUT</h1><p>There's nothing on this route.</p><p><a data-nav href="/">BACK TO LITTLEROOT</a></p></main>`,
    );

  const pages: Record<string, string> = { "index.html": home(), "404.html": missing() };
  for (const starter of STARTERS) pages[`${starter}/index.html`] = road(starter);
  return { pages, sprites };
}
