import { type GameData, STARTERS } from "./lib/data.ts";
import { html } from "./lib/html.ts";
import { renderHome } from "./pages/home.ts";
import { type Assets, createKit } from "./pages/kit.ts";
import { renderMap, renderPlace } from "./pages/map.ts";
import { renderPokemon, renderPokemonIndex } from "./pages/pokemon.ts";
import { renderAbilities, renderMachines } from "./pages/reference.ts";
import { renderRoad } from "./pages/road.ts";

export type { Assets };

export type Site = {
  pages: Record<string, string>;
  /** Dex numbers of every sprite the pages use. */
  sprites: Set<number>;
};

export function renderSite(data: GameData, assets: Assets): Site {
  const kit = createKit(data, assets);
  const pages: Record<string, string> = {
    "index.html": renderHome(kit),
    "404.html": kit.page(
      { path: "/404", title: "You whited out | Eight Badges", description: "This page doesn't exist.", bodyClass: "lost" },
      html`<main><h1>YOU WHITED OUT</h1><p>There's nothing on this route.</p><p><a data-nav href="/">BACK TO LITTLEROOT</a></p></main>`,
    ),
    "map/index.html": renderMap(kit),
    "pokemon/index.html": renderPokemonIndex(kit),
    "tms/index.html": renderMachines(kit),
    "abilities/index.html": renderAbilities(kit),
  };
  for (const starter of STARTERS) pages[`${starter}/index.html`] = renderRoad(kit, starter);
  for (const species of data.species.keys()) pages[`pokemon/${species}/index.html`] = renderPokemon(kit, species);
  for (const section of data.world.sections) pages[`places/${section.id}/index.html`] = renderPlace(kit, section.id);
  return { pages, sprites: kit.sprites };
}
