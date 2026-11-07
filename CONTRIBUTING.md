# Contributing to Eight Badges

Thanks for being here! Whether you've spotted a wrong note or want to build a whole feature, help is welcome. Be kind to each other: everyone here is doing this for the love of the games.

## The easiest way to help

Spot something wrong on the site? You can [report it](https://github.com/Sudhendra/eightbadges/issues/new/choose) without touching any code.

Comfortable editing a file? The story lives in two plain JSON files, and the tests catch most mistakes:

- [`content/emerald/journey.json`](content/emerald/journey.json) holds every fight on the road, in order. Each stop also lists the areas and tools (rods, Surf and so on) that open up before it. Foresight, the map and every "open before" label come from those lists.
- [`content/emerald/forks.json`](content/emerald/forks.json) holds one-time choices, like the Root or Claw fossil.

## Get it running

You need [Node 22.18 or newer](https://nodejs.org) and [pnpm](https://pnpm.io).

```bash
pnpm install
```

```bash
pnpm dev
```

Then open <http://localhost:4321>. On the dev site, press **F** to try other font pairings.

The dev server restarts when files in `site/` or `content/` change, but you need to refresh the browser yourself.

## Find your way around

| Path | What's in it | Edit by hand? |
|---|---|---|
| `content/emerald/` | The story path, what each stop opens, and one-time choices | Yes |
| `site/pages/` | One file per kind of page: road, Pokémon, map, places, TMs | Yes |
| `site/lib/` | Matchups, story progress, and Foresight's picks | Yes |
| `site/style.css`, `site/client.js` | All the styling and the little bit of JS | Yes |
| `pipeline/` | Extracts game data from the decomp | Yes |
| `data/emerald/` | Generated game data | No, run `pnpm data` |

## Before you open a pull request

```bash
pnpm typecheck
```

```bash
pnpm data:fetch
```

```bash
pnpm test
```

`pnpm data:fetch` only needs to run once. It downloads the decomp's text files, so tests can confirm the committed data is current. CI runs all of this on every pull request.

## Project rules

### Keep Nintendo's work out of the repo

This rule keeps the project alive, so we can't make exceptions:

- **No ROMs, save states or emulator BIOS files**, and no links to them.
- **No sprites, tilesets, music or other game assets committed to git.** The build fetches sprites when it runs, and all of that goes through [`site/lib/sprites.ts`](site/lib/sprites.ts).
- **No copied game text**, such as dialogue or item, move and Pokédex descriptions. Facts like stats are fine, and names are fine. Write notes in your own words.
- **No text copied from other guides or wikis.** Check facts against them, then write it yourself.
- **Nothing commercial:** no ads, affiliate links, paid features or sponsorships.

### Keep it fast and fun

How the site feels matters more than how many features it has.

- **Size budgets are real.** Tests fail if a page or data file gets too big. Don't raise a budget without explaining why in your pull request.
- **No new runtime dependencies** without talking it through first. Pages use no framework and only a little hand-written JS.
- **Pages must work without JavaScript.** JS adds polish, like keyboard play and sound.
- **Check phone width and dark mode** before you call a UI change done.

### Keep the data honest

- **The game is the source of truth.** Game data comes from [pret/pokeemerald](https://github.com/pret/pokeemerald) at the commit pinned in `pipeline/config.ts`.
- **Never edit `data/emerald/` by hand.** Fix the extractor instead.
- **Where the game and other sources disagree, the game wins.** Differences from Pokémon Showdown are listed in `pipeline/test/crosscheck.test.ts`.
- **Add a test when you fix a data bug**, so it stays fixed.

## Good first projects

- Check a road against your own playthrough and report anything that feels wrong.
- Know an area opens earlier than the site says? Move it to the right stop in `journey.json`. We open areas late when unsure, so this is common.
- Add a missing story fight to `journey.json`, such as Tabitha at Mt. Chimney.
- Improve a stop's note. Accurate, short and funny is the goal.
- Write short, original descriptions for abilities. We can't copy the game's, so the abilities page doesn't have any yet.

See [project decisions](docs/decisions.md) for known gaps and bigger ideas. For anything large, please open an issue first, so we can agree on the approach before you spend time on it.

## License

By contributing, you agree that your work is released under the project's [MIT license](LICENSE).
